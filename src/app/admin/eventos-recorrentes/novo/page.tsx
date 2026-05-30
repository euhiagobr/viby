'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useAuth, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { RecurringEventForm } from '@/components/recurring-events/RecurringEventForm';
import { generateOccurrences } from '@/services/recurring-event-service';
import { toast } from '@/hooks/use-toast';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';

export default function NewRecurringEventPage() {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();
  
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (formData: any) => {
    if (!db || !user || !currentOrg) {
      toast({ variant: "destructive", title: "Erro", description: "Organização não selecionada." });
      return;
    }

    setLoading(true);
    try {
      const parentData = {
        ...formData,
        organizationId: currentOrg.id,
        organizerName: currentOrg.name,
        organizerId: user.uid,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'recurring_events'), parentData);
      const count = await generateOccurrences(db, docRef.id, parentData);

      toast({ title: "Série Criada!", description: `${count} ocorrências foram geradas na agenda.` });
      router.push(`/admin/eventos-recorrentes/${docRef.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao criar série", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/admin/eventos-recorrentes"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-secondary" /> Criar Série Recorrente
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Nova programação periódica</p>
        </div>
      </div>

      <RecurringEventForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
