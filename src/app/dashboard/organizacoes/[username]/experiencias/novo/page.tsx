
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { ExperienceForm } from '@/components/experiences/ExperienceForm';
import { getOrCreateExperienceDraftAction, saveExperienceAction, publishExperienceAction } from '@/app/actions/experiences';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';

export default function NovaExperienciaPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();
  const db = useFirestore();

  const [loading, setLoading] = React.useState(true);
  const [draftData, setDraftData] = React.useState<any>(null);

  const categoriesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "categories"), where("type", "==", "experience")) : null, 
    [db]
  );
  const { data: categories } = useCollection<any>(categoriesQuery);

  React.useEffect(() => {
    if (!user || !currentOrg) return;
    getOrCreateExperienceDraftAction(user.uid, currentOrg.id).then(res => {
      if (res.success) setDraftData(res.data);
      setLoading(false);
    });
  }, [user, currentOrg]);

  const handleSave = async (data: any) => {
    if (!draftData?.id) return;
    await saveExperienceAction(draftData.id, data);
  };

  const handlePublish = async (data: any) => {
    if (!draftData?.id || !currentOrg) return;
    const res = await publishExperienceAction(draftData.id, { ...data, organizationId: currentOrg.id });
    if (res.success) {
      router.push(`/dashboard/organizacoes/${currentOrg.username}/experiencias`);
    }
  };

  if (loading || !draftData) {
    return <div className="py-40 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <ExperienceForm 
      initialData={draftData} 
      onSave={handleSave} 
      onPublish={handlePublish}
      categories={categories || []} 
    />
  );
}
