import React from 'react';
import { useCatalogs } from '@/lib/CatalogContext';
import PageHeader from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import DisciplineTab from '@/components/admin/DisciplineTab';
import WorkPackageTab from '@/components/admin/WorkPackageTab';
import ContractorDefaultTab from '@/components/admin/ContractorDefaultTab';
import ExportPanel from '@/components/admin/ExportPanel';
import AiSettingsTab from '@/components/admin/AiSettingsTab';
import DataTab from '@/components/admin/DataTab';
import FloorsRoomsImportTab from '@/components/admin/FloorsRoomsImportTab';
import { useAccess } from '@/lib/AccessContext';

export default function Admin() {
  const cat = useCatalogs();
  const access = useAccess();

  if (!access.loading && !access.appAdmin) {
    return (
      <>
        <PageHeader
          eyebrow="Administration"
          title="Configuration"
          description="Disciplines, work packages and default contractor assignments."
        />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          These lists are company-wide configuration and can only be changed by an application administrator. Your
          project roles are shown on Users &amp; Access.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Configuration"
        description="Disciplines, work packages and default contractor assignments. Management can add any of these without a code change."
      />

      {cat.loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <Tabs defaultValue="work-packages">
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="disciplines">Disciplines</TabsTrigger>
            <TabsTrigger value="work-packages">Work packages</TabsTrigger>
            <TabsTrigger value="defaults">Contractor defaults</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="ai">AI assistant</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="floors-rooms">Floors &amp; rooms import</TabsTrigger>
          </TabsList>

          <TabsContent value="disciplines" className="mt-5">
            <DisciplineTab cat={cat} />
          </TabsContent>
          <TabsContent value="work-packages" className="mt-5">
            <WorkPackageTab cat={cat} />
          </TabsContent>
          <TabsContent value="defaults" className="mt-5">
            <ContractorDefaultTab cat={cat} />
          </TabsContent>
          <TabsContent value="export" className="mt-5">
            <ExportPanel />
          </TabsContent>
          <TabsContent value="ai" className="mt-5">
            <AiSettingsTab />
          </TabsContent>
          <TabsContent value="data" className="mt-5">
            <DataTab />
          </TabsContent>
          <TabsContent value="floors-rooms" className="mt-5">
            <FloorsRoomsImportTab />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}