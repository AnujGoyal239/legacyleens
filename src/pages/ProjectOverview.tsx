// ============================================================
// LegacyLens — Project Overview Page
// ============================================================

import { useParams, Link } from 'react-router-dom';
import {
  GitBranch,
  FileCode2,
  AlertTriangle,
  Play,
  ExternalLink,
  Code2,
  MessageSquare,
  LayoutDashboard,
  Mic,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatNumber, getStatusInfo, getRiskBadge, cn } from '@/lib/utils';
import HealthScoreWidget from '@/components/ui/HealthScoreWidget';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProjectOverview() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.project.get.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'indexing' || status === 'pending' ? 3000 : false;
      },
    }
  );
  const startIndexingMutation = trpc.project.startIndexing.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ projectId });
      utils.project.list.invalidate();
    },
  });

  const handleStartIndexing = () => {
    startIndexingMutation.mutate({ projectId });
  };

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const statusInfo = getStatusInfo(project.status);

  const riskDistribution = project.files?.reduce(
    (acc, f) => {
      const level = f.riskLevel || 'low';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? { low: 0, medium: 0, high: 0, critical: 0 };

  const totalLines = project.files?.reduce((sum, f) => sum + (f.linesOfCode || 0), 0) ?? project.totalLines ?? 0;
  const entryPoints = project.files?.filter((f) => f.isEntryPoint).length ?? (project.entryPoints?.length || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                statusInfo.className
              )}
            >
              {statusInfo.label}
            </span>
          </div>
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <GitBranch className="h-4 w-4" />
              {project.githubUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {project.techStack && typeof project.techStack === 'object' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(project.techStack as { frameworks?: string[] }).frameworks?.map((f: string) => (
                <span
                  key={f}
                  className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium"
                >
                  {f}
                </span>
              )) ?? null}
              {(project.techStack as { languages?: { name: string }[] }).languages?.slice(0, 5).map((l: { name: string }) => (
                <span
                  key={l.name}
                  className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium"
                >
                  {l.name}
                </span>
              )) ?? null}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {project.status === 'pending' && project.githubUrl && (
            <button
              onClick={handleStartIndexing}
              disabled={startIndexingMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {startIndexingMutation.isPending ? 'Starting...' : 'Start Indexing'}
            </button>
          )}
          {project.status === 'indexing' && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${project.totalFiles ? (project.processedFiles / project.totalFiles) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {project.processedFiles} / {project.totalFiles} files
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          to={`/dashboard/project/${projectId}/architecture`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <Code2 className="h-4 w-4" />
          Architecture
        </Link>
        <Link
          to={`/dashboard/project/${projectId}/qa`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <MessageSquare className="h-4 w-4" />
          Q&A
        </Link>
        <Link
          to={`/dashboard/project/${projectId}/board`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" />
          Board
        </Link>
        <Link
          to={`/dashboard/project/${projectId}/meetings`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          <Mic className="h-4 w-4" />
          Meetings
        </Link>
        <Link
          to={`/dashboard/project/${projectId}/onboarding`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          <BookOpen className="h-4 w-4" />
          Generate Onboarding Guide
        </Link>
      </div>

      {/* Stats + Health Score row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stats cards */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Total files"
              value={formatNumber(project.files?.length ?? project._count?.files ?? 0)}
              icon={FileCode2}
            />
            <StatCard
              label="Lines of code"
              value={formatNumber(totalLines)}
              icon={FileCode2}
            />
            <StatCard
              label="Entry points"
              value={formatNumber(entryPoints)}
              icon={Code2}
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Risk distribution</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                      const count = riskDistribution[level] || 0;
                      if (count === 0) return null;
                      const badge = getRiskBadge(level);
                      return (
                        <span
                          key={level}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            badge.className
                          )}
                        >
                          {badge.label}: {count}
                        </span>
                      );
                    })}
                    {Object.keys(riskDistribution).length === 0 && (
                      <span className="text-xs text-muted-foreground">No data yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Score Widget */}
        {project.status === 'complete' && <HealthScoreWidget />}
      </div>

      {/* File list table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">File path</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Lines</th>
                <th className="px-4 py-3 text-left font-medium">Risk level</th>
                <th className="px-4 py-3 text-left font-medium">Dependents</th>
              </tr>
            </thead>
            <tbody>
              {project.files?.length ? (
                project.files.slice(0, 50).map((file) => {
                  const riskBadge = getRiskBadge(file.riskLevel || 'low');
                  return (
                    <tr
                      key={file.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{file.filePath}</td>
                      <td className="px-4 py-3 text-muted-foreground">{file.fileType}</td>
                      <td className="px-4 py-3">{formatNumber(file.linesOfCode || 0)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            riskBadge.className
                          )}
                        >
                          {riskBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatNumber(file.dependentsCount || 0)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No files indexed yet. Connect a GitHub repo and start indexing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
