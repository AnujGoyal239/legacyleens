// ============================================================
// LegacyLens — Security & Compliance (secrets, vuln deps, licenses)
// ============================================================

import { prisma, logger } from '../trpc.js';
import { parseGitHubUrl, fetchFileContent } from './github.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

// Common secret patterns (redacted in output; we only report location/type)
const SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret', regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/ },
  { name: 'Generic API Key', regex: /(?:api[_-]?key|apikey|api_key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i },
  { name: 'Bearer Token', regex: /Bearer\s+[a-zA-Z0-9_\-.]{20,}/ },
  { name: 'Private Key (PEM)', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Slack Token', regex: /xox[baprs]-[a-zA-Z0-9-]{10,}/ },
  { name: 'GitHub PAT', regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub OAuth', regex: /gho_[a-zA-Z0-9]{36}/ },
  { name: 'Generic Secret', regex: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/i },
];

export interface SecretFinding {
  filePath: string | null;
  type: string;
  snippet: string;
}

/**
 * Scan indexed content (embeddings) for potential secrets.
 */
export async function scanSecrets(projectId: string): Promise<SecretFinding[]> {
  const rows = await prisma.embedding.findMany({
    where: { projectId, content: { not: null } },
    select: { filePath: true, content: true },
  });

  const findings: SecretFinding[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const content = row.content || '';
    const filePath = row.filePath || '';

    for (const { name, regex } of SECRET_PATTERNS) {
      const matches = content.matchAll(new RegExp(regex.source, regex.flags + 'g'));
      for (const m of matches) {
        const snippet = (m[0] || '').slice(0, 50) + (m[0].length > 50 ? '...' : '');
        const key = `${filePath}:${name}:${snippet}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ filePath: filePath || null, type: name, snippet });
      }
    }
  }

  logger.info({ projectId, count: findings.length }, 'Secrets scan completed');
  return findings;
}

/**
 * Get package.json from project repo and run npm audit.
 * Returns audit result or dependency list if audit not available.
 */
export async function getVulnerableDeps(
  projectId: string,
  githubUrl: string,
  defaultBranch: string,
  githubPat?: string | null
): Promise<{
  dependencies: { name: string; version: string }[];
  audit: { vulnerabilities: number; critical: number; high: number; moderate: number; low: number; summary: string } | null;
  error?: string;
}> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    return { dependencies: [], audit: null, error: 'Invalid GitHub URL' };
  }

  const packageJsonRaw = await fetchFileContent(
    parsed.owner,
    parsed.repo,
    'package.json',
    defaultBranch,
    githubPat
  );

  if (!packageJsonRaw) {
    return { dependencies: [], audit: null, error: 'package.json not found' };
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(packageJsonRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  } catch {
    return { dependencies: [], audit: null, error: 'Invalid package.json' };
  }

  const deps: { name: string; version: string }[] = [];
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    deps.push({ name, version: version.replace(/^[\^~]/, '') });
  }
  for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
    deps.push({ name, version: version.replace(/^[\^~]/, '') });
  }

  const tmpDir = path.join(os.tmpdir(), `legacylens_audit_${projectId}_${Date.now()}`);
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'package.json'), packageJsonRaw, 'utf-8');
    const out = execSync('npm audit --json', { cwd: tmpDir, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 });
    const auditData = JSON.parse(out) as {
      metadata?: { vulnerabilities?: { info?: number; low?: number; moderate?: number; high?: number; critical?: number } };
    };
    const meta = auditData.metadata?.vulnerabilities || {};
    const crit = meta.critical ?? 0;
    const high = meta.high ?? 0;
    const mod = meta.moderate ?? 0;
    const low = meta.low ?? 0;
    const info = meta.info ?? 0;
    return {
      dependencies: deps,
      audit: {
        vulnerabilities: crit + high + mod + low + info,
        critical: crit,
        high,
        moderate: mod,
        low,
        summary: `Critical: ${crit}, High: ${high}, Moderate: ${mod}, Low: ${low}`,
      },
    };
  } catch (e) {
    // npm audit may exit 1 when vulns found; we still want to parse
    try {
      const stderr = (e as { stderr?: string }).stderr || '';
      const stdout = (e as { stdout?: string }).stdout || '';
      const out = stdout || stderr;
      const auditData = JSON.parse(out) as {
        metadata?: { vulnerabilities?: { info?: number; low?: number; moderate?: number; high?: number; critical?: number } };
      };
      const meta = auditData.metadata?.vulnerabilities || {};
      const crit = meta.critical ?? 0;
      const high = meta.high ?? 0;
      const mod = meta.moderate ?? 0;
      const low = meta.low ?? 0;
      const info = meta.info ?? 0;
      return {
        dependencies: deps,
        audit: {
          vulnerabilities: crit + high + mod + low + info,
          critical: crit,
          high,
          moderate: mod,
          low,
          summary: `Critical: ${crit}, High: ${high}, Moderate: ${mod}, Low: ${low}`,
        },
      };
    } catch {
      logger.warn({ projectId, e }, 'npm audit failed');
      return { dependencies: deps, audit: null, error: 'Run npm audit in your repo for vulnerability details.' };
    }
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * List dependencies with licenses (from npm registry).
 */
export async function getLicenseList(
  projectId: string,
  githubUrl: string,
  defaultBranch: string,
  githubPat?: string | null
): Promise<{ name: string; version: string; license: string }[]> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) return [];

  const packageJsonRaw = await fetchFileContent(
    parsed.owner,
    parsed.repo,
    'package.json',
    defaultBranch,
    githubPat
  );
  if (!packageJsonRaw) return [];

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(packageJsonRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  } catch {
    return [];
  }

  const names = new Set<string>();
  for (const name of Object.keys(pkg.dependencies || {})) names.add(name);
  for (const name of Object.keys(pkg.devDependencies || {})) names.add(name);

  const results: { name: string; version: string; license: string }[] = [];
  for (const name of names) {
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
      if (!res.ok) {
        results.push({ name, version: '', license: 'Unknown' });
        continue;
      }
      const data = (await res.json()) as { 'dist-tags'?: { latest?: string }; versions?: Record<string, { license?: string }> };
      const latest = data['dist-tags']?.latest;
      const version = latest || (data.versions && Object.keys(data.versions).pop()) || '';
      const license = (data.versions?.[version]?.license as string) || (data as { license?: string }).license || 'Unknown';
      results.push({
        name,
        version,
        license: typeof license === 'string' ? license : (license as { type?: string })?.type ?? 'Unknown',
      });
    } catch {
      results.push({ name, version: '', license: 'Unknown' });
    }
  }

  return results;
}
