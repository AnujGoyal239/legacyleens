// ============================================================
// LegacyLens — Meeting Detail Page
// ============================================================

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  ListTodo,
  MessageSquare,
  Bot,
  Send,
  Loader2,
  FileText,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatDuration, formatRelativeTime } from '@/lib/utils';

interface MeetingInsights {
  decisions?: string[];
  actionItems?: string[];
  risks?: string[];
  technicalDiscussions?: { topic: string; timestamp?: number; summary: string }[];
}

export default function MeetingDetail() {
  const { id: projectId, meetingId } = useParams<{ id: string; meetingId: string }>();
  const navigate = useNavigate();
  const [meetBuddyQuestion, setMeetBuddyQuestion] = useState('');
  const [buddyHistory, setBuddyHistory] = useState<Array<{ question: string; answer: string }>>([]);

  const { data: meeting, isLoading, error } = trpc.meeting.get.useQuery(
    { meetingId: meetingId! },
    { enabled: !!meetingId }
  );
  const askMeetBuddy = trpc.meeting.askMeetBuddy.useMutation({
    onSuccess: (data, variables) => {
      setBuddyHistory((prev) => [...prev, { question: variables.question, answer: data.answer }]);
      setMeetBuddyQuestion('');
    },
  });

  const handleBack = () => {
    navigate(`/dashboard/project/${projectId}/meetings`);
  };

  if (!meetingId || !projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid meeting
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to meetings
        </button>
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card text-destructive">
          {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !meeting) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const insights = (meeting.insights as MeetingInsights | null) ?? {};

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to meetings
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{meeting.title ?? 'Untitled Meeting'}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {meeting.durationSeconds != null && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatDuration(meeting.durationSeconds)}
            </span>
          )}
          <span>{formatRelativeTime(meeting.createdAt)}</span>
          {meeting.transcriptionStatus === 'complete' && (
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              Transcribed
            </span>
          )}
        </div>
      </div>

      {/* Summary (if available, e.g. from live meeting) */}
      {meeting.summary && (
        <div className="rounded-lg border border-border bg-card">
          <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-medium">
            <FileText className="h-4 w-4" />
            Summary
          </h2>
          <div className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">{meeting.summary}</div>
        </div>
      )}

      {/* Transcript */}
      <div className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 font-medium">Transcript</h2>
        <div className="max-h-64 overflow-y-auto p-4 text-sm">
          {meeting.transcriptText ? (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {meeting.transcriptText}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {meeting.transcriptionStatus === 'processing'
                ? 'Transcription in progress...'
                : 'No transcript available.'}
            </p>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(insights.decisions?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="font-medium">Decisions</h3>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {insights.decisions?.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(insights.actionItems?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Action Items</h3>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {insights.actionItems?.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(insights.risks?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-medium">Risks</h3>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {insights.risks?.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(insights.technicalDiscussions?.length ?? 0) > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium">Technical Discussions</h3>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {insights.technicalDiscussions?.map((t, i) => (
                <li key={i} className="rounded-md bg-muted/50 p-3">
                  <p className="font-medium text-foreground">{t.topic}</p>
                  <p className="mt-1">{t.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!insights.decisions?.length &&
        !insights.actionItems?.length &&
        !insights.risks?.length &&
        !insights.technicalDiscussions?.length &&
        meeting.transcriptionStatus === 'complete' && (
          <p className="text-center text-sm text-muted-foreground">
            No insights extracted yet.
          </p>
        )}

      {/* Meet Buddy — chatbot that answers from this meeting */}
      {meeting.transcriptionStatus === 'complete' && meeting.transcriptText && (
        <div className="rounded-lg border border-border bg-card">
          <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-medium">
            <Bot className="h-4 w-4" />
            Meet Buddy
          </h2>
          <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            Ask anything about what was said, decided, or discussed in this meeting.
          </p>
          <div className="max-h-80 overflow-y-auto p-4 space-y-3">
            {buddyHistory.map((item, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm font-medium text-foreground">Q: {item.question}</p>
                <p className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/30">{item.answer}</p>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!meetBuddyQuestion.trim() || askMeetBuddy.isPending) return;
              askMeetBuddy.mutate({ meetingId: meeting.id, question: meetBuddyQuestion.trim() });
            }}
          >
            <input
              type="text"
              value={meetBuddyQuestion}
              onChange={(e) => setMeetBuddyQuestion(e.target.value)}
              placeholder="e.g. What was decided about the deadline?"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={askMeetBuddy.isPending}
            />
            <button
              type="submit"
              disabled={!meetBuddyQuestion.trim() || askMeetBuddy.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {askMeetBuddy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
