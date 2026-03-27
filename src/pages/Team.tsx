// ============================================================
// LegacyLens — Team Page
// Team collaboration hub with members, activity, and progress
// ============================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Users,
  GitCommit,
  LayoutGrid,
  MessageSquare,
  Mic,
  TrendingUp,
  UserPlus,
  Clock,
  FileCode2,
  CheckCircle2,
  GitPullRequest,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime } from '@/lib/utils';

function ActivityItem({ activity }: { activity: any }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'commit':
        return <GitCommit className="h-4 w-4 text-blue-500" />;
      case 'card':
        return <LayoutGrid className="h-4 w-4 text-purple-500" />;
      case 'qa':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'meeting':
        return <Mic className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getDescription = () => {
    switch (activity.type) {
      case 'commit':
        return (
          <span>
            <span className="font-medium">{activity.user?.name || activity.data.author}</span> committed{' '}
            <span className="font-mono text-xs">{activity.data.hash.substring(0, 7)}</span>
            {activity.data.filesChanged > 0 && (
              <span className="text-muted-foreground"> ({activity.data.filesChanged} files)</span>
            )}
          </span>
        );
      case 'card':
        return (
          <span>
            <span className="font-medium">{activity.user?.name || 'Someone'}</span> updated card{' '}
            <span className="font-medium">"{activity.data.title}"</span> in{' '}
            <span className="text-muted-foreground">{activity.data.columnName}</span>
          </span>
        );
      case 'qa':
        return (
          <span>
            <span className="font-medium">{activity.user?.name || 'Someone'}</span> asked:{' '}
            <span className="italic">"{activity.data.question.substring(0, 60)}..."</span>
          </span>
        );
      case 'meeting':
        return (
          <span>
            Meeting <span className="font-medium">"{activity.data.title}"</span> was{' '}
            {activity.data.status === 'complete' ? 'completed' : 'created'}
          </span>
        );
      default:
        return 'Unknown activity';
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="mt-0.5 shrink-0">{getIcon()}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{getDescription()}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(activity.timestamp)}
        </p>
      </div>
      {activity.user?.avatarUrl && (
        <img
          src={activity.user.avatarUrl}
          alt={activity.user.name || 'User'}
          className="h-6 w-6 shrink-0 rounded-full"
        />
      )}
    </div>
  );
}

function MemberCard({ member }: { member: any }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {member.user.avatarUrl ? (
          <img
            src={member.user.avatarUrl}
            alt={member.user.name || member.user.email}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{member.user.name || member.user.email}</p>
          <p className="text-xs text-muted-foreground">{member.user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                member.role === 'owner'
                  ? 'bg-purple-100 text-purple-700'
                  : member.role === 'admin'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {member.role}
            </span>
            <span className="text-xs text-muted-foreground">
              Joined {formatRelativeTime(member.joinedAt)}
            </span>
          </div>
        </div>
      </div>
      {member.stats && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div className="text-center">
            <p className="text-lg font-semibold">{member.stats.commits}</p>
            <p className="text-xs text-muted-foreground">Commits</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{member.stats.cardsAssigned}</p>
            <p className="text-xs text-muted-foreground">Cards</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{member.stats.qaQuestions}</p>
            <p className="text-xs text-muted-foreground">Questions</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Team() {
  const { id: projectId } = useParams<{ id: string }>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const utils = trpc.useUtils();
  const { data: members, isLoading: membersLoading } = trpc.team.getMembers.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: activity, isLoading: activityLoading } = trpc.team.getActivity.useQuery(
    { projectId: projectId!, limit: 30 },
    { enabled: !!projectId }
  );
  const { data: progress, isLoading: progressLoading } = trpc.team.getProgress.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: prs, isLoading: prsLoading, refetch: refetchPRs } = trpc.pullRequest.list.useQuery(
    { projectId: projectId!, state: 'all' },
    { enabled: !!projectId }
  );
  const syncPRsMutation = trpc.pullRequest.sync.useMutation({
    onSuccess: () => {
      refetchPRs();
    },
  });

  const inviteMutation = trpc.project.inviteMember.useMutation({
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail('');
      utils.team.getMembers.invalidate({ projectId: projectId! });
      utils.team.getProgress.invalidate({ projectId: projectId! });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim() || !projectId) return;
    inviteMutation.mutate({
      projectId,
      email: inviteEmail.trim(),
      role: 'member',
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-muted-foreground">Collaborate and track team progress</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>

      {/* Project Stats */}
      {progress && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{progress.projectStats.totalMembers}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{progress.projectStats.totalCommits}</p>
                <p className="text-xs text-muted-foreground">Total Commits</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{progress.projectStats.completedCards}</p>
                <p className="text-xs text-muted-foreground">Completed Cards</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(progress.projectStats.completionRate)}%
                </p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pull Requests Section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Pull Requests</h2>
          </div>
          <button
            onClick={() => syncPRsMutation.mutate({ projectId: projectId! })}
            disabled={syncPRsMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncPRsMutation.isPending ? 'animate-spin' : ''}`} />
            Sync from GitHub
          </button>
        </div>
        {prsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : prs && prs.length > 0 ? (
          <div className="space-y-2">
            {prs.slice(0, 5).map((pr) => (
              <div
                key={pr.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${pr.author}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      #{pr.githubPrId} {pr.title}
                    </a>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        pr.state === 'open'
                          ? 'bg-green-100 text-green-700'
                          : pr.state === 'merged'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {pr.state}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    by {pr.author} • {pr.filesChanged.length} files changed
                  </p>
                </div>
                <a
                  href={`https://github.com/${pr.author}/${pr.headBranch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 shrink-0 text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
            {prs.length > 5 && (
              <p className="text-center text-sm text-muted-foreground">
                +{prs.length - 5} more PRs
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <GitPullRequest className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No pull requests yet</p>
            <button
              onClick={() => syncPRsMutation.mutate({ projectId: projectId! })}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Sync from GitHub
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Members */}
        <div className="lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Team Members</h2>
            {members && <span className="text-sm text-muted-foreground">{members.length}</span>}
          </div>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No team members yet</p>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          {activityLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : activity && activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((item, idx) => (
                <ActivityItem key={idx} activity={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Dialog */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !inviteMutation.isPending && setInviteOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Invite Team Member</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite someone to collaborate on this project
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inviteEmail.trim()) {
                      handleInvite();
                    }
                  }}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  They must have a LegacyLens account to be invited.
                </p>
              </div>
              {inviteMutation.error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">{inviteMutation.error.message}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (!inviteMutation.isPending) {
                    setInviteOpen(false);
                    inviteMutation.reset();
                  }
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
