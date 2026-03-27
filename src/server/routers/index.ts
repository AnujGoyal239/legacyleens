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
import { devopsRouter } from './devops.js';
import { documentationRouter } from './documentation.js';
import { insightsRouter } from './insights.js';
import { teamRouter } from './team.js';
import { pullRequestRouter } from './pullRequest.js';
import { chatRouter } from './chat.js';
import { benchmarksRouter } from './benchmarks.js';
import { googleMeetRouter } from './googleMeet.js';
import { healthScoreRouter } from './healthScore.js';
import { onboardingRouter } from './onboarding.js';
import { historyRouter } from './history.js';
import { architectureRouter } from './architecture.js';

export const appRouter = router({
  auth: authRouter,
  project: projectRouter,
  qa: qaRouter,
  meeting: meetingRouter,
  board: boardRouter,
  billing: billingRouter,
  devops: devopsRouter,
  documentation: documentationRouter,
  insights: insightsRouter,
  team: teamRouter,
  pullRequest: pullRequestRouter,
  chat: chatRouter,
  benchmarks: benchmarksRouter,
  googleMeet: googleMeetRouter,
  healthScore: healthScoreRouter,
  onboarding: onboardingRouter,
  history: historyRouter,
  architecture: architectureRouter,
});

// Export type for client
export type AppRouter = typeof appRouter;
