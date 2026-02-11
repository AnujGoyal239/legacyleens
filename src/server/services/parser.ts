// ============================================================
// LegacyLens — Code Parser Service
// ============================================================

import { logger } from '../trpc.js';
import type { ParsedFile, ParsedFunction, ParsedClass, ParsedImport } from '../../types/index.js';

/**
 * Parse a source file and extract structure (functions, classes, imports, exports)
 * Uses regex-based parsing as a lightweight alternative to tree-sitter
 * for the MVP. Can be upgraded to tree-sitter later for better accuracy.
 */
export function parseFileContent(
  filePath: string,
  content: string
): Omit<ParsedFile, 'path' | 'content'> {
  const lines = content.split('\n');
  const linesOfCode = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith('//')).length;

  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  let functions: ParsedFunction[] = [];
  let classes: ParsedClass[] = [];
  let imports: ParsedImport[] = [];
  let exports: string[] = [];

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      ({ functions, classes, imports, exports } = parseJavaScriptLike(content, lines));
      break;
    case 'py':
      ({ functions, classes, imports, exports } = parsePython(content, lines));
      break;
    case 'java':
    case 'kt':
    case 'scala':
      ({ functions, classes, imports, exports } = parseJavaLike(content, lines));
      break;
    case 'go':
      ({ functions, classes, imports, exports } = parseGo(content, lines));
      break;
    default:
      // For unsupported types, just return basic info
      break;
  }

  return { linesOfCode, functions, classes, imports, exports };
}

// ============================================================
// JavaScript / TypeScript Parser
// ============================================================

function parseJavaScriptLike(content: string, lines: string[]) {
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];
  const imports: ParsedImport[] = [];
  const exports: string[] = [];

  // Parse imports
  const importRegex = /import\s+(?:(?:(\{[^}]+\})|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1]
      ? match[1].replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const defaultImport = match[2] || '';
    const items = defaultImport ? [defaultImport, ...namedImports] : namedImports;

    imports.push({
      module: match[3],
      items,
      isDefault: !!match[2],
    });
  }

  // Parse functions
  const funcPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?:=>|:)/g,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  ];

  for (const pattern of funcPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      const lineStart = content.substring(0, match.index).split('\n').length;
      const isExported = match[0].startsWith('export');
      const params = match[2] ? match[2].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean) : [];

      functions.push({
        name: match[1],
        params,
        lineStart,
        lineEnd: lineStart + 10, // Approximation
        isExported,
      });

      if (isExported) {
        exports.push(match[1]);
      }
    }
  }

  // Parse classes
  const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g;

  while ((match = classRegex.exec(content)) !== null) {
    const lineStart = content.substring(0, match.index).split('\n').length;
    const isExported = match[0].startsWith('export');

    // Extract methods
    const methods: string[] = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g;
    const classBody = content.substring(match.index);
    let methodMatch;

    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      if (methodMatch[1] !== 'constructor' && methodMatch[1] !== 'class') {
        methods.push(methodMatch[1]);
      }
      if (methodMatch.index > 2000) break; // Don't search too far
    }

    classes.push({
      name: match[1],
      methods,
      lineStart,
      lineEnd: lineStart + 50, // Approximation
      isExported,
    });

    if (isExported) {
      exports.push(match[1]);
    }
  }

  // Parse export statements
  const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|async)\s+(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    if (!exports.includes(match[1])) {
      exports.push(match[1]);
    }
  }

  return { functions, classes, imports, exports };
}

// ============================================================
// Python Parser
// ============================================================

function parsePython(content: string, lines: string[]) {
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];
  const imports: ParsedImport[] = [];
  const exports: string[] = [];

  let match;

  // Parse imports
  const importRegex = /(?:from\s+([\w.]+)\s+import\s+(.+)|import\s+([\w.]+))/g;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push({
        module: match[1],
        items: match[2].split(',').map((s) => s.trim()),
        isDefault: false,
      });
    } else if (match[3]) {
      imports.push({
        module: match[3],
        items: [match[3]],
        isDefault: true,
      });
    }
  }

  // Parse functions
  const funcRegex = /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineStart = content.substring(0, match.index).split('\n').length;
    const params = match[2] ? match[2].split(',').map((s) => s.trim().split(':')[0].split('=')[0].trim()).filter((p) => p && p !== 'self' && p !== 'cls') : [];

    functions.push({
      name: match[1],
      params,
      lineStart,
      lineEnd: lineStart + 10,
      isExported: !match[1].startsWith('_'),
    });
  }

  // Parse classes
  const classRegex = /class\s+(\w+)(?:\(([^)]*)\))?\s*:/g;
  while ((match = classRegex.exec(content)) !== null) {
    const lineStart = content.substring(0, match.index).split('\n').length;
    const methods: string[] = [];

    // Find methods in class
    const classBody = content.substring(match.index);
    const methodRegex = /def\s+(\w+)/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      if (!methodMatch[1].startsWith('__') || methodMatch[1] === '__init__') {
        methods.push(methodMatch[1]);
      }
      if (methodMatch.index > 3000) break;
    }

    classes.push({
      name: match[1],
      methods,
      lineStart,
      lineEnd: lineStart + 50,
      isExported: !match[1].startsWith('_'),
    });
  }

  return { functions, classes, imports, exports };
}

// ============================================================
// Java-like Parser (Java, Kotlin, Scala)
// ============================================================

function parseJavaLike(content: string, lines: string[]) {
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];
  const imports: ParsedImport[] = [];
  const exports: string[] = [];

  let match;

  // Parse imports
  const importRegex = /import\s+([\w.]+)/g;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      module: match[1],
      items: [match[1].split('.').pop() || ''],
      isDefault: false,
    });
  }

  // Parse classes
  const classRegex = /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/g;
  while ((match = classRegex.exec(content)) !== null) {
    const lineStart = content.substring(0, match.index).split('\n').length;
    classes.push({
      name: match[1],
      methods: [],
      lineStart,
      lineEnd: lineStart + 50,
      isExported: match[0].includes('public'),
    });
  }

  // Parse methods
  const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:[\w<>[\]]+)\s+(\w+)\s*\(([^)]*)\)/g;
  while ((match = methodRegex.exec(content)) !== null) {
    if (!['if', 'while', 'for', 'switch', 'catch'].includes(match[1])) {
      const lineStart = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        params: match[2] ? match[2].split(',').map((s) => s.trim().split(' ').pop() || '').filter(Boolean) : [],
        lineStart,
        lineEnd: lineStart + 10,
        isExported: match[0].includes('public'),
      });
    }
  }

  return { functions, classes, imports, exports };
}

// ============================================================
// Go Parser
// ============================================================

function parseGo(content: string, lines: string[]) {
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];
  const imports: ParsedImport[] = [];
  const exports: string[] = [];

  let match;

  // Parse imports
  const importRegex = /import\s+(?:\(\s*([\s\S]*?)\)|"([^"]+)")/g;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      const importLines = match[1].split('\n').filter((l) => l.trim());
      for (const line of importLines) {
        const pkg = line.trim().replace(/['"]/g, '');
        if (pkg) {
          imports.push({ module: pkg, items: [pkg.split('/').pop() || ''], isDefault: false });
        }
      }
    } else if (match[2]) {
      imports.push({ module: match[2], items: [match[2].split('/').pop() || ''], isDefault: false });
    }
  }

  // Parse functions
  const funcRegex = /func\s+(?:\((\w+)\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineStart = content.substring(0, match.index).split('\n').length;
    const name = match[2];
    const isExported = name[0] === name[0].toUpperCase();

    functions.push({
      name,
      params: match[3] ? match[3].split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean) : [],
      lineStart,
      lineEnd: lineStart + 10,
      isExported,
    });
  }

  // Parse structs (like classes)
  const structRegex = /type\s+(\w+)\s+struct\s*\{/g;
  while ((match = structRegex.exec(content)) !== null) {
    const lineStart = content.substring(0, match.index).split('\n').length;
    classes.push({
      name: match[1],
      methods: [],
      lineStart,
      lineEnd: lineStart + 20,
      isExported: match[1][0] === match[1][0].toUpperCase(),
    });
  }

  return { functions, classes, imports, exports };
}

export { parseFileContent as parseFile };
