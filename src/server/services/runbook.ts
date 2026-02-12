// ============================================================
// LegacyLens — Runbook / Config Detection Service (on-demand)
// ============================================================

import type { PrismaClient } from '@prisma/client';
import { logger } from '../trpc.js';

export interface DetectedRunbook {
  rollbackSteps: string;
  hotfixSteps: string;
  signals: string[];
}

export interface EnvVarUsage {
  name: string;
  files: string[];
}

function hasAny(paths: Set<string>, candidates: string[]): boolean {
  return candidates.some((c) => paths.has(c));
}

function hasPrefix(paths: Set<string>, prefix: string): boolean {
  for (const p of paths) if (p.startsWith(prefix)) return true;
  return false;
}

export async function detectRunbookFromIndexedFiles(
  prisma: PrismaClient,
  projectId: string
): Promise<DetectedRunbook> {
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { filePath: true },
  });
  const pathSet = new Set(files.map((f) => f.filePath));
  const signals: string[] = [];

  const hasDockerfile = Array.from(pathSet).some((p) => p.toLowerCase().endsWith('dockerfile'));
  const hasCompose = hasAny(pathSet, ['docker-compose.yml', 'docker-compose.yaml']);
  const hasGitHubActions = hasPrefix(pathSet, '.github/workflows/');
  const hasK8s = hasPrefix(pathSet, 'k8s/') || hasPrefix(pathSet, 'kubernetes/') || hasPrefix(pathSet, 'helm/');
  const hasScripts = hasPrefix(pathSet, 'scripts/') || hasPrefix(pathSet, 'bin/');
  const hasFly = hasAny(pathSet, ['fly.toml']);

  if (hasDockerfile) signals.push('Dockerfile detected');
  if (hasCompose) signals.push('docker-compose detected');
  if (hasGitHubActions) signals.push('GitHub Actions workflows detected');
  if (hasK8s) signals.push('Kubernetes/Helm manifests detected');
  if (hasScripts) signals.push('scripts/ or bin/ detected');
  if (hasFly) signals.push('fly.toml detected');

  // Keep this pragmatic: safe generic steps with repo-specific signals.
  const rollbackSteps: string[] = [];
  const hotfixSteps: string[] = [];

  rollbackSteps.push('1) Identify the last known good release / commit.');
  rollbackSteps.push('2) Roll back deployment to that release.');
  rollbackSteps.push('3) Verify health checks and key user flows.');
  rollbackSteps.push('4) If rollback fails, mitigate by disabling the failing feature flag or route (if available).');

  hotfixSteps.push('1) Reproduce the issue quickly (logs/stack trace) and isolate the smallest fix.');
  hotfixSteps.push('2) Run targeted checks (type-check/tests for the affected area).');
  hotfixSteps.push('3) Build and deploy a hotfix in the smallest scope possible.');
  hotfixSteps.push('4) Monitor error rate and latency; prepare a rollback if metrics regress.');

  if (hasCompose) {
    rollbackSteps.push('');
    rollbackSteps.push('Compose hint: if you deploy via Docker Compose, rollback is often “deploy previous image tag” then `docker compose up -d`.');
  }
  if (hasK8s) {
    rollbackSteps.push('');
    rollbackSteps.push('K8s hint: use `kubectl rollout undo deployment/<name>` and confirm `kubectl rollout status`.');
  }
  if (hasFly) {
    rollbackSteps.push('');
    rollbackSteps.push('Fly.io hint: use `fly releases list` then `fly releases rollback <version>`.');
  }
  if (hasGitHubActions) {
    hotfixSteps.push('');
    hotfixSteps.push('CI hint: check the latest GitHub Actions run for failing steps and artifacts.');
  }

  return {
    rollbackSteps: rollbackSteps.join('\n'),
    hotfixSteps: hotfixSteps.join('\n'),
    signals,
  };
}

export function extractEnvVarsFromText(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;

  // process.env.FOO
  const dotRe = /\bprocess\.env\.([A-Z0-9_]{2,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = dotRe.exec(text)) !== null) out.add(m[1]);

  // process.env['FOO'] / process.env[\"FOO\"]
  const bracketRe = /\bprocess\.env\[['"]([A-Z0-9_]{2,})['"]\]/g;
  while ((m = bracketRe.exec(text)) !== null) out.add(m[1]);

  return out;
}

export async function detectEnvVarsFromEmbeddings(
  prisma: PrismaClient,
  projectId: string
): Promise<EnvVarUsage[]> {
  // Use stored embedding content for on-demand scanning (no re-clone).
  // Note: content is truncated when stored; this is “best effort”.
  const rows = await prisma.embedding.findMany({
    where: {
      projectId,
      type: { in: ['file'] },
      content: { contains: 'process.env' },
    },
    select: { filePath: true, content: true },
    take: 500,
  });

  const usage = new Map<string, Set<string>>();
  for (const r of rows) {
    const filePath = r.filePath ?? 'unknown';
    const vars = extractEnvVarsFromText(r.content ?? '');
    for (const v of vars) {
      if (!usage.has(v)) usage.set(v, new Set());
      usage.get(v)!.add(filePath);
    }
  }

  const result: EnvVarUsage[] = Array.from(usage.entries())
    .map(([name, files]) => ({ name, files: Array.from(files).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  logger.info({ projectId, envVarCount: result.length }, 'Env var detection complete');
  return result;
}
