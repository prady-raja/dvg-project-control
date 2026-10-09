/**
 * The audit trail for records that are not tasks — villas and locations today.
 *
 * Location edits go through the authenticated `saveRecord` operation, and every
 * accepted change writes its before/after values here, taken from the stored
 * record and the validated change set rather than from anything the browser
 * says about itself. Rows are written only by server-side operations.
 */

import { SERVER_OWNED_FIELDS } from './history.ts';

/** The fields an audited record may change, per entity. */
export const AUDITED_FIELDS = {
  Location: [
    'project_id', 'phase_id', 'villa_code', 'location_type', 'plot_numbers',
    'possession_status', 'possession_date', 'works_stage', 'active_status',
    'planned_completion_date', 'assigned_engineer', 'sort_order', 'notes',
  ],
};

const NUMBER_FIELDS = ['sort_order'];

const normalize = (field, value) => {
  if (value === '' || value === undefined || value === null) return null;
  if (NUMBER_FIELDS.includes(field)) {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return String(value);
};

const trim = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
};

const changeTypeFor = (field) => {
  if (field === 'active_status') return 'Status Change';
  if (field === 'villa_code') return 'Identity';
  if (field === 'phase_id' || field === 'project_id') return 'Placement';
  return 'Field Change';
};

/**
 * Writes one row per genuinely changed field, plus a row for the operation
 * itself, and returns how many were written. Nothing is written when nothing
 * changed, so an unchanged save does not pad the trail.
 */
export async function writeRecordAudit(base44, { entity, before, changes, after, projectId, memberIds, user, note }) {
  const fields = AUDITED_FIELDS[entity];
  if (!fields) return 0;

  const rows = [];
  const base = {
    entity_name: entity,
    record_id: (after && after.id) || (before && before.id) || '',
    project_id: projectId || (after && after.project_id) || (before && before.project_id) || '',
    member_ids: memberIds || (after && after.member_ids) || [],
    changed_by_id: (user && user.id) || '',
    changed_by_name: (user && (user.full_name || user.email)) || 'Unknown user',
    changed_at: new Date().toISOString(),
  };

  if (!before) {
    rows.push({
      ...base,
      change_type: 'Record Created',
      field_changed: 'record',
      old_value: '',
      new_value: trim((after && (after.villa_code || after.id)) || ''),
      note: note || 'Record created',
    });
  } else {
    fields.forEach((field) => {
      if (!changes || !Object.prototype.hasOwnProperty.call(changes, field)) return;
      const previous = normalize(field, before[field]);
      const next = normalize(field, changes[field]);
      if (String(previous === null ? '' : previous) === String(next === null ? '' : next)) return;
      rows.push({
        ...base,
        change_type: changeTypeFor(field),
        field_changed: field,
        old_value: trim(previous),
        new_value: trim(next),
        note: note || '',
      });
    });
  }

  if (!rows.length) return 0;
  await base44.asServiceRole.entities.RecordAudit.bulkCreate(rows);
  return rows.length;
}

/** Fields a caller may never set on an audited record, from one shared list. */
export const isServerOwned = (field) => SERVER_OWNED_FIELDS.includes(field);