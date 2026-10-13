import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { data } from '@/api/data';
import { updateSnag } from '@/lib/snagService';
import { useQuickActions } from '@/components/layout/QuickActions';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import DataState from '@/components/common/DataState';
import SnagList from '@/components/handover/SnagList';
import InspectionResults from '@/components/inspection/InspectionResults';

/** The snags of one location, with the raise-a-snag button (L-02). */
export default function SnagsTab({ location, canEdit }) {
  const quick = useQuickActions();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [checklistKey, setChecklistKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: '' });
  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const res = await data.readAll('Snag', { location_id: location.id }, { sort: '-created_date', max: 1000 });
      setRows(res.items);
      setState({ loading: false, error: '' });
    } catch (e) {
      setState({ loading: false, error: e?.message || 'The snags could not be loaded.' });
    }
  }, [location.id]);
  useEffect(() => { load(); }, [load, quick.version]);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Tracked separately from tasks. Photographs are optional.</p>
        {canEdit && <Button size="sm" className="gap-2" onClick={() => quick.openSnag({ locationId: location.id })}><Plus className="h-4 w-4" /> Raise a snag</Button>}
      </div>
      <DataState loading={state.loading} error={state.error} onRetry={load}>
        <SnagList
          rows={rows}
          onChecklist={() => setChecklistKey((n) => n + 1)}
          canEdit={canEdit}
          emptyLabel="No snag recorded against this location."
          onAdvance={async (row, patch) => {
            try { await updateSnag(row.id, patch); load(); } catch (e) { toast({ description: e?.message || 'Could not update the snag.', variant: 'destructive' }); }
          }}
        />
      </DataState>
      <div className="mt-4"><InspectionResults filter={{ location_id: location.id, subject_type: 'Snag' }} refreshKey={checklistKey} title="Snag inspection checklists" /></div>
    </section>
  );
}
