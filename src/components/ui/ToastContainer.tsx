// ============================================================
// LegacyLens — Toast Container
// ============================================================

import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex min-w-72 items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
            toast.type === 'success' && 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/50',
            toast.type === 'error' && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50',
            toast.type === 'warning' && 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50',
            toast.type === 'info' && 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50'
          )}
        >
          <div className="flex-1">
            <p className="font-medium">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
