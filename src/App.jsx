import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
// Add page imports here
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Locations from '@/pages/Locations';
import LocationDetail from '@/pages/LocationDetail';
import TaskRegister from '@/pages/TaskRegister';
import TaskEditor from '@/pages/TaskEditor';
import TaskDetail from '@/pages/TaskDetail';
import Contractors from '@/pages/Contractors';
import ContractorDetail from '@/pages/ContractorDetail';
import Admin from '@/pages/Admin';
import Access from '@/pages/Access';
import DailyActivity from '@/pages/DailyActivity';
import WorkImport from '@/pages/WorkImport';
import Dashboard from '@/pages/Dashboard';
import Planning from '@/pages/Planning';
import BlockerBoard from '@/pages/BlockerBoard';
import ContractorBoard from '@/pages/ContractorBoard';
import Meetings from '@/pages/Meetings';
import Handover from '@/pages/Handover';
import SiteWide from '@/pages/SiteWide';
import VillaExecution from '@/pages/VillaExecution';
import AskDvgAi from '@/pages/AskDvgAi';
import NeedsAttention from '@/pages/NeedsAttention';

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
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Sign-up is closed: people are invited by the administrator (Users & access). */}
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/locations/:locationId" element={<LocationDetail />} />
          <Route path="/locations/:locationId/execution" element={<VillaExecution />} />
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