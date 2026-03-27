// ============================================================
// LegacyLens — Refactor & abstraction suggestions (extract, pattern, rename, split)
// ============================================================

import Groq from 'groq-sdk';
import { prisma, logger } from '../trpc.js';
import { searchCode } from './search.js';
import type { ArchitectureGraph } from '../../types/index.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Find references to a symbol (file path or symbol name) using graph + search.
 */
export async function findReferences(
  projectId: string,
  filePath: string,
  symbol?: string
): Promise<{ filePath: string; snippet?: string }[]> {
  const graph = await prisma.project.findFirst({
    where: { id: projectId },
    select: { architectureJson: true },
  }).then((p) => p?.architectureJson as ArchitectureGraph | null);

  const edges = (graph?.edges || []) as { source: string; target: string }[];
  const referrers = edges.filter((e) => e.target === filePath).map((e) => e.source);

  const out: { filePath: string; snippet?: string }[] = referrers.map((f) => ({ filePath: f }));

  if (symbol) {
    const query = `${symbol} import from ${filePath.split('/').pop()}`;
    const searchResults = await searchCode(query, projectId, 10);
    for (const r of searchResults) {
      if (!out.some((o) => o.filePath === r.filePath)) {
        out.push({ filePath: r.filePath, snippet: r.content?.slice(0, 120) });
      }
    }
  }

  return out;
}

/**
 * Suggest how to extract selected code into a helper (LLM).
 */
export async function suggestExtract(
  projectId: string,
  filePath: string,
  selection: string
): Promise<string> {
  const context = await searchCode(filePath + ' ' + selection.slice(0, 200), projectId, 3);
  const contextText = context.map((c) => `${c.filePath}:\n${c.content}`).join('\n\n');

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a refactoring assistant. Suggest how to extract the selected code into a reusable function or module. Be concise, use markdown.' },
      {
        role: 'user',
        content: `File: ${filePath}\nSelected code:\n\`\`\`\n${selection.slice(0, 2000)}\n\`\`\`\n\nRelevant context:\n${contextText}\n\nSuggest: 1) Where to put the extracted code (file name). 2) Function signature and name. 3) How to replace the original with a call.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content?.trim() || 'No suggestion generated.';
}

/**
 * Suggest how to split a large file (LLM with file list).
 */
export async function suggestSplit(
  projectId: string,
  filePath: string
): Promise<string> {
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { filePath: true, linesOfCode: true },
  });
  const target = files.find((f) => f.filePath === filePath);
  const loc = target?.linesOfCode ?? 0;
  const similar = files.filter((f) => f.filePath !== filePath).slice(0, 20);

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a refactoring assistant. Suggest how to split a large file into smaller modules. Be concise, use markdown.' },
      {
        role: 'user',
        content: `File: ${filePath} (${loc} LOC). Suggest: 1) Logical groupings (e.g. by feature or layer). 2) New file names. 3) What to move where. 4) How to avoid circular dependencies.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content?.trim() || 'No suggestion generated.';
}

/**
 * Suggest a shared helper for a pattern (placeholder: use RAG + LLM in UI).
 */
export async function suggestSharedHelper(
  projectId: string,
  patternDescription: string
): Promise<string> {
  const results = await searchCode(patternDescription, projectId, 5);
  const context = results.map((r) => `${r.filePath}:\n${r.content}`).join('\n\n');

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a refactoring assistant. Suggest a shared helper or utility for the described pattern. Be concise, use markdown.' },
      {
        role: 'user',
        content: `Pattern: ${patternDescription}\n\nCode snippets that may match:\n${context}\n\nSuggest: 1) A shared function/utility name and signature. 2) Where to put it. 3) How to use it in the shown places.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content?.trim() || 'No suggestion generated.';
}
