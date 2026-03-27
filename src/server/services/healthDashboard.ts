// ============================================================
// LegacyLens — Codebase health & tech debt dashboard
// ============================================================

import { prisma } from '../trpc.js';
import type { ArchitectureGraph } from '../../types/index.js';

export interface HealthDashboard {
  duplicateSuggestions: string[];
  deadOrUnusedFiles: { filePath: string }[];
  complexityHotspots: { filePath: string; linesOfCode: number; dependentsCount: number; riskLevel: string }[];
  outdatedOrVulnerableSummary: string | null;
  filesWithNoTestsCount: number;
  techDebtScore: number; // 0–100, higher = more debt
}

/**
 * Build health dashboard: dead code from graph, complexity from files, placeholder duplicates.
 */
export async function getHealthDashboard(
  projectId: string,
  options: {
    vulnerableDepsCount?: number;
    filesWithNoTestsCount?: number;
  } = {}
): Promise<HealthDashboard> {
  const [files, project] = await Promise.all([
    prisma.file.findMany({
      where: { projectId },
      select: {
        filePath: true,
        linesOfCode: true,
        dependentsCount: true,
        riskLevel: true,
        isEntryPoint: true,
      },
    }),
    prisma.project.findFirst({
      where: { id: projectId },
      select: { architectureJson: true },
    }),
  ]);

  const graph = project?.architectureJson as ArchitectureGraph | null;
  const edges = (graph?.edges || []) as { source: string; target: string }[];
  const targets = new Set(edges.map((e) => e.target));
  const entryPoints = new Set(files.filter((f) => f.isEntryPoint).map((f) => f.filePath));

  const deadOrUnusedFiles: { filePath: string }[] = [];
  for (const f of files) {
    const hasIncoming = targets.has(f.filePath);
    if (!hasIncoming && !entryPoints.has(f.filePath)) {
      deadOrUnusedFiles.push({ filePath: f.filePath });
    }
  }

  const complexityHotspots = files
    .filter((f) => f.linesOfCode > 0 || f.dependentsCount > 0)
    .map((f) => ({
      filePath: f.filePath,
      linesOfCode: f.linesOfCode,
      dependentsCount: f.dependentsCount,
      riskLevel: f.riskLevel,
    }))
    .sort((a, b) => b.linesOfCode * (b.dependentsCount + 1) - a.linesOfCode * (a.dependentsCount + 1))
    .slice(0, 20);

  const filesWithNoTestsCount =
    options.filesWithNoTestsCount ?? (await import('./testCoverage.js').then((m) => m.getFilesWithNoTests(projectId))).length;

  const vulnCount = options.vulnerableDepsCount ?? 0;
  const duplicateSuggestions: string[] = [];
  // Duplicate detection would use embeddings; placeholder
  duplicateSuggestions.push('Run duplicate detection (e.g. jscpd or similar) for detailed duplicate report.');

  let techDebtScore = 0;
  if (files.length > 0) {
    const deadRatio = deadOrUnusedFiles.length / files.length;
    const noTestRatio = filesWithNoTestsCount / files.length;
    techDebtScore = Math.min(
      100,
      Math.round(
        deadRatio * 30 + noTestRatio * 25 + (vulnCount > 0 ? 20 : 0) + (complexityHotspots.length > 10 ? 15 : 0)
      )
    );
  }

  return {
    duplicateSuggestions,
    deadOrUnusedFiles,
    complexityHotspots,
    outdatedOrVulnerableSummary:
      vulnCount > 0 ? `${vulnCount} vulnerable dependency(ies). Run Security tab for details.` : null,
    filesWithNoTestsCount,
    techDebtScore,
  };
}
