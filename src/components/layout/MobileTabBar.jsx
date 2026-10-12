import React from 'react';
import { NavLink } from 'react-router-dom';
import { ListChecks, MapPin, Menu, Plus, Sun } from 'lucide-react';
import { useNavCounts } from '@/components/layout/NavList';
import { useQuickActions } from '@/components/layout/QuickActions';
import { cn } from '@/lib/utils';

const Tab = ({ to, icon: Icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn('relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')
    }
  >
    <Icon className="h-5 w-5" aria-hidden />
    {label}
    {badge > 0 && (
      <span className="field-mono absolute right-[22%] top-1.5 rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">{badge > 99 ? '99+' : badge}</span>
    )}
  </NavLink>
);

/**
 * The phone's bottom bar: Today, Villas, a large "+" for Log update / Snag / Tell
 * DVG, Snags, and More (the full menu). Hidden on large screens, where the sidebar
 * does the job.
 */
export default function MobileTabBar({ onMore }) {
  const counts = useNavCounts();
  const quick = useQuickActions();
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <Tab to="/today" icon={Sun} label="Today" badge={counts.today} />
      <Tab to="/locations" icon={MapPin} label="Villas" />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={quick.openMenu}
          aria-label="Log update, snag or message"
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
        >
          <Plus className="h-7 w-7" aria-hidden />
        </button>
      </div>
      <Tab to="/handover" icon={ListChecks} label="Snags" badge={counts.snags} />
      <button type="button" onClick={onMore} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground">
        <Menu className="h-5 w-5" aria-hidden />
        More
      </button>
    </nav>
  );
}
