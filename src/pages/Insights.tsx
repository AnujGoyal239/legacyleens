// ============================================================
// LegacyLens — Insights (Security, Test coverage, Health, Refactor, Fix it)
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  TestTube,
  Activity,
  Boxes,
  Wrench,
  Gauge,
  Loader2,
  AlertTriangle,
  FileCode2,
  GitBranch,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type TabId = 'security' | 'tests' | 'health' | 'refactor' | 'fixit' | 'benchmarks';

export default function Insights() {
  const { id: projectId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('security');
  const [testFilePath, setTestFilePath] = useState('');
  const [refactorFilePath, setRefactorFilePath] = useState('');
  const [refactorSelection, setRefactorSelection] = useState('');
  const [refactorPattern, setRefactorPattern] = useState('');
  const [fixInstruction, setFixInstruction] = useState('');

  // Benchmarks state
  const [benchmarkSuiteId, setBenchmarkSuiteId] = useState<string>('');
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDesc, setNewSuiteDesc] = useState('');
  const [newCaseName, setNewCaseName] = useState('');
  const [newCasePrompt, setNewCasePrompt] = useState('');
  const [newCaseKeywords, setNewCaseKeywords] = useState('');
  const [newCaseFiles, setNewCaseFiles] = useState('');
  const [newCaseMinScore, setNewCaseMinScore] = useState(0.6);

  const { data: project } = trpc.project.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const filePaths = (project?.files ?? []).map((f) => f.filePath).filter(Boolean).sort();

  const { data: secrets, isLoading: secretsLoading } = trpc.insights.scanSecrets.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && activeTab === 'security' }
  );
  const { data: vulnDeps, isLoading: vulnLoading } = trpc.insights.getVulnerableDeps.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && activeTab === 'security' }
  );
  const { data: licenses, isLoading: licensesLoading } = trpc.insights.getLicenseList.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && activeTab === 'security' }
  );

  const { data: testsForFile } = trpc.insights.getTestsForFile.useQuery(
    { projectId: projectId!, filePath: testFilePath },
    { enabled: !!projectId && !!testFilePath && activeTab === 'tests' }
  );
  const { data: filesWithNoTests } = trpc.insights.getFilesWithNoTests.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && activeTab === 'tests' }
  );

  const { data: health } = trpc.insights.getHealthDashboard.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && activeTab === 'health' }
  );

  const { data: refs } = trpc.insights.findReferences.useQuery(
    { projectId: projectId!, filePath: refactorFilePath, symbol: undefined },
    { enabled: !!projectId && !!refactorFilePath && activeTab === 'refactor' }
  );

  const suggestExtractMutation = trpc.insights.suggestExtract.useMutation();
  const suggestSplitMutation = trpc.insights.suggestSplit.useMutation();
  const suggestHelperMutation = trpc.insights.suggestSharedHelper.useMutation();
  const suggestFixesMutation = trpc.insights.suggestFixes.useMutation();
  const createPrMutation = trpc.insights.createPrDraft.useMutation();

  // Benchmarks API
  const utils = trpc.useUtils();
  const { data: benchmarkSuites, isLoading: suitesLoading } = trpc.benchmarks.listSuites.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && activeTab === 'benchmarks' }
  );
  const { data: selectedSuite } = trpc.benchmarks.getSuite.useQuery(
    { projectId: projectId!, suiteId: benchmarkSuiteId },
    { enabled: !!projectId && activeTab === 'benchmarks' && !!benchmarkSuiteId }
  );
  const createSuiteMutation = trpc.benchmarks.createSuite.useMutation({
    onSuccess: (s) => {
      utils.benchmarks.listSuites.invalidate({ projectId: projectId! });
      setBenchmarkSuiteId(s.id);
      setNewSuiteName('');
      setNewSuiteDesc('');
    },
  });
  const addCaseMutation = trpc.benchmarks.addCase.useMutation({
    onSuccess: () => {
      if (projectId && benchmarkSuiteId) {
        utils.benchmarks.getSuite.invalidate({ projectId, suiteId: benchmarkSuiteId });
      }
      setNewCaseName('');
      setNewCasePrompt('');
      setNewCaseKeywords('');
      setNewCaseFiles('');
      setNewCaseMinScore(0.6);
    },
  });
  const runSuiteMutation = trpc.benchmarks.runSuite.useMutation({
    onSuccess: (run) => {
      if (projectId && benchmarkSuiteId) {
        utils.benchmarks.getSuite.invalidate({ projectId, suiteId: benchmarkSuiteId });
      }
    },
  });

  const [extractResult, setExtractResult] = useState('');
  const [splitResult, setSplitResult] = useState('');
  const [helperResult, setHelperResult] = useState('');
  const [fixResult, setFixResult] = useState<{ summary: string; edits: { filePath: string; suggestion: string }[] } | null>(null);
  const [prBranch, setPrBranch] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prCreated, setPrCreated] = useState<{ prUrl: string; prNumber: number } | null>(null);

  const tabs: { id: TabId; label: string; icon: typeof ShieldCheck }[] = [
    { id: 'security', label: 'Security & Compliance', icon: ShieldCheck },
    { id: 'tests', label: 'Test Coverage & Gaps', icon: TestTube },
    { id: 'health', label: 'Codebase Health', icon: Activity },
    { id: 'refactor', label: 'Refactor Suggestions', icon: Boxes },
    { id: 'fixit', label: 'AI Fix it / PR', icon: Wrench },
    { id: 'benchmarks', label: 'Benchmarks', icon: Gauge },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Insights</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Security, test coverage, tech debt, refactor ideas, and AI-powered fix suggestions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Security & Compliance */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Secrets scan</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Potential secrets in indexed content (embeddings).
            </p>
            {secretsLoading ? (
              <Loader2 className="mt-3 h-5 w-5 animate-spin text-slate-400" />
            ) : (secrets?.length ?? 0) > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {(secrets ?? []).map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {s.filePath || 'unknown'} — {s.type}: {s.snippet}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No secrets detected in scanned content.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Vulnerable dependencies</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              From package.json + npm audit (when available).
            </p>
            {vulnLoading ? (
              <Loader2 className="mt-3 h-5 w-5 animate-spin text-slate-400" />
            ) : vulnDeps?.error ? (
              <p className="mt-3 text-sm text-amber-600">{vulnDeps.error}</p>
            ) : vulnDeps?.audit ? (
              <div className="mt-3 text-sm">
                <p className="font-medium">{vulnDeps.audit.summary}</p>
                <p className="text-slate-500">Total vulnerabilities: {vulnDeps.audit.vulnerabilities}</p>
              </div>
            ) : null}
            {vulnDeps?.dependencies && vulnDeps.dependencies.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
                {vulnDeps.dependencies.map((d, i) => (
                  <li key={i}>{d.name}@{d.version}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">License list</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Dependencies and licenses from npm registry.
            </p>
            {licensesLoading ? (
              <Loader2 className="mt-3 h-5 w-5 animate-spin text-slate-400" />
            ) : (licenses?.length ?? 0) > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 text-left font-medium">Package</th>
                      <th className="py-2 text-left font-medium">Version</th>
                      <th className="py-2 text-left font-medium">License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(licenses ?? []).map((l, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5">{l.name}</td>
                        <td className="py-1.5">{l.version}</td>
                        <td className="py-1.5">{l.license}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No package.json or no dependencies.</p>
            )}
          </section>
        </div>
      )}

      {/* Test coverage & gaps */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Which tests cover this file?</h2>
            <div className="mt-2 flex gap-2">
              <select
                value={testFilePath}
                onChange={(e) => setTestFilePath(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="">Select file…</option>
                {filePaths.slice(0, 500).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {testsForFile && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {testsForFile.length === 0 ? (
                  <li className="text-sm text-slate-500">No matching test file found (by convention).</li>
                ) : (
                  testsForFile.map((t, i) => (
                    <li key={i} className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                      <FileCode2 className="h-4 w-4" /> {t.filePath}
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Files with no tests</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Production files without a matching test file (by convention).
            </p>
            {filesWithNoTests && (
              <ul className="mt-3 max-h-64 overflow-y-auto text-sm">
                {filesWithNoTests.slice(0, 200).map((f, i) => (
                  <li key={i} className="py-0.5 text-slate-600 dark:text-slate-400">{f.filePath}</li>
                ))}
                {filesWithNoTests.length > 200 && (
                  <li className="text-slate-500">… and {filesWithNoTests.length - 200} more</li>
                )}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Codebase health */}
      {activeTab === 'health' && health && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Tech debt score</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Composite score (0–100); higher = more debt.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <span className={cn(
                'text-3xl font-bold',
                health.techDebtScore >= 50 ? 'text-amber-600' : health.techDebtScore >= 25 ? 'text-orange-500' : 'text-slate-700 dark:text-slate-300'
              )}>
                {health.techDebtScore}
              </span>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Dead / unused files</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Files never imported (excluding entry points).
            </p>
            <ul className="mt-3 max-h-48 overflow-y-auto text-sm">
              {health.deadOrUnusedFiles.slice(0, 100).map((f, i) => (
                <li key={i}>{f.filePath}</li>
              ))}
              {health.deadOrUnusedFiles.length > 100 && (
                <li className="text-slate-500">… and {health.deadOrUnusedFiles.length - 100} more</li>
              )}
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Complexity hotspots</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              High LOC × dependents.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 text-left font-medium">File</th>
                    <th className="py-2 text-right font-medium">LOC</th>
                    <th className="py-2 text-right font-medium">Dependents</th>
                    <th className="py-2 text-left font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {health.complexityHotspots.map((h, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{h.filePath}</td>
                      <td className="py-1.5 text-right">{h.linesOfCode}</td>
                      <td className="py-1.5 text-right">{h.dependentsCount}</td>
                      <td className="py-1.5">{h.riskLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {health.duplicateSuggestions.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Duplicate code</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{health.duplicateSuggestions[0]}</p>
            </section>
          )}
        </div>
      )}

      {/* Refactor suggestions */}
      {activeTab === 'refactor' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Find references</h2>
            <select
              value={refactorFilePath}
              onChange={(e) => setRefactorFilePath(e.target.value)}
              className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Select file…</option>
              {filePaths.slice(0, 500).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {refs && (
              <ul className="mt-3 text-sm">
                {refs.length === 0 ? (
                  <li className="text-slate-500">No references found (no other file imports this).</li>
                ) : (
                  refs.map((r, i) => (
                    <li key={i}>{r.filePath} {r.snippet && `— ${r.snippet}`}</li>
                  ))
                )}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Extract selection</h2>
            <div className="mt-2 space-y-2">
              <input
                type="text"
                placeholder="File path"
                value={refactorFilePath}
                onChange={(e) => setRefactorFilePath(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <textarea
                placeholder="Paste code selection to extract"
                value={refactorSelection}
                onChange={(e) => setRefactorSelection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                rows={4}
              />
              <button
                type="button"
                onClick={() =>
                  projectId &&
                  suggestExtractMutation.mutate(
                    { projectId, filePath: refactorFilePath, selection: refactorSelection },
                    { onSuccess: setExtractResult }
                  )
                }
                disabled={!refactorFilePath || !refactorSelection || suggestExtractMutation.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
              >
                {suggestExtractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest extract'}
              </button>
            </div>
            {extractResult && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <pre className="whitespace-pre-wrap">{extractResult}</pre>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Split large file</h2>
            <select
              value={refactorFilePath}
              onChange={(e) => setRefactorFilePath(e.target.value)}
              className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Select file…</option>
              {filePaths.slice(0, 500).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                projectId &&
                refactorFilePath &&
                suggestSplitMutation.mutate({ projectId, filePath: refactorFilePath }, { onSuccess: setSplitResult })
              }
              disabled={!refactorFilePath || suggestSplitMutation.isPending}
              className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {suggestSplitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest split'}
            </button>
            {splitResult && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <pre className="whitespace-pre-wrap">{splitResult}</pre>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Shared helper (pattern in N places)</h2>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Describe the pattern (e.g. 'error handling around Redis calls')"
                value={refactorPattern}
                onChange={(e) => setRefactorPattern(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() =>
                  projectId &&
                  refactorPattern &&
                  suggestHelperMutation.mutate(
                    { projectId, patternDescription: refactorPattern },
                    { onSuccess: setHelperResult }
                  )
                }
                disabled={!refactorPattern || suggestHelperMutation.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
              >
                {suggestHelperMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest helper'}
              </button>
            </div>
            {helperResult && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <pre className="whitespace-pre-wrap">{helperResult}</pre>
              </div>
            )}
          </section>
        </div>
      )}

      {/* AI Fix it / PR */}
      {activeTab === 'fixit' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">AI Fix it</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              e.g. &quot;Add error handling to all Redis calls&quot; or &quot;Upgrade lib X&quot;.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Instruction"
                value={fixInstruction}
                onChange={(e) => setFixInstruction(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() =>
                  projectId &&
                  fixInstruction &&
                  suggestFixesMutation.mutate(
                    { projectId, instruction: fixInstruction },
                    { onSuccess: setFixResult }
                  )
                }
                disabled={!fixInstruction || suggestFixesMutation.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
              >
                {suggestFixesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest edits'}
              </button>
            </div>
            {fixResult && (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium">Summary</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{fixResult.summary}</p>
                <p className="text-sm font-medium">Per-file suggestions</p>
                {fixResult.edits.map((e, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                    <p className="font-medium">{e.filePath}</p>
                    <pre className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{e.suggestion}</pre>
                  </div>
                ))}
                
                {/* PR Creation Section */}
                {!prCreated && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="mb-3 text-sm font-medium text-blue-900 dark:text-blue-100">
                      Create GitHub Pull Request
                    </p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Branch name (e.g., fix/error-handling)"
                        value={prBranch}
                        onChange={(e) => setPrBranch(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="PR Title"
                        value={prTitle}
                        onChange={(e) => setPrTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!projectId || !prBranch || !prTitle || !fixResult) return;
                          
                          // For now, create PR with suggestions as content
                          // In a full implementation, we'd fetch actual file contents and apply suggestions
                          createPrMutation.mutate(
                            {
                              projectId,
                              branch: prBranch,
                              title: prTitle,
                              body: `## Summary\n\n${fixResult.summary}\n\n## Changes\n\n${fixResult.edits.map(e => `- ${e.filePath}: ${e.suggestion.substring(0, 100)}...`).join('\n')}\n\n*This PR was created by LegacyLens AI Fix It feature.*`,
                              changes: fixResult.edits.map((e) => ({
                                filePath: e.filePath,
                                content: `/* ${e.suggestion} */\n\n// TODO: Apply the suggested changes:\n// ${e.suggestion.replace(/\n/g, '\n// ')}`,
                                operation: 'update' as const,
                              })),
                            },
                            {
                              onSuccess: (result) => {
                                if (result.success && result.prUrl) {
                                  setPrCreated({ prUrl: result.prUrl, prNumber: result.prNumber || 0 });
                                }
                              },
                            }
                          );
                        }}
                        disabled={!prBranch || !prTitle || createPrMutation.isPending}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {createPrMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating PR...
                          </>
                        ) : (
                          <>
                            <GitBranch className="h-4 w-4" />
                            Create Pull Request
                          </>
                        )}
                      </button>
                      {createPrMutation.error && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {createPrMutation.error.message}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {prCreated && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Pull Request created successfully!
                      </p>
                    </div>
                    <a
                      href={prCreated.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View PR #{prCreated.prNumber} on GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </section>
          {!fixResult && (
          <p className="text-sm text-slate-500">
              Enter an instruction above to get AI-powered fix suggestions. You can then create a GitHub Pull Request directly from here.
            </p>
          )}
        </div>
      )}

      {/* Benchmarks */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Benchmarks</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Define test cases (prompts + expected keywords/files) and run them to score the current AI pipeline.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {/* Suites list */}
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Suites</p>
                </div>
                {suitesLoading ? (
                  <div className="mt-3 h-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ) : (
                  <div className="mt-3 space-y-2">
                    {(benchmarkSuites ?? []).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setBenchmarkSuiteId(s.id)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left text-sm',
                          benchmarkSuiteId === s.id
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        )}
                      >
                        <div className="font-medium">{s.name}</div>
                        <div className="mt-0.5 text-xs opacity-80">
                          {s._count?.cases ?? 0} cases • {s._count?.runs ?? 0} runs
                        </div>
                      </button>
                    ))}
                    {(!benchmarkSuites || benchmarkSuites.length === 0) && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No suites yet. Create one below.</p>
                    )}
                  </div>
                )}

                {/* Create suite */}
                <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <p className="text-sm font-medium">Create suite</p>
                  <input
                    type="text"
                    placeholder="Suite name"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newSuiteDesc}
                    onChange={(e) => setNewSuiteDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => projectId && newSuiteName.trim() && createSuiteMutation.mutate({ projectId, name: newSuiteName.trim(), description: newSuiteDesc.trim() || undefined })}
                    disabled={!newSuiteName.trim() || createSuiteMutation.isPending}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {createSuiteMutation.isPending ? 'Creating…' : 'Create suite'}
                  </button>
                  {createSuiteMutation.error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{createSuiteMutation.error.message}</p>
                  )}
                </div>
              </div>

              {/* Suite detail */}
              <div className="lg:col-span-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {!benchmarkSuiteId ? (
                  <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                    Select a suite to view cases and run benchmarks.
                  </div>
                ) : !selectedSuite ? (
                  <div className="h-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold">{selectedSuite.name}</p>
                        {selectedSuite.description && (
                          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{selectedSuite.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => projectId && benchmarkSuiteId && runSuiteMutation.mutate({ projectId, suiteId: benchmarkSuiteId })}
                        disabled={runSuiteMutation.isPending || (selectedSuite.cases?.length ?? 0) === 0}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {runSuiteMutation.isPending ? 'Running…' : 'Run suite'}
                      </button>
                    </div>

                    {/* Last run summary */}
                    {selectedSuite.runs && selectedSuite.runs.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                        <p className="font-medium">Latest run</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Status</div>
                            <div>{selectedSuite.runs[0].status}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Passed</div>
                            <div>
                              {selectedSuite.runs[0].passedCases}/{selectedSuite.runs[0].totalCases}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Avg score</div>
                            <div>{(selectedSuite.runs[0].averageScore * 100).toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Latency</div>
                            <div>{selectedSuite.runs[0].totalLatencyMs}ms</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cases list */}
                    <div>
                      <p className="text-sm font-medium">Cases</p>
                      <div className="mt-2 space-y-2">
                        {(selectedSuite.cases ?? []).map((c) => (
                          <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">minScore {(c.minScore * 100).toFixed(0)}%</div>
                            </div>
                            <div className="mt-2 rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                              <pre className="whitespace-pre-wrap">{c.prompt}</pre>
                            </div>
                            {(c.expectedKeywords?.length ?? 0) > 0 && (
                              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                Keywords: {c.expectedKeywords.join(', ')}
                              </div>
                            )}
                            {(c.expectedFilePaths?.length ?? 0) > 0 && (
                              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                Files: {c.expectedFilePaths.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                        {(!selectedSuite.cases || selectedSuite.cases.length === 0) && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">No cases yet. Add one below.</p>
                        )}
                      </div>
                    </div>

                    {/* Add case */}
                    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-sm font-medium">Add case</p>
                      <div className="mt-2 grid gap-2">
                        <input
                          type="text"
                          placeholder="Case name"
                          value={newCaseName}
                          onChange={(e) => setNewCaseName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                        <textarea
                          placeholder="Prompt"
                          value={newCasePrompt}
                          onChange={(e) => setNewCasePrompt(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          placeholder="Expected keywords (comma-separated)"
                          value={newCaseKeywords}
                          onChange={(e) => setNewCaseKeywords(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          placeholder="Expected file paths (comma-separated)"
                          value={newCaseFiles}
                          onChange={(e) => setNewCaseFiles(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-xs text-slate-600 dark:text-slate-400">Min score</span>
                          <input
                            type="number"
                            value={newCaseMinScore}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(e) => setNewCaseMinScore(Number(e.target.value))}
                            className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!projectId || !benchmarkSuiteId) return;
                            if (!newCaseName.trim() || !newCasePrompt.trim()) return;
                            addCaseMutation.mutate({
                              projectId,
                              suiteId: benchmarkSuiteId,
                              name: newCaseName.trim(),
                              prompt: newCasePrompt.trim(),
                              expectedKeywords: newCaseKeywords.split(',').map((s) => s.trim()).filter(Boolean),
                              expectedFilePaths: newCaseFiles.split(',').map((s) => s.trim()).filter(Boolean),
                              minScore: newCaseMinScore,
                            });
                          }}
                          disabled={!newCaseName.trim() || !newCasePrompt.trim() || addCaseMutation.isPending}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                        >
                          {addCaseMutation.isPending ? 'Adding…' : 'Add case'}
                        </button>
                        {addCaseMutation.error && (
                          <p className="text-sm text-red-600 dark:text-red-400">{addCaseMutation.error.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
