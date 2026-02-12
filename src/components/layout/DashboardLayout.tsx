// ============================================================
// LegacyLens — Dashboard Layout
// ============================================================

import { Outlet, NavLink, Link, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Code2,
  MessageSquare,
  LayoutGrid,
  Mic,
  User,
  ShieldAlert,
  GitCommit,
  BookOpen,
  LineChart,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/clerk-react';

const projectNavItems = [
  { to: '', label: 'Overview', icon: FolderGit2, end: true },
  { to: 'architecture', label: 'Architecture', icon: Code2, end: false },
  { to: 'qa', label: 'Q&A', icon: MessageSquare, end: false },
  { to: 'board', label: 'Board', icon: LayoutGrid, end: false },
  { to: 'team', label: 'Team', icon: Users, end: false },
  { to: 'chat', label: 'Chat', icon: MessageSquare, end: false },
  { to: 'meetings', label: 'Meetings', icon: Mic, end: false },
  { to: 'devops', label: 'DevOps', icon: ShieldAlert, end: false },
  { to: 'history', label: 'History', icon: GitCommit, end: false },
  { to: 'documentation', label: 'Documentation', icon: BookOpen, end: false },
  { to: 'insights', label: 'Insights', icon: LineChart, end: false },
];

export default function DashboardLayout() {
  const { id: projectId } = useParams<{ id?: string }>();
  const isProjectRoute = !!projectId;
  const { user: clerkUser } = useUser();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card lg:block">
        <div className="sticky top-0 flex h-screen flex-col py-4">
          <Link to="/dashboard" className="px-4">
            <span className="text-lg font-semibold">LegacyLens</span>
          </Link>
          <nav className="mt-6 flex flex-1 flex-col gap-1 px-2">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'
                )
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              Projects
            </NavLink>
            {isProjectRoute && (
              <>
                {projectNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to ? `/dashboard/project/${projectId}/${item.to}` : `/dashboard/project/${projectId}`}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                        isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
            <NavLink
              to="/dashboard/account"
              className={({ isActive }) =>
                cn(
                  'mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'
                )
              }
            >
              {clerkUser?.imageUrl ? (
                <img
                  src={clerkUser.imageUrl}
                  alt={clerkUser.fullName || 'User'}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
              {clerkUser?.fullName || clerkUser?.firstName || 'Account'}
            </NavLink>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
