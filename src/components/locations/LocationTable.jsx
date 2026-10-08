import React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pill from '@/components/common/Pill';
import { formatDate } from '@/lib/format';

const th = 'whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

export default function LocationTable({ locations, cat }) {
  return (
    <>
      <div className="scroll-slim hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={th}>Villa / Location</TableHead>
              <TableHead className={th}>Phase</TableHead>
              <TableHead className={th}>Type</TableHead>
              <TableHead className={th}>Plot references</TableHead>
              <TableHead className={th}>Possession</TableHead>
              <TableHead className={th}>Works stage</TableHead>
              <TableHead className={th}>Active</TableHead>
              <TableHead className={th}>Engineer</TableHead>
              <TableHead className={th}>Planned completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((l) => (
              <TableRow key={l.id} className="transition-colors hover:bg-accent/50">
                <TableCell className="whitespace-nowrap p-0">
                  <Link to={`/locations/${l.id}`} className="field-mono block px-4 py-3 text-xs font-medium text-foreground">
                    {l.villa_code}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {cat.phaseById(l.phase_id)?.name || '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{l.location_type}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{l.plot_numbers || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Pill value={l.possession_status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Pill value={l.works_stage} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Pill value={l.active_status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {l.assigned_engineer || '—'}
                </TableCell>
                <TableCell className="field-mono whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(l.planned_completion_date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {locations.map((l) => (
          <Link
            key={l.id}
            to={`/locations/${l.id}`}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="field-mono text-xs font-medium text-foreground">{l.villa_code}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {cat.phaseById(l.phase_id)?.name || l.location_type}
                  {l.plot_numbers ? ` · ${l.plot_numbers}` : ''}
                </p>
              </div>
              <Pill value={l.active_status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill value={l.possession_status} />
              <Pill value={l.works_stage} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}