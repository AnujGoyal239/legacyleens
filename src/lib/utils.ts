// ============================================================
// LegacyLens — Utility Functions
// ============================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with commas (e.g., 1,234,567)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format seconds to human-readable duration (e.g., "2m 30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get risk level color classes
 */
export function getRiskColor(level: string): string {
  switch (level) {
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'high':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
    default:
      return 'text-green-600 bg-green-50 border-green-200';
  }
}

/**
 * Get risk level badge variant
 */
export function getRiskBadge(level: string): { label: string; className: string } {
  switch (level) {
    case 'critical':
      return { label: 'Critical', className: 'bg-red-100 text-red-700' };
    case 'high':
      return { label: 'High Risk', className: 'bg-orange-100 text-orange-700' };
    case 'medium':
      return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' };
    case 'low':
    default:
      return { label: 'Safe', className: 'bg-green-100 text-green-700' };
  }
}

/**
 * Get project status info
 */
export function getStatusInfo(status: string): { label: string; className: string } {
  switch (status) {
    case 'indexing':
      return { label: 'Indexing...', className: 'bg-blue-100 text-blue-700' };
    case 'complete':
      return { label: 'Ready', className: 'bg-green-100 text-green-700' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-100 text-red-700' };
    case 'pending':
    default:
      return { label: 'Pending', className: 'bg-gray-100 text-gray-700' };
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a hash for caching purposes
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract owner/repo from GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Get file icon based on extension
 */
export function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'react',
    js: 'javascript',
    jsx: 'react',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    css: 'css',
    html: 'html',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return iconMap[ext || ''] || 'file';
}
