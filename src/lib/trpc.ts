// ============================================================
// LegacyLens — tRPC Client Setup (Clerk auth)
// ============================================================

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';
import type { AppRouter } from '../server/routers/index.js';

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// React Query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const getTrpcUrl = () => {
  const base = import.meta.env.VITE_API_URL;
  if (base && typeof window !== 'undefined') return `${base.replace(/\/$/, '')}/trpc`;
  return '/trpc';
};

// Create tRPC client with Clerk getToken (call from component that has useAuth())
export function createTrpcClient(getToken: () => Promise<string | null>) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: getTrpcUrl(),
        transformer: superjson,
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: 'include',
          });
        },
        async headers() {
          const token = await getToken();
          if (import.meta.env.DEV && !token) {
            console.warn('[LegacyLens] No auth token — getToken() returned null. Sign out and sign in again if you see 401s.');
          }
          if (!token) return {};
          return {
            Authorization: `Bearer ${token}`,
            'x-access-token': token,
          };
        },
      }),
    ],
  });
}
