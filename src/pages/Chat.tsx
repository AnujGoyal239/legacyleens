// ============================================================
// LegacyLens — Chat Page
// Real-time team messaging
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send, MessageSquare, Users, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime } from '@/lib/utils';

export default function Chat() {
  const { id: projectId } = useParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: channel, isLoading: channelLoading } = trpc.chat.getTeamChannel.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: messages, isLoading: messagesLoading } = trpc.chat.getMessages.useQuery(
    { channelId: channel?.id || '', limit: 50 },
    { enabled: !!channel?.id, refetchInterval: 2000 } // Poll every 2 seconds for now
  );
  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage('');
      utils.chat.getMessages.invalidate({ channelId: channel?.id || '' });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !channel?.id) return;
    sendMessageMutation.mutate({
      channelId: channel.id,
      content: message.trim(),
    });
  };

  if (!projectId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Invalid project
      </div>
    );
  }

  if (channelLoading || messagesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Team Chat</h1>
        </div>
        {channel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {channel.members.length} members
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages && messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3">
                {msg.user.avatarUrl ? (
                  <img
                    src={msg.user.avatarUrl}
                    alt={msg.user.name || 'User'}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{msg.user.name || 'Anonymous'}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                  {msg.replyTo && (
                    <div className="mt-1 rounded border-l-2 border-primary/30 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                      Replying to {msg.replyTo.user.name || 'Anonymous'}
                    </div>
                  )}
                  <p className="mt-1 whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {channel && (
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
