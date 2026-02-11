// ============================================================
// LegacyLens — Login Page (Clerk)
// ============================================================

import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-6">
        <Link to="/" className="flex items-center justify-center gap-2">
          <span className="text-2xl font-semibold tracking-tight text-slate-900">
            LegacyLens
          </span>
        </Link>
      </div>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/login"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      />
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link to="/" className="font-medium text-primary hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
