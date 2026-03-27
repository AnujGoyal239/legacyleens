// ============================================================
// LegacyLens — Health Score Widget (Circular Progress)
// ============================================================

import { useParams, Link } from 'react-router-dom';
import { MessageSquare, RefreshCw, Loader2, TrendingUp, Info } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

function getGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'Good', color: 'text-green-400' };
  if (score >= 50) return { label: 'Moderate', color: 'text-amber-400' };
  if (score >= 30) return { label: 'Poor', color: 'text-orange-400' };
  return { label: 'Critical', color: 'text-red-400' };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 50) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function CircularProgress({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148,163,184,0.15)"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function SubScoreBar({ label, score, tooltip }: { label: string; score: number; tooltip: string }) {
  const color = getScoreColor(score);

  return (
    <div className="space-y-1" title={tooltip}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium" style={{ color }}>{score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function HealthScoreWidget() {
  const { id: projectId } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: score, isLoading } = trpc.healthScore.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const computeMutation = trpc.healthScore.compute.useMutation({
    onSuccess: () => {
      utils.healthScore.get.invalidate({ projectId: projectId! });
    },
  });

  if (!projectId) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="h-28 w-28 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Codebase Health Score</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Analyze the health and understandability of this codebase
          </p>
          <button
            onClick={() => computeMutation.mutate({ projectId })}
            disabled={computeMutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {computeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {computeMutation.isPending ? 'Computing...' : 'Compute Health Score'}
          </button>
        </div>
      </div>
    );
  }

  const grade = getGrade(score.overallScore);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Codebase Health</h3>
        </div>
        <button
          onClick={() => computeMutation.mutate({ projectId })}
          disabled={computeMutation.isPending}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted disabled:opacity-50"
          title="Recompute score"
        >
          {computeMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="flex items-start gap-6">
        {/* Circular score */}
        <div className="flex flex-col items-center gap-2">
          <CircularProgress score={score.overallScore} />
          <span className={cn('text-sm font-semibold', grade.color)}>
            {grade.label}
          </span>
        </div>

        {/* Sub-scores */}
        <div className="flex-1 space-y-3">
          <SubScoreBar
            label="Documentation Coverage"
            score={score.docCoverageScore}
            tooltip="Percentage of functions/classes with documentation"
          />
          <SubScoreBar
            label="Critical File Risk"
            score={score.criticalFileRiskScore}
            tooltip="Coverage of documentation on high-dependency files"
          />
          <SubScoreBar
            label="Code Complexity"
            score={score.complexityScore}
            tooltip="Average cyclomatic complexity across files"
          />
          <SubScoreBar
            label="Onboarding Readiness"
            score={score.onboardingReadiness}
            tooltip="Presence of README, entry points, clear structure"
          />
        </div>
      </div>

      {/* Improve Score CTA */}
      <div className="mt-4 pt-4 border-t border-border">
        <Link
          to={`/dashboard/project/${projectId}/qa`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium transition hover:bg-muted"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Improve Score — Ask how to fix underdocumented files
        </Link>
      </div>
    </div>
  );
}
