
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { ExperienceForm } from '@/components/experiences/ExperienceForm';
import { saveExperienceAction } from '@/app/actions/experiences';
import { Loader2 } from 'lucide-react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';

export default function EditarExperienciaPage() {
  const params = useParams();
  const router = useRouter();
  const expId = params.id as string;
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();

  const expRef = React.useMemo(() => (db && expId) ? doc(db, "experiences", expId) : null, [db, expId]);
  const { data: experience, loading } = useDoc<any>(expRef);

  const categoriesQuery = useMemoFirebase(() => 
    db ? query(collection(db, "categories"), where("type", "==", "experience")) : null, 
    [db]
  );
  const { data: categories } = useCollection<any>(categoriesQuery);

  const handleSave = async (data: any) => {
    if (!expId) return;
    await saveExperienceAction(expId, data);
  };

  if (loading || !experience) {
    return <div className="py-40 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  return (
    <ExperienceForm 
      initialData={experience} 
      onSave={handleSave} 
      isEditing 
      categories={categories || []} 
    />
  );
}
