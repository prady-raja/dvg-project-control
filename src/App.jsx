import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
// Add page imports here
import HomeRedirect from '@/components/layout/HomeRedirect';

// Each screen loads when it is first opened, so the phone downloads Today and little else (R-02).
const Login = lazy(() => import('@/pages/Login'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Locations = lazy(() => import('@/pages/Locations'));
const LocationDetail = lazy(() => import('@/pages/LocationDetail'));
const TaskRegister = lazy(() => import('@/pages/TaskRegister'));
const TaskEditor = lazy(() => import('@/pages/TaskEditor'));
const TaskDetail = lazy(() => import('@/pages/TaskDetail'));
const Contractors = lazy(() => import('@/pages/Contractors'));
const ContractorDetail = lazy(() => import('@/pages/ContractorDetail'));
const Admin = lazy(() => import('@/pages/Admin'));
const Access = lazy(() => import('@/pages/Access'));
const DailyActivity = lazy(() => import('@/pages/DailyActivity'));
const WorkImport = lazy(() => import('@/pages/WorkImport'));
const ImportHistory = lazy(() => import('@/pages/ImportHistory'));
const Today = lazy(() => import('@/pages/Today'));
const Help = lazy(() => import('@/pages/Help'));
const VillaMatrix = lazy(() => import('@/pages/VillaMatrix'));
const VillaStatement = lazy(() => import('@/pages/VillaStatement'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Planning = lazy(() => import('@/pages/Planning'));
const BlockerBoard = lazy(() => import('@/pages/BlockerBoard'));
const ContractorBoard = lazy(() => import('@/pages/ContractorBoard'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const Handover = lazy(() => import('@/pages/Handover'));
const SiteWide = lazy(() => import('@/pages/SiteWide'));
const AskDvgAi = lazy(() => import('@/pages/AskDvgAi'));
const NeedsAttention = lazy(() => import('@/pages/NeedsAttention'));

const ExecutionRedirect = () => {
  const { locationId } = useParams();
  return <Navigate to={`/locations/${locationId}?tab=overview`} replace />;
};

const PageFallback = () => (
  <div className="space-y-3 p-6" aria-busy="true">
    <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
    <div className="h-40 animate-pulse rounded-xl bg-muted" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Sign-up is closed: people are invited by the administrator (Users & access). */}
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/today" element={<Today />} />
          <Route path="/overview" element={<Dashboard />} />
          <Route path="/matrix" element={<VillaMatrix />} />
          <Route path="/help" element={<Help />} />
          <Route path="/villas/:locationId/statement" element={<VillaStatement />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/locations/:locationId" element={<LocationDetail />} />
          <Route path="/locations/:locationId/execution" element={<ExecutionRedirect />} />
          <Route path="/daily" element={<DailyActivity />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/blockers" element={<BlockerBoard />} />
          <Route path="/contractor-board" element={<ContractorBoard />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/site-wide" element={<SiteWide />} />
          <Route path="/ai" element={<AskDvgAi />} />
          <Route path="/attention" element={<NeedsAttention />} />
          <Route path="/import" element={<WorkImport />} />
          <Route path="/import/history" element={<ImportHistory />} />
          <Route path="/tasks" element={<TaskRegister />} />
          <Route path="/tasks/new" element={<TaskEditor />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
          <Route path="/tasks/:taskId/edit" element={<TaskEditor />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/contractors/:contractorId" element={<ContractorDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/access" element={<Access />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App