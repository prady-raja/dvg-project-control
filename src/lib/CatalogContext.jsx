import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAccess } from '@/lib/AccessContext';
import { byId, items } from '@/lib/dataHelpers';
import { errorMessageOf } from '@/lib/clientErrors';

const CatalogContext = createContext(null);

const EMPTY = {
  projects: [],
  phases: [],
  locations: [],
  contractors: [],
  disciplines: [],
  workPackages: [],
  contractorDefaults: [],
};

/**
 * Small, bounded reference data (projects, phases, villas, contractors,
 * disciplines, work packages, contractor defaults). Loaded once for the
 * signed-in session and refreshed after any administrative change.
 */
export function CatalogProvider({ children }) {
  const access = useAccess();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
    const [projects, phases, locations, contractors, disciplines, workPackages, contractorDefaults] =
      await Promise.all([
        base44.entities.Project.filter({}, { sort: 'name', limit: 200 }),
        base44.entities.Phase.filter({}, { sort: 'sort_order', limit: 300 }),
        base44.entities.Location.filter({}, { sort: 'sort_order', limit: 1000 }),
        base44.entities.Contractor.filter({}, { sort: 'name', limit: 300 }),
        base44.entities.Discipline.filter({}, { sort: 'sort_order', limit: 200 }),
        base44.entities.WorkPackage.filter({}, { sort: 'sort_order', limit: 1000 }),
        base44.entities.ContractorDefault.filter({}, { limit: 1000 }),
      ]);
    // A project under execution leads the list (and is the default scope of every
    // dashboard); a project still in planning has no work to report yet.
    const ordered = [...items(projects)].sort(
      (a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1)
        || String(a.name || '').localeCompare(String(b.name || '')),
    );
    setData({
      projects: ordered,
      phases: items(phases),
      locations: items(locations),
      contractors: items(contractors),
      disciplines: items(disciplines),
      workPackages: items(workPackages),
      contractorDefaults: items(contractorDefaults),
    });
    } catch (e) {
      setError(errorMessageOf(e, 'The project lists could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Access resolves first: a membership recorded against this person's email is
  // claimed and mirrored onto the project's records before anything is read.
  useEffect(() => {
    if (access.loading) return;
    refresh();
  }, [access.loading, refresh]);

  const value = useMemo(() => {
    const maps = {
      projectMap: byId(data.projects),
      phaseMap: byId(data.phases),
      locationMap: byId(data.locations),
      contractorMap: byId(data.contractors),
      disciplineMap: byId(data.disciplines),
    };

    const disciplineByCode = new Map(data.disciplines.map((d) => [d.code, d]));

    const api = {
      ...data,
      ...maps,
      loading,
      error,
      refresh,
      projectById: (id) => maps.projectMap.get(id),
      phaseById: (id) => maps.phaseMap.get(id),
      locationById: (id) => maps.locationMap.get(id),
      contractorById: (id) => maps.contractorMap.get(id),
      disciplineByCode: (code) => disciplineByCode.get(code),
      disciplineName: (code) => disciplineByCode.get(code)?.name || code || '',
      phasesFor: (projectId) =>
        data.phases.filter((p) => p.project_id === projectId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      locationsFor: (projectId, phaseId) =>
        data.locations
          .filter((l) => l.project_id === projectId && (!phaseId || l.phase_id === phaseId))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      villasFor: (projectId) =>
        data.locations
          .filter((l) => l.project_id === projectId && l.location_type === 'Villa')
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      enabledDisciplines: (project) => {
        if (!project) return data.disciplines.filter((d) => d.active !== false);
        const ids = project.enabled_disciplines || [];
        if (!ids.length) return data.disciplines.filter((d) => d.active !== false);
        return data.disciplines.filter((d) => ids.includes(d.id) && d.active !== false);
      },
      workPackagesFor: (projectId, disciplineCode) =>
        data.workPackages
          .filter((w) => w.discipline === disciplineCode && w.active !== false && (!projectId || w.project_id === projectId))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      suggestedContractorId: (projectId, phaseId, disciplineCode) => {
        const candidates = data.contractorDefaults.filter(
          (d) => d.project_id === projectId && d.discipline === disciplineCode && d.active !== false,
        );
        const exact = candidates.find((d) => d.phase_id === phaseId);
        if (exact) return exact.contractor_id;
        const anyPhase = candidates.find((d) => !d.phase_id);
        return anyPhase ? anyPhase.contractor_id : '';
      },
    };
    return api;
  }, [data, loading, error, refresh]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalogs() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalogs must be used inside CatalogProvider');
  return ctx;
}