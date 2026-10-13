import { todayIst } from '@/lib/format';
import React, { useState } from 'react';
import { Database, Download, FileJson, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { EXPORT_ENTITIES, NOT_EXPORTED_YET, RELATIONSHIPS } from '@/lib/exportSchema';
import { Button } from '@/components/ui/button';

const PAGE = 500;

const csvValue = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows, fields) => {
  const columns = fields && fields.length ? fields : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [columns.join(',')];
  rows.forEach((row) => lines.push(columns.map((column) => csvValue(row[column])).join(',')));
  return lines.join('\n');
};

const download = (filename, text, type) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const stamp = () => todayIst();

/** Full, ID-preserving exports of every business entity, for the future migration. */
export default function ExportPanel() {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({});

  const fetchAll = async (entity) => {
    const rows = [];
    let cursor = null;
    for (let page = 0; page < 400; page += 1) {
      const res = await base44.functions.invoke('dataExport', {
        entity,
        limit: PAGE,
        ...(cursor ? { cursor } : {}),
      });
      const data = res?.data || {};
      if (!Array.isArray(data.rows)) throw new Error(data.error || `Could not export ${entity}.`);
      rows.push(...data.rows);
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }
    return rows;
  };

  const runBundle = async () => {
    setBusy('bundle');
    setError('');
    setMessage('');
    try {
      const bundle = {};
      const found = {};
      for (const item of EXPORT_ENTITIES) {
        setMessage(`Collecting ${item.label}…`);
        const rows = await fetchAll(item.name);
        bundle[item.name] = rows;
        found[item.name] = rows.length;
      }
      setCounts(found);
      const payload = {
        _meta: {
          app: 'DVG Project Control',
          exported_at: new Date().toISOString(),
          generator: 'Administration → Export',
          source: 'Base44 entities (pre-migration snapshot)',
          notes: [
            'Internal ids, created/updated timestamps and every relationship id are preserved.',
            'No passwords, tokens or sessions are included; profiles only.',
            ...NOT_EXPORTED_YET,
          ],
          relationships: RELATIONSHIPS,
          row_counts: found,
        },
        entities: bundle,
      };
      download(`dvg-project-control-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
      setMessage('Complete JSON bundle downloaded.');
    } catch (e) {
      setError(e?.message || 'The export failed.');
      setMessage('');
    } finally {
      setBusy('');
    }
  };

  const runCsv = async (item) => {
    setBusy(item.name);
    setError('');
    setMessage('');
    try {
      const rows = await fetchAll(item.name);
      setCounts((c) => ({ ...c, [item.name]: rows.length }));
      download(
        `${item.name.toLowerCase()}-${stamp()}.csv`,
        toCsv(rows, item.fields),
        'text/csv;charset=utf-8',
      );
      setMessage(`${item.label} exported — ${rows.length} row(s).`);
    } catch (e) {
      setError(e?.message || `Could not export ${item.label}.`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <Database className="h-4 w-4 text-muted-foreground" /> Migration export
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              A complete copy of every business entity with its internal ids, timestamps and relationships, so the
              Imagine records can be loaded into another database without remapping names. One JSON bundle holds
              everything; each entity can also be downloaded on its own as CSV.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" disabled={!!busy} onClick={runBundle}>
              <FileJson className="h-4 w-4" />
              {busy === 'bundle' ? 'Exporting…' : 'Download JSON bundle'}
            </Button>
          </div>
        </div>

        {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Entity</th>
              <th className="px-4 py-2.5 font-medium">Note</th>
              <th className="px-4 py-2.5 text-right font-medium">Rows</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {EXPORT_ENTITIES.map((item) => (
              <tr key={item.name}>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{item.label}</span>
                  <span className="field-mono ml-2 text-[11px] text-muted-foreground">{item.name}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.note || ''}</td>
                <td className="field-mono px-4 py-2.5 text-right text-xs">
                  {counts[item.name] === undefined ? '—' : counts[item.name]}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={!!busy}
                    onClick={() => runCsv(item)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {busy === item.name ? '…' : 'CSV'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5" /> Not included in any export
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Passwords, access tokens, sessions and verification codes — they are held by the platform, never in app data.</li>
          {NOT_EXPORTED_YET.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}