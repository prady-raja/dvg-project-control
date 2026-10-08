import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bot, Building2, CalendarCheck, CalendarClock, CalendarRange, ClipboardCheck, ClipboardList,
  Construction, HardHat, LayoutDashboard, MapPin, Settings2, ShieldAlert, Upload, UserCog, UsersRound,
} from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ICONS = {
  LayoutDashboard, Building2, MapPin, ClipboardList, CalendarCheck, CalendarRange, Upload,
  ShieldAlert, ClipboardCheck, Construction, HardHat, UsersRound, CalendarClock, Bot, Settings2, UserCog,
};

export default function NavList({ onNavigate }) {
  let lastGroup = '';

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon] || Building2;
        const showGroup = item.group && item.group !== lastGroup;
        lastGroup = item.group || lastGroup;
        return (
          <React.Fragment key={item.to}>
            {showGroup && (
              <p className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                {item.group}
              </p>
            )}
            <NavLink
              to={item.to}
              end={item.to === '/'}
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
                </>
              )}
            </NavLink>
          </React.Fragment>
        );
      })}
    </nav>
  );
}