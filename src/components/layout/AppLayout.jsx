import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { CatalogProvider } from '@/lib/CatalogContext';
import { AccessProvider, useAccess } from '@/lib/AccessContext';
import { useCatalogs } from '@/lib/CatalogContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import MobileTabBar from '@/components/layout/MobileTabBar';
import { QuickActionsProvider } from '@/components/layout/QuickActions';
import DataState from '@/components/common/DataState';
import { installGlobalErrorHandlers, setErrorContext } from '@/lib/clientErrors';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import DesktopSidebar from '@/components/layout/DesktopSidebar';
import NavList from '@/components/layout/NavList';
import BrandMark from '@/components/layout/BrandMark';

installGlobalErrorHandlers();

/** Says so when the user's access or the project lists could not be loaded, instead of silently showing nothing. */
function LoadBanners() {
  const access = useAccess();
  const cat = useCatalogs();
  React.useEffect(() => {
    setErrorContext({ userId: access.user?.id || '', userEmail: access.user?.email || '' });
  }, [access.user]);
  if (access.failed) {
    return (
      <div className="mb-4">
        <DataState error="Your access could not be loaded, so some buttons are hidden." onRetry={access.refresh} />
      </div>
    );
  }
  if (cat.error) {
    return (
      <div className="mb-4">
        <DataState error={cat.error} onRetry={cat.refresh} />
      </div>
    );
  }
  return null;
}

export default function AppLayout() {
  const routerLocation = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await base44.auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <AccessProvider>
      <CatalogProvider>
        <QuickActionsProvider>
        <div className="min-h-screen bg-background">
        <DesktopSidebar />

        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="text-sidebar-foreground hover:bg-sidebar-accent">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[272px] flex-col border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
                <BrandMark />
              </div>
              <div className="scroll-slim flex-1 overflow-y-auto p-3">
                <NavList onNavigate={() => setMenuOpen(false)} />
              </div>
              <div className="shrink-0 border-t border-sidebar-border p-3">
                <p className="truncate px-1 pb-2 text-xs text-sidebar-foreground/60">{user?.email}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <BrandMark compact />
          <div className="w-9" />
        </header>

          <div className="lg:pl-[264px]">
            <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
              <LoadBanners />
              <ErrorBoundary resetKey={routerLocation.pathname}>
                <Outlet />
              </ErrorBoundary>
            </div>
          </div>
          <MobileTabBar onMore={() => setMenuOpen(true)} />
        </div>
        </QuickActionsProvider>
      </CatalogProvider>
    </AccessProvider>
  );
}