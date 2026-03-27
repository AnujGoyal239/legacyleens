// ============================================================
// LegacyLens — Incident / DevOps Helper Service
// ============================================================

import type { PrismaClient } from '@prisma/client';
import { logger } from '../trpc.js';
import { searchCode } from './search.js';
import { generateAnswer } from './llm.js';
import type { ArchitectureGraph, GraphEdge } from '../../types/index.js';
import type { SearchResult } from '../../types/index.js';

// -----------------------------------------------
// Stack trace parsing (failure fingerprint)
// -----------------------------------------------

export interface StackFrame {
  filePath?: string;
  line?: number;
  message?: string;
  raw?: string;
}

/**
 * Parse a stack trace or error message and extract file paths and line numbers.
 * Handles common formats: "at file.ts:10:5", "at /path/to/file.js:42", "(file.ts:10)"
 */
export function parseStackTrace(text: string): StackFrame[] {
  const frames: StackFrame[] = [];
  if (!text?.trim()) return frames;

  // Match: "at path/to/file.ts:line:col" or "at path/to/file.ts:line" or "(file.ts:line)"
  const re = /(?:\s+at\s+|\s*\()([^(]+?):(\d+)(?::(\d+))?\)?/g;
  const lines = text.split('\n');

  for (const line of lines) {
    let m = re.exec(line);
    if (m) {
      const rawPath = m[1].trim();
      // Normalize Windows backslashes and strip leading slash
      const filePath = rawPath.replace(/\\/g, '/').replace(/^\//, '');
      const lineNum = parseInt(m[2], 10);
      const col = m[3] ? parseInt(m[3], 10) : undefined;
      frames.push({
        filePath: filePath || undefined,
        line: lineNum,
        message: undefined,
        raw: line.trim(),
      });
    }
  }

  // Also try single-line pattern: "Error: message at file:line"
  const singleLineRe = /([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+):(\d+)/g;
  let match;
  while ((match = singleLineRe.exec(text)) !== null) {
    const filePath = match[1].replace(/\\/g, '/');
    const lineNum = parseInt(match[2], 10);
    if (!frames.some((f) => f.filePath === filePath && f.line === lineNum)) {
      frames.push({ filePath, line: lineNum, raw: match[0] });
    }
  }

  return frames;
}

// -----------------------------------------------
// Blast radius from architecture graph
// -----------------------------------------------

/**
 * Given the architecture graph (nodes + edges), return all file paths that
 * depend on the given filePath (i.e. edges where target === filePath).
 */
export function getBlastRadiusFromGraph(
  graph: ArchitectureGraph | null,
  filePath: string
): string[] {
  if (!graph?.edges?.length) return [];
  const dependents = new Set<string>();
  const normalizedTarget = filePath.replace(/\\/g, '/');
  for (const edge of graph.edges as GraphEdge[]) {
    const target = (edge.target || '').replace(/\\/g, '/');
    if (target === normalizedTarget && edge.source) {
      dependents.add((edge.source as string).replace(/\\/g, '/'));
    }
  }
  return Array.from(dependents);
}

// -----------------------------------------------
// Recent changes (from Commit model)
// -----------------------------------------------

export interface RecentCommit {
  commitHash: string;
  message: string;
  author: string;
  committedAt: Date;
  filesChanged: string[];
  summary?: string | null;
}

/**
 * Get recent commits for a project, optionally filtered by file path.
 */
export async function getRecentChangesForFile(
  prisma: PrismaClient,
  projectId: string,
  options: { filePath?: string; limit?: number } = {}
): Promise<RecentCommit[]> {
  const limit = options.limit ?? 20;
  const where: { projectId: string; filesChanged?: { has: string } } = {
    projectId,
  };
  if (options.filePath) {
    where.filesChanged = { has: options.filePath };
  }
  const commits = await prisma.commit.findMany({
    where,
    orderBy: { committedAt: 'desc' },
    take: limit,
    select: {
      commitHash: true,
      message: true,
      author: true,
      committedAt: true,
      filesChanged: true,
      summary: true,
    } as { commitHash: true; message: true; author: true; committedAt: true; filesChanged: true; summary: true },
  });
  return commits as RecentCommit[];
}

// -----------------------------------------------
// Incident context (search + optional runbook)
// -----------------------------------------------

export interface IncidentContextResult {
  searchResults: SearchResult[];
  stackFrames: StackFrame[];
  runbookText?: string;
}

/**
 * Assemble incident context: search for relevant code, parse stack trace,
 * optionally generate a short runbook via LLM.
 */
export async function getIncidentContext(
  projectId: string,
  errorMessage: string,
  options: { includeRunbook?: boolean } = {}
): Promise<IncidentContextResult> {
  const stackFrames = parseStackTrace(errorMessage);
  const query = errorMessage.trim().slice(0, 500);
  const searchResults = await searchCode(query, projectId, 8);

  let runbookText: string | undefined;
  if (options.includeRunbook && searchResults.length > 0) {
    try {
      const runbookQuestion = `This error or message occurred in production. Based ONLY on the code context below, suggest a very short runbook (3-5 steps) for an on-call engineer: 1) Where to look first (file/area), 2) What to check (e.g. config, connection), 3) Optional: rollback or mitigation. Be concise and actionable.`;
      const answer = await generateAnswer(runbookQuestion, searchResults);
      runbookText = answer.text;
    } catch (err) {
      logger.warn({ err, projectId }, 'Incident runbook generation failed');
    }
  }

  return {
    searchResults,
    stackFrames,
    runbookText,
  };
}

// -----------------------------------------------
// Safe change suggestion (minimal fix set + warning)
// -----------------------------------------------

export interface SafeChangeSuggestion {
  suggestedFiles: { filePath: string; score: number }[];
  hint: string;
  warning?: string;
}

/**
 * Suggest minimal set of files to change for a bug, with blast-radius warning.
 */
export async function getSafeChangeSuggestion(
  projectId: string,
  bugDescription: string,
  searchResults: SearchResult[],
  blastRadiusByFile: Record<string, string[]>
): Promise<SafeChangeSuggestion> {
  const fileList = searchResults.slice(0, 6).map((r) => ({ filePath: r.filePath, score: r.score }));
  const highImpact: string[] = [];
  for (const f of fileList) {
    const dependents = blastRadiusByFile[f.filePath];
    if (dependents?.length >= 3) {
      highImpact.push(`${f.filePath} (${dependents.length} dependents)`);
    }
  }
  const warning =
    highImpact.length > 0
      ? `High impact: changing these files affects many others: ${highImpact.join('; ')}. Prefer minimal changes.`
      : undefined;

  try {
    const question = `A developer wants to fix this bug with the SMALLEST possible code change. Bug: "${bugDescription}". Based on the code context, list 1-3 files they should focus on first (by path), and one short sentence of advice. Do not suggest changing unrelated areas.`;
    const answer = await generateAnswer(question, searchResults);
    return {
      suggestedFiles: fileList,
      hint: answer.text,
      warning,
    };
  } catch (err) {
    logger.warn({ err, projectId }, 'Safe change suggestion failed');
    return {
      suggestedFiles: fileList,
      hint: 'Review the relevant files above and limit changes to the minimal set that fixes the bug.',
      warning,
    };
  }
}

// -----------------------------------------------
// Incident replay (call path from stack trace)
// -----------------------------------------------

export interface CallPathStep {
  filePath: string;
  line?: number;
  isFailure: boolean;
  index: number;
  raw?: string;
}

/**
 * Reconstruct call path from a stack trace: entry → ... → failure.
 * Matches stack frame paths to project files (by suffix or exact match).
 */
export async function getCallPathFromStackTrace(
  prisma: PrismaClient,
  projectId: string,
  stackTraceText: string
): Promise<CallPathStep[]> {
  const frames = parseStackTrace(stackTraceText);
  if (frames.length === 0) return [];

  const projectFiles = await prisma.file.findMany({
    where: { projectId },
    select: { filePath: true },
  });
  const pathSet = new Set(projectFiles.map((f) => f.filePath.replace(/\\/g, '/')));
  const pathList = Array.from(pathSet);

  function matchToProjectPath(framePath: string): string | null {
    const normalized = framePath.replace(/\\/g, '/').replace(/^\//, '');
    if (pathSet.has(normalized)) return normalized;
    // Ends-with match (e.g. "src/server/auth.ts" in stack vs "server/auth.ts" in repo)
    for (const p of pathList) {
      if (normalized === p || normalized.endsWith('/' + p) || p.endsWith('/' + normalized)) return p;
    }
    // Last resort: use frame path as-is if it contains a known segment
    const segments = normalized.split('/');
    for (let i = 0; i < segments.length; i++) {
      const suffix = segments.slice(i).join('/');
      if (pathSet.has(suffix)) return suffix;
    }
    return null;
  }

  const steps: CallPathStep[] = [];
  // Stack: index 0 = top (failure), last = entry. We want path entry → failure, so reverse.
  const ordered = [...frames].reverse();
  let index = 0;
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    const filePath = f.filePath ? matchToProjectPath(f.filePath) : null;
    const resolvedPath = filePath ?? f.filePath ?? 'unknown';
    steps.push({
      filePath: resolvedPath,
      line: f.line,
      isFailure: i === ordered.length - 1,
      index: index++,
      raw: f.raw,
    });
  }

  logger.info({ projectId, stepCount: steps.length }, 'Call path from stack trace');
  return steps;
}
