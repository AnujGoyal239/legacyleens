// ============================================================
// LegacyLens — Main tRPC Router
// ============================================================

import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { projectRouter } from './project.js';
import { qaRouter } from './qa.js';
import { meetingRouter } from './meeting.js';
import { boardRouter } from './board.js';
import { billingRouter } from './billing.js';

export const appRouter = router({
  auth: authRouter,
  project: projectRouter,
  qa: qaRouter,
  meeting: meetingRouter,
  board: boardRouter,
  billing: billingRouter,
});

// Export type for client
export type AppRouter = typeof appRouter;
