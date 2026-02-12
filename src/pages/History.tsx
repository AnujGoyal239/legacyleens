// ============================================================
// LegacyLens — Code History (GitLens-style)
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GitCommit, FileCode2, User, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime } from '@/lib/utils';

export default function History() {
  const { id: projectId } = useParams<{ id: string }>();
  const [fileFilter, setFileFilter] = useState('');

  const { data: project } = trpc.project.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const filePaths = (project?.files ?? []).map((f) => f.filePath).filter(Boolean).sort();

  const utils = trpc.useUtils();
  const generateSummariesMutation = trpc.project.generateCommitSummaries.useMutation({
    onSuccess: () => {
      utils.devops.getRecentChanges.invalidate({ projectId: projectId! });
    },
  });

  const { data: commitsData, isLoading } = trpc.devops.getRecentChanges.useQuery(
    {
      projectId: projectId!,
      filePath: fileFilter.trim() || undefined,
      limit: 50,
    },
    { enabled: !!projectId }
  );

  const commits = commitsData?.commits ?? [];
  const commitsWithoutSummary = commits.filter((c) => !(c as { summary?: string | null }).summary).length;

  if (!projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid project
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GitCommit className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Code history</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Recent commits with optional AI summary. Filter by file to see GitLens-style file history.
      </p>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium">Filter by file</label>
            <select
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="max-w-md rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <option value="">All files</option>
            {filePaths.slice(0, 300).map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          </div>
          <button
            type="button"
            onClick={() => projectId && generateSummariesMutation.mutate({ projectId, limit: 20 })}
            disabled={generateSummariesMutation.isPending || commitsWithoutSummary === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {generateSummariesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generateSummariesMutation.isPending ? 'Generating...' : 'Generate commit summaries'}
          </button>
        </div>
        {generateSummariesMutation.isSuccess && (
          <p className="mb-2 text-xs text-muted-foreground">
            Generated {generateSummariesMutation.data?.generated ?? 0} summary(ies).
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : commits.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No commits found. Re-index the project to populate commit history.
          </p>
        ) : (
          <ul className="space-y-2">
            {commits.map((c) => {
              const summary = (c as { summary?: string | null }).summary;
              return (
                <li
                  key={c.commitHash}
                  className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.commitHash.slice(0, 7)}
                  </span>
                  <span className="flex-1 font-medium">{c.message}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {c.author}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatRelativeTime(c.committedAt)}
                  </span>
                  {summary && (
                    <div className="mt-1 w-full rounded border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs text-foreground">
                      <span className="font-medium text-muted-foreground">Summary: </span>
                      {summary}
                    </div>
                  )}
                  {c.filesChanged?.length ? (
                    <div className="mt-1 w-full text-xs text-muted-foreground">
                      <FileCode2 className="mr-1 inline h-3 w-3" />
                      {c.filesChanged.slice(0, 8).join(', ')}
                      {c.filesChanged.length > 8 ? ` (+${c.filesChanged.length - 8} more)` : ''}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
