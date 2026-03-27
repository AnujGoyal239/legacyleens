// ============================================================
// LegacyLens — OAuth Callback (Clerk handles auth; redirect only)
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clerk handles OAuth; this route is for legacy /auth/callback bookmarks
    const t = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <SignedIn>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-slate-600">Redirecting to dashboard...</p>
      </SignedIn>
      <SignedOut>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-slate-600">Redirecting...</p>
      </SignedOut>
    </div>
  );
}
