import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, HardHat, TriangleAlert, User } from 'lucide-react';
import Pill from '@/components/common/Pill';
import PhotoStrip from '@/components/daily/PhotoStrip';
import { formatDate, formatDateTime, todayIst } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';
import { useQuickActions } from '@/components/layout/QuickActions';
import { voidDailyUpdate } from '@/lib/dailyService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const show = (value) => (value === null || value === undefined || value === '' ? null : String(value));

/** One day's report on one task, exactly as it was filed. */
export default function DailyUpdateCard({ update, hideVilla = false }) {
  const manpower = update.manpower_items || [];
  const forecastMoved = update.forecast_previous && update.forecast_new;
  const { user } = useAuth();
  const quick = useQuickActions();
  const { toast } = useToast();
  // Your own report of today can be corrected: it is taken back and the form reopens with its values.
  const canCorrect = !update.voided && user?.id && update.reported_by_id === user.id && update.update_date === todayIst() && update.task_id;

  const correct = async () => {
    try {
      await voidDailyUpdate(update.id);
      quick.openLogUpdate({
        taskId: update.task_id,
        prefill: { status: update.status, progress: update.progress_percent ?? '', note: update.work_done || '' },
      });
    } catch (e) {
      toast({ description: e?.message || 'That report could not be corrected.', variant: 'destructive' });
    }
  };

  return (
    <article className={`rounded-xl border border-border bg-card p-4 ${update.voided ? 'opacity-60' : ''}`}>
      {update.voided && (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Taken back{update.voided_by_name ? ` by ${update.voided_by_name}` : ''} — kept on record, not counted
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {hideVilla ? null : (
              <span className="mr-2 text-muted-foreground">
                {update.villa_code || update.site_area || 'Site-wide'}
              </span>
            )}
            {update.task_id ? (
              <Link to={`/tasks/${update.task_id}`} className="underline underline-offset-2">
                {update.task_ref || 'Task'}
              </Link>
            ) : (
              update.task_ref
            )}
            <span className="text-muted-foreground"> · {update.task_name}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {update.reported_by_name || 'Unknown user'}
            </span>
            <span className="field-mono">{formatDateTime(update.reported_at)}</span>
            {update.work_scope === 'Site-wide' && update.site_area ? <span>{update.site_area}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill value={update.status} />
          {update.progress_percent !== null && update.progress_percent !== undefined ? (
            <span className="field-mono text-xs text-muted-foreground">{update.progress_percent}%</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {show(update.work_done) && (
          <p>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Done today · </span>
            {update.work_done}
          </p>
        )}
        {show(update.plan_tomorrow) && (
          <p className="text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wide">Tomorrow · </span>
            {update.plan_tomorrow}
          </p>
        )}
        {update.manpower_total ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <HardHat className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{update.manpower_total} manpower</span>
            {manpower.length > 0 && <span>· {manpower.map((row) => `${row.discipline} ${row.count}`).join(', ')}</span>}
          </p>
        ) : null}
      </div>

      {update.blocker_reported && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> Blocker · {update.blocker_category}
          </p>
          <p className="mt-1 text-sm">{update.blocker_description}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
            {show(update.blocker_responsible_party) && <span>With {update.blocker_responsible_party}</span>}
            {show(update.expected_resolution_date) && (
              <span className="field-mono">Expected by {formatDate(update.expected_resolution_date)}</span>
            )}
          </p>
        </div>
      )}

      {update.blocker_cleared && (
        <p className="mt-3 text-xs text-muted-foreground">Blocker cleared on this report.</p>
      )}

      {forecastMoved && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          <span className="field-mono">
            {formatDate(update.forecast_previous)} → {formatDate(update.forecast_new)}
          </span>
          {show(update.date_revision_reason) && <span>· {update.date_revision_reason}</span>}
        </p>
      )}

      {update.photo_uris?.length > 0 && (
        <div className="mt-2">
          <PhotoStrip uris={update.photo_uris} />
        </div>
      )}
      {canCorrect && (
        <div className="mt-3 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={correct}>Correct this report</Button>
        </div>
      )}
    </article>
  );
}