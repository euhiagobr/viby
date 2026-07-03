
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { MenuManagement } from '@/components/organizer/MenuManagement';
import { Loader2, UtensilsCrossed, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { hasFoodCategory } from '@/lib/organization-utils';

export default function OrgMenuPage() {
  const { currentOrg, loading, userRole } = useCurrentOrganization();

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  if (!currentOrg) return null;

  const isFood = hasFoodCategory(currentOrg.type || "");
  const canEdit = ['owner', 'admin', 'editor'].includes(userRole || "");

  if (!isFood) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-6 animate-in fade-in">
        <div className="p-6 bg-muted/20 rounded-full border-2 border-dashed">
          <UtensilsCrossed className="w-12 h-12 text-muted-foreground opacity-30" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Funcionalidade Restrita</h2>
          <p className="text-muted-foreground font-medium max-w-sm mx-auto uppercase text-[10px] tracking-widest">
            O Cardápio Nativo está disponível apenas para empresas dos segmentos de Gastronomia, Restaurantes, Bares e similares.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl h-12 px-8 font-black uppercase italic">
          <Link href={`/dashboard/organizacoes/${currentOrg.username}/settings`}>Alterar Segmento</Link>
        </Button>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-6">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-20" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para editar o cardápio desta marca.</p>
      </div>
    );
  }

  return <MenuManagement orgId={currentOrg.id} />;
}
