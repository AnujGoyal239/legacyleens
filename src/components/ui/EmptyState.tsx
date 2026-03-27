// ============================================================
// LegacyLens — Shared EmptyState Component
// ============================================================

import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  heading: string;
  description: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function EmptyState({ icon: Icon, heading, description, cta, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <Icon className="h-12 w-12 text-muted-foreground/40" />
      <h3 className="mt-4 text-sm font-semibold">{heading}</h3>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground">{description}</p>
      {cta && (
        cta.href ? (
          <Link
            to={cta.href}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  );
}
