/**
 * P-01: actual_start and actual_finish were never set. Read them back from the
 * status changes in TaskHistory: the first move to In Progress, and the latest
 * move to Execution Complete (cleared if the task was reopened since).
 */
const day = (value) => String(value || '').slice(0, 10);

export const actualDates = {
  id: 'actual-dates',
  description: 'Fill actual_start and actual_finish from TaskHistory status changes.',
  entities: { Task: { archived: { $ne: true } }, TaskHistory: { field_changed: 'status' } },
  plan({ Task: tasks = [], TaskHistory: history = [] }) {
    const byTask = new Map();
    history.forEach((h) => {
      if (!h.task_id) return;
      if (!byTask.has(h.task_id)) byTask.set(h.task_id, []);
      byTask.get(h.task_id).push(h);
    });
    const patches = [];
    tasks.forEach((task) => {
      const rows = (byTask.get(task.id) || []).slice().sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)));
      const data = {};
      const started = rows.find((h) => h.new_value === 'In Progress');
      if (!task.actual_start && started) data.actual_start = day(started.changed_at);
      const finished = rows.filter((h) => h.new_value === 'Execution Complete').pop();
      const reopened = finished && rows.some((h) => String(h.changed_at) > String(finished.changed_at) && ['Not Started', 'In Progress', 'Blocked'].includes(h.new_value));
      const done = ['Execution Complete', 'Under Inspection', 'Approved', 'Closed'].includes(task.status);
      if (!task.actual_finish && finished && !reopened && done) data.actual_finish = day(finished.changed_at);
      if (Object.keys(data).length) patches.push({ entity: 'Task', id: task.id, data });
    });
    return patches;
  },
};
