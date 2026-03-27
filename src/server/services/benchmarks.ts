// ============================================================
// LegacyLens — Benchmark Runner Service (MVP)
// Runs deterministic benchmark suites against current RAG+LLM pipeline
// ============================================================

import { logger } from '../trpc.js';
import { searchCode } from './search.js';
import { generateAnswer } from './llm.js';

export type BenchmarkRunnerOptions = {
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  aiTestMode?: boolean;
};

function normalize(s: string) {
  return s.toLowerCase();
}

function includesAny(haystack: string, needles: string[]) {
  const h = normalize(haystack);
  const matched: string[] = [];
  for (const n of needles) {
    const nn = n.trim();
    if (!nn) continue;
    if (h.includes(normalize(nn))) matched.push(nn);
  }
  return matched;
}

function matchFilePaths(answer: string, expectedFilePaths: string[]) {
  const a = normalize(answer);
  const matched: string[] = [];
  for (const p of expectedFilePaths) {
    const pp = p.trim();
    if (!pp) continue;
    // match either full path or basename
    const base = pp.split('/').pop() || pp;
    if (a.includes(normalize(pp)) || a.includes(normalize(base))) matched.push(pp);
  }
  return matched;
}

export async function runBenchmarkSuite(
  prisma: any,
  suiteId: string,
  userId: string,
  options: BenchmarkRunnerOptions = {}
) {
  const suite = await prisma.benchmarkSuite.findUnique({
    where: { id: suiteId },
    include: { cases: true },
  });

  if (!suite) throw new Error('Benchmark suite not found');

  const run = await prisma.benchmarkRun.create({
    data: {
      suiteId,
      userId,
      modelName: options.modelName || null,
      temperature: options.temperature ?? null,
      maxTokens: options.maxTokens ?? null,
      aiTestMode: !!options.aiTestMode,
      status: 'running',
      startedAt: new Date(),
      totalCases: suite.cases.length,
    },
  });

  let passedCases = 0;
  let totalScore = 0;
  let totalLatencyMs = 0;

  for (const c of suite.cases) {
    const started = Date.now();
    let answerText = '';
    try {
      const context = await searchCode(c.prompt, suite.projectId, 12);
      const answer = await generateAnswer(c.prompt, context);
      answerText = answer.text;
    } catch (err) {
      answerText = `Error generating answer: ${err instanceof Error ? err.message : String(err)}`;
    }
    const latencyMs = Date.now() - started;
    totalLatencyMs += latencyMs;

    const matchedKeywords = includesAny(answerText, c.expectedKeywords ?? []);
    const matchedFilePaths = matchFilePaths(answerText, c.expectedFilePaths ?? []);

    // Simple scoring: 50% keywords, 50% file paths
    const keywordScore =
      (c.expectedKeywords?.length ?? 0) === 0
        ? 1
        : matchedKeywords.length / Math.max(1, c.expectedKeywords.length);
    const fileScore =
      (c.expectedFilePaths?.length ?? 0) === 0
        ? 1
        : matchedFilePaths.length / Math.max(1, c.expectedFilePaths.length);
    const score = Math.max(0, Math.min(1, 0.5 * keywordScore + 0.5 * fileScore));

    const passed = score >= (c.minScore ?? 0.6);
    if (passed) passedCases++;
    totalScore += score;

    await prisma.benchmarkResult.upsert({
      where: { runId_caseId: { runId: run.id, caseId: c.id } },
      create: {
        runId: run.id,
        caseId: c.id,
        score,
        passed,
        latencyMs,
        answerText,
        matchedKeywords,
        matchedFilePaths,
      },
      update: {
        score,
        passed,
        latencyMs,
        answerText,
        matchedKeywords,
        matchedFilePaths,
      },
    });
  }

  const averageScore = suite.cases.length ? totalScore / suite.cases.length : 0;

  const finished = await prisma.benchmarkRun.update({
    where: { id: run.id },
    data: {
      status: 'complete',
      finishedAt: new Date(),
      passedCases,
      averageScore,
      totalLatencyMs,
    },
    include: {
      results: {
        include: {
          case: true,
        },
      },
      suite: true,
    },
  });

  logger.info(
    { suiteId, runId: run.id, passedCases, totalCases: suite.cases.length, averageScore },
    'Benchmark suite run complete'
  );

  return finished;
}

