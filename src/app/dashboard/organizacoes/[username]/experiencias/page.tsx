
'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc, deleteField } from 'firebase/firestore';
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
  ArrowRight,
  TicketPercent,
  Users,
  History,
  Archive,
  FileText,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { deleteExperienceAction, duplicateExperienceAction } from '@/app/actions/experiences';
import { ExperienceRevenueSimulator } from '@/components/finance/ExperienceRevenueSimulator';

export default function OrganizationExperiencesPage() {
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const [search, setSearch] = React.useState("");
  const [isProcessingId, setIsProcessingId] = React.useState<string | null>(null);
  const [expToDelete, setExpToDelete] = React.useState<{id: string, title: string} | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = React.useState(false);

  const experiencesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'experiences'), 
      where('organizationId', '==', currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawExp, loading } = useCollection<any>(experiencesQuery);

  const { activeExp, draftExp, deletedExp } = React.useMemo(() => {
    const active: any[] = [];
    const drafts: any[] = [];
    const deleted: any[] = [];

    if (!rawExp) return { activeExp: [], draftExp: [], deletedExp: [] };

    const filtered = rawExp.filter(e => 
      !search || e.title?.toLowerCase().includes(search.toLowerCase())
    );

    filtered.forEach(e => {
      if (e.status === 'deleted' || e.status === 'Excluído') {
        deleted.push(e);
      } else if (e.status === 'draft' || e.status === 'Rascunho') {
        drafts.push(e);
      } else {
        active.push(e);
      }
    });

    const sortByDate = (a: any, b: any) => {
       const tA = a.createdAt?.seconds || 0;
       const tB = b.createdAt?.seconds || 0;
       return tB - tA;
    };

    return {
      activeExp: active.sort(sortByDate),
      draftExp: drafts.sort(sortByDate),
      deletedExp: deleted.sort(sortByDate)
    };
  }, [rawExp, search]);

  const handleDelete = async () => {
    if (!expToDelete) return;
    setIsProcessingId(expToDelete.id);
    try {
      const res = await deleteExperienceAction(expToDelete.id);
      if (res.success) {
        toast({ 
          title: res.mode === 'soft' ? "Experiência Ocultada" : "Experiência Removida", 
          description: res.mode === 'soft' 
            ? "Vendas detectadas. O projeto foi movido para a aba de deletados para preservar os vouchers."
            : "A experiência e todos os seus horários foram apagados permanentemente."
        });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na exclusão", description: e.message });
    } finally {
      setIsProcessingId(null);
      setExpToDelete(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    setIsProcessingId(id);
    try {
      const res = await duplicateExperienceAction(id, user.uid);
      if (res.success) toast({ title: "Experiência duplicada!", description: "A cópia foi salva como rascunho." });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao duplicar", description: e.message });
    } finally {
      setIsProcessingId(null);
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
          <p className="text-muted-foreground font-medium">Gerencie vivências exclusivas de <strong>{currentOrg?.name}</strong>.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsSimulatorOpen(true)}
            className="rounded-full h-12 px-6 font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary hover:bg-secondary/5"
          >
            <Info className="w-4 h-4" /> Entenda suas taxas
          </Button>

          {isAtLeastEditor && (
            <Button asChild className="bg-secondary text-white font-black rounded-full px-8 h-12 shadow-lg hover:scale-105 transition-transform gap-2 uppercase italic">
              <Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias/novo`}>
                <Plus className="w-5 h-5" />
                Nova Experiência
              </Link>
            </Button>
          )}
        </div>
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

      <Tabs defaultValue="active" className="w-full space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12 flex-wrap">
           <TabsTrigger value="active" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Ativas ({activeExp.length})
           </TabsTrigger>
           <TabsTrigger value="drafts" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
              <FileText className="w-4 h-4 text-orange-500" /> Rascunhos ({draftExp.length})
           </TabsTrigger>
           <TabsTrigger value="deleted" className="rounded-lg px-6 font-bold gap-2 data-[state=active]:bg-white">
              <Trash2 className="w-4 h-4 text-muted-foreground" /> Deletadas ({deletedExp.length})
           </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="m-0">
           <ExperienceGrid 
             experiences={activeExp} 
             loading={loading} 
             isAtLeastEditor={isAtLeastEditor}
             currentOrg={currentOrg}
             onDuplicate={handleDuplicate}
             onDelete={(exp) => setExpToDelete(exp)}
             processingId={isProcessingId}
           />
        </TabsContent>

        <TabsContent value="drafts" className="m-0">
           <ExperienceGrid 
             experiences={draftExp} 
             loading={loading} 
             isAtLeastEditor={isAtLeastEditor}
             currentOrg={currentOrg}
             onDuplicate={handleDuplicate}
             onDelete={(exp) => setExpToDelete(exp)}
             processingId={isProcessingId}
           />
        </TabsContent>

        <TabsContent value="deleted" className="m-0">
           <ExperienceGrid 
             experiences={deletedExp} 
             loading={loading} 
             isAtLeastEditor={false}
             currentOrg={currentOrg}
             onDuplicate={() => {}}
             onDelete={() => {}}
             processingId={null}
             isTrash
           />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!expToDelete} onOpenChange={(v) => !v && setExpToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-destructive/10 rounded-lg text-destructive"><Trash2 className="w-6 h-6" /></div>
               <AlertDialogTitle className="text-xl font-black italic uppercase italic tracking-tighter">Remover Experiência?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium text-foreground/80 leading-relaxed">
              Você está removendo <strong>{expToDelete?.title}</strong>. Se houverem ingressos já vendidos, ela será apenas ocultada. Caso contrário, será apagada permanentemente junto com todos os horários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-none bg-muted">Desistir</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={!!isProcessingId}
              className="bg-destructive text-white rounded-xl font-black uppercase text-[10px] px-8"
            >
              {isProcessingId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Remoção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExperienceRevenueSimulator 
        isOpen={isSimulatorOpen} 
        onOpenChange={setIsSimulatorOpen} 
        organization={currentOrg} 
      />
    </div>
  );
}

function ExperienceGrid({ experiences, loading, isAtLeastEditor, currentOrg, onDuplicate, onDelete, processingId, isTrash }: any) {
  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;

  if (experiences.length === 0) {
    return (
      <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 opacity-40 italic">
        <Inbox className="w-12 h-12" />
        <p className="text-xs font-black uppercase tracking-widest">{isTrash ? "Lixeira Vazia" : "Nenhuma vivência localizada nesta aba"}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {experiences.map((exp: any) => (
        <Card key={exp.id} className={cn(
          "overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[2rem] bg-white group h-full flex flex-col relative",
          isTrash && "opacity-60 grayscale"
        )}>
          <CardHeader className="bg-muted/30 p-8 border-b">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-secondary/10 rounded-2xl text-secondary"><Sparkles className="w-5 h-5" /></div>
               <Badge className={cn(
                 "uppercase text-[9px] font-black px-3 h-5",
                 exp.status === 'active' ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
               )}>
                 {exp.status === 'active' ? 'Ativa' : exp.status === 'deleted' ? 'Deletada' : 'Rascunho'}
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
                {!isTrash && (
                  <>
                    <Button asChild variant="outline" className="flex-1 rounded-xl h-10 font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary">
                       <Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias/${exp.id}/editar`}><Edit className="w-3.5 h-3.5" /> Editar</Link>
                    </Button>
                    <Button asChild variant="secondary" className="flex-1 rounded-xl h-10 font-black uppercase italic text-[10px] gap-2 shadow-sm">
                       <Link href={`/dashboard/experiencia/${exp.id}/publico`}><Users className="w-3.5 h-3.5" /> Compradores</Link>
                    </Button>
                  </>
                )}
                {isTrash && (
                  <Button variant="ghost" asChild className="w-full h-10 rounded-xl font-black uppercase text-[10px] border border-dashed">
                     <Link href={`/dashboard/experiencia/${exp.id}/publico`}>Ver Compradores Antigos</Link>
                  </Button>
                )}
                {!isTrash && (
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
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/experiencia/${exp.id}/cupons`} className="flex items-center gap-2 py-2 cursor-pointer">
                              <TicketPercent className="w-4 h-4 text-secondary" /> Cupons
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(exp.id)} className="flex items-center gap-2 py-2 cursor-pointer">
                          <Copy className="w-4 h-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onDelete(exp)}
                          className="flex items-center gap-2 text-destructive focus:text-destructive py-2 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Remover
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
             </div>
          </CardContent>
          {processingId === exp.id && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-40">
               <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
