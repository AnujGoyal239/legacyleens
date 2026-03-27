// ============================================================
// LegacyLens — Architecture Side Panel (Slide-in Drawer)
// ============================================================

import { X, FileCode2, AlertTriangle, ArrowRight, MessageSquare } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FileInfo {
  id?: string;
  filePath: string;
  fileType?: string;
  riskLevel: string;
  dependentsCount: number;
  dependenciesCount: number;
  linesOfCode: number;
  isEntryPoint: boolean;
}

interface ArchitectureSidePanelProps {
  file: FileInfo | null;
  onClose: () => void;
}

function getRiskColor(level: string) {
  switch (level?.toLowerCase()) {
    case 'critical': return 'text-red-500 bg-red-500/10';
    case 'high': return 'text-amber-500 bg-amber-500/10';
    case 'medium': return 'text-green-500 bg-green-500/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
}

export default function ArchitectureSidePanel({ file, onClose }: ArchitectureSidePanelProps) {
  const { id: projectId } = useParams<{ id: string }>();

  if (!file) return null;

  const riskColor = getRiskColor(file.riskLevel);
  const fileName = file.filePath.split('/').pop() || file.filePath;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium text-sm" title={file.filePath}>
            {fileName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Full path */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Full path</p>
          <p className="font-mono text-xs break-all">{file.filePath}</p>
        </div>

        {/* Risk level badge */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Risk Level</p>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium capitalize', riskColor)}>
            {file.riskLevel === 'critical' || file.riskLevel === 'high' ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : null}
            {file.riskLevel || 'low'}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Lines of code</p>
            <p className="text-lg font-semibold">{file.linesOfCode.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Entry point</p>
            <p className="text-lg font-semibold">{file.isEntryPoint ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Dependents</p>
            <p className="text-lg font-semibold text-primary">{file.dependentsCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Dependencies</p>
            <p className="text-lg font-semibold">{file.dependenciesCount}</p>
          </div>
        </div>

        {/* Risk explanation */}
        {(file.riskLevel === 'critical' || file.riskLevel === 'high') && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-400 font-medium mb-1">⚠ High Impact File</p>
            <p className="text-xs text-muted-foreground">
              This file has {file.dependentsCount} dependents. Changes to this file may affect many
              parts of the codebase. Review carefully before modifying.
            </p>
          </div>
        )}

        {/* File type */}
        {file.fileType && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">File type</p>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{file.fileType}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border p-4 space-y-2">
        {projectId && (
          <Link
            to={`/dashboard/project/${projectId}/qa`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <MessageSquare className="h-4 w-4" />
            Ask Q&A about this file
          </Link>
        )}
      </div>
    </div>
  );
}
