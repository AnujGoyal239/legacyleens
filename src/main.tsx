// ============================================================
// LegacyLens — Main Entry Point (Clerk + tRPC)
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, queryClient, createTrpcClient } from './lib/trpc';
import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is not set. Auth will not work.');
}

function TrpcProviderWithClerk() {
  const { getToken } = useAuth();
  const trpcClient = React.useMemo(
    () => createTrpcClient(() => getToken()),
    [getToken]
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={publishableKey || ''}
      afterSignOutUrl="/login"
    >
      <TrpcProviderWithClerk />
    </ClerkProvider>
  </React.StrictMode>
);
