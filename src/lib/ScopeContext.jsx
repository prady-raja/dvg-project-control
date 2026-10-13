import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalogs } from '@/lib/CatalogContext';

const KEY = 'dvg.scope';

const readStored = () => {
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};
const writeStored = (value) => {
  try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private mode: the URL still carries it */ }
};

const ScopeContext = createContext(null);

/**
 * The project and phase every screen is showing (N-03). It lives in the address
 * (?project=&phase=) so a link carries it, falls back to the last choice on this
 * phone or computer, then to the first project — instead of each page working it
 * out for itself and forgetting it on the next page.
 */
export function ScopeProvider({ children }) {
  const cat = useCatalogs();
  const [params, setParams] = useSearchParams();

  const value = useMemo(() => {
    const stored = readStored();
    const known = (id) => (id && cat.projects.some((p) => p.id === id) ? id : '');
    const projectId = known(params.get('project')) || known(stored.project) || cat.projects[0]?.id || '';
    const phaseOk = (id) => (id && cat.phasesFor(projectId).some((p) => p.id === id) ? id : '');
    const fromStore = stored.project === projectId ? stored.phase : '';
    const phaseId = phaseOk(params.get('phase')) || (params.get('project') ? '' : phaseOk(fromStore));
    return { projectId, phaseId };
  }, [params, cat]);

  const write = useCallback((patch) => {
    const stored = readStored();
    const next = { ...stored, ...patch };
    writeStored(next);
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      if ('project' in patch) { if (patch.project) out.set('project', patch.project); else out.delete('project'); }
      if ('phase' in patch) { if (patch.phase) out.set('phase', patch.phase); else out.delete('phase'); }
      return out;
    }, { replace: true });
  }, [setParams]);

  const api = useMemo(() => ({
    ...value,
    setProjectId: (id) => write({ project: id || '', phase: '' }),
    setPhaseId: (id) => write({ phase: id || '' }),
  }), [value, write]);

  return <ScopeContext.Provider value={api}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used inside <ScopeProvider>');
  return ctx;
}

/** [projectId, setProjectId, phaseId, setPhaseId] — a drop-in for the two useState pairs pages used to keep. */
export function useScopeState() {
  const s = useScope();
  return [s.projectId, s.setProjectId, s.phaseId, s.setPhaseId];
}
