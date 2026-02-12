// ============================================================
// LegacyLens — Documentation (LLD, HLD, System Design via Groq)
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileStack, Layers, Network, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type DocTab = 'lld' | 'hld' | 'system';

export default function Documentation() {
  const { id: projectId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<DocTab>('lld');
  const [lldContent, setLldContent] = useState<string | null>(null);
  const [hldContent, setHldContent] = useState<string | null>(null);
  const [systemContent, setSystemContent] = useState<string | null>(null);

  const generateLld = trpc.documentation.generateLLD.useMutation({
    onSuccess: (data) => setLldContent(data),
  });
  const generateHld = trpc.documentation.generateHLD.useMutation({
    onSuccess: (data) => setHldContent(data),
  });
  const generateSystem = trpc.documentation.generateSystemDesign.useMutation({
    onSuccess: (data) => setSystemContent(data),
  });

  const handleGenerate = () => {
    if (!projectId) return;
    if (activeTab === 'lld') generateLld.mutate({ projectId });
    if (activeTab === 'hld') generateHld.mutate({ projectId });
    if (activeTab === 'system') generateSystem.mutate({ projectId });
  };

  const tabs: { id: DocTab; label: string; icon: typeof FileStack }[] = [
    { id: 'lld', label: 'Low Level Design (LLD)', icon: FileStack },
    { id: 'hld', label: 'High Level Design (HLD)', icon: Layers },
    { id: 'system', label: 'System Design', icon: Network },
  ];

  const currentContent =
    activeTab === 'lld' ? lldContent : activeTab === 'hld' ? hldContent : systemContent;
  const isGenerating =
    generateLld.isPending || generateHld.isPending || generateSystem.isPending;
  const error =
    generateLld.error?.message || generateHld.error?.message || generateSystem.error?.message;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Documentation
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Generate LLD, HLD, and System Design docs from your codebase using AI (Groq).
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!projectId || isGenerating}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Generate {activeTab === 'lld' ? 'LLD' : activeTab === 'hld' ? 'HLD' : 'System Design'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="min-h-[400px] rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        {currentContent ? (
          <article className="prose prose-slate max-w-none dark:prose-invert">
            <ReactMarkdown>{currentContent}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">
            Click &quot;Generate&quot; to create {activeTab === 'lld' ? 'LLD' : activeTab === 'hld' ? 'HLD' : 'System Design'} documentation for this project.
          </p>
        )}
      </div>
    </div>
  );
}
