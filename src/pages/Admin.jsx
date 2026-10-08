import React from 'react';
import { useCatalogs } from '@/lib/CatalogContext';
import PageHeader from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import DisciplineTab from '@/components/admin/DisciplineTab';
import WorkPackageTab from '@/components/admin/WorkPackageTab';
import ContractorDefaultTab from '@/components/admin/ContractorDefaultTab';

export default function Admin() {
  const cat = useCatalogs();

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
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="disciplines">Disciplines</TabsTrigger>
            <TabsTrigger value="work-packages">Work packages</TabsTrigger>
            <TabsTrigger value="defaults">Contractor defaults</TabsTrigger>
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
        </Tabs>
      )}
    </>
  );
}