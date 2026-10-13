import React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ActivityCard, { ActivityFlags } from '@/components/common/ActivityCard';
import Pill from '@/components/common/Pill';
import HealthBadge from '@/components/common/HealthBadge';
import { formatDate } from '@/lib/format';

const th = 'whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * The activity list every board and report uses: a table that scrolls
 * sideways on desktop, cards on a phone. One shape of row, so the same task
 * reads identically wherever management meets it.
 */
export default function ActivityRows({ rows = [], emptyLabel = 'Nothing to show for this filter.', showAction = false, rowAction, rowActionLabel = 'Manage' }) {
  if (!rows.length) {
    return <p className="px-1 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="scroll-slim hidden overflow-x-auto md:block">
        <Table className="min-w-[1040px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={th}>Task ref</TableHead>
              <TableHead className={th}>Villa / location</TableHead>
              <TableHead className={th}>Work</TableHead>
              <TableHead className={th}>Discipline</TableHead>
              <TableHead className={th}>Contractor</TableHead>
              <TableHead className={th}>Engineer</TableHead>
              <TableHead className={th}>Baseline finish</TableHead>
              <TableHead className={th}>Forecast finish</TableHead>
              <TableHead className={th}>Status</TableHead>
              <TableHead className={th}>{showAction ? 'Action required' : 'Blocker'}</TableHead>
              {rowAction && <TableHead className={th}>{rowActionLabel}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="field-mono whitespace-nowrap text-xs">
                  <Link to={`/tasks/${row.id}`} className="font-medium hover:underline">{row.ref}</Link>
                  <div className="mt-1"><ActivityFlags row={row} /></div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {row.villa}
                  <div className="text-xs text-muted-foreground">{row.phase}</div>
                </TableCell>
                <TableCell className="max-w-[260px] text-sm">{row.name}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.discipline_name}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.contractor || '—'}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.engineer || '—'}</TableCell>
                <TableCell className="field-mono whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.baseline_finish)}</TableCell>
                <TableCell className="field-mono whitespace-nowrap text-xs">{formatDate(row.forecast_finish)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Pill value={row.status} />
                  {row.health && <div className="mt-1"><HealthBadge health={row.health} slipDays={row.slip_days} /></div>}
                </TableCell>
                <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                  {showAction ? row.action : row.blocker || '—'}
                </TableCell>
                {rowAction && <TableCell className="whitespace-nowrap">{rowAction(row)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <ActivityCard key={row.id} row={row} showAction={showAction} rowAction={rowAction} />
        ))}
      </div>
    </>
  );
}