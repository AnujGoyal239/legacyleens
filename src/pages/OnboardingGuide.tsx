// ============================================================
// LegacyLens — Onboarding Guide Page
// ============================================================

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BookOpen,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition hover:bg-muted/30"
      >
        <span>{title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function OnboardingGuide() {
  const { id: projectId } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: guide, isLoading } = trpc.onboarding.getGuide.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const generateMutation = trpc.onboarding.generateGuide.useMutation({
    onSuccess: () => {
      utils.onboarding.getGuide.invalidate({ projectId: projectId! });
    },
  });

  const handleGenerate = () => {
    if (projectId) {
      generateMutation.mutate({ projectId });
    }
  };

  const handleExport = () => {
    if (!guide?.content) return;
    const content = typeof guide.content === 'object' && 'markdown' in guide.content
      ? (guide.content as { markdown: string }).markdown
      : JSON.stringify(guide.content, null, 2);

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onboarding-guide-v${guide.version || 1}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid project
      </div>
    );
  }

  const guideMarkdown = guide?.content && typeof guide.content === 'object' && 'markdown' in guide.content
    ? (guide.content as { markdown: string }).markdown
    : null;

  // Parse sections from markdown
  const sections = guideMarkdown
    ? guideMarkdown.split(/^## /gm).filter(Boolean).map((section) => {
        const lines = section.split('\n');
        const title = lines[0]?.trim() || 'Section';
        const content = lines.slice(1).join('\n').trim();
        return { title, content };
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Onboarding Guide</h1>
        </div>
        <div className="flex items-center gap-2">
          {guide && (
            <>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export as Markdown
              </button>
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        A personalised step-by-step guide for understanding this codebase. Every new hire gets this on day one.
      </p>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Empty state — no guide generated yet */}
      {!isLoading && !guide && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No Onboarding Guide Yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Generate a personalised onboarding guide that tells new developers exactly which files to
            read first, which flows to understand, and which files are dangerous to touch.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generateMutation.isPending ? 'Generating guide...' : 'Generate Onboarding Guide'}
          </button>
          {generateMutation.isPending && (
            <p className="mt-3 text-xs text-muted-foreground">
              This may take 10–20 seconds. The guide is being tailored to your specific codebase.
            </p>
          )}
        </div>
      )}

      {/* Guide content — collapsible sections */}
      {!isLoading && guide && sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <CollapsibleSection
              key={idx}
              title={section.title}
              defaultOpen={idx < 3}
            >
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{section.content}</ReactMarkdown>
              </article>
            </CollapsibleSection>
          ))}
        </div>
      )}

      {/* Fallback: full markdown render if sections parsing fails */}
      {!isLoading && guide && sections.length === 0 && guideMarkdown && (
        <div className="rounded-xl border border-border bg-card p-6">
          <article className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
          </article>
        </div>
      )}

      {/* Version info */}
      {guide && (
        <p className="text-xs text-muted-foreground">
          Version {guide.version || 1} • Generated{' '}
          {new Date(guide.generatedAt).toLocaleDateString()}
        </p>
      )}

      {/* Error */}
      {generateMutation.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {generateMutation.error.message}
        </div>
      )}
    </div>
  );
}
