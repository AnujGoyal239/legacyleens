// ============================================================
// LegacyLens — App Component with Routing (Clerk auth)
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ProjectOverview from './pages/ProjectOverview';
import Architecture from './pages/Architecture';
import QA from './pages/QA';
import Board from './pages/Board';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
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
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
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
          <Route path="project/:id/meetings" element={<Meetings />} />
          <Route path="project/:id/meetings/:meetingId" element={<MeetingDetail />} />
          <Route path="account" element={<Account />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer />
    </>
  );
}
