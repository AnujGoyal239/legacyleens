// ============================================================
// LegacyLens — Codebase Health Score Computation
// ============================================================

import { logger } from '../trpc.js';

interface FileData {
  filePath: string;
  fileType: string;
  linesOfCode: number;
  riskLevel: string;
  dependentsCount: number;
  dependenciesCount: number;
  isEntryPoint: boolean;
  functions: unknown;
  classes: unknown;
  imports: unknown;
}

interface HealthScoreResult {
  overallScore: number;
  docCoverageScore: number;
  criticalFileRiskScore: number;
  complexityScore: number;
  onboardingReadiness: number;
}

/**
 * Documentation Coverage (30% weight)
 * Checks % of functions/classes that have docstrings-like definitions
 * Uses AST parsed data from File model
 */
function computeDocCoverage(files: FileData[]): number {
  let totalSymbols = 0;
  let documentedSymbols = 0;

  for (const file of files) {
    const fns = Array.isArray(file.functions) ? file.functions : [];
    const cls = Array.isArray(file.classes) ? file.classes : [];

    totalSymbols += fns.length + cls.length;

    // Heuristic: if a function/class object has a 'doc' or 'description' field, or if
    // the file has more comments relative to code, count it as documented
    for (const fn of fns) {
      if (
        fn &&
        typeof fn === 'object' &&
        ((fn as Record<string, unknown>).doc ||
          (fn as Record<string, unknown>).description ||
          (fn as Record<string, unknown>).comment)
      ) {
        documentedSymbols++;
      }
    }
    for (const cl of cls) {
      if (
        cl &&
        typeof cl === 'object' &&
        ((cl as Record<string, unknown>).doc ||
          (cl as Record<string, unknown>).description ||
          (cl as Record<string, unknown>).comment)
      ) {
        documentedSymbols++;
      }
    }
  }

  if (totalSymbols === 0) {
    // No functions/classes parsed — give moderate score
    return 50;
  }

  const ratio = documentedSymbols / totalSymbols;
  return Math.round(Math.min(100, ratio * 100));
}

/**
 * Critical File Risk (25% weight)
 * Proportion of high-dependency files (5+ dependents) that lack documentation
 */
function computeCriticalFileRisk(files: FileData[]): number {
  const criticalFiles = files.filter((f) => f.dependentsCount >= 5);

  if (criticalFiles.length === 0) {
    // No critical files — great!
    return 100;
  }

  let wellDocumented = 0;
  for (const file of criticalFiles) {
    const fns = Array.isArray(file.functions) ? file.functions : [];
    const cls = Array.isArray(file.classes) ? file.classes : [];
    const hasAnySymbol = fns.length > 0 || cls.length > 0;

    if (hasAnySymbol) {
      // Check if at least some are documented
      const allSymbols = [...fns, ...cls];
      const documented = allSymbols.filter(
        (s) =>
          s &&
          typeof s === 'object' &&
          ((s as Record<string, unknown>).doc ||
            (s as Record<string, unknown>).description)
      );
      if (documented.length >= allSymbols.length * 0.3) {
        wellDocumented++;
      }
    }
  }

  // Invert: higher score = less risk
  const riskRatio = 1 - wellDocumented / criticalFiles.length;
  // Lower risk = higher score
  return Math.round(Math.max(0, (1 - riskRatio * 0.8) * 100));
}

/**
 * Code Complexity (25% weight)
 * Approximate from nesting depth and lines per function
 */
function computeComplexity(files: FileData[]): number {
  if (files.length === 0) return 50;

  let totalComplexity = 0;
  let fileCount = 0;

  for (const file of files) {
    const fns = Array.isArray(file.functions) ? file.functions as Array<Record<string, unknown>> : [];

    if (fns.length === 0) {
      // Estimate from lines of code — larger files tend to be more complex
      if (file.linesOfCode > 500) totalComplexity += 0.8;
      else if (file.linesOfCode > 200) totalComplexity += 0.5;
      else if (file.linesOfCode > 100) totalComplexity += 0.3;
      else totalComplexity += 0.1;
    } else {
      // Estimate from function length
      for (const fn of fns) {
        const start = typeof fn.lineStart === 'number' ? fn.lineStart : 0;
        const end = typeof fn.lineEnd === 'number' ? fn.lineEnd : start;
        const fnLength = end - start;

        if (fnLength > 100) totalComplexity += 0.9;
        else if (fnLength > 50) totalComplexity += 0.6;
        else if (fnLength > 20) totalComplexity += 0.3;
        else totalComplexity += 0.1;
      }
    }
    fileCount++;
  }

  const avgComplexity = totalComplexity / Math.max(1, fileCount);
  // Lower complexity = higher score
  const score = Math.round((1 - Math.min(1, avgComplexity)) * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * Onboarding Readiness (20% weight)
 * Heuristic: checks for README, index/entry files, clear folder structure
 */
function computeOnboardingReadiness(
  files: FileData[],
  entryPoints: string[]
): number {
  let score = 0;

  // Check for README
  const hasReadme = files.some((f) =>
    f.filePath.toLowerCase().match(/readme\.(md|txt|rst)$/i)
  );
  if (hasReadme) score += 30;

  // Check for entry points
  if (entryPoints.length > 0) score += 20;

  // Check for index files (good organization signal)
  const indexFiles = files.filter((f) =>
    f.filePath.match(/\/(index|main|app)\.(ts|tsx|js|jsx|py)$/i)
  );
  if (indexFiles.length > 0) score += 15;
  if (indexFiles.length >= 3) score += 10;

  // Check for clear folder structure  
  const uniqueDirs = new Set(
    files.map((f) => {
      const parts = f.filePath.split('/');
      return parts.length > 1 ? parts[0] : '';
    })
  );
  if (uniqueDirs.size >= 3) score += 15;

  // Bonus for having package.json or requirements.txt (setup instructions)
  const hasSetup = files.some((f) =>
    f.filePath.match(/(package\.json|requirements\.txt|Makefile|Dockerfile)/i)
  );
  if (hasSetup) score += 10;

  return Math.min(100, score);
}

/**
 * Exported for property-based testing
 */
export function computeWeightedScore(
  docCoverage: number,
  criticalRisk: number,
  complexity: number,
  onboarding: number
): number {
  const raw = Math.round(docCoverage * 0.3 + criticalRisk * 0.25 + complexity * 0.25 + onboarding * 0.2);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Compute the overall Codebase Health Score
 */
export function computeHealthScore(
  files: FileData[],
  entryPoints: string[]
): HealthScoreResult {
  const docCoverageScore = computeDocCoverage(files);
  const criticalFileRiskScore = computeCriticalFileRisk(files);
  const complexityScore = computeComplexity(files);
  const onboardingReadiness = computeOnboardingReadiness(files, entryPoints);

  // Weighted average
  const overallScore = Math.round(
    docCoverageScore * 0.3 +
      criticalFileRiskScore * 0.25 +
      complexityScore * 0.25 +
      onboardingReadiness * 0.2
  );

  logger.info(
    {
      overallScore,
      docCoverageScore,
      criticalFileRiskScore,
      complexityScore,
      onboardingReadiness,
    },
    'Health score computed'
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    docCoverageScore,
    criticalFileRiskScore,
    complexityScore,
    onboardingReadiness,
  };
}
