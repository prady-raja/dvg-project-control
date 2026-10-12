/** X-03: give each task the update_date of its newest daily report. */
export const latestReportDate = {
  id: 'latest-report-date',
  description: 'Set Task.latest_report_date from the newest DailyUpdate.update_date of each task.',
  entities: { Task: { archived: { $ne: true } }, DailyUpdate: {} },
  plan({ Task: tasks = [], DailyUpdate: updates = [] }) {
    const newest = new Map();
    updates.forEach((u) => {
      const day = String(u.update_date || '').slice(0, 10);
      if (!u.task_id || !day) return;
      if (!newest.has(u.task_id) || newest.get(u.task_id) < day) newest.set(u.task_id, day);
    });
    return tasks
      .filter((t) => newest.has(t.id))
      .map((t) => ({ entity: 'Task', id: t.id, data: { latest_report_date: newest.get(t.id) } }));
  },
};
