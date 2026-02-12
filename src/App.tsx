// ============================================================
// LegacyLens — App Component with Routing (Clerk auth)
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

function LandingOrRedirect() {
  return (
    <>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  );
}
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ProjectOverview from './pages/ProjectOverview';
import Architecture from './pages/Architecture';
import QA from './pages/QA';
import Board from './pages/Board';
import Team from './pages/Team';
import Chat from './pages/Chat';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import DevOps from './pages/DevOps';
import History from './pages/History';
import Documentation from './pages/Documentation';
import Insights from './pages/Insights';
import Account from './pages/Account';
import AuthCallback from './pages/AuthCallback';
import ToastContainer from './components/ui/ToastContainer';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingOrRedirect />} />
        <Route path="/login/*" element={<Login />} />
        <Route path="/sign-up/*" element={<SignUp />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="project/:id" element={<ProjectOverview />} />
          <Route path="project/:id/architecture" element={<Architecture />} />
          <Route path="project/:id/qa" element={<QA />} />
          <Route path="project/:id/board" element={<Board />} />
          <Route path="project/:id/team" element={<Team />} />
          <Route path="project/:id/chat" element={<Chat />} />
          <Route path="project/:id/meetings" element={<Meetings />} />
          <Route path="project/:id/meetings/:meetingId" element={<MeetingDetail />} />
          <Route path="project/:id/devops" element={<DevOps />} />
          <Route path="project/:id/history" element={<History />} />
          <Route path="project/:id/documentation" element={<Documentation />} />
          <Route path="project/:id/insights" element={<Insights />} />
          <Route path="account" element={<Account />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer />
    </>
  );
}
