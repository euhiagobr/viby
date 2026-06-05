'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useFirebaseApp } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowDownCircle, 
  FileText, 
  Upload, 
  Calendar,
  FilterX,
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from "@/components/ui/progress";
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/financial-utils';
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'anuncios', label: 'Anúncios' },
  { value: 'servidores', label: 'Infraestrutura / Servidores' },
  { value: 'funcionarios', label: 'Pessoal / Salários' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'financeiro', label: 'Taxas Bancárias' },
  { value: 'ferramentas', label: 'SaaS / Ferramentas' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'reembolsos', label: 'Reembolsos / Estornos' },
  { value: 'operacional', label: 'Geral Operacional' },
  { value: 'outros', label: 'Outros' },
];

export default function AdminExpensesPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const app = useFirebaseApp();
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app]);

  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [proofUrl, setProofUrl] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);

  const expensesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "internal_expenses"), orderBy("date", "desc"));
  }, [db]);

  const { data: expenses, loading } = useCollection<any>(expensesQuery);

  const filteredExpenses = React.useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => 
      e.title?.toLowerCase().includes(search.toLowerCase()) || 
      e.category?.toLowerCase().includes(search.toLowerCase())
    );
  }, [expenses, search]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;
    setUploadProgress(0);
    try {
      const storageRef = ref(storage, `expenses/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', 
        (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setProofUrl(downloadURL);
          setUploadProgress(null);
          toast({ title: "Comprovante carregado!" });
        }
      );
    } catch (err) { setUploadProgress(null); }
  };

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !user) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const expenseData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      category: formData.get("category") as string,
      date: new Date(formData.get("date") as string),
      proofUrl,
      creatorId: user.uid,
      creatorName: user.displayName || "Admin",
      status: "pago",
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "internal_expenses"), expenseData);
      toast({ title: "Despesa lançada!" });
      setIsDialogOpen(false);
      setProofUrl("");
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("Remover este lançamento?")) return;
    try {
      await deleteDoc(doc(db, "internal_expenses", id));
      toast({ title: "Despesa removida" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <ArrowDownCircle className="w-8 h-8 text-red-500" /> Controle de Saídas
          </h1>
          <p className="text-muted-foreground font-medium">Gestão de despesas internas e custos operacionais.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black rounded-full px-8 h-12 shadow-lg gap-2 uppercase italic">
              <Plus className="w-5 h-5" /> Lançar Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem] overflow-hidden">
            <form onSubmit={handleCreateExpense} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Nova Despesa</DialogTitle>
                <DialogDescription>Registre uma saída financeira no caixa da Viby.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Título / Favorecido</Label>
                  <Input name="title" required placeholder="Ex: Pagamento AWS" className="rounded-xl h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Valor (BRL)</Label>
                      <Input name="amount" type="number" step="0.01" required className="rounded-xl h-11 font-black" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-60">Data</Label>
                      <Input name="date" type="date" required className="rounded-xl h-11 text-xs" />
                   </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Categoria</Label>
                  <Select name="category" required>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Comprovante</Label>
                  <div className={cn(
                    "relative h-24 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center cursor-pointer overflow-hidden",
                    proofUrl && "border-green-500 bg-green-50/50"
                  )} onClick={() => !proofUrl && document.getElementById('expense-proof-up')?.click()}>
                     {proofUrl ? (
                       <div className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase"><CheckCircle2 className="w-5 h-5" /> Arquivo OK</div>
                     ) : (
                       <div className="text-center opacity-40"><Upload className="w-6 h-6 mx-auto mb-1" /><p className="text-[8px] font-black uppercase">Fazer Upload</p></div>
                     )}
                     <input id="expense-proof-up" type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                     {uploadProgress !== null && <Progress value={uploadProgress} className="absolute bottom-0 left-0 right-0 h-1" />}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || uploadProgress !== null} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Confirmar Lançamento"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por título ou categoria..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] tracking-widest p-6">Data</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Categoria</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest">Descrição / Título</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Valor</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest p-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></TableCell></TableRow>
            ) : filteredExpenses.length > 0 ? (
              filteredExpenses.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/10">
                  <TableCell className="p-6 text-[10px] font-bold">
                    {e.date?.toDate ? e.date.toDate().toLocaleDateString('pt-BR') : new Date(e.date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/20 text-primary bg-primary/5">
                      {CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                     <div className="flex flex-col">
                        <span className="font-bold text-sm uppercase">{e.title}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{e.description}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-red-500">
                    -{formatCurrency(e.amount)}
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {e.proofUrl && (
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" asChild title="Ver Comprovante">
                            <a href={e.proofUrl} target="_blank"><FileText className="w-4 h-4" /></a>
                         </Button>
                       )}
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(e.id)}>
                         <Trash2 className="w-4 h-4" />
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-32 text-center opacity-30 italic">Nenhuma despesa registrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
