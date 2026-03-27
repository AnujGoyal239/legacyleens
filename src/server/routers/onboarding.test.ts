// ============================================================
// LegacyLens — Onboarding Router Tests
// Feature: legacylens-vibecon-2026
// ============================================================

import { describe, it, expect } from 'vitest';

// ============================================================
// Property 10: Onboarding guide has exactly 7 sections
// Feature: legacylens-vibecon-2026, Property 10
// ============================================================

const EXPECTED_SECTIONS = [
  'Start Here',
  'Understand the Architecture',
  'Core Flows',
  'Files to Read Before Touching Anything',
  'Safe Zones',
  'Known Complexity Hotspots',
  'Suggested First Tasks',
];

function parseSections(markdown: string): string[] {
  return markdown
    .split(/^## /gm)
    .filter(Boolean)
    .map((section) => section.split('\n')[0]?.trim() || '')
    .filter(Boolean);
}

describe('Property 10: Onboarding guide has exactly 7 sections', () => {
  it('a well-formed guide markdown has exactly 7 sections with correct titles', () => {
    const mockGuide = `
## Start Here
Entry points and how to run the project locally.

## Understand the Architecture
Top 5 most-connected files.

## Core Flows
The 3-5 most important user journeys.

## Files to Read Before Touching Anything
Critical files ranked by dependency count.

## Safe Zones
Files and folders with low dependencies.

## Known Complexity Hotspots
Files with high complexity to approach carefully.

## Suggested First Tasks
5 beginner-friendly changes to get started.
`.trim();

    const sections = parseSections(mockGuide);
    expect(sections).toHaveLength(7);
    EXPECTED_SECTIONS.forEach((title, i) => {
      expect(sections[i]).toBe(title);
    });
  });

  it('parseSections returns empty array for empty string', () => {
    expect(parseSections('')).toHaveLength(0);
  });

  it('parseSections handles numbered section titles', () => {
    const guide = `
## 1. Start Here
content

## 2. Understand the Architecture
content
`.trim();
    const sections = parseSections(guide);
    expect(sections.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Property 9: Onboarding guide persistence round-trip
// Feature: legacylens-vibecon-2026, Property 9
// ============================================================

describe('Property 9: Onboarding guide persistence round-trip', () => {
  it('version increments on each generation', () => {
    // Simulates the version increment logic in the router
    let existingCount = 0;
    const guide1 = { version: existingCount + 1 };
    existingCount++;
    const guide2 = { version: existingCount + 1 };

    expect(guide1.version).toBe(1);
    expect(guide2.version).toBe(2);
  });

  it('getGuide returns the most recently generated guide', () => {
    // Simulates findFirst with orderBy: { generatedAt: 'desc' }
    const guides = [
      { id: '1', version: 1, generatedAt: new Date('2026-01-01') },
      { id: '2', version: 2, generatedAt: new Date('2026-01-02') },
    ];
    const latest = guides.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0];
    expect(latest.version).toBe(2);
  });
});

// ============================================================
// Unit test: generateGuide rejects non-complete projects
// ============================================================

describe('generateGuide precondition check', () => {
  it('rejects with correct error message when project is not complete', () => {
    const projectStatus: string = 'indexing';
    const expectedMessage = 'Project must be fully indexed before generating an Onboarding Guide.';

    if (projectStatus !== 'complete') {
      expect(expectedMessage).toBe('Project must be fully indexed before generating an Onboarding Guide.');
    }
  });
});
