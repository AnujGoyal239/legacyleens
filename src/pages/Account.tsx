// ============================================================
// LegacyLens — Account Page
// ============================================================

import { useNavigate } from 'react-router-dom';
import { User, CreditCard, LogOut, Star, Zap, Github } from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export default function Account() {
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const { data: session, isLoading: sessionLoading } = trpc.auth.getSession.useQuery();
  const { data: usageStats, isLoading: usageLoading } = trpc.auth.getUsageStats.useQuery();
  const { data: subscription, isLoading: subLoading } = trpc.billing.getSubscription.useQuery();
  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const handleSignOut = async () => {
    try {
      await clerkSignOut();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpgrade = (tier: 'pro' | 'team') => {
    checkoutMutation.mutate({ tier });
  };

  const isLoading = sessionLoading || usageLoading || subLoading;

  if (isLoading && !session) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const user = session ?? undefined;
  const tier = subscription?.tier ?? 'free';
  const credits = subscription?.credits ?? user?.credits ?? 0;
  const avatarUrl =
    (session as Record<string, unknown>)?.avatarUrl as string | null ??
    clerkUser?.imageUrl ??
    null;
  const displayName = user?.name ?? clerkUser?.fullName ?? clerkUser?.firstName ?? '—';
  const displayEmail = user?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? '—';
  const displayGithub = (user as { githubUsername?: string })?.githubUsername ?? '—';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Account</h1>
      </div>

      {/* User info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-medium">Profile</h2>
        <div className="mt-4 flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-20 w-20 rounded-full border-2 border-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="h-10 w-10" />
              </div>
            )}
          </div>

          {/* Details */}
          <dl className="space-y-3 flex-1">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="mt-0.5 font-medium">{displayName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="mt-0.5">{displayEmail}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">GitHub</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">
                <Github className="h-4 w-4 text-muted-foreground" />
                {displayGithub !== '—' ? (
                  <a
                    href={`https://github.com/${displayGithub}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    @{displayGithub}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Subscription & credits */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-medium">Subscription</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <span className="capitalize">{tier}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <span>{credits} credits remaining</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleUpgrade('pro')}
            disabled={checkoutMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Star className="h-4 w-4" />
            {checkoutMutation.isPending ? 'Redirecting...' : 'Upgrade to Pro'}
          </button>
          <button
            type="button"
            onClick={() => handleUpgrade('team')}
            disabled={checkoutMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            Upgrade to Team
          </button>
        </div>
      </div>

      {/* Usage stats */}
      {usageStats && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-medium">Usage</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-muted-foreground">Projects</dt>
              <dd className="mt-1 text-lg font-semibold">{usageStats.projectCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Q&A sessions</dt>
              <dd className="mt-1 text-lg font-semibold">{usageStats.qaCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Meetings</dt>
              <dd className="mt-1 text-lg font-semibold">{usageStats.meetingCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Credits used</dt>
              <dd className="mt-1 text-lg font-semibold">{usageStats.totalCreditsUsed}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Sign out */}
      <div>
        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-4 py-2.5',
            'text-destructive transition hover:bg-destructive/10'
          )}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
