
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
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
  Check,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { saveExperienceAction, publishExperienceAction } from '@/app/actions/experiences';
import { slugify } from '@/lib/slug-utils';

export default function EditarExperienciaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const { currentOrg } = useCurrentOrganization();

  const expRef = React.useMemo(() => (db && id) ? doc(db, "experiences", id) : null, [db, id]);
  const { data: exp, loading: expLoading } = useDoc<any>(expRef);

  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(null);

  React.useEffect(() => {
    if (exp) {
      setFormData({
        title: exp.title || "",
        slug: exp.slug || "",
        shortDescription: exp.shortDescription || "",
        description: exp.description || "",
        status: exp.status || "draft"
      });
    }
  }, [exp]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || saving) return;

    setSaving(true);
    try {
      const res = await saveExperienceAction(id, formData);
      if (res.success) {
        toast({ title: "Alterações salvas!" });
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (expLoading || !formData) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">Editar Experiência</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gestão de conteúdo básico</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="bg-muted/30 p-8 border-b">
             <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-2">
                <Zap className="w-5 h-5 text-secondary" /> Conteúdo da Experiência
             </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Título</Label>
              <Input 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value, slug: slugify(e.target.value)})}
                required
                className="h-12 rounded-xl font-bold"
              />
            </div>

            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Slug da URL</Label>
               <div className="relative">
                  <Input 
                    value={formData.slug}
                    onChange={e => setFormData({...formData, slug: slugify(e.target.value)})}
                    className="h-11 rounded-xl bg-muted/30 font-mono text-xs"
                    required
                  />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Curta</Label>
              <Input 
                value={formData.shortDescription}
                onChange={e => setFormData({...formData, shortDescription: e.target.value})}
                maxLength={120}
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Descrição Completa</Label>
              <Textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="min-h-[200px] rounded-xl resize-none leading-relaxed"
              />
            </div>
            
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Status</Label>
               <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                     <SelectItem value="draft">Rascunho</SelectItem>
                     <SelectItem value="active">Ativa (Público)</SelectItem>
                     <SelectItem value="paused">Pausada</SelectItem>
                     <SelectItem value="closed">Encerrada</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
           <Button variant="ghost" asChild className="h-14 px-8 rounded-xl font-bold uppercase text-xs">
              <Link href={`/dashboard/organizacoes/${currentOrg?.username}/experiencias`}>Cancelar</Link>
           </Button>
           <Button 
            type="submit" 
            disabled={saving} 
            className="flex-1 h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic"
           >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  );
}
