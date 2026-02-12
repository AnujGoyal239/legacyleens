// ============================================================
// LegacyLens — Meetings Page
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  Mic,
  Clock,
  CheckCircle,
  Loader2,
  FileText,
  Link as LinkIcon,
  HardDrive,
  X,
  FileAudio,
  AlertCircle,
  Radio,
  Square,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { trpc } from '@/lib/trpc';
import { formatDuration, formatRelativeTime, cn } from '@/lib/utils';

function MeetingCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
      <div className="h-5 w-48 rounded bg-muted" />
      <div className="mt-3 h-4 w-32 rounded bg-muted" />
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'live';
}) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        Live
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Pending
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Processing
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
        <CheckCircle className="h-3.5 w-3.5" />
        Complete
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
      Failed
    </span>
  );
}

// Browser Speech Recognition (Chrome, Edge, Safari)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: boolean =
  typeof window !== 'undefined' &&
  !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );

export default function Meetings() {
  const { id: projectId } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'url' | 'live'>('file');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live meeting state
  const [liveMeetingId, setLiveMeetingId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveStartTime, setLiveStartTime] = useState<number | null>(null);
  const [liveEnding, setLiveEnding] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const startSpeechRecognition = () => {
    if (!SpeechRecognitionAPI) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Win = window as any;
    const SR = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      setLiveTranscript((prev) => prev + finalText + (interim ? ` [${interim}]` : ''));
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  const utils = trpc.useUtils();
  const { data: meetings, isLoading } = trpc.meeting.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const uploadMutation = trpc.meeting.upload.useMutation({
    onSuccess: () => {
      resetForm();
      utils.meeting.list.invalidate();
    },
  });
  const startLiveMutation = trpc.meeting.startLive.useMutation({
    onSuccess: (meeting) => {
      setLiveMeetingId(meeting.id);
      setLiveStartTime(Date.now());
      setLiveTranscript('');
      startSpeechRecognition();
      utils.meeting.list.invalidate();
    },
  });
  const endLiveMutation = trpc.meeting.endLive.useMutation({
    onSuccess: (meeting) => {
      stopSpeechRecognition();
      setLiveMeetingId(null);
      setLiveTranscript('');
      setLiveStartTime(null);
      setLiveEnding(false);
      setShowUpload(false);
      setUploadTab('file');
      utils.meeting.list.invalidate();
      navigate(`/dashboard/project/${projectId}/meetings/${meeting.id}`);
    },
  });

  const ACCEPTED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'video/webm', 'video/quicktime'];
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  const resetForm = () => {
    setShowUpload(false);
    setUploadUrl('');
    setUploadTitle('');
    setSelectedFile(null);
    setFileError(null);
    setFileUploading(false);
  };

  const handleEndLiveMeeting = () => {
    if (!liveMeetingId || !liveTranscript.trim()) return;
    setLiveEnding(true);
    const durationSeconds = liveStartTime ? Math.round((Date.now() - liveStartTime) / 1000) : 0;
    endLiveMutation.mutate(
      { meetingId: liveMeetingId, transcriptText: liveTranscript.trim(), durationSeconds },
      { onError: () => setLiveEnding(false) }
    );
  };

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|mp4|m4a|mov)$/i)) {
      return 'Unsupported file type. Please upload an audio or video file (MP3, WAV, MP4, etc.)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 50 MB.`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
    } else {
      setFileError(null);
      setSelectedFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Upload file via REST endpoint
  const handleFileUpload = async () => {
    if (!projectId || !selectedFile) return;
    setFileUploading(true);
    setFileError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', projectId);
      formData.append('title', uploadTitle.trim() || selectedFile.name);

      const token = await getToken();
      const res = await fetch('/api/meetings/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}`, 'x-access-token': token } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      resetForm();
      utils.meeting.list.invalidate();
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setFileUploading(false);
    }
  };

  // Upload via URL (existing tRPC mutation)
  const handleUrlUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !uploadUrl.trim()) return;
    uploadMutation.mutate({
      projectId,
      fileUrl: uploadUrl.trim(),
      title: uploadTitle.trim() || undefined,
    });
  };

  if (!projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid project
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Meetings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowUpload(true); setUploadTab('live'); }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            <Radio className="h-4 w-4" />
            Live Meeting
          </button>
          <button
            type="button"
            onClick={() => { setShowUpload(true); setUploadTab('file'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload Meeting
          </button>
        </div>
      </div>

      {/* In-progress live meeting banner */}
      {liveMeetingId && (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-medium">Live meeting in progress</span>
              {liveStartTime && (
                <span className="text-sm text-muted-foreground">
                  {formatDuration(Math.floor((Date.now() - liveStartTime) / 1000))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleEndLiveMeeting}
              disabled={liveEnding || endLiveMutation.isPending || !liveTranscript.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {(liveEnding || endLiveMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              <Square className="h-4 w-4" />
              End meeting & get summary
            </button>
          </div>
          {/* Jitsi Meet embed — share the room link so others can join */}
          {(() => {
            const jitsiRoom = `LegacyLens${liveMeetingId.replace(/-/g, '')}`;
            const jitsiUrl = `https://meet.jit.si/${jitsiRoom}`;
            return (
              <div className="mt-3 rounded-md border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                  <span>Video call (Jitsi) — share the room link with participants</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(jitsiUrl);
                    }}
                    className="rounded border border-border px-2 py-1 hover:bg-muted text-foreground"
                  >
                    Copy room link
                  </button>
                </div>
                <div className="relative h-[320px] w-full min-w-0">
                  <iframe
                    title="Jitsi Meet"
                    src={`${jitsiUrl}?config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
                    allow="camera; microphone; fullscreen; display-capture"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>
            );
          })()}
          <div className="mt-3 rounded-md border border-border bg-background p-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Live transcript (speak to capture)</p>
            <div className="max-h-40 overflow-y-auto text-sm text-foreground whitespace-pre-wrap">
              {liveTranscript || (
                <span className="text-muted-foreground italic">
                  {SpeechRecognitionAPI ? 'Start speaking…' : 'Browser speech recognition not supported. Type or paste transcript below before ending.'}
                </span>
              )}
            </div>
            {!SpeechRecognitionAPI && (
              <textarea
                className="mt-2 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                placeholder="Paste or type the meeting transcript here..."
                value={liveTranscript}
                onChange={(e) => setLiveTranscript(e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Upload Meeting</h2>
            <button type="button" onClick={resetForm} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs: File / URL / Live */}
          <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setUploadTab('file')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                uploadTab === 'file' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <HardDrive className="h-4 w-4" />
              From Computer
            </button>
            <button
              type="button"
              onClick={() => setUploadTab('url')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                uploadTab === 'url' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LinkIcon className="h-4 w-4" />
              From URL
            </button>
            <button
              type="button"
              onClick={() => setUploadTab('live')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                uploadTab === 'live' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Radio className="h-4 w-4" />
              Live Meeting
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {/* FILE UPLOAD TAB */}
            {uploadTab === 'file' && (
              <>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition',
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : selectedFile
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*,.mp3,.wav,.ogg,.webm,.mp4,.m4a,.mov"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  {selectedFile ? (
                    <>
                      <FileAudio className="h-10 w-10 text-emerald-600" />
                      <p className="mt-2 text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="mt-2 text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground/50" />
                      <p className="mt-2 text-sm font-medium text-muted-foreground">
                        Drag & drop an audio/video file here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse — MP3, WAV, MP4, WebM (max 50 MB)
                      </p>
                    </>
                  )}
                </div>
              </>
            )}

            {/* URL TAB */}
            {uploadTab === 'url' && (
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Audio/Video URL</label>
                <input
                  type="url"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://example.com/meeting.mp3"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* LIVE MEETING TAB */}
            {uploadTab === 'live' && !liveMeetingId && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Start a live meeting. Your browser will capture speech for a real-time transcript. When you end the meeting, we’ll generate a summary and you can chat with Meet Buddy about it.
                </p>
                <div>
                  <label className="mb-1.5 block text-sm text-muted-foreground">Meeting title (optional)</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Sprint standup"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {!SpeechRecognitionAPI && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Your browser doesn’t support live speech recognition. You can still run a live meeting and paste the transcript before ending.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => projectId && startLiveMutation.mutate({ projectId, title: uploadTitle.trim() || undefined })}
                  disabled={!projectId || startLiveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {startLiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Mic className="h-4 w-4" />
                  Start live meeting
                </button>
              </div>
            )}

            {/* Title field (shared) */}
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Title (optional)</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Sprint planning"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Error */}
            {(fileError || uploadMutation.error) && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{fileError || uploadMutation.error?.message}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {uploadTab === 'file' ? (
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || fileUploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {fileUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {fileUploading ? 'Uploading...' : 'Upload File'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUrlUpload as () => void}
                  disabled={uploadMutation.isPending || !uploadUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload from URL'}
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <MeetingCardSkeleton key={i} />
          ))}
        </div>
      ) : !meetings?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            No meetings yet. Upload one to get started.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload Meeting
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/dashboard/project/${projectId}/meetings/${m.id}`)}
              className="flex flex-col items-start rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="truncate font-medium">{m.title ?? 'Untitled'}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {(m as { source?: string }).source === 'live' && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Live</span>
                  )}
                  <StatusBadge status={m.transcriptionStatus as 'pending' | 'processing' | 'complete' | 'failed' | 'live'} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {m.durationSeconds != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(m.durationSeconds)}
                  </span>
                )}
                <span>{formatRelativeTime(m.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
