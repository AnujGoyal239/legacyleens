// ============================================================
// LegacyLens — Test coverage & gaps (which tests cover file, files with no tests)
// ============================================================

import { prisma } from '../trpc.js';

const TEST_DIR_PATTERNS = ['__tests__', 'test', 'tests', 'spec', 'specs', '.test.', '.spec.'];
const TEST_EXTENSIONS = ['.test.', '.spec.'];

function baseName(filePath: string): string {
  const last = filePath.split('/').pop() || filePath;
  const dot = last.lastIndexOf('.');
  return dot > 0 ? last.slice(0, dot) : last;
}

function pathWithoutExt(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot > 0 ? filePath.slice(0, lastDot) : filePath;
}

function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (TEST_EXTENSIONS.some((e) => lower.includes(e))) return true;
  const parts = filePath.split('/');
  return parts.some((p) => TEST_DIR_PATTERNS.includes(p) || p.startsWith('__tests__'));
}

/**
 * Which test files "cover" this file (by convention: same base name or path).
 */
export async function getTestsForFile(
  projectId: string,
  filePath: string
): Promise<{ filePath: string }[]> {
  const allFiles = await prisma.file.findMany({
    where: { projectId },
    select: { filePath: true },
  });

  const base = baseName(filePath);
  const sourcePathNoExt = pathWithoutExt(filePath);
  const out: { filePath: string }[] = [];

  for (const f of allFiles) {
    const p = f.filePath;
    if (!isTestFile(p)) continue;
    const testBase = baseName(p);
    const testPathNoExt = pathWithoutExt(p);
    // Same base name (e.g. utils.ts <-> utils.test.ts)
    if (testBase === base || testBase.startsWith(base + '.') || testBase.startsWith(base + '_')) {
      out.push({ filePath: p });
      continue;
    }
    // Test path mirrors source (e.g. src/utils.ts -> __tests__/utils.test.ts)
    if (testPathNoExt.endsWith(base) || testPathNoExt.endsWith('/' + base)) {
      out.push({ filePath: p });
    }
  }

  return out;
}

/**
 * Production files that have no corresponding test file.
 */
export async function getFilesWithNoTests(projectId: string): Promise<{ filePath: string }[]> {
  const allFiles = await prisma.file.findMany({
    where: { projectId },
    select: { filePath: true },
  });

  const testFiles = new Set(allFiles.filter((f) => isTestFile(f.filePath)).map((f) => f.filePath));
  const productionFiles = allFiles.filter((f) => !testFiles.has(f.filePath));

  const noTest: { filePath: string }[] = [];
  for (const f of productionFiles) {
    const base = baseName(f.filePath);
    const hasTest = allFiles.some((t) => {
      if (!isTestFile(t.filePath)) return false;
      const tb = baseName(t.filePath);
      return tb === base || tb.startsWith(base + '.') || tb.startsWith(base + '_');
    });
    if (!hasTest) noTest.push({ filePath: f.filePath });
  }

  return noTest;
}
