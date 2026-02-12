// ============================================================
// LegacyLens — GitHub Pull Request Service
// Full PR creation and fetching via GitHub API
// ============================================================

import { logger } from '../trpc.js';
import { parseGitHubUrl } from './github.js';

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  author: string;
  authorEmail: string | null;
  baseBranch: string;
  headBranch: string;
  filesChanged: string[];
  reviewers: string[];
  mergedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  htmlUrl: string;
}

/**
 * Create a GitHub Pull Request via API
 * Steps:
 * 1. Create a new branch
 * 2. Create/update files via Contents API
 * 3. Create a PR
 */
export async function createGitHubPR(
  owner: string,
  repo: string,
  baseBranch: string,
  branchName: string,
  title: string,
  body: string,
  changes: Array<{ filePath: string; content: string; operation: 'create' | 'update' | 'delete' }>,
  pat: string
): Promise<{ prUrl: string; prNumber: number }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'LegacyLens/1.0',
    Authorization: `Bearer ${pat}`,
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Get the base branch SHA
    const baseBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
      { headers }
    );

    if (!baseBranchResponse.ok) {
      throw new Error(`Failed to get base branch: ${baseBranchResponse.statusText}`);
    }

    const baseBranchData = (await baseBranchResponse.json()) as { object?: { sha?: string } };
    const baseSha = baseBranchData.object?.sha;

    if (!baseSha) {
      throw new Error('Could not get base branch SHA');
    }

    // Step 2: Create a new branch
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    );

    // Branch might already exist, that's okay
    if (!createBranchResponse.ok && createBranchResponse.status !== 422) {
      const errorText = await createBranchResponse.text();
      throw new Error(`Failed to create branch: ${createBranchResponse.statusText} - ${errorText}`);
    }

    // Step 3: Get file contents and create/update files
    for (const change of changes) {
      if (change.operation === 'delete') {
        // Get current file SHA for deletion
        const fileResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(change.filePath)}?ref=${branchName}`,
          { headers }
        );

        if (fileResponse.ok) {
          const fileData = (await fileResponse.json()) as { sha?: string };
          if (fileData.sha) {
            await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(change.filePath)}`,
              {
                method: 'DELETE',
                headers,
                body: JSON.stringify({
                  message: `Delete ${change.filePath}`,
                  sha: fileData.sha,
                  branch: branchName,
                }),
              }
            );
          }
        }
      } else {
        // Get current file SHA if updating
        let currentSha: string | undefined;
        const fileResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(change.filePath)}?ref=${baseBranch}`,
          { headers }
        );

        if (fileResponse.ok) {
          const fileData = (await fileResponse.json()) as { sha?: string };
          currentSha = fileData.sha;
        }

        // Create or update file
        const content = Buffer.from(change.content).toString('base64');
        const updateResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(change.filePath)}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              message: change.operation === 'create' ? `Add ${change.filePath}` : `Update ${change.filePath}`,
              content,
              branch: branchName,
              ...(currentSha && { sha: currentSha }),
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          logger.warn(
            { filePath: change.filePath, error: errorText },
            'Failed to update file in PR branch'
          );
        }
      }
    }

    // Step 4: Create the Pull Request
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: baseBranch,
        draft: true, // Create as draft PR
      }),
    });

    if (!prResponse.ok) {
      const errorText = await prResponse.text();
      throw new Error(`Failed to create PR: ${prResponse.statusText} - ${errorText}`);
    }

    const prData = (await prResponse.json()) as { html_url?: string; number?: number };
    return {
      prUrl: prData.html_url || `https://github.com/${owner}/${repo}/pull/${prData.number}`,
      prNumber: prData.number || 0,
    };
  } catch (error) {
    logger.error({ error, owner, repo, branchName }, 'Failed to create GitHub PR');
    throw error;
  }
}

/**
 * Fetch Pull Requests from GitHub API
 */
export async function fetchGitHubPRs(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'all',
  pat?: string | null
): Promise<GitHubPR[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'LegacyLens/1.0',
  };

  if (pat) {
    headers.Authorization = `Bearer ${pat}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=100&sort=updated&direction=desc`,
    { headers }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const prs = (await response.json()) as Array<{
    id?: number;
    number?: number;
    title?: string;
    body?: string | null;
    state?: string;
    user?: { login?: string; email?: string | null };
    base?: { ref?: string };
    head?: { ref?: string };
    requested_reviewers?: Array<{ login?: string }>;
    merged_at?: string | null;
    created_at?: string;
    updated_at?: string;
    html_url?: string;
  }>;

  // Fetch file changes for each PR
  const enrichedPRs = await Promise.all(
    prs.map(async (pr) => {
      let filesChanged: string[] = [];

      if (pr.number && pat) {
        try {
          const filesResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/files`,
            { headers }
          );

          if (filesResponse.ok) {
            const files = (await filesResponse.json()) as Array<{ filename?: string }>;
            filesChanged = files.map((f) => f.filename || '').filter(Boolean);
          }
        } catch (error) {
          logger.debug({ prNumber: pr.number, error }, 'Failed to fetch PR files');
        }
      }

      return {
        id: pr.id || 0,
        number: pr.number || 0,
        title: pr.title || '',
        body: pr.body,
        state: (pr.state as 'open' | 'closed' | 'merged') || 'open',
        author: pr.user?.login || '',
        authorEmail: pr.user?.email || null,
        baseBranch: pr.base?.ref || 'main',
        headBranch: pr.head?.ref || '',
        filesChanged,
        reviewers: pr.requested_reviewers?.map((r) => r.login || '').filter(Boolean) || [],
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        createdAt: new Date(pr.created_at || Date.now()),
        updatedAt: new Date(pr.updated_at || Date.now()),
        htmlUrl: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
      };
    })
  );

  return enrichedPRs;
}

/**
 * Sync PRs from GitHub and store in database
 */
export async function syncPRsToDatabase(
  prisma: any,
  projectId: string,
  owner: string,
  repo: string,
  pat?: string | null
): Promise<number> {
  const prs = await fetchGitHubPRs(owner, repo, 'all', pat);
  let synced = 0;

  for (const pr of prs) {
    try {
      await prisma.pullRequest.upsert({
        where: {
          githubPrId: pr.id.toString(),
        },
        create: {
          projectId,
          githubPrId: pr.id.toString(),
          title: pr.title,
          body: pr.body,
          state: pr.state,
          author: pr.author,
          authorEmail: pr.authorEmail,
          baseBranch: pr.baseBranch,
          headBranch: pr.headBranch,
          filesChanged: pr.filesChanged,
          reviewers: pr.reviewers,
          mergedAt: pr.mergedAt,
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
        },
        update: {
          title: pr.title,
          body: pr.body,
          state: pr.state,
          filesChanged: pr.filesChanged,
          reviewers: pr.reviewers,
          mergedAt: pr.mergedAt,
          updatedAt: pr.updatedAt,
        },
      });
      synced++;
    } catch (error) {
      logger.warn({ prId: pr.id, error }, 'Failed to sync PR to database');
    }
  }

  return synced;
}
