import { data } from '@/api/data';
import DataState from '@/components/common/DataState';
import TruncationBanner from '@/components/common/TruncationBanner';
import { errorMessageOf } from '@/lib/clientErrors';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import DetailList from '@/components/common/DetailList';
import EmptyState from '@/components/common/EmptyState';
import TaskTable from '@/components/tasks/TaskTable';
import TaskCard from '@/components/tasks/TaskCard';
import ContractorDialog from '@/components/contractors/ContractorDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList } from 'lucide-react';
import ContactChip from '@/components/common/ContactChip';

export default function ContractorDetail() {
  const { contractorId } = useParams();
  const cat = useCatalogs();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const contractor = cat.contractorById(contractorId);

  const load = useCallback(async () => {
    if (!contractorId) return;
    setLoading(true);
    setLoadError('');
    // Closed work is finished, so it is neither listed nor counted as active.
    const query = { contractor_id: contractorId, archived: { $ne: true }, status: { $ne: 'Closed' } };
    try {
      const [page, count] = await Promise.all([
        base44.entities.Task.filter(query, { sort: '-created_date', limit: 100 }),
        base44.entities.Task.count(query),
      ]);
      setTasks(items(page));
      setTotal(count || 0);
    } catch (e) {
      setLoadError(errorMessageOf(e, 'This contractor\'s tasks could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  const loadAll = async () => {
    setLoadingAll(true);
    try {
      const all = await data.readAll('Task', { contractor_id: contractorId, archived: { $ne: true }, status: { $ne: 'Closed' } }, { sort: '-created_date', max: 5000 });
      setTasks(all.items);
      setTotal(all.items.length);
    } catch (e) {
      setLoadError(errorMessageOf(e, 'The full list could not be loaded.'));
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!contractor) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Contractor not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/contractors">Back to contractors</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
        <Link to="/contractors">
          <ArrowLeft className="h-4 w-4" /> Contractors
        </Link>
      </Button>

      <PageHeader
        eyebrow={contractor.classification}
        title={contractor.name}
        description={contractor.notes || undefined}
        actions={
          <>
            <Pill value={contractor.active === false ? 'Archived' : 'Active'} />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" className="gap-2" onClick={() => navigate(`/tasks/new?contractor=${contractor.id}`)}>
              <Plus className="h-3.5 w-3.5" /> New task
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <DetailList
          columns={3}
          items={[
            { label: 'Trade / responsibility', value: contractor.trade },
            { label: 'Contact person', value: contractor.contact_person },
            { label: 'Phone', value: contractor.phone ? <ContactChip name={contractor.contact_person || contractor.name} phone={contractor.phone} /> : '' },
            { label: 'Email', value: contractor.email },
            { label: 'Active tasks', value: total, mono: true },
          ]}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tasks assigned to {contractor.name}
        </h2>

        {loadError ? (
          <DataState error={loadError} onRetry={load} />
        ) : loading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={ClipboardList}
              title="No tasks assigned yet"
              description="Assign this contractor from a task, or add the default rule under Administration."
            />
          </div>
        ) : (
          <>
            <TruncationBanner shown={tasks.length} total={total} noun="active tasks" onLoadAll={loadAll} loading={loadingAll} to={`/tasks?contractor=${contractor.id}`} className="mb-3" />
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <TaskTable tasks={tasks} cat={cat} onOpen={(t) => navigate(`/tasks/${t.id}`)} />
            </div>
            <div className="space-y-3 md:hidden">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} cat={cat} onOpen={() => navigate(`/tasks/${t.id}`)} />
              ))}
            </div>
          </>
        )}
      </section>

      <ContractorDialog open={editOpen} onOpenChange={setEditOpen} contractor={contractor} cat={cat} />
    </>
  );
}