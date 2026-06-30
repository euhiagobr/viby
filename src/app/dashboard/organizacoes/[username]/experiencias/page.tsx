
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Loader2, 
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  Inbox,
  ArrowRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { deleteExperienceAction, duplicateExperienceAction } from '@/app/actions/experiences';

export default function OrganizationExperiencesPage() {
  const { currentOrg, userRole } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [search, setSearch] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState<string | null>(null);

  const experiencesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'experiences'), 
      where('organizationId', '==', currentOrg.id),
      orderBy('createdAt', 'desc')
    );
  }, [db, currentOrg?.id]);

  const { data: experiences, loading } = useCollection<any>(experiencesQuery);

  const filtered = React.useMemo(() => {
    if (!experiences) return [];
    return experiences.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()));
  }, [experiences, search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja remover esta experiência permanentemente?")) return;
    setIsProcessing(id);
    try {
      const res = await deleteExperienceAction(id);
      if (res.success) toast({ title: "Experiência removida." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    setIsProcessing(id);
    try {
      const res = await duplicateExperienceAction(id, user.uid);
      if (res.success) toast({ title: "Experiência duplicada!", description: "A cópia foi salva como rascunho." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao duplicar", description: e.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const isAtLeastEditor = ['owner', 'admin', 'editor'].includes(userRole || '');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-secondary" />
            Experiências
          </h1>
          <p className="text-muted-foreground font-medium">Crie vivências únicas para seu público.</p>
        </div>
        
        {isAtLeastEditor && (
          <Button asChild className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
            <Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias/novo`}>
              <Plus className="w-5 h-5" />
              Nova Experiência
            </Link>
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar experiências..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((exp) => (
            <Card key={exp.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[2rem] bg-white group h-full flex flex-col">
              <CardHeader className="bg-muted/30 p-8 border-b">
                <div className="flex justify-between items-start">
                   <div className="p-3 bg-secondary/10 rounded-2xl text-secondary"><Sparkles className="w-5 h-5" /></div>
                   <Badge className={cn(
                     "uppercase text-[9px] font-black px-3 h-5",
                     exp.status === 'active' ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                   )}>
                     {exp.status === 'active' ? 'Ativa' : exp.status}
                   </Badge>
                </div>
                <div className="mt-4">
                  <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary line-clamp-1">{exp.title || "Sem título"}</CardTitle>
                  <CardDescription className="text-xs font-bold text-secondary uppercase tracking-widest mt-1">/experiencia/{exp.slug || "..."}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-8 flex-1 flex flex-col justify-between gap-6">
                 <p className="text-xs text-muted-foreground line-clamp-3 min-h-[48px] font-medium leading-relaxed">
                    {exp.shortDescription || "Nenhuma descrição curta definida."}
                 </p>
                 <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1 rounded-xl h-10 font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary">
                       <Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias/${exp.id}/editar`}><Edit className="w-3.5 h-3.5" /> Editar</Link>
                    </Button>
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-muted/50"><MoreHorizontal className="w-4 h-4" /></Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="rounded-xl w-48">
                          <DropdownMenuItem asChild>
                             <Link href={`/${currentOrg?.username}/experiencia/${exp.slug}`} target="_blank" className="flex items-center gap-2 py-2 cursor-pointer">
                                <Eye className="w-4 h-4" /> Ver Pública
                             </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(exp.id)} className="flex items-center gap-2 py-2 cursor-pointer">
                             <Copy className="w-4 h-4" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(exp.id)}
                            className="flex items-center gap-2 text-destructive focus:text-destructive py-2 cursor-pointer"
                          >
                             <Trash2 className="w-4 h-4" /> Excluir
                          </DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 shadow-inner">
           <Inbox className="w-12 h-12 text-muted-foreground opacity-10" />
           <p className="text-muted-foreground font-bold italic">Nenhuma experiência cadastrada para esta marca.</p>
           {isAtLeastEditor && (
             <Button asChild variant="outline" className="rounded-full font-bold h-10 border-secondary text-secondary">
               <Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias/novo`}>Criar minha primeira Experiência</Link>
             </Button>
           )}
        </div>
      )}
    </div>
  );
}
