/**
 * FRONTEND COPY of the villa statement in base44/shared/villaViews.ts — the
 * browser may not import from base44/, so the plain-text statement for owner and
 * handover conversations lives here too. Keep the two in step.
 */

const dayLabel = (day) => (day ? day : 'date not set');

/** The statement as plain text for WhatsApp: short lines, no tables, no internal fields. */
export function statementText(view, { includeRefs = false } = {}) {
  const v = view.villa;
  const lines = [
    `Pending works — ${v.code}${v.plots ? ` (${v.plots})` : ''}, ${v.project}${v.phase ? `, ${v.phase}` : ''}`,
    `As of ${view.as_of}. ${v.possession_status === 'Handed Over' ? `Handed over${v.possession_date ? ` on ${v.possession_date}` : ''}.` : 'Not yet handed over.'}`,
    view.forecast.date
      ? `${view.forecast.label}: ${view.forecast.date}${view.forecast.undated ? ` (${view.forecast.undated} item(s) have no date yet)` : ''}`
      : view.totals.open_tasks ? `${view.forecast.label}: not scheduled yet` : 'No pending works.',
    '',
  ];
  view.groups.forEach((group) => {
    lines.push(group.floor.toUpperCase());
    group.items.forEach((item) => {
      lines.push(`• ${item.room ? `${item.room}: ` : ''}${item.what}${includeRefs && item.ref ? ` [${item.ref}]` : ''} — ${item.trade}, ${item.status.toLowerCase()}, ${dayLabel(item.expected)}${item.holding ? `. ${item.holding}` : ''}`);
    });
    lines.push('');
  });
  if (view.snags.length) {
    lines.push('SNAGS TO FIX');
    view.snags.forEach((s) => lines.push(`• ${s.title}${s.area ? ` (${s.area})` : ''} — ${s.status.toLowerCase()}`));
    lines.push('');
  }
  if (view.needed_from_owner.length) {
    lines.push('NEEDED FROM YOU');
    view.needed_from_owner.forEach((o) => lines.push(`• ${o.need}: ${o.what}`));
    lines.push('');
  }
  if (view.completed_recently.length) {
    lines.push(`COMPLETED IN THE LAST 30 DAYS: ${view.completed_recently.length}`);
  }
  lines.push(`${view.totals.open_tasks} work item(s) and ${view.totals.open_snags} snag(s) open.${view.totals.percent !== null ? ` ${view.totals.percent}% complete (measured).` : ''}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}