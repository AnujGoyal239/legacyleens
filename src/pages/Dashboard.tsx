// ============================================================
// LegacyLens — Dashboard Page
// ============================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, FolderGit2, Clock, FileCode2, GitBranch,
  Star, Lock, Globe, Eye, EyeOff, Loader2, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { trpc } from '@/lib/trpc';
import { getStatusInfo, formatRelativeTime, cn } from '@/lib/utils';

function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-10 w-48 rounded bg-muted" />
        <div className="h-6 w-16 rounded-full bg-muted" />
      </div>
      <div className="mt-4 flex gap-4">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="mt-4 h-4 w-24 rounded bg-muted" />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isLoaded: clerkLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createGithubUrl, setCreateGithubUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [githubPat, setGithubPat] = useState('');
  const [showPat, setShowPat] = useState(false);

  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.project.list.useQuery(undefined, {
    enabled: clerkLoaded,
  });
  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      setCreateOpen(false);
      setCreateName('');
      setCreateGithubUrl('');
      setIsPrivate(false);
      setGithubPat('');
      utils.project.list.invalidate();
      navigate(`/dashboard/project/${project.id}`);
    },
  });

  const filteredProjects = projects?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = createName.trim() && createGithubUrl.trim() && (!isPrivate || githubPat.trim());

  const handleCreate = () => {
    if (!canCreate) return;
    createMutation.mutate({
      name: createName.trim(),
      githubUrl: createGithubUrl.trim(),
      isPrivate,
      githubPat: isPrivate ? githubPat.trim() : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage and explore your codebase projects
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {/* Project grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredProjects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16">
          <FolderGit2 className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            {searchQuery
              ? 'No projects match your search'
              : 'No projects yet. Create your first project!'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => {
            const statusInfo = getStatusInfo(project.status);
            return (
              <Link
                key={project.id}
                to={`/dashboard/project/${project.id}`}
                className="group block rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-md"
              >
                {/* Header: Avatar + Name + Status */}
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {project.repoAvatarUrl ? (
                      <img
                        src={project.repoAvatarUrl}
                        alt={project.repoOwner || project.name}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FolderGit2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">{project.name}</span>
                      {project.repoOwner && project.repoName && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {project.repoOwner}/{project.repoName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        statusInfo.className
                      )}
                    >
                      {statusInfo.label}
                    </span>
                    {project.repoVisibility === 'private' ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Globe className="h-3 w-3" /> Public
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {project.repoDescription && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {project.repoDescription}
                  </p>
                )}

                {/* Stats row: Language, Stars, Forks, Files */}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {project.repoLanguage && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-primary" />
                      {project.repoLanguage}
                    </span>
                  )}
                  {(project.repoStars ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      {project.repoStars?.toLocaleString()}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <FileCode2 className="h-3.5 w-3.5" />
                    {project._count?.files ?? project.totalFiles ?? 0} files
                  </span>
                </div>

                {/* Topics */}
                {project.repoTopics && project.repoTopics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {project.repoTopics.slice(0, 4).map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {topic}
                      </span>
                    ))}
                    {project.repoTopics.length > 4 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        +{project.repoTopics.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Updated {formatRelativeTime(project.updatedAt)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !createMutation.isPending && setCreateOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Create Project</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a GitHub repository to start analyzing your codebase
            </p>
            <div className="mt-6 space-y-4">
              {/* Project Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Project name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {/* GitHub URL (mandatory) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  GitHub Repository URL <span className="text-destructive">*</span>
                </label>
                <input
                  type="url"
                  value={createGithubUrl}
                  onChange={(e) => setCreateGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {/* Visibility Toggle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Repository visibility</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsPrivate(false); setGithubPat(''); }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                      !isPrivate
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Globe className="h-4 w-4" />
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                      isPrivate
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700'
                        : 'border-input text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Lock className="h-4 w-4" />
                    Private
                  </button>
                </div>
              </div>

              {/* PAT field — shown only for private repos */}
              {isPrivate && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    GitHub Personal Access Token <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPat ? 'text' : 'password'}
                      value={githubPat}
                      onChange={(e) => setGithubPat(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPat(!showPat)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Generate a token at{' '}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      GitHub Settings
                    </a>
                    {' '}with <code className="rounded bg-muted px-1 py-0.5 text-[11px]">repo</code> scope.
                  </p>
                </div>
              )}

              {/* Error message */}
              {createMutation.error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{createMutation.error.message}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (!createMutation.isPending) {
                    setCreateOpen(false);
                    createMutation.reset();
                  }
                }}
                className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreate || createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {createMutation.isPending ? 'Fetching repo details...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
