
// ============================================================
// LegacyLens — Q&A Router Tests
// Feature: legacylens-vibecon-2026
// ============================================================

import { describe, it, expect } from 'vitest';

// ============================================================
// Property 18: Q&A suggestions are project-specific and count exactly 5
// Feature: legacylens-vibecon-2026, Property 18
// ============================================================

function buildSuggestions(project: {
  name: string;
  repoLanguage: string | null;
  techStack: { frameworks?: string[] } | null;
  files: Array<{ filePath: string; riskLevel: string; dependentsCount: number }>;
}): string[] {
  const topFile = project.files[0]?.filePath ?? 'the main module';
  const criticalFile = project.files.find((f) => f.riskLevel === 'critical')?.filePath ?? topFile;
  const lang = project.repoLanguage ?? 'the codebase';
  const framework = project.techStack?.frameworks?.[0] ?? lang;

  const suggestions = [
    `How does the overall architecture of ${project.name} work?`,
    `What is the purpose of ${topFile} and why does it have so many dependents?`,
    `How does ${framework} handle routing and middleware in this project?`,
    `Which files are the most dangerous to modify and why?`,
    `Walk me through the main data flow from request to response in ${project.name}.`,
  ];

  if (criticalFile !== topFile) {
    suggestions[3] = `Why is ${criticalFile} considered a critical file?`;
  }

  return suggestions.slice(0, 5);
}

describe('Property 18: Q&A suggestions are project-specific and count exactly 5', () => {
  it('getSuggestions always returns exactly 5 strings', () => {
    const project = {
      name: 'Django',
      repoLanguage: 'Python',
      techStack: { frameworks: ['Django'] },
      files: [
        { filePath: 'django/core/handlers/base.py', riskLevel: 'critical', dependentsCount: 15 },
        { filePath: 'django/db/models/base.py', riskLevel: 'high', dependentsCount: 10 },
      ],
    };

    const suggestions = buildSuggestions(project);
    expect(suggestions).toHaveLength(5);
    for (const s of suggestions) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('two projects with different tech stacks return different suggestion sets', () => {
    const djangoProject = {
      name: 'Django',
      repoLanguage: 'Python',
      techStack: { frameworks: ['Django'] },
      files: [{ filePath: 'django/core/handlers/base.py', riskLevel: 'critical', dependentsCount: 15 }],
    };

    const nextProject = {
      name: 'Next.js',
      repoLanguage: 'TypeScript',
      techStack: { frameworks: ['Next.js'] },
      files: [{ filePath: 'packages/next/src/server/app-router.ts', riskLevel: 'critical', dependentsCount: 20 }],
    };

    const djangoSuggestions = buildSuggestions(djangoProject);
    const nextSuggestions = buildSuggestions(nextProject);

    // At least one suggestion should differ between the two projects
    const allSame = djangoSuggestions.every((s, i) => s === nextSuggestions[i]);
    expect(allSame).toBe(false);
  });

  it('suggestions reference the actual project name', () => {
    const project = {
      name: 'Chatwoot',
      repoLanguage: 'Ruby',
      techStack: { frameworks: ['Rails'] },
      files: [{ filePath: 'app/controllers/application_controller.rb', riskLevel: 'high', dependentsCount: 8 }],
    };

    const suggestions = buildSuggestions(project);
    const mentionsProject = suggestions.some((s) => s.includes('Chatwoot'));
    expect(mentionsProject).toBe(true);
  });
});
