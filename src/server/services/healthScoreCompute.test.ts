// ============================================================
// LegacyLens — Health Score Compute Tests
// Feature: legacylens-vibecon-2026
// ============================================================

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeWeightedScore, computeHealthScore } from './healthScoreCompute.js';

// ============================================================
// Property 5: Health score weighted formula
// Feature: legacylens-vibecon-2026, Property 5
// ============================================================

describe('Property 5: Health score weighted formula', () => {
  it('computeWeightedScore matches expected formula and is clamped to [0,100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (d, c, x, o) => {
          const expected = Math.max(0, Math.min(100, Math.round(d * 0.3 + c * 0.25 + x * 0.25 + o * 0.2)));
          const result = computeWeightedScore(d, c, x, o);
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result is always in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 200 }),
        fc.integer({ min: -100, max: 200 }),
        fc.integer({ min: -100, max: 200 }),
        fc.integer({ min: -100, max: 200 }),
        (d, c, x, o) => {
          const result = computeWeightedScore(d, c, x, o);
          return result >= 0 && result <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 6: Documentation coverage is a valid percentage
// Feature: legacylens-vibecon-2026, Property 6
// ============================================================

describe('Property 6: Documentation coverage is a valid percentage', () => {
  it('computeHealthScore docCoverageScore is always in [0, 100]', () => {
    const fileArb = fc.array(
      fc.record({
        filePath: fc.string({ minLength: 1 }).map((s) => `src/${s}.ts`),
        fileType: fc.constantFrom('ts', 'js', 'py'),
        linesOfCode: fc.nat(1000),
        riskLevel: fc.constantFrom('low', 'medium', 'high', 'critical'),
        dependentsCount: fc.nat(20),
        dependenciesCount: fc.nat(10),
        isEntryPoint: fc.boolean(),
        functions: fc.array(fc.record({ name: fc.string(), doc: fc.option(fc.string()) })),
        classes: fc.array(fc.record({ name: fc.string(), doc: fc.option(fc.string()) })),
        imports: fc.constant([]),
      }),
      { minLength: 0, maxLength: 50 }
    );

    fc.assert(
      fc.property(fileArb, (files) => {
        const result = computeHealthScore(files as any, []);
        return result.docCoverageScore >= 0 && result.docCoverageScore <= 100;
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================
// Property 7: Onboarding readiness increases with README presence
// Feature: legacylens-vibecon-2026, Property 7
// ============================================================

describe('Property 7: Onboarding readiness increases with README presence', () => {
  it('score with README >= score without README', () => {
    const baseFile = {
      filePath: 'src/index.ts',
      fileType: 'ts',
      linesOfCode: 100,
      riskLevel: 'low',
      dependentsCount: 0,
      dependenciesCount: 0,
      isEntryPoint: true,
      functions: [],
      classes: [],
      imports: [],
    };

    const readmeFile = {
      ...baseFile,
      filePath: 'README.md',
      fileType: 'md',
    };

    const withoutReadme = computeHealthScore([baseFile] as any, ['src/index.ts']);
    const withReadme = computeHealthScore([baseFile, readmeFile] as any, ['src/index.ts']);

    expect(withReadme.onboardingReadiness).toBeGreaterThanOrEqual(
      withoutReadme.onboardingReadiness + 30
    );
  });
});

// ============================================================
// Unit tests — computeHealthScore edge cases
// ============================================================

describe('computeHealthScore edge cases', () => {
  it('returns valid scores for empty file list', () => {
    const result = computeHealthScore([], []);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.docCoverageScore).toBe(50); // neutral default
  });

  it('overallScore matches weighted formula', () => {
    const result = computeHealthScore([], []);
    const expected = computeWeightedScore(
      result.docCoverageScore,
      result.criticalFileRiskScore,
      result.complexityScore,
      result.onboardingReadiness
    );
    expect(result.overallScore).toBe(expected);
  });
});
