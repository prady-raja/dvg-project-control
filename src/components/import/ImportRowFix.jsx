import React, { useEffect, useMemo, useState } from 'react';
import { Wand2, Plus } from 'lucide-react';
import { data } from '@/api/data';
import { createRecord } from '@/lib/recordService';
import { useAccess } from '@/lib/AccessContext';
import { normalizeAreaName } from '@/lib/shared/villaAreas.ts';
import { forgetVillaScope } from '@/components/villa/VillaScopePicker';
import { Button } from '@/components/ui/button';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

/**
 * Corrections for one row. Values are pre-filled from what the server read, and
 * whatever is applied is re-checked by the server before it is trusted.
 */
// The file's own wording for each corrected value, so one correction can be offered to every row that said the same.
const RAW_KEY = { location_id: 'villa_code', discipline: 'discipline', contractor_id: 'contractor', work_package: 'work_package', floor: 'floor', area: 'area' };
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

export default function ImportRowFix({ row, cat, projectId, onApply, onApplyMany, onClear, busy, allRows = [] }) {
  const access = useAccess();
  const [creating, setCreating] = useState('');
  const [note, setNote] = useState('');
  const [scope, setScope] = useState({ floors: [], areas: [] });
  const [draft, setDraft] = useState(() => ({
    floor: row.values.floor || '',
    area: row.values.area || '',
    location_id: row.resolved.location_id || '',
    discipline: row.resolved.discipline || '',
    work_package: row.resolved.work_package || '',
    contractor_id: row.resolved.contractor_id || '',
    status: row.resolved.status_value || '',
    priority: row.resolved.priority_value || '',
    name: row.values.name || '',
    baseline_start: row.resolved.baseline_start || '',
    baseline_finish: row.resolved.baseline_finish || '',
    current_forecast_finish: row.resolved.current_forecast_finish || '',
    progress_percent: row.resolved.progress_percent === null ? '' : String(row.resolved.progress_percent),
    estimated_manhours: row.resolved.estimated_manhours === null ? '' : String(row.resolved.estimated_manhours),
    responsible_engineer: row.values.responsible_engineer || '',
    remarks: row.values.remarks || '',
  }));

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const locations = cat.locationsFor(projectId);

  // The chosen villa's registered floors and rooms, to correct the scope and to see what is missing.
  useEffect(() => {
    if (!draft.location_id) {
      setScope({ floors: [], areas: [] });
      return undefined;
    }
    let alive = true;
    Promise.all([
      data.list('VillaFloor', { location_id: draft.location_id }, { sort: 'level_order', limit: 100 }),
      data.list('VillaArea', { location_id: draft.location_id }, { sort: 'sort_order', limit: 300 }),
    ]).then(([floors, areas]) => alive && setScope({ floors, areas })).catch(() => {});
    return () => { alive = false; };
  }, [draft.location_id]);

  const roomNames = useMemo(() => String(draft.area || '').split(/[,;/|]+/).map((n) => n.trim()).filter(Boolean), [draft.area]);
  const missingRooms = useMemo(() => {
    if (!draft.location_id) return [];
    const known = new Set(scope.areas.map((a) => a.normalized_name || normalizeAreaName(a.area_name)));
    return roomNames.filter((name) => !known.has(normalizeAreaName(name)));
  }, [draft.location_id, scope.areas, roomNames]);

  const othersWithSameWording = (field) => {
    const key = RAW_KEY[field];
    const raw = row.values[key];
    if (!raw || !String(raw).trim()) return [];
    return allRows.filter((other) => other.row_number !== row.row_number && same(other.values[key], raw)).map((other) => other.row_number);
  };

  const ApplyToAll = ({ field, patch }) => {
    const others = othersWithSameWording(field);
    if (!others.length || !onApplyMany) return null;
    return (
      <button
        type="button"
        className="mt-1 text-left text-[11px] text-primary underline-offset-2 hover:underline"
        disabled={!!busy}
        onClick={() => onApplyMany([row.row_number, ...others], patch)}
      >
        Apply to all {others.length + 1} rows that say “{row.values[RAW_KEY[field]]}”
      </button>
    );
  };

  const create = async (kind, run) => {
    setCreating(kind);
    setNote('');
    try {
      await run();
    } catch (e) {
      setNote(e?.message || 'That could not be created.');
    } finally {
      setCreating('');
    }
  };

  const createVilla = () => create('villa', async () => {
    const code = row.values.villa_code.trim();
    const created = await createRecord('Location', {
      project_id: projectId, phase_id: row.resolved.phase_id || '', villa_code: code, location_type: 'Villa',
      possession_status: 'Not Handed Over', works_stage: 'Works Pending', active_status: 'Active',
    });
    await cat.refresh();
    set({ location_id: created.record.id });
    setNote(`Created ${code}. Apply corrections to use it.`);
  });

  const createContractor = () => create('contractor', async () => {
    const created = await createRecord('Contractor', { name: row.values.contractor.trim(), classification: 'External Contractor', active: true });
    await cat.refresh();
    set({ contractor_id: created.record.id });
    setNote(`Created ${row.values.contractor.trim()}. Apply corrections to use it.`);
  });

  const createRooms = () => create('rooms', async () => {
    const villa = cat.locationById(draft.location_id);
    const floor = scope.floors.find((f) => same(f.floor_name, draft.floor) || same(f.floor_code, draft.floor));
    for (const name of missingRooms) {
      await createRecord('VillaArea', {
        project_id: projectId, phase_id: villa?.phase_id || '', location_id: draft.location_id,
        floor_id: floor?.id || null, area_name: name, source: 'Manual',
      });
    }
    forgetVillaScope(draft.location_id);
    const [floors, areas] = await Promise.all([
      data.list('VillaFloor', { location_id: draft.location_id }, { sort: 'level_order', limit: 100 }),
      data.list('VillaArea', { location_id: draft.location_id }, { sort: 'sort_order', limit: 300 }),
    ]);
    setScope({ floors, areas });
    setNote(`Registered ${missingRooms.join(', ')}. Apply corrections to use them.`);
  });
  const packages = draft.discipline ? cat.workPackagesFor(projectId, draft.discipline) : [];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Wand2 className="h-3.5 w-3.5" /> Correct row {row.row_number}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => onClear(row.row_number)} disabled={!!busy}>
            Reset row
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => onApply(row.row_number, draft)} disabled={!!busy}>
            Apply corrections
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Task description" required>
          <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
        </Field>

        <Field label="Villa / location" hint={row.resolved.location_state === 'ambiguous' ? 'The file matched more than one villa' : ''}>
          <EnumSelect
            value={draft.location_id}
            onChange={(value) => set({ location_id: value })}
            options={locations.map((location) => ({
              value: location.id,
              label: `${location.villa_code}${location.location_type === 'Villa' ? '' : ` — ${location.location_type}`}`,
            }))}
            placeholder={row.values.villa_code ? `${row.values.villa_code} (unmatched)` : 'No villa (site-wide)'}
          />
          {row.resolved.location_state === 'unknown' && row.values.villa_code && !draft.location_id && (
            <Button type="button" size="sm" variant="outline" className="mt-1.5 gap-1.5" disabled={!!busy || !!creating} onClick={createVilla}>
              <Plus className="h-3.5 w-3.5" /> {creating === 'villa' ? 'Creating…' : `Create villa ${row.values.villa_code}`}
            </Button>
          )}
          {draft.location_id && <ApplyToAll field="location_id" patch={{ location_id: draft.location_id }} />}
        </Field>

        {draft.location_id && (
          <>
            <Field label="Floor" hint="Registered on this villa">
              <EnumSelect
                value={scope.floors.find((f) => same(f.floor_name, draft.floor) || same(f.floor_code, draft.floor))?.floor_name || ''}
                onChange={(value) => set({ floor: value })}
                options={[{ value: '', label: 'No floor' }, ...scope.floors.map((f) => ({ value: f.floor_name, label: f.floor_name }))]}
                placeholder={row.values.floor ? `${row.values.floor} (not registered)` : 'No floor'}
              />
              <ApplyToAll field="floor" patch={{ floor: draft.floor }} />
            </Field>
            <Field label="Rooms/areas" hint="Tick registered rooms, or type names separated by commas.">
              {scope.areas.length > 0 && (
                <div className="mb-1.5 max-h-28 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {scope.areas.map((area) => {
                    const checked = roomNames.some((n) => normalizeAreaName(n) === (area.normalized_name || normalizeAreaName(area.area_name)));
                    return (
                      <label key={area.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const key = area.normalized_name || normalizeAreaName(area.area_name);
                            const rest = roomNames.filter((n) => normalizeAreaName(n) !== key);
                            set({ area: (e.target.checked ? [...rest, area.area_name] : rest).join(', ') });
                          }}
                        />
                        {area.area_name}
                      </label>
                    );
                  })}
                </div>
              )}
              <Input value={draft.area} onChange={(event) => set({ area: event.target.value })} placeholder="e.g. Kitchen, Utility" />
              {missingRooms.length > 0 && (
                <Button type="button" size="sm" variant="outline" className="mt-1.5 gap-1.5" disabled={!!busy || !!creating} onClick={createRooms}>
                  <Plus className="h-3.5 w-3.5" /> {creating === 'rooms' ? 'Registering…' : `Register ${missingRooms.join(', ')} on this villa`}
                </Button>
              )}
              <ApplyToAll field="area" patch={{ area: draft.area }} />
            </Field>
          </>
        )}

        <Field label="Discipline" required>
          <EnumSelect
            value={draft.discipline}
            onChange={(value) => set({ discipline: value, work_package: '' })}
            options={cat.disciplines.map((discipline) => ({ value: discipline.code, label: discipline.name }))}
            placeholder={row.values.discipline || 'Choose a discipline'}
          />
          {draft.discipline && <ApplyToAll field="discipline" patch={{ discipline: draft.discipline }} />}
        </Field>

        <Field label="Work package">
          <EnumSelect
            value={draft.work_package}
            onChange={(value) => set({ work_package: value })}
            options={packages.map((item) => ({ value: item.package_name, label: item.package_name }))}
            placeholder={row.values.work_package || 'Choose a work package'}
            disabled={!draft.discipline}
          />
        </Field>

        <Field label="Contractor">
          <EnumSelect
            value={draft.contractor_id}
            onChange={(value) => set({ contractor_id: value })}
            options={cat.contractors.map((contractor) => ({ value: contractor.id, label: contractor.name }))}
            placeholder={row.values.contractor ? `${row.values.contractor} (unmatched)` : 'Project default'}
          />
          {row.values.contractor && !draft.contractor_id && access.appAdmin && (
            <Button type="button" size="sm" variant="outline" className="mt-1.5 gap-1.5" disabled={!!busy || !!creating} onClick={createContractor}>
              <Plus className="h-3.5 w-3.5" /> {creating === 'contractor' ? 'Creating…' : `Create contractor ${row.values.contractor}`}
            </Button>
          )}
          {draft.contractor_id && <ApplyToAll field="contractor_id" patch={{ contractor_id: draft.contractor_id }} />}
        </Field>

        <Field label="Responsible engineer">
          <Input
            value={draft.responsible_engineer}
            onChange={(event) => set({ responsible_engineer: event.target.value })}
          />
        </Field>

        <Field label="Status">
          <EnumSelect
            value={draft.status}
            onChange={(value) => set({ status: value })}
            options={TASK_STATUSES}
            placeholder={row.values.status || 'Not Started'}
          />
        </Field>

        <Field label="Priority">
          <EnumSelect
            value={draft.priority}
            onChange={(value) => set({ priority: value })}
            options={TASK_PRIORITIES}
            placeholder={row.values.priority || 'Medium'}
          />
        </Field>

        <Field label="Progress %">
          <Input
            type="number"
            min="0"
            max="100"
            value={draft.progress_percent}
            onChange={(event) => set({ progress_percent: event.target.value })}
            placeholder="Blank when unknown"
          />
        </Field>

        <Field label="Baseline start">
          <Input type="date" value={draft.baseline_start} onChange={(event) => set({ baseline_start: event.target.value })} />
        </Field>

        <Field label="Baseline finish">
          <Input type="date" value={draft.baseline_finish} onChange={(event) => set({ baseline_finish: event.target.value })} />
        </Field>

        <Field label="Forecast finish">
          <Input
            type="date"
            value={draft.current_forecast_finish}
            onChange={(event) => set({ current_forecast_finish: event.target.value })}
          />
        </Field>

        <Field label="Estimated man-hours">
          <Input
            type="number"
            min="0"
            value={draft.estimated_manhours}
            onChange={(event) => set({ estimated_manhours: event.target.value })}
          />
        </Field>

        <Field label="Remarks" className="sm:col-span-2">
          <Input value={draft.remarks} onChange={(event) => set({ remarks: event.target.value })} />
        </Field>
      </div>

      {note && <p className="mt-3 text-xs text-foreground" role="status">{note}</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Corrections are held in this window only. Nothing is written to a task until you confirm the import.
      </p>
    </div>
  );
}