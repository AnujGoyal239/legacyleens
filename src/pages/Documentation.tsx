// ============================================================
// LegacyLens — Documentation (LLD, HLD, System Design via Groq)
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileStack, Layers, Network, Loader2, Copy, Download, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('sql', sql);
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type DocTab = 'lld' | 'hld' | 'system';

export default function Documentation() {
  const { id: projectId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<DocTab>('lld');
  const [lldContent, setLldContent] = useState<string | null>(null);
  const [hldContent, setHldContent] = useState<string | null>(null);
  const [systemContent, setSystemContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    if (!currentContent) return;
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!currentContent) return;
    const blob = new Blob([currentContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}-documentation.md`;
    a.click();
    URL.revokeObjectURL(url);
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
        <h1 className="text-2xl font-semibold">
          Documentation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate LLD, HLD, and System Design docs from your codebase using AI (Groq).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Generate {activeTab === 'lld' ? 'LLD' : activeTab === 'hld' ? 'HLD' : 'System Design'}
        </button>

        {/* Copy & Export buttons */}
        {currentContent && (
          <>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Export as Markdown
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Streaming skeleton */}
      {isGenerating && !currentContent && (
        <div className="min-h-[400px] rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Generating documentation...</span>
          </div>
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-20 w-full rounded bg-muted" />
            <div className="h-4 w-4/5 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
          </div>
        </div>
      )}

      {/* Content area */}
      {!isGenerating && (
        <div className="min-h-[400px] rounded-xl border border-border bg-card p-6">
          {currentContent ? (
            <article className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const inline = !match;
                    if (inline) {
                      return (
                        <code className="rounded bg-muted px-1 py-0.5 text-sm" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg text-sm"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    );
                  },
                }}
              >
                {currentContent}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileStack className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                Click &quot;Generate&quot; to create {activeTab === 'lld' ? 'LLD' : activeTab === 'hld' ? 'HLD' : 'System Design'} documentation for this project.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
