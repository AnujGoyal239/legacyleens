// ============================================================
// LegacyLens — Architecture Page (Graph + List view)
// ============================================================

import { useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  GitBranch,
  AlertTriangle,
  Search,
  FileCode2,
  Shield,
  LayoutGrid,
  List,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { getRiskBadge, formatNumber, cn } from '@/lib/utils';
import ArchitectureGraph from '@/components/ui/ArchitectureGraph';
import ArchitectureSidePanel from '@/components/ui/ArchitectureSidePanel';

interface ProjectFile {
  id: string;
  filePath: string;
  fileType: string;
  riskLevel: string;
  dependentsCount: number;
  dependenciesCount: number;
  linesOfCode: number;
  isEntryPoint: boolean;
}

const RISK_ORDER = ['critical', 'high', 'medium', 'low'];
const FILTERS = [
  { id: 'all', label: 'Show all' },
  { id: 'critical', label: 'Critical only' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
];

export default function Architecture() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [sidePanelFile, setSidePanelFile] = useState<ProjectFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [graphFilter, setGraphFilter] = useState('all');
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.project.getArchitecture.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const getFileContentMutation = trpc.project.getFileContent.useMutation();

  const files = (data?.files ?? []).map((f) => ({ ...f, linesOfCode: f.linesOfCode ?? 0 })) as ProjectFile[];
  const techStack = data?.techStack as
    | { languages?: { name: string }[]; frameworks?: string[] }
    | null
    | undefined;
  const graphData = data?.graph as { nodes?: unknown[]; edges?: unknown[] } | null;

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

  const handleNodeClick = (node: { filePath: string; riskLevel: string; dependentsCount: number; dependenciesCount: number; linesOfCode: number; isEntryPoint: boolean }) => {
    const file = files.find((f) => f.filePath === node.filePath);
    setSidePanelFile(file || {
      id: '',
      filePath: node.filePath,
      fileType: node.filePath.split('.').pop() || '',
      riskLevel: node.riskLevel,
      dependentsCount: node.dependentsCount,
      dependenciesCount: node.dependenciesCount,
      linesOfCode: node.linesOfCode,
      isEntryPoint: node.isEntryPoint,
    });
  };

  const handleResetZoom = () => {
    const container = graphContainerRef.current?.querySelector('[class*="rounded-xl"]') as any;
    if (container?.__resetZoom) container.__resetZoom();
  };

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
        <div className="h-[500px] animate-pulse rounded-xl bg-muted" />
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

      {/* View toggle + filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-muted/30">
            <button
              onClick={() => setViewMode('graph')}
              className={cn(
                'flex items-center gap-1.5 rounded-l-lg px-3 py-2 text-sm font-medium transition',
                viewMode === 'graph'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Graph
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-r-lg px-3 py-2 text-sm font-medium transition',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>

          {/* Graph filters */}
          {viewMode === 'graph' && (
            <>
              <div className="h-6 w-px bg-border" />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setGraphFilter(f.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    graphFilter === f.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={handleResetZoom}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                title="Reset zoom"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Graph view */}
      {viewMode === 'graph' && (
        <div ref={graphContainerRef}>
          <ArchitectureGraph
            files={files}
            graphData={graphData}
            onNodeClick={handleNodeClick}
            searchQuery={searchQuery}
            filter={graphFilter}
          />
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {RISK_ORDER.map((level) => {
            const items = groupedByRisk[level] ?? [];
            if (items.length === 0) return null;

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
                  {items.map((f) => {
                    const isSelected = selectedFile?.id === f.id;
                    return (
                      <li key={f.id} className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-4 hover:bg-muted/50"
                          onClick={async () => {
                            if (!projectId) return;
                            if (isSelected) {
                              setSelectedFile(null);
                              setFileContent('');
                              return;
                            }
                            setSelectedFile(f);
                            setFileContent('');
                            try {
                              const res = await getFileContentMutation.mutateAsync({
                                projectId,
                                filePath: f.filePath,
                              });
                              setFileContent(res.content);
                            } catch {
                              setFileContent('// Failed to load file content from GitHub.');
                            }
                          }}
                        >
                          <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate font-mono text-left" title={f.filePath}>
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
                        </button>

                        {isSelected && (
                          <div className="mt-2 rounded-md bg-muted/40 p-3">
                            {getFileContentMutation.isPending && !fileContent ? (
                              <p className="text-xs text-muted-foreground">Loading code…</p>
                            ) : (
                              <pre className="whitespace-pre text-xs font-mono">
                                {fileContent || '// No content loaded.'}
                              </pre>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-muted-foreground">
          <Search className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4">No files match your search</p>
        </div>
      )}

      {/* Side Panel */}
      {sidePanelFile && (
        <ArchitectureSidePanel
          file={sidePanelFile}
          onClose={() => setSidePanelFile(null)}
        />
      )}
    </div>
  );
}
