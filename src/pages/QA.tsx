// ============================================================
// LegacyLens — Q&A Page
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Send,
  MessageSquare,
  FileCode2,
  Clock,
  Sparkles,
  History,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface ContextFile {
  filePath?: string;
  path?: string;
  score?: number;
}

function LoadingDots() {
  return (
    <div className="flex gap-1 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="mt-2 h-3 w-24 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function QA() {
  const { id: projectId } = useParams<{ id: string }>();
  const [question, setQuestion] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: historyData, isLoading: historyLoading } = trpc.qa.getHistory.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: suggestions, isLoading: suggestionsLoading } =
    trpc.qa.getSuggestions.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const utils = trpc.useUtils();
  const askMutation = trpc.qa.ask.useMutation({
    onSuccess: () => {
      utils.qa.getHistory.invalidate({ projectId: projectId! });
    },
  });

  const conversations = historyData?.conversations ?? [];
  const hasHistory = conversations.length > 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, askMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !projectId || askMutation.isPending) return;
    askMutation.mutate({ projectId, question: trimmed });
    setQuestion('');
  };

  const handleSuggestionClick = (s: string) => {
    setQuestion(s);
  };

  if (!projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid project
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Q&A</h1>
      </div>

      {/* Scrollable chat area */}
      <div className="flex-1 space-y-6 overflow-y-auto rounded-lg border border-border bg-card p-4">
        {historyLoading ? (
          <HistorySkeleton />
        ) : !hasHistory && !askMutation.isPending ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-primary/50" />
            <p className="mt-4 text-muted-foreground">
              Ask questions about this codebase. I&apos;ll search and explain using the actual code.
            </p>
            {suggestionsLoading ? (
              <div className="mt-4 h-8 w-48 animate-pulse rounded bg-muted" />
            ) : (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions?.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm transition hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {conversations.map((c) => {
              const ctxFiles = (c.contextFiles as ContextFile[] | null) ?? [];
              return (
                <div key={c.id} className="space-y-3 border-b border-border pb-4 last:border-0">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <History className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{c.question}</p>
                      <div
                        className="mt-2 text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: (c.answer ?? '')
                            .replace(/\n/g, '<br/>')
                            .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1">$1</code>'),
                        }}
                      />
                      {c.responseTimeMs != null && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {c.responseTimeMs}ms
                        </div>
                      )}
                      {ctxFiles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ctxFiles.map((f, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-1 text-xs"
                            >
                              <FileCode2 className="h-3.5 w-3.5" />
                              {f.filePath ?? f.path ?? 'unknown'}
                              {typeof f.score === 'number' && (
                                <span className="text-muted-foreground">
                                  ({(f.score * 100).toFixed(0)}%)
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {askMutation.isPending && (
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{askMutation.variables?.question}</p>
                  <LoadingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Fixed input at bottom */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this codebase..."
            className={cn(
              'flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
            )}
            disabled={askMutation.isPending}
          />
          <button
            type="submit"
            disabled={!question.trim() || askMutation.isPending}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground',
              'transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {askMutation.error && (
          <p className="mt-2 text-sm text-destructive">{askMutation.error.message}</p>
        )}
      </form>
    </div>
  );
}
