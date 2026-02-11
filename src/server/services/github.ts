// ============================================================
// LegacyLens — GitHub API Service
// ============================================================

import { simpleGit, SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../trpc.js';

// ============================================================
// GitHub API — Fetch Repository Metadata
// ============================================================

export interface RepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  visibility: 'public' | 'private';
  defaultBranch: string;
  topics: string[];
  avatarUrl: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  size: number; // in KB
  openIssues: number;
}

/**
 * Parse owner and repo name from a GitHub URL.
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Fetch repository metadata from the GitHub REST API.
 * For public repos: no token required.
 * For private repos: a Personal Access Token (PAT) with `repo` scope is required.
 */
export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  pat?: string | null
): Promise<RepoMetadata> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'LegacyLens/1.0',
  };

  if (pat) {
    headers.Authorization = `Bearer ${pat}`;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

  if (response.status === 404) {
    throw new Error(
      pat
        ? `Repository ${owner}/${repo} not found. Check the URL and ensure your token has access.`
        : `Repository ${owner}/${repo} not found. If it's private, provide a Personal Access Token.`
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'GitHub authentication failed. Please check your Personal Access Token and ensure it has the "repo" scope.'
    );
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    owner: data.owner?.login || owner,
    name: data.name || repo,
    fullName: data.full_name || `${owner}/${repo}`,
    description: data.description || null,
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    language: data.language || null,
    visibility: data.private ? 'private' : 'public',
    defaultBranch: data.default_branch || 'main',
    topics: data.topics || [],
    avatarUrl: data.owner?.avatar_url || null,
    htmlUrl: data.html_url || `https://github.com/${owner}/${repo}`,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    size: data.size || 0,
    openIssues: data.open_issues_count || 0,
  };
}

// ============================================================
// Git Operations — Clone, Read Files, Commit History
// ============================================================

// Supported file extensions for code analysis
const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php',
  '.cs', '.c', '.cpp', '.h', '.hpp', '.rs', '.swift', '.kt', '.scala',
  '.vue', '.svelte', '.astro', '.html', '.css', '.scss', '.less',
  '.sql', '.graphql', '.prisma', '.yaml', '.yml', '.json', '.toml',
  '.md', '.mdx', '.txt', '.env', '.sh', '.bash', '.zsh',
  '.dockerfile', '.xml', '.gradle',
]);

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', 'vendor', '__pycache__', '.next',
  'dist', 'build', 'out', '.cache', 'coverage', '.nyc_output',
  'target', 'bin', 'obj', '.gradle', '.idea', '.vscode',
  'venv', '.venv', 'env', '.tox', 'eggs',
]);

export interface RepoFile {
  path: string;
  content: string;
  size: number;
}

/**
 * Clone a GitHub repository to a temporary directory.
 * For private repos, injects the PAT into the clone URL.
 */
export async function cloneRepository(
  repoUrl: string,
  projectId: string,
  pat?: string | null
): Promise<string> {
  const tempDir = path.join(process.env.TEMP || '/tmp', `repo_${projectId}_${Date.now()}`);

  // For private repos, inject PAT into the URL: https://<pat>@github.com/owner/repo.git
  let cloneUrl = repoUrl;
  if (pat) {
    cloneUrl = repoUrl.replace('https://github.com/', `https://${pat}@github.com/`);
  }
  // Ensure it ends with .git
  if (!cloneUrl.endsWith('.git')) {
    cloneUrl += '.git';
  }

  logger.info({ repoUrl, tempDir }, 'Cloning repository');

  const git: SimpleGit = simpleGit();

  await git.clone(cloneUrl, tempDir, [
    '--depth', '100', // Shallow clone for speed
    '--single-branch',
  ]);

  logger.info({ repoUrl, tempDir }, 'Repository cloned successfully');

  return tempDir;
}

/**
 * Recursively get all supported files in a directory
 */
export async function getAllFiles(
  dir: string,
  basePath: string = dir,
  maxFiles: number = 10000
): Promise<RepoFile[]> {
  const files: RepoFile[] = [];

  async function walk(currentDir: string): Promise<void> {
    if (files.length >= maxFiles) return;

    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (SUPPORTED_EXTENSIONS.has(ext)) {
          try {
            const stat = await fs.stat(fullPath);

            // Skip files larger than 500KB
            if (stat.size > 500 * 1024) continue;

            const content = await fs.readFile(fullPath, 'utf-8');

            files.push({
              path: relativePath,
              content,
              size: stat.size,
            });
          } catch (error) {
            // Skip files that can't be read (binary, etc.)
            logger.debug({ filePath: relativePath }, 'Skipping unreadable file');
          }
        }
      }
    }
  }

  await walk(dir);

  return files;
}

/**
 * Get commit history for a repo
 */
export async function getCommitHistory(
  repoDir: string,
  limit: number = 100
): Promise<Array<{
  hash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  filesChanged: string[];
}>> {
  const git: SimpleGit = simpleGit(repoDir);

  const log = await git.log({
    maxCount: limit,
    format: {
      hash: '%H',
      message: '%s',
      author: '%an',
      authorEmail: '%ae',
      date: '%aI',
    },
  });

  return log.all.map((entry) => ({
    hash: entry.hash,
    message: entry.message,
    author: (entry as unknown as Record<string, string>).author || '',
    authorEmail: (entry as unknown as Record<string, string>).authorEmail || '',
    date: new Date(entry.date),
    filesChanged: [], // Could be expanded with diff-tree
  }));
}

/**
 * Detect the file type / language from extension
 */
export function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const typeMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    cs: 'csharp',
    c: 'c',
    cpp: 'cpp',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    vue: 'vue',
    svelte: 'svelte',
  };

  return typeMap[ext] || ext;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    logger.info({ tempDir }, 'Temporary directory cleaned up');
  } catch (error) {
    logger.warn({ tempDir, error }, 'Failed to clean up temporary directory');
  }
}
