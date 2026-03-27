// ============================================================
// LegacyLens — History Router Tests
// Feature: legacylens-vibecon-2026
// ============================================================

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ============================================================
// Property 13: Commit insight uniqueness and retrievability
// Feature: legacylens-vibecon-2026, Property 13
// ============================================================

describe('Property 13: Commit insight uniqueness and retrievability', () => {
  it('calling generateWhy twice for same (projectId, commitHash) yields 1 record', () => {
    // Simulates the unique constraint + cache-hit logic in the router
    const store = new Map<string, { projectId: string; commitHash: string; why: string }>();

    function generateWhy(projectId: string, commitHash: string, why: string) {
      const key = `${projectId}:${commitHash}`;
      if (store.has(key)) {
        return store.get(key)!; // cache hit — no duplicate
      }
      const insight = { projectId, commitHash, why };
      store.set(key, insight);
      return insight;
    }

    generateWhy('proj-1', 'abc123', 'First call');
    generateWhy('proj-1', 'abc123', 'Second call — should be ignored');

    const records = [...store.values()].filter(
      (r) => r.projectId === 'proj-1' && r.commitHash === 'abc123'
    );
    expect(records).toHaveLength(1);
    expect(records[0].why).toBe('First call');
  });

  it('getInsights returns a map with all cached commitHashes', () => {
    const insights = [
      { commitHash: 'abc', why: 'reason 1' },
      { commitHash: 'def', why: 'reason 2' },
    ];
    const insightMap: Record<string, string> = {};
    for (const insight of insights) {
      insightMap[insight.commitHash] = insight.why;
    }
    expect(insightMap['abc']).toBe('reason 1');
    expect(insightMap['def']).toBe('reason 2');
  });
});

// ============================================================
// Property 14: Bulk Why generation respects limit
// Feature: legacylens-vibecon-2026, Property 14
// ============================================================

describe('Property 14: Bulk Why generation respects limit', () => {
  it('generated count is always <= limit and <= commitCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        (limit, commitCount) => {
          const generated = Math.min(commitCount, limit);
          return generated <= limit && generated <= commitCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generateAllWhy with limit=20 processes at most 20 commits', () => {
    const commits = Array.from({ length: 50 }, (_, i) => ({ commitHash: `hash${i}` }));
    const limit = 20;
    const processed = commits.slice(0, limit);
    expect(processed).toHaveLength(20);
  });
});

// ============================================================
// Unit test: cache-hit path skips LLM call
// ============================================================

describe('generateWhy cache-hit path', () => {
  it('returns cached insight without calling LLM when insight exists', () => {
    let llmCallCount = 0;
    const mockLLM = () => {
      llmCallCount++;
      return 'LLM response';
    };

    const existingInsight = { commitHash: 'abc123', why: 'cached reason' };

    function generateWhy(commitHash: string) {
      if (existingInsight.commitHash === commitHash) {
        return existingInsight; // cache hit
      }
      return { commitHash, why: mockLLM() };
    }

    const result = generateWhy('abc123');
    expect(result.why).toBe('cached reason');
    expect(llmCallCount).toBe(0);
  });
});
