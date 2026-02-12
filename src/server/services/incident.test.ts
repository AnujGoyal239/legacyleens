// ============================================================
// LegacyLens — Incident Service Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  parseStackTrace,
  getBlastRadiusFromGraph,
} from './incident.js';
import type { ArchitectureGraph } from '../../types/index.js';

describe('parseStackTrace', () => {
  it('parses at file:line format', () => {
    const text = `Error: something broke
    at src/server/auth.ts:42:10
    at src/server/index.ts:100:5`;
    const frames = parseStackTrace(text);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0].filePath).toContain('auth.ts');
    expect(frames[0].line).toBe(42);
    expect(frames[1].filePath).toContain('index.ts');
    expect(frames[1].line).toBe(100);
  });

  it('parses path with backslashes (Windows)', () => {
    const text = ' at C:\\repo\\src\\main.ts:10:1';
    const frames = parseStackTrace(text);
    expect(frames.length).toBeGreaterThanOrEqual(1);
    expect(frames[0].filePath).toContain('/');
    expect(frames[0].line).toBe(10);
  });

  it('returns empty array for empty string', () => {
    expect(parseStackTrace('')).toEqual([]);
    expect(parseStackTrace('   ')).toEqual([]);
  });

  it('extracts file:line from single line error', () => {
    const text = 'TypeError at src/utils/helper.js:99';
    const frames = parseStackTrace(text);
    expect(frames.some((f) => f.filePath?.includes('helper') && f.line === 99)).toBe(true);
  });
});

describe('getBlastRadiusFromGraph', () => {
  it('returns dependents for given file', () => {
    const graph: ArchitectureGraph = {
      nodes: [
        { id: 'a', filePath: 'a', label: 'a', type: 'file', riskLevel: 'low', dependentsCount: 0, dependenciesCount: 1, linesOfCode: 10, isEntryPoint: false },
        { id: 'b', filePath: 'b', label: 'b', type: 'file', riskLevel: 'medium', dependentsCount: 1, dependenciesCount: 0, linesOfCode: 20, isEntryPoint: true },
      ],
      edges: [
        { source: 'b', target: 'a', type: 'import' },
      ],
    };
    const dependents = getBlastRadiusFromGraph(graph, 'a');
    expect(dependents).toEqual(['b']);
  });

  it('returns empty array when graph is null', () => {
    expect(getBlastRadiusFromGraph(null, 'any')).toEqual([]);
  });

  it('returns empty array when graph has no edges', () => {
    const graph: ArchitectureGraph = { nodes: [], edges: [] };
    expect(getBlastRadiusFromGraph(graph, 'x')).toEqual([]);
  });

  it('normalizes backslashes in file path', () => {
    const graph: ArchitectureGraph = {
      nodes: [],
      edges: [
        { source: 'c', target: 'src\\foo.ts', type: 'import' },
      ],
    };
    const dependents = getBlastRadiusFromGraph(graph, 'src/foo.ts');
    expect(dependents).toContain('c');
  });
});
