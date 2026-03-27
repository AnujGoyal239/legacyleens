// ============================================================
// LegacyLens — DevOps Helper Page
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldAlert,
  FileCode2,
  GitCommit,
  Lightbulb,
  ListChecks,
  Copy,
  BookOpen,
  SlidersHorizontal,
  GitBranch,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type TabId = 'incident' | 'blast' | 'recent' | 'safe' | 'runbook' | 'config' | 'replay' | 'log';

export default function DevOps() {
  const { id: projectId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('incident');
  const [errorMessage, setErrorMessage] = useState('');
  const [blastFilePath, setBlastFilePath] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [incidentSummary, setIncidentSummary] = useState('');
  const [incidentRootCause, setIncidentRootCause] = useState('');
  const [incidentResolution, setIncidentResolution] = useState('');
  const [incidentFilesChanged, setIncidentFilesChanged] = useState('');
  const [copied, setCopied] = useState(false);
  const [rollbackSteps, setRollbackSteps] = useState('');
  const [hotfixSteps, setHotfixSteps] = useState('');
  const [envVarsText, setEnvVarsText] = useState('');
  const [replayStackTrace, setReplayStackTrace] = useState('');

  const { data: project } = trpc.project.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const files = project?.files ?? [];
  const filePaths = files.map((f) => f.filePath).filter(Boolean).sort();

  const incidentContextMutation = trpc.devops.getIncidentContext.useMutation();
  const safeChangeMutation = trpc.devops.getSafeChangeSuggestion.useMutation();
  const detectRunbookMutation = trpc.devops.detectRunbook.useMutation();
  const saveRunbookMutation = trpc.devops.saveRunbook.useMutation();
  const incidentReplayMutation = trpc.devops.getIncidentReplay.useMutation();
  const createIncidentMutation = trpc.devops.createIncident.useMutation({
    onSuccess: () => {
      utils.devops.listIncidents.invalidate({ projectId: projectId! });
      setIncidentSummary('');
      setIncidentRootCause('');
      setIncidentResolution('');
      setIncidentFilesChanged('');
    },
  });

  const { data: blastData, isLoading: blastLoading } = trpc.devops.getBlastRadius.useQuery(
    { projectId: projectId!, filePath: blastFilePath },
    { enabled: !!projectId && !!blastFilePath }
  );
  const { data: lastCommitData } = trpc.project.getLastCommitForFile.useQuery(
    { projectId: projectId!, filePath: blastFilePath },
    { enabled: !!projectId && !!blastFilePath }
  );
  const { data: recentData } = trpc.devops.getRecentChanges.useQuery(
    { projectId: projectId!, limit: 15 },
    { enabled: !!projectId }
  );
  const { data: incidentsData } = trpc.devops.listIncidents.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: runbookData } = trpc.devops.getRunbook.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: envData, refetch: refetchEnv, isFetching: envFetching } = trpc.devops.detectEnvVars.useQuery(
    { projectId: projectId! },
    { enabled: false }
  );
  const { data: exportData } = trpc.devops.exportContext.useQuery(
    {
      projectId: projectId!,
      filePath: blastFilePath || undefined,
      errorMessage: errorMessage || undefined,
    },
    { enabled: !!projectId && (!!blastFilePath || !!errorMessage) }
  );
  const utils = trpc.useUtils();

  const handleGetIncidentContext = () => {
    if (!projectId || !errorMessage.trim()) return;
    incidentContextMutation.mutate({
      projectId,
      errorMessage: errorMessage.trim(),
      includeRunbook: true,
    });
  };

  const handleGetSafeChange = () => {
    if (!projectId || !bugDescription.trim()) return;
    safeChangeMutation.mutate({ projectId, bugDescription: bugDescription.trim() });
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !incidentSummary.trim()) return;
    createIncidentMutation.mutate({
      projectId,
      summary: incidentSummary.trim(),
      rootCause: incidentRootCause.trim() || undefined,
      filesChanged: incidentFilesChanged.trim() ? incidentFilesChanged.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : [],
      resolution: incidentResolution.trim() || undefined,
    });
  };

  const copyExport = () => {
    if (exportData?.markdown) {
      navigator.clipboard.writeText(exportData.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'incident', label: 'Incident context', icon: ShieldAlert },
    { id: 'blast', label: 'Blast radius', icon: FileCode2 },
    { id: 'recent', label: 'Recent changes', icon: GitCommit },
    { id: 'safe', label: 'Safe change', icon: Lightbulb },
    { id: 'runbook', label: 'Runbook', icon: BookOpen },
    { id: 'config', label: 'Config/Env', icon: SlidersHorizontal },
    { id: 'replay', label: 'Call path', icon: GitBranch },
    { id: 'log', label: 'Incident log', icon: ListChecks },
  ];

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
        <ShieldAlert className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">DevOps Helper</h1>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
              activeTab === tab.id
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Incident context */}
      {activeTab === 'incident' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Paste error or stack trace</h2>
          <textarea
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            placeholder="Paste stack trace or error message..."
            className="min-h-[120px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm"
            rows={5}
          />
          <button
            type="button"
            onClick={handleGetIncidentContext}
            disabled={!errorMessage.trim() || incidentContextMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {incidentContextMutation.isPending ? 'Loading...' : 'Get context & runbook'}
          </button>
          {incidentContextMutation.data && (
            <div className="space-y-4 pt-2">
              {incidentContextMutation.data.stackFrames.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Parsed stack</h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {incidentContextMutation.data.stackFrames.slice(0, 8).map((f, i) => (
                      <li key={i}>
                        {f.filePath ?? '?'}:{f.line ?? '?'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {incidentContextMutation.data.searchResults.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Relevant code</h3>
                  <ul className="space-y-2">
                    {incidentContextMutation.data.searchResults.slice(0, 5).map((r, i) => (
                      <li key={i} className="rounded border border-border bg-muted/20 p-2 text-sm">
                        <span className="font-medium">{r.filePath}</span>
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs">
                          {r.content.slice(0, 300)}...
                        </pre>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {incidentContextMutation.data.runbookText && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Runbook</h3>
                  <div className="prose prose-sm max-w-none rounded border border-border bg-muted/20 p-3 text-sm">
                    {incidentContextMutation.data.runbookText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Blast radius */}
      {activeTab === 'blast' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Select a file to see impact</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={blastFilePath}
              onChange={(e) => setBlastFilePath(e.target.value)}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <option value="">Choose file...</option>
              {filePaths.slice(0, 200).map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </div>
          {blastFilePath && (
            <div className="pt-2">
              {blastLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : blastData ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>{blastData.dependentsCount}</strong> file(s) depend on{' '}
                    <code className="rounded bg-muted px-1">{blastData.filePath}</code>
                  </p>
                  {lastCommitData?.commit && (
                    <p className="text-xs text-muted-foreground rounded border border-border bg-muted/20 px-2 py-1.5">
                      <span className="font-medium text-foreground">Last commit:</span>{' '}
                      {lastCommitData.commit.message} — {lastCommitData.commit.author}{' '}
                      ({new Date(lastCommitData.commit.committedAt).toLocaleDateString()})
                    </p>
                  )}
                  <ul className="max-h-64 list-inside list-disc overflow-y-auto text-sm text-muted-foreground">
                    {blastData.dependents.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  {exportData?.markdown && (
                    <button
                      type="button"
                      onClick={copyExport}
                      className="mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? 'Copied' : 'Copy context for handoff'}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Recent changes */}
      {activeTab === 'recent' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 font-medium">Recent commits</h2>
          {recentData?.commits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commits in index. Re-index to populate.</p>
          ) : (
            <ul className="space-y-2">
              {recentData?.commits.map((c) => (
                <li
                  key={c.commitHash}
                  className="flex items-start gap-2 rounded border border-border bg-muted/20 p-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">{c.commitHash.slice(0, 7)}</span>
                  <span>{c.message}</span>
                  <span className="text-muted-foreground">— {c.author}</span>
                  {c.filesChanged?.length ? (
                    <span className="text-xs text-muted-foreground">
                      ({c.filesChanged.length} files)
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Safe change suggestion */}
      {activeTab === 'safe' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Describe the bug for a minimal fix suggestion</h2>
          <textarea
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="e.g. Login fails with 500 after Redis timeout"
            className="min-h-[80px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
            rows={3}
          />
          <button
            type="button"
            onClick={handleGetSafeChange}
            disabled={!bugDescription.trim() || safeChangeMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {safeChangeMutation.isPending ? 'Thinking...' : 'Suggest safe change'}
          </button>
          {safeChangeMutation.data && (
            <div className="space-y-3 pt-2">
              {safeChangeMutation.data.warning && (
                <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-400">
                  {safeChangeMutation.data.warning}
                </div>
              )}
              <div className="prose prose-sm max-w-none rounded border border-border bg-muted/20 p-3 text-sm">
                {safeChangeMutation.data.hint}
              </div>
              {safeChangeMutation.data.suggestedFiles.length > 0 && (
                <ul className="text-sm">
                  {safeChangeMutation.data.suggestedFiles.map((f, i) => (
                    <li key={i}>
                      <code className="rounded bg-muted px-1">{f.filePath}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Runbook (rollback/hotfix) */}
      {activeTab === 'runbook' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Rollback / Hotfix runbook (on-demand)</h2>
            <button
              type="button"
              onClick={() => projectId && detectRunbookMutation.mutate({ projectId })}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
              disabled={detectRunbookMutation.isPending}
            >
              {detectRunbookMutation.isPending ? 'Detecting...' : 'Detect from repo'}
            </button>
          </div>

          {detectRunbookMutation.data?.detected?.signals?.length ? (
            <div className="rounded border border-border bg-muted/20 p-2 text-sm text-muted-foreground">
              Signals: {detectRunbookMutation.data.detected.signals.join(' · ')}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Rollback steps</label>
              <textarea
                value={rollbackSteps || runbookData?.runbook?.rollbackSteps || detectRunbookMutation.data?.detected?.rollbackSteps || ''}
                onChange={(e) => setRollbackSteps(e.target.value)}
                className="min-h-[180px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hotfix steps</label>
              <textarea
                value={hotfixSteps || runbookData?.runbook?.hotfixSteps || detectRunbookMutation.data?.detected?.hotfixSteps || ''}
                onChange={(e) => setHotfixSteps(e.target.value)}
                className="min-h-[180px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!projectId) return;
                const envVars = envVarsText
                  .split(/[\n,]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                saveRunbookMutation.mutate({
                  projectId,
                  rollbackSteps: rollbackSteps || runbookData?.runbook?.rollbackSteps || detectRunbookMutation.data?.detected?.rollbackSteps || '',
                  hotfixSteps: hotfixSteps || runbookData?.runbook?.hotfixSteps || detectRunbookMutation.data?.detected?.hotfixSteps || '',
                  envVars,
                });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={saveRunbookMutation.isPending}
            >
              {saveRunbookMutation.isPending ? 'Saving...' : 'Save runbook'}
            </button>
            {saveRunbookMutation.isSuccess ? (
              <span className="text-sm text-muted-foreground">Saved.</span>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Env vars (optional, for quick checks)</label>
            <textarea
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              placeholder="REDIS_URL\nDATABASE_URL\n..."
              className="min-h-[80px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* Config / Env map */}
      {activeTab === 'config' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Config / Env map (on-demand)</h2>
            <button
              type="button"
              onClick={() => refetchEnv()}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
              disabled={envFetching}
            >
              {envFetching ? 'Scanning...' : 'Scan env vars'}
            </button>
          </div>

          {envData?.env?.length ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Found <strong>{envData.env.length}</strong> env var(s) used in code (best-effort from indexed content).
              </p>
              <ul className="space-y-2 text-sm">
                {envData.env.map((v) => (
                  <li key={v.name} className="rounded border border-border bg-muted/20 p-2">
                    <div className="font-mono font-medium">{v.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {v.files.slice(0, 6).join(', ')}
                      {v.files.length > 6 ? ` (+${v.files.length - 6} more)` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click “Scan env vars” to generate a map of `process.env.*` usage.
            </p>
          )}
        </div>
      )}

      {/* Incident replay — call path from stack trace */}
      {activeTab === 'replay' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Call path from stack trace</h2>
          <p className="text-sm text-muted-foreground">
            Paste a stack trace to see the request path: entry → … → failure.
          </p>
          <textarea
            value={replayStackTrace}
            onChange={(e) => setReplayStackTrace(e.target.value)}
            placeholder="Paste stack trace (e.g. at src/server/auth.ts:42:10..."
            className="min-h-[140px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm"
            rows={6}
          />
          <button
            type="button"
            onClick={() => projectId && replayStackTrace.trim() && incidentReplayMutation.mutate({ projectId, stackTrace: replayStackTrace.trim() })}
            disabled={!replayStackTrace.trim() || incidentReplayMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {incidentReplayMutation.isPending ? 'Building path...' : 'Show call path'}
          </button>
          {incidentReplayMutation.data?.path?.length ? (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-medium">Request path</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {incidentReplayMutation.data.path.map((step, i) => (
                  <span key={step.index} className="flex items-center gap-1">
                    <span
                      className={cn(
                        'rounded px-2 py-1 font-mono',
                        step.isFailure ? 'bg-destructive/20 text-destructive font-medium' : 'bg-muted/50'
                      )}
                      title={step.raw}
                    >
                      {step.filePath}{step.line != null ? `:${step.line}` : ''}
                    </span>
                    {i < incidentReplayMutation.data!.path.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Last step is the failure point. Path order: entry (bottom of stack) to failure (top).
              </p>
            </div>
          ) : incidentReplayMutation.isSuccess && incidentReplayMutation.data?.path?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No frames could be matched to project files. Check that the stack trace contains file paths.</p>
          ) : null}
        </div>
      )}

      {/* Incident log */}
      {activeTab === 'log' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 font-medium">Log a new incident</h2>
            <form onSubmit={handleCreateIncident} className="space-y-3">
              <input
                type="text"
                value={incidentSummary}
                onChange={(e) => setIncidentSummary(e.target.value)}
                placeholder="Summary (required)"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                value={incidentRootCause}
                onChange={(e) => setIncidentRootCause(e.target.value)}
                placeholder="Root cause (optional)"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              />
              <textarea
                value={incidentResolution}
                onChange={(e) => setIncidentResolution(e.target.value)}
                placeholder="Resolution (optional)"
                className="min-h-[60px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={incidentFilesChanged}
                onChange={(e) => setIncidentFilesChanged(e.target.value)}
                placeholder="Files changed (comma or newline separated)"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={createIncidentMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createIncidentMutation.isPending ? 'Saving...' : 'Save incident'}
              </button>
            </form>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 font-medium">Past incidents</h2>
            {incidentsData?.incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents logged yet.</p>
            ) : (
              <ul className="space-y-3">
                {incidentsData?.incidents.map((inc) => (
                  <li
                    key={inc.id}
                    className="rounded border border-border bg-muted/20 p-3 text-sm"
                  >
                    <p className="font-medium">{inc.summary}</p>
                    {inc.rootCause && (
                      <p className="mt-1 text-muted-foreground">Cause: {inc.rootCause}</p>
                    )}
                    {inc.filesChanged?.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Files: {inc.filesChanged.join(', ')}
                      </p>
                    ) : null}
                    {inc.resolution && (
                      <p className="mt-1 text-muted-foreground">Fix: {inc.resolution}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(inc.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
