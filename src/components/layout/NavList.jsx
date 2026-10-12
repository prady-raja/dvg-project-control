import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bot, Building2, CalendarCheck, CalendarClock, CalendarRange, CircleHelp, ClipboardCheck, ClipboardList,
  Construction, Grid3x3, HardHat, History, LayoutDashboard, ListChecks, MapPin, Settings2, ShieldAlert, Sun, Upload, UserCog, UsersRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NAV_SECTIONS, visibleSections } from '@/lib/navigation';
import { useAccess } from '@/lib/AccessContext';
import { loadDashboard } from '@/lib/dashboardService';
import { queryKeys } from '@/lib/queries/keys';
import { cn } from '@/lib/utils';

const ICONS = {
  Bot, Building2, CalendarCheck, CalendarClock, CalendarRange, CircleHelp, ClipboardCheck, ClipboardList,
  Construction, Grid3x3, HardHat, History, LayoutDashboard, ListChecks, MapPin, Settings2, ShieldAlert, Sun, Upload, UserCog, UsersRound,
};

export const iconFor = (name) => ICONS[name] || Building2;

/** Menu badge counts, from the one counts view on the server; refreshed after any save. */
export function useNavCounts() {
  const access = useAccess();
  const enabled = !access.loading && access.hasAnyProject;
  const { data } = useQuery({
    queryKey: queryKeys.navCounts(),
    queryFn: () => loadDashboard('counts', {}),
    enabled,
    staleTime: 120000,
    refetchInterval: 300000,
  });
  return data || {};
}

export default function NavList({ onNavigate }) {
  const access = useAccess();
  const counts = useNavCounts();
  const sections = visibleSections(NAV_SECTIONS, { appAdmin: access.appAdmin, canAnywhere: access.canAnywhere });

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {sections.map((section) => (
        <React.Fragment key={section.label}>
          <p className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40">{section.label}</p>
          {section.items.map((item) => {
            const Icon = iconFor(item.icon);
            const badge = item.badge ? counts[item.badge] : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/overview' || item.to === '/import'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-sidebar-primary' : '')} />
                    <span className="truncate">{item.label}</span>
                    {badge > 0 && (
                      <span className="field-mono ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-accent-foreground" aria-label={`${badge} need attention`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </React.Fragment>
      ))}
    </nav>
  );
}

