import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandMark from '@/components/layout/BrandMark';
import NavList from '@/components/layout/NavList';

export default function DesktopSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await base44.auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-[68px] items-center border-b border-sidebar-border px-5">
        <BrandMark />
      </div>

      <div className="scroll-slim flex-1 overflow-y-auto p-3">
        <NavList />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent font-display text-xs font-semibold text-sidebar-accent-foreground">
            {(user?.full_name || user?.email || 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-sidebar-foreground">
              {user?.full_name || 'Signed in'}
            </span>
            <span className="block truncate text-[10px] text-sidebar-foreground/50">{user?.email}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}