// ============================================================
// LegacyLens — AI "fix it" / PR drafts (suggest edits, optional GitHub PR)
// ============================================================

import Groq from 'groq-sdk';
import { logger } from '../trpc.js';
import { searchCode } from './search.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Suggest edits for an instruction (e.g. "Add error handling to all Redis calls").
 */
export async function suggestFixes(
  projectId: string,
  instruction: string
): Promise<{ summary: string; edits: { filePath: string; suggestion: string }[] }> {
  const results = await searchCode(instruction, projectId, 15);
  const context = results
    .map((r) => `File: ${r.filePath}\n${r.content}`)
    .join('\n---\n');

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a code assistant. Given an instruction and code context, output a short summary and then a list of file-specific suggestions. Format: "Summary: ..." then "File: path\nSuggestion: ..." for each file. Use markdown.',
      },
      {
        role: 'user',
        content: `Instruction: ${instruction}\n\nRelevant code:\n${context}\n\nProvide a summary and concrete edit suggestions per file.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const text = completion.choices[0]?.message?.content?.trim() || '';
  const summary = text.includes('Summary:') ? text.slice(text.indexOf('Summary:') + 9, text.indexOf('\n\n') > 0 ? text.indexOf('\n\n') : text.length).trim() : text.slice(0, 300);
  const edits: { filePath: string; suggestion: string }[] = [];
  const fileBlocks = text.split(/(?=File:\s*)/i);
  for (const block of fileBlocks) {
    const pathMatch = block.match(/File:\s*([^\n]+)/);
    const suggMatch = block.match(/Suggestion:\s*([\s\S]*?)(?=File:\s*|$)/i);
    if (pathMatch && suggMatch) {
      edits.push({ filePath: pathMatch[1].trim(), suggestion: suggMatch[1].trim() });
    }
  }

  return { summary, edits };
}

/**
 * Create a PR via GitHub API (branch + commit + PR).
 */
export async function createPrDraft(
  projectId: string,
  branch: string,
  title: string,
  body: string,
  changes: Array<{ filePath: string; content: string; operation?: 'create' | 'update' | 'delete' }>,
  prisma: any
): Promise<{ success: boolean; message: string; prUrl?: string; prNumber?: number }> {
  try {
    // Get project with GitHub info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        githubUrl: true,
        githubPat: true,
        defaultBranch: true,
        repoOwner: true,
        repoName: true,
      },
    });

    if (!project || !project.githubUrl) {
      return {
        success: false,
        message: 'Project does not have a GitHub repository connected.',
      };
    }

    const owner = project.repoOwner;
    const repo = project.repoName;
    const pat = project.githubPat;

    if (!owner || !repo) {
      return {
        success: false,
        message: 'Could not determine repository owner/name. Please reconnect the GitHub repository.',
      };
    }

    if (!pat) {
      return {
        success: false,
        message: 'GitHub Personal Access Token required for PR creation. Please add it in project settings.',
      };
    }

    // Import here to avoid circular dependency
    const { createGitHubPR } = await import('./githubPr.js');

    const result = await createGitHubPR(
      owner,
      repo,
      project.defaultBranch || 'main',
      branch,
      title,
      body,
      changes.map((c) => ({
        filePath: c.filePath,
        content: c.content,
        operation: c.operation || 'update',
      })),
      pat
    );

    logger.info({ projectId, prUrl: result.prUrl, prNumber: result.prNumber }, 'GitHub PR created successfully');

    return {
      success: true,
      message: `Pull Request created successfully!`,
      prUrl: result.prUrl,
      prNumber: result.prNumber,
    };
  } catch (error) {
    logger.error({ projectId, error }, 'Failed to create GitHub PR');
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create PR. Please check your GitHub token permissions.',
    };
  }
}
