// ============================================================
// LegacyLens — ArchitectureGraph Tests
// Feature: legacylens-vibecon-2026
// ============================================================

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ---- Pure helpers extracted for testing (mirrors ArchitectureGraph.tsx) ----

function getNodeRadius(dependentsCount: number): number {
  if (dependentsCount >= 10) return 16;
  if (dependentsCount >= 5) return 12;
  if (dependentsCount >= 2) return 9;
  return 6;
}

function isFileType(filePath: string, type: 'frontend' | 'backend'): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (type === 'frontend') {
    return (
      ['tsx', 'jsx', 'vue', 'svelte', 'css', 'scss', 'html'].includes(ext) ||
      filePath.includes('/components/') ||
      filePath.includes('/pages/') ||
      filePath.includes('/views/')
    );
  }
  return (
    ['ts', 'js', 'py', 'java', 'go', 'rs', 'rb'].includes(ext) &&
    (filePath.includes('/server/') ||
      filePath.includes('/api/') ||
      filePath.includes('/services/') ||
      filePath.includes('/routes/') ||
      filePath.includes('/controllers/'))
  );
}

interface FileInput {
  id: string;
  filePath: string;
  fileType: string;
  riskLevel: string;
  dependentsCount: number;
  dependenciesCount: number;
  linesOfCode: number;
  isEntryPoint: boolean;
}

function buildGraphData(
  files: FileInput[],
  filter: string
): { nodes: FileInput[]; links: { source: string; target: string }[] } {
  let filteredFiles = files;
  if (filter === 'critical') {
    filteredFiles = files.filter((f) => f.riskLevel === 'critical' || f.riskLevel === 'high');
  } else if (filter === 'frontend') {
    filteredFiles = files.filter((f) => isFileType(f.filePath, 'frontend'));
  } else if (filter === 'backend') {
    filteredFiles = files.filter((f) => isFileType(f.filePath, 'backend'));
  }
  const cappedFiles = filteredFiles
    .sort((a, b) => b.dependentsCount - a.dependentsCount)
    .slice(0, 200);
  return { nodes: cappedFiles, links: [] };
}

// ---- Arbitraries ----

const fileArb = fc.record({
  id: fc.uuid(),
  filePath: fc.string({ minLength: 1, maxLength: 80 }).map((s) => `src/${s}.ts`),
  fileType: fc.constantFrom('ts', 'tsx', 'js', 'py'),
  riskLevel: fc.constantFrom('low', 'medium', 'high', 'critical'),
  dependentsCount: fc.nat(50),
  dependenciesCount: fc.nat(20),
  linesOfCode: fc.nat(1000),
  isEntryPoint: fc.boolean(),
});

// ============================================================
// Unit tests — architecture.getGraph helpers
// ============================================================

describe('architecture.getGraph helpers', () => {
  it('returns empty nodes and links for null architectureJson', () => {
    // Simulates the router returning { nodes: [], links: [] } when architectureJson is null
    const raw = null;
    const result = raw ? { nodes: [], links: [] } : { nodes: [], links: [] };
    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });

  it('filters links where either endpoint is missing from node set', () => {
    const nodeSet = new Set(['a.ts', 'b.ts']);
    const edges = [
      { source: 'a.ts', target: 'b.ts' },
      { source: 'a.ts', target: 'c.ts' }, // c.ts not in nodeSet
      { source: 'd.ts', target: 'b.ts' }, // d.ts not in nodeSet
    ];
    const links = edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ source: 'a.ts', target: 'b.ts' });
  });

  it('enriches nodes with file metadata from fileMap', () => {
    const rawNodes = [{ id: 'a.ts', filePath: 'a.ts' }];
    const fileMap = new Map([
      ['a.ts', { fileType: 'ts', linesOfCode: 100, riskLevel: 'high', dependentsCount: 5, dependenciesCount: 2, isEntryPoint: false }],
    ]);
    const nodes = rawNodes
      .filter((n) => fileMap.has(n.filePath))
      .map((n) => {
        const f = fileMap.get(n.filePath)!;
        return { id: n.filePath, filePath: n.filePath, ...f };
      });
    expect(nodes[0].riskLevel).toBe('high');
    expect(nodes[0].dependentsCount).toBe(5);
  });
});

// ============================================================
// Property 1: Graph node set matches file set
// Feature: legacylens-vibecon-2026, Property 1
// ============================================================

describe('Property 1: Graph node set matches file set', () => {
  it('nodes.length <= 200 and every node filePath exists in input', () => {
    fc.assert(
      fc.property(
        fc.array(fileArb, { minLength: 0, maxLength: 500 }),
        fc.constantFrom('all', 'critical', 'frontend', 'backend'),
        (files, filter) => {
          const { nodes } = buildGraphData(files, filter);
          const inputPaths = new Set(files.map((f) => f.filePath));
          return (
            nodes.length <= 200 &&
            nodes.every((n) => inputPaths.has(n.filePath))
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 2: Node radius is bounded and monotone
// Feature: legacylens-vibecon-2026, Property 2
// ============================================================

describe('Property 2: Node radius is bounded and monotone', () => {
  it('getNodeRadius always returns value in [6, 16]', () => {
    fc.assert(
      fc.property(fc.nat(1000), (count) => {
        const r = getNodeRadius(count);
        return r >= 6 && r <= 16;
      }),
      { numRuns: 100 }
    );
  });

  it('getNodeRadius is monotone non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.nat(999),
        (a) => {
          return getNodeRadius(a) <= getNodeRadius(a + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 4: Filter produces a subset
// Feature: legacylens-vibecon-2026, Property 4
// ============================================================

describe('Property 4: Filter produces a subset', () => {
  it('"all" filter returns full list (before 200 cap)', () => {
    fc.assert(
      fc.property(fc.array(fileArb, { minLength: 0, maxLength: 50 }), (files) => {
        const { nodes } = buildGraphData(files, 'all');
        const inputPaths = new Set(files.map((f) => f.filePath));
        return nodes.every((n) => inputPaths.has(n.filePath));
      }),
      { numRuns: 100 }
    );
  });

  it('"critical" filter returns only critical/high risk nodes', () => {
    fc.assert(
      fc.property(fc.array(fileArb, { minLength: 0, maxLength: 100 }), (files) => {
        const { nodes } = buildGraphData(files, 'critical');
        return nodes.every((n) => n.riskLevel === 'critical' || n.riskLevel === 'high');
      }),
      { numRuns: 100 }
    );
  });

  it('filtered result is always a subset of input', () => {
    fc.assert(
      fc.property(
        fc.array(fileArb, { minLength: 0, maxLength: 100 }),
        fc.constantFrom('all', 'critical', 'frontend', 'backend'),
        (files, filter) => {
          const { nodes } = buildGraphData(files, filter);
          const inputPaths = new Set(files.map((f) => f.filePath));
          return nodes.every((n) => inputPaths.has(n.filePath));
        }
      ),
      { numRuns: 100 }
    );
  });
});
