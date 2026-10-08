import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, HardHat, Phone, Mail, User } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import ContractorDialog from '@/components/contractors/ContractorDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Contractors() {
  const cat = useCatalogs();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const internal = cat.contractors.filter((c) => c.classification === 'Internal Execution Team');
  const external = cat.contractors.filter((c) => c.classification !== 'Internal Execution Team');

  const group = (title, list, description) => (
    <section className="mt-8 first:mt-0">
      <div className="mb-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <article key={c.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold">{c.name}</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.trade || 'Trade not set'}</p>
              </div>
              <Pill value={c.active === false ? 'Archived' : c.classification} />
            </div>

            <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              {c.contact_person && (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> {c.contact_person}
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {c.phone}
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> <span className="truncate">{c.email}</span>
                </div>
              )}
              {!c.contact_person && !c.phone && !c.email && <p>No contact details recorded.</p>}
            </dl>

            <div className="mt-4 flex items-center gap-2 pt-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/contractors/${c.id}`}>View tasks</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(c);
                  setOpen(true);
                }}
              >
                Edit
              </Button>
            </div>
          </article>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">No records in this group yet.</p>
        )}
      </div>
    </section>
  );

  return (
    <>
      <PageHeader
        eyebrow="Execution teams"
        title="Contractors"
        description="Internal execution teams and external contractors, with the trade each one carries."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New contractor
          </Button>
        }
      />

      {cat.loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : cat.contractors.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
          <HardHat className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-display font-semibold">No contractors yet</p>
        </div>
      ) : (
        <>
          {group('Internal execution teams', internal, 'Directly managed by DVG.')}
          {group('External contractors', external, 'Engaged specialists working across phases.')}
        </>
      )}

      <ContractorDialog open={open} onOpenChange={setOpen} contractor={editing} cat={cat} />
    </>
  );
}