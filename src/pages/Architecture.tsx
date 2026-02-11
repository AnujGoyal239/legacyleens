// ============================================================
// LegacyLens — Architecture Page
// ============================================================

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  GitBranch,
  AlertTriangle,
  Search,
  FileCode2,
  Shield,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { getRiskBadge, formatNumber } from '@/lib/utils';

interface ProjectFile {
  id: string;
  filePath: string;
  fileType: string;
  riskLevel: string;
  dependentsCount: number;
  dependenciesCount: number;
  linesOfCode?: number;
  isEntryPoint: boolean;
}

const RISK_ORDER = ['critical', 'high', 'medium', 'low'];

export default function Architecture() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = trpc.project.getArchitecture.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const files = (data?.files ?? []) as ProjectFile[];
  const techStack = data?.techStack as
    | { languages?: { name: string }[]; frameworks?: string[] }
    | null
    | undefined;

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.filePath.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const groupedByRisk = useMemo(() => {
    const groups: Record<string, ProjectFile[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    for (const f of filteredFiles) {
      const level = (f.riskLevel ?? 'low').toLowerCase();
      if (groups[level]) groups[level].push(f);
      else groups.low.push(f);
    }
    return groups;
  }, [filteredFiles]);

  const stats = useMemo(() => {
    const critical = files.filter((f) => f.riskLevel?.toLowerCase() === 'critical').length;
    const high = files.filter((f) => f.riskLevel?.toLowerCase() === 'high').length;
    return { total: files.length, critical, high };
  }, [files]);

  if (!projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid project
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card text-destructive">
        {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-12 w-full animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const techItems: string[] = [];
  if (techStack?.languages?.length) {
    techItems.push(...techStack.languages.map((l) => l.name));
  }
  if (techStack?.frameworks?.length) {
    techItems.push(...techStack.frameworks);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Architecture</h1>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <FileCode2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{formatNumber(stats.total)} files</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950/50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium">{formatNumber(stats.critical)} critical</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-900 dark:bg-orange-950/50">
          <Shield className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium">{formatNumber(stats.high)} high risk</span>
        </div>
      </div>

      {/* Tech stack badges */}
      {techItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {techItems.map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Filter / search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by file name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Files by risk level */}
      <div className="space-y-6">
        {RISK_ORDER.map((level) => {
          const items = groupedByRisk[level] ?? [];
          if (items.length === 0) return null;

          const label = level.charAt(0).toUpperCase() + level.slice(1);
          const badge = getRiskBadge(level);

          return (
            <div key={level} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {items.length} file{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {items.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono" title={f.filePath}>
                      {f.filePath}
                    </span>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                      {f.isEntryPoint && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                          entry
                        </span>
                      )}
                      <span title="Dependents">
                        {formatNumber(f.dependentsCount)} deps
                      </span>
                      <span title="Dependencies">
                        {formatNumber(f.dependenciesCount)} uses
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-muted-foreground">
          <Search className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4">No files match your search</p>
        </div>
      )}
    </div>
  );
}
