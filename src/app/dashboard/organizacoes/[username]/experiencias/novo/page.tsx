
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { useCurrentOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Sparkles, 
  Save, 
  Loader2, 
  Info,
  ShieldCheck,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { getOrCreateExperienceDraftAction, publishExperienceAction, saveExperienceAction } from '@/app/actions/experiences';
import { slugify } from '@/lib/slug-utils';

export default function NovaExperienciaPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();
  const db = useFirestore();

  const [loading, setLoading] = React.useState(true);
  const [publishing, setPublishing] = React.useState(false);
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    title: "",
    slug: "",
    shortDescription: "",
    description: "",
    status: "draft"
  });

  React.useEffect(() => {
    if (!user || !currentOrg) return;

    const init = async () => {
      const res = await getOrCreateExperienceDraftAction(user.uid, currentOrg.id);
      if (res.success) {
        setDraftId(res.id);
        setFormData({
          title: res.title || "",
          slug: res.slug || "",
          shortDescription: res.shortDescription || "",
          description: res.description || "",
          status: res.status || "draft"
        });
      }
      setLoading(false);
    };

    init();
  }, [user, currentOrg]);

  // Auto-save
  React.useEffect(() => {
    if (!draftId || loading || publishing) return;
    const timer = setTimeout(() => {
      saveExperienceAction(draftId, formData);
    }, 2000);
    return () => clearTimeout(timer);
  }, [formData, draftId, loading, publishing]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftId || !currentOrg || publishing) return;

    setPublishing(true);
    try {
      const res = await publishExperienceAction(draftId, {
        ...formData,
        organizationId: currentOrg.id,
      });

      if (res.success) {
        toast({ title: "Experiência Publicada!" });
        router.push(`/dashboard/organizacoes/${currentOrg.username}/experiencias`);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na publicação", description: e.message });
      setPublishing(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Nova Experiência</h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Defina a base da sua vivência cultural</p>
        </div>
      </div>

      <form onSubmit={handlePublish} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="bg-muted/30 p-8 border-b">
             <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" /> Informações Básicas
             </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Título da Experiência</Label>
              <Input 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value, slug: slugify(e.target.value)})}
                placeholder="Ex: Workshop de Fotografia Urbana"
                required
                className="h-14 text-lg font-bold rounded-xl border-dashed border-secondary/30"
              />
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Slug da URL</Label>
               <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-30">/experiencia/</div>
                  <Input 
                    value={formData.slug}
                    onChange={e => setFormData({...formData, slug: slugify(e.target.value)})}
                    className="pl-24 h-11 rounded-xl bg-muted/30 font-mono text-xs"
                    required
                  />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Curta (Vitrine)</Label>
              <Input 
                value={formData.shortDescription}
                onChange={e => setFormData({...formData, shortDescription: e.target.value})}
                placeholder="Um resumo de 1 frase para atrair o público."
                maxLength={120}
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Completa</Label>
              <Textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Detalhe tudo o que o participante irá vivenciar..."
                className="min-h-[200px] rounded-xl resize-none leading-relaxed"
              />
            </div>
            
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Status Inicial</Label>
               <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                     <SelectItem value="draft">Rascunho (Privado)</SelectItem>
                     <SelectItem value="active">Ativa (Público)</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </CardContent>
        </Card>

        <div className="p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/20 flex items-start gap-4">
           <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
           <div className="space-y-1">
              <h4 className="font-black uppercase text-xs italic text-primary">Próximos Passos</h4>
              <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">Nesta etapa você define apenas o conteúdo. Nas próximas etapas você poderá configurar a agenda, preços e disponibilidade física.</p>
           </div>
        </div>

        <Button 
          type="submit" 
          disabled={publishing || !formData.title} 
          className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg"
        >
          {publishing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Check className="w-6 h-6 mr-2" />}
          Finalizar Etapa 1
        </Button>
      </form>
    </div>
  );
}
