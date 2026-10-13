import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { formatDate, todayIst } from '@/lib/format';
import { withState } from '@/lib/shared/commitments.ts';
import Pill from '@/components/common/Pill';

/** What contractors have promised about this task (C-01). Open and past its date reads as Missed. */
export default function TaskCommitments({ taskId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    base44.entities.MeetingCommitment.filter({ task_id: taskId }, { sort: '-meeting_date', limit: 50 })
      .then((res) => alive && setRows(items(res).map((c) => withState(c, todayIst()))))
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [taskId]);
  if (!rows?.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commitments</h2>
      <ul className="divide-y divide-border">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-sm">{c.commitment}</p>
              <p className="text-xs text-muted-foreground">Meeting {formatDate(c.meeting_date)} · promised {formatDate(c.promised_date)}{c.responsible_person ? ` · ${c.responsible_person}` : ''}</p>
            </div>
            <Pill value={c.state} />
          </li>
        ))}
      </ul>
      <Link to="/meetings" className="mt-2 inline-block text-xs text-primary underline">Open the meeting register</Link>
    </section>
  );
}
