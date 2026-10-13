import { IMPORT_COLUMNS } from '@/lib/shared/workImport.ts';

/**
 * The register as an Excel sheet in the import template (I-03): edit it, upload it on
 * the Import screen, and each changed row comes back through the same review as any
 * revised work list. Every row names its task reference and when it was last updated,
 * so the import can refuse to overwrite work that moved on after the export.
 * Floor and room are left blank on purpose: a blank cell proposes nothing.
 */
export const EDITABLE_NOTE = 'Edit the cells you want to change. Leave "Task reference" and "Last updated (do not edit)" alone: they tie each row to its task. Upload this file on the Import screen to review the changes.';

export function registerRows(tasks, cat) {
  const columns = IMPORT_COLUMNS;
  const headers = columns.map((c) => c.label);
  const projectName = (id) => cat.projectById(id)?.name || '';
  const value = (task, key) => {
    switch (key) {
      case 'project': return projectName(task.project_id);
      case 'phase': return cat.phaseById(task.phase_id)?.name || '';
      case 'villa_code': return cat.locationById(task.location_id)?.villa_code || '';
      case 'work_category': return task.location_id ? 'Villa Work' : 'Site-Wide Work';
      case 'discipline': return task.discipline || '';
      case 'contractor': return cat.contractorById(task.contractor_id)?.name || '';
      case 'floor': case 'area': case 'scope_type': return '';
      case 'source_reference': return task.source_reference || '';
      case 'exported_at': return task.updated_date || '';
      default: return task[key] ?? '';
    }
  };
  const rows = tasks
    .filter((t) => t.is_villa_work_parent !== true && t.archived !== true)
    .map((task) => columns.map((c) => value(task, c.key)));
  return { headers, rows };
}
