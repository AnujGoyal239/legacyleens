// ============================================================
// LegacyLens — Board Page (Kanban)
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus,
  GripVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

function ColumnSkeleton() {
  return (
    <div className="w-72 shrink-0 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="h-6 w-32 rounded bg-muted" />
      <div className="h-24 rounded bg-muted" />
      <div className="h-24 rounded bg-muted" />
    </div>
  );
}

export default function Board() {
  const { id: projectId } = useParams<{ id: string }>();
  const [addCardColumnId, setAddCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');

  const utils = trpc.useUtils();
  const { data: board, isLoading } = trpc.board.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const createCardMutation = trpc.board.createCard.useMutation({
    onSuccess: () => {
      utils.board.get.invalidate({ projectId: projectId! });
      setAddCardColumnId(null);
      setNewCardTitle('');
      setNewCardDesc('');
    },
  });
  const moveCardMutation = trpc.board.moveCard.useMutation({
    onSuccess: () => {
      utils.board.get.invalidate({ projectId: projectId! });
    },
  });
  const deleteCardMutation = trpc.board.deleteCard.useMutation({
    onSuccess: () => {
      utils.board.get.invalidate({ projectId: projectId! });
    },
  });
  const suggestTasksMutation = trpc.board.suggestTasks.useMutation({
    onSuccess: () => {
      utils.board.get.invalidate({ projectId: projectId! });
    },
  });

  const columns = board?.columns ?? [];
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  const handleMoveLeft = (cardId: string, colIndex: number) => {
    if (colIndex <= 0) return;
    const prevColumn = sortedColumns[colIndex - 1];
    moveCardMutation.mutate({
      cardId,
      columnId: prevColumn.id,
      position: prevColumn.cards?.length ?? 0,
    });
  };

  const handleMoveRight = (cardId: string, colIndex: number) => {
    if (colIndex >= sortedColumns.length - 1) return;
    const nextColumn = sortedColumns[colIndex + 1];
    moveCardMutation.mutate({
      cardId,
      columnId: nextColumn.id,
      position: nextColumn.cards?.length ?? 0,
    });
  };

  const handleAddCard = (columnId: string) => {
    const title = newCardTitle.trim();
    if (!title) return;
    createCardMutation.mutate({
      columnId,
      title,
      description: newCardDesc.trim() || undefined,
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GripVertical className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Board</h1>
        <button
          type="button"
          onClick={() => projectId && suggestTasksMutation.mutate({ projectId })}
          disabled={suggestTasksMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          {suggestTasksMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {suggestTasksMutation.isPending ? 'Generating...' : 'AI Suggest Tasks'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <ColumnSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedColumns.map((column, colIndex) => (
            <div
              key={column.id}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/20"
            >
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-medium">{column.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {(column.cards?.length ?? 0)} cards
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {column.cards?.map((card) => (
                  <div
                    key={card.id}
                    className="group rounded-lg border border-border bg-card p-3 shadow-sm transition hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{card.title}</p>
                        {card.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {card.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {(card.linkedFiles?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <FileCode2 className="h-3.5 w-3.5" />
                              {card.linkedFiles.length} files
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleMoveLeft(card.id, colIndex)}
                          disabled={colIndex === 0 || moveCardMutation.isPending}
                          className="rounded p-1 hover:bg-muted disabled:opacity-30"
                          aria-label="Move left"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRight(card.id, colIndex)}
                          disabled={
                            colIndex === sortedColumns.length - 1 || moveCardMutation.isPending
                          }
                          className="rounded p-1 hover:bg-muted disabled:opacity-30"
                          aria-label="Move right"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCardMutation.mutate({ cardId: card.id })}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {addCardColumnId === column.id ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                    <input
                      type="text"
                      placeholder="Card title"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newCardDesc}
                      onChange={(e) => setNewCardDesc(e.target.value)}
                      rows={2}
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddCard(column.id)}
                        disabled={!newCardTitle.trim() || createCardMutation.isPending}
                        className="rounded bg-primary px-2 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddCardColumnId(null);
                          setNewCardTitle('');
                          setNewCardDesc('');
                        }}
                        className="rounded border border-input px-2 py-1 text-sm hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddCardColumnId(column.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add card
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
