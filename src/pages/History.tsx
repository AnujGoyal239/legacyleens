// ============================================================
// LegacyLens — Code History (with Commit "Why" Intelligence)
// ============================================================

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitCommit,
  FileCode2,
  User,
  Calendar,
  Sparkles,
  Loader2,
  HelpCircle,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime, cn } from '@/lib/utils';

export default function History() {
  const { id: projectId } = useParams<{ id: string }>();
  const [fileFilter, setFileFilter] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

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

  // Get cached Why insights
  const { data: insightsData } = trpc.history.getInsights.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const insightMap = insightsData?.insights ?? {};

  // Generate Why for single commit
  const generateWhyMutation = trpc.history.generateWhy.useMutation({
    onSuccess: () => {
      utils.history.getInsights.invalidate({ projectId: projectId! });
      setGeneratingFor(null);
    },
    onError: () => {
      setGeneratingFor(null);
    },
  });

  // Bulk generate Why
  const generateAllWhyMutation = trpc.history.generateAllWhy.useMutation({
    onSuccess: () => {
      utils.history.getInsights.invalidate({ projectId: projectId! });
    },
  });

  const commits = commitsData?.commits ?? [];
  const commitsWithoutSummary = commits.filter((c) => !(c as { summary?: string | null }).summary).length;
  const commitsWithoutWhy = commits.filter((c) => !insightMap[c.commitHash]).length;

  const handleGenerateWhy = (commitHash: string) => {
    if (!projectId) return;
    setGeneratingFor(commitHash);
    generateWhyMutation.mutate({ projectId, commitHash });
  };

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
        Recent commits with AI-generated summaries and &quot;Why&quot; intelligence — understand the business and technical reasons behind each change.
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Generate summaries button */}
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
              {generateSummariesMutation.isPending ? 'Generating...' : 'Generate summaries'}
            </button>
            {/* Generate Why for all commits */}
            <button
              type="button"
              onClick={() => projectId && generateAllWhyMutation.mutate({ projectId, limit: 20 })}
              disabled={generateAllWhyMutation.isPending || commitsWithoutWhy === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {generateAllWhyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {generateAllWhyMutation.isPending ? 'Generating...' : 'Generate "Why" for all'}
            </button>
          </div>
        </div>

        {generateSummariesMutation.isSuccess && (
          <p className="mb-2 text-xs text-muted-foreground">
            Generated {generateSummariesMutation.data?.generated ?? 0} summary(ies).
          </p>
        )}
        {generateAllWhyMutation.isSuccess && (
          <p className="mb-2 text-xs text-muted-foreground">
            Generated {generateAllWhyMutation.data?.generated ?? 0} &quot;Why&quot; explanation(s).
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : commits.length === 0 ? (
          /* Improved empty state with CTA (Feature 6) */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitCommit className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-sm font-semibold">No commit history yet</h3>
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">
              Re-index the project to populate commit history. Commits are fetched from the GitHub
              repository during indexing.
            </p>
            <Link
              to={`/dashboard/project/${projectId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Go to Overview to Re-index
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {commits.map((c) => {
              const summary = (c as { summary?: string | null }).summary;
              const why = insightMap[c.commitHash];
              const isGenerating = generatingFor === c.commitHash;

              return (
                <li
                  key={c.commitHash}
                  className="rounded-lg border border-border bg-muted/20 p-4 text-sm"
                >
                  {/* Commit header */}
                  <div className="flex flex-wrap items-start gap-2">
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
                  </div>

                  {/* Summary */}
                  {summary && (
                    <div className="mt-2 rounded border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
                      <span className="font-medium text-muted-foreground">Summary: </span>
                      {summary}
                    </div>
                  )}

                  {/* Why section */}
                  {why ? (
                    <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
                      <span className="font-medium text-amber-500">Why: </span>
                      {why}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateWhy(c.commitHash)}
                      disabled={isGenerating}
                      className="mt-2 inline-flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <HelpCircle className="h-3 w-3" />
                      )}
                      {isGenerating ? 'Generating...' : 'Generate "Why"'}
                    </button>
                  )}

                  {/* Files changed */}
                  {c.filesChanged?.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <FileCode2 className="mr-1 h-3 w-3" />
                      {c.filesChanged.slice(0, 5).map((f) => (
                        <Link
                          key={f}
                          to={`/dashboard/project/${projectId}/architecture`}
                          className="rounded bg-muted/50 px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                        >
                          {f.split('/').pop()}
                        </Link>
                      ))}
                      {c.filesChanged.length > 5 ? (
                        <span className="text-muted-foreground/60">
                          (+{c.filesChanged.length - 5} more)
                        </span>
                      ) : null}
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
