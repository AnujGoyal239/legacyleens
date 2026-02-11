// ============================================================
// LegacyLens — Dependency Analyzer Service
// ============================================================

import { logger } from '../trpc.js';
import type { ArchitectureGraph, GraphNode, GraphEdge, TechStack, ParsedFile } from '../../types/index.js';
import type { RiskLevel } from '../../types/index.js';

/**
 * Analyze file dependencies and build architecture graph
 */
export function analyzeDependencies(
  files: ParsedFile[]
): {
  graph: ArchitectureGraph;
  entryPoints: string[];
  techStack: TechStack;
} {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const dependentsMap = new Map<string, Set<string>>();
  const dependenciesMap = new Map<string, Set<string>>();

  // Build a map of file paths for resolution
  const filePathSet = new Set(files.map((f) => f.path));

  // Create nodes and analyze imports
  for (const file of files) {
    // Track dependencies
    const deps = new Set<string>();

    for (const imp of file.imports) {
      // Resolve relative imports
      const resolvedPath = resolveImport(file.path, imp.module, filePathSet);
      if (resolvedPath) {
        deps.add(resolvedPath);
        edges.push({
          source: file.path,
          target: resolvedPath,
          type: 'import',
        });

        // Track reverse dependencies (who depends on this file)
        if (!dependentsMap.has(resolvedPath)) {
          dependentsMap.set(resolvedPath, new Set());
        }
        dependentsMap.get(resolvedPath)!.add(file.path);
      }
    }

    dependenciesMap.set(file.path, deps);
  }

  // Create nodes with dependency data
  for (const file of files) {
    const dependentsCount = dependentsMap.get(file.path)?.size || 0;
    const dependenciesCount = dependenciesMap.get(file.path)?.size || 0;

    const riskLevel: RiskLevel =
      dependentsCount >= 10
        ? 'critical'
        : dependentsCount >= 5
          ? 'high'
          : dependentsCount >= 2
            ? 'medium'
            : 'low';

    const isEntryPoint = detectEntryPoint(file.path, dependentsCount, dependenciesCount);

    nodes.push({
      id: file.path,
      label: file.path.split('/').pop() || file.path,
      filePath: file.path,
      type: 'file',
      riskLevel,
      dependentsCount,
      dependenciesCount,
      linesOfCode: file.linesOfCode,
      isEntryPoint,
    });
  }

  // Detect entry points
  const entryPoints = nodes
    .filter((n) => n.isEntryPoint)
    .map((n) => n.filePath);

  // Detect tech stack
  const techStack = detectTechStack(files);

  logger.info(
    {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      entryPoints: entryPoints.length,
    },
    'Dependency analysis complete'
  );

  return {
    graph: { nodes, edges },
    entryPoints,
    techStack,
  };
}

/**
 * Resolve an import path to an actual file in the project
 */
function resolveImport(
  fromPath: string,
  importModule: string,
  filePathSet: Set<string>
): string | null {
  // Skip external packages
  if (!importModule.startsWith('.') && !importModule.startsWith('/')) {
    return null;
  }

  // Resolve relative path
  const fromDir = fromPath.split('/').slice(0, -1).join('/');
  const parts = importModule.split('/');
  const dirParts = fromDir.split('/');

  let resolved = [...dirParts];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  const basePath = resolved.join('/');

  // Try different extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (filePathSet.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Detect if a file is likely an entry point
 */
function detectEntryPoint(
  filePath: string,
  dependentsCount: number,
  dependenciesCount: number
): boolean {
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  const entryPatterns = [
    'index.ts', 'index.tsx', 'index.js', 'index.jsx',
    'main.ts', 'main.tsx', 'main.js', 'main.py', 'main.go',
    'app.ts', 'app.tsx', 'app.js', 'app.jsx', 'app.py',
    'server.ts', 'server.js', 'server.py',
    'manage.py', 'setup.py', 'wsgi.py',
    'cmd/main.go',
  ];

  // File name matches common entry points
  if (entryPatterns.includes(fileName)) return true;

  // Root-level files that are imported by many but import few
  if (dependentsCount === 0 && dependenciesCount > 3) return true;

  return false;
}

/**
 * Detect the tech stack from file analysis
 */
function detectTechStack(files: ParsedFile[]): TechStack {
  const languageCount = new Map<string, number>();
  const frameworks = new Set<string>();
  const buildTools = new Set<string>();
  const testingTools = new Set<string>();
  const databases = new Set<string>();

  for (const file of files) {
    // Count languages
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
      py: 'Python', java: 'Java', go: 'Go', rb: 'Ruby', php: 'PHP',
      cs: 'C#', rs: 'Rust', swift: 'Swift', kt: 'Kotlin',
    };
    const lang = langMap[ext];
    if (lang) {
      languageCount.set(lang, (languageCount.get(lang) || 0) + 1);
    }

    // Detect frameworks from imports
    const importModules = file.imports.map((i) => i.module);
    for (const mod of importModules) {
      if (mod === 'react' || mod.startsWith('react/')) frameworks.add('React');
      if (mod === 'vue' || mod.startsWith('vue/')) frameworks.add('Vue.js');
      if (mod === 'express') frameworks.add('Express.js');
      if (mod === 'fastify') frameworks.add('Fastify');
      if (mod === 'next' || mod.startsWith('next/')) frameworks.add('Next.js');
      if (mod === '@angular/core') frameworks.add('Angular');
      if (mod === 'django' || mod.startsWith('django.')) frameworks.add('Django');
      if (mod === 'flask') frameworks.add('Flask');
      if (mod.startsWith('spring')) frameworks.add('Spring');
      if (mod === 'tailwindcss') frameworks.add('TailwindCSS');
      if (mod === '@prisma/client') frameworks.add('Prisma');

      // Build tools
      if (mod === 'webpack') buildTools.add('Webpack');
      if (mod === 'vite') buildTools.add('Vite');

      // Testing
      if (mod === 'jest' || mod.startsWith('@jest')) testingTools.add('Jest');
      if (mod === 'vitest') testingTools.add('Vitest');
      if (mod === 'pytest') testingTools.add('Pytest');
      if (mod === 'mocha') testingTools.add('Mocha');

      // Databases
      if (mod === 'pg' || mod === 'postgres') databases.add('PostgreSQL');
      if (mod === 'mongoose' || mod === 'mongodb') databases.add('MongoDB');
      if (mod === 'mysql2' || mod === 'mysql') databases.add('MySQL');
      if (mod === 'redis' || mod === 'ioredis') databases.add('Redis');
    }
  }

  // Calculate language percentages
  const totalFiles = Array.from(languageCount.values()).reduce((a, b) => a + b, 0);
  const languages = Array.from(languageCount.entries())
    .map(([name, files]) => ({
      name,
      percentage: Math.round((files / totalFiles) * 100),
      files,
    }))
    .sort((a, b) => b.files - a.files);

  return {
    languages,
    frameworks: Array.from(frameworks),
    buildTools: Array.from(buildTools),
    testingTools: Array.from(testingTools),
    databases: Array.from(databases),
  };
}
