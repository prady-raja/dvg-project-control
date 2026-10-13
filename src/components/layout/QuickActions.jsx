import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, MessageSquareText, TriangleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import LogUpdateDrawer from '@/components/daily/LogUpdateDrawer';
import SnagDialog from '@/components/handover/SnagDialog';
import BlockerSheet from '@/components/daily/BlockerSheet';
import VillaDaySheet from '@/components/daily/VillaDaySheet';
import { todayIst } from '@/lib/format';
import { useInvalidateWork } from '@/hooks/useDashboardQuery';

const QuickActionsContext = createContext(null);

/** The villa or task on screen, read from the address, so "+" is already scoped to it. */
export function screenContext(pathname) {
  const villa = pathname.match(/^\/locations\/([^/]+)/);
  const task = pathname.match(/^\/tasks\/([^/]+)/);
  return { locationId: villa && villa[1] !== 'new' ? villa[1] : '', taskId: task && !['new'].includes(task[1]) ? task[1] : '' };
}

/**
 * Log update, Snag and Tell DVG from anywhere: the bottom bar's "+" opens them on
 * a phone, and pages open them from a task card or the Today list. Each opens
 * already scoped to the villa or task the person is looking at.
 */
export function QuickActionsProvider({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cat = useCatalogs();
  const access = useAccess();
  const invalidateWork = useInvalidateWork();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logFor, setLogFor] = useState(null);
  const [snagFor, setSnagFor] = useState(null);
  const [blockFor, setBlockFor] = useState(null);
  const [dayFor, setDayFor] = useState(null);
  // Bumped after any save, so a page showing the work can reload itself.
  const [version, setVersion] = useState(0);

  const here = screenContext(pathname);

  const api = useMemo(() => ({
    openMenu: () => setMenuOpen(true),
    openLogUpdate: (scope = {}) => { setMenuOpen(false); setLogFor({ ...here, ...scope }); },
    openSnag: (scope = {}) => { setMenuOpen(false); setSnagFor({ ...here, ...scope }); },
    openBlocker: (task) => setBlockFor(task),
    openDaySheet: (scope = {}) => { setMenuOpen(false); setDayFor({ date: todayIst(), ...scope }); },
    tellDvg: () => { setMenuOpen(false); navigate('/ai'); },
    canReport: access.canAnywhere('edit_tasks'),
    version,
  }), [here, access, navigate, version]);

  const afterSave = useCallback(() => {
    setVersion((n) => n + 1);
    return invalidateWork();
  }, [invalidateWork]);
  const snagLocation = snagFor?.locationId ? cat.locationById(snagFor.locationId) : null;

  return (
    <QuickActionsContext.Provider value={api}>
      {children}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>What do you want to do?</SheetTitle>
            <SheetDescription>
              {here.taskId ? 'On this task.' : here.locationId ? `On ${cat.locationById(here.locationId)?.villa_code || 'this villa'}.` : 'Pick the villa next.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {[
              { icon: Camera, label: 'Log update', hint: 'Progress and a photo, in a few taps', run: () => api.openLogUpdate() },
              { icon: TriangleAlert, label: 'Raise a snag', hint: 'A defect to be fixed and re-inspected', run: () => api.openSnag() },
              { icon: MessageSquareText, label: 'Tell DVG', hint: 'Paste a site message; confirm what it proposes', run: api.tellDvg },
            ].map(({ icon: Icon, label, hint, run }) => (
              <button key={label} type="button" onClick={run} disabled={!api.canReport}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:bg-accent disabled:opacity-50">
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <LogUpdateDrawer
        open={!!logFor}
        onOpenChange={(v) => !v && setLogFor(null)}
        scope={logFor}
        onSaved={afterSave}
        onBlock={(task) => { setLogFor(null); setBlockFor(task); }}
      />
      <SnagDialog
        open={!!snagFor}
        onOpenChange={(v) => !v && setSnagFor(null)}
        projectId={snagLocation?.project_id || cat.projects[0]?.id || ''}
        phaseId={snagLocation?.phase_id || ''}
        locationId={snagFor?.locationId || ''}
        disciplines={cat.disciplines}
        contractors={cat.contractors}
        prefill={snagFor?.prefill || null}
        onSaved={() => { setSnagFor(null); afterSave(); }}
      />
      <BlockerSheet task={blockFor} onClose={() => setBlockFor(null)} onSaved={afterSave} />
      <VillaDaySheet open={!!dayFor} onOpenChange={(v) => !v && setDayFor(null)} locationId={dayFor?.locationId} date={dayFor?.date || todayIst()} onSaved={afterSave} />
    </QuickActionsContext.Provider>
  );
}

export function useQuickActions() {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) throw new Error('useQuickActions must be used inside QuickActionsProvider');
  return ctx;
}
