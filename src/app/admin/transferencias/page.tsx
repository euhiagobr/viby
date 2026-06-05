"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  SendHorizontal, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Paperclip,
  Upload,
  Building2,
  DollarSign,
  History,
  ShieldCheck,
  FileText,
  Mail,
  RefreshCw
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { sendPayoutConfirmedEmail } from "@/app/actions/email"

export default function AdminTransferenciasPage() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const storage = React.useMemo(() => app ? getStorage(app) : null, [app])

  const [search, setSearch] = React.useState("")
  const [selectedRequest, setSelectedRequest] = React.useState<any>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [proofUrl, setProofUrl] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [resendingId, setResendingId] = React.useState<string | null>(null)

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "payout_requests"));
  }, [db])

  const { data: rawRequests, loading } = useCollection<any>(requestsQuery)

  const requests = React.useMemo(() => {
    if (!rawRequests) return [];
    return [...rawRequests].sort((a, b) => {
      const tA = a.requestedAt?.seconds || 0;
      const tB = b.requestedAt?.seconds || 0;
      return tB - tA;
    });
  }, [rawRequests]);

  const filteredRequests = React.useMemo(() => {
    if (!requests) return []
    return requests.filter(r => 
      (r.organizationName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (r.id?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [requests, search])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !selectedRequest) return

    setUploadProgress(0)
    try {
      const fileName = `payout_proofs/${selectedRequest.organizationId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { toast({ variant: "destructive", title: "Erro no upload" }); setUploadProgress(null); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setProofUrl(downloadURL)
          setUploadProgress(null)
          toast({ title: "Comprovante carregado!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleCompletePayout = async () => {
    if (!db || !selectedRequest || !proofUrl) return

    setIsSubmitting(true)
    try {
      // 1. Atualizar o documento do saque
      await updateDoc(doc(db, "payout_requests", selectedRequest.id), {
        status: "Concluído",
        proofUrl: proofUrl,
        processedAt: serverTimestamp()
      })

      // 2. Disparar e-mail de notificação
      await triggerPayoutNotification(selectedRequest.userId, selectedRequest.organizationName, selectedRequest.amount, proofUrl);

      toast({ title: "Saque Concluído!", description: "O comprovante foi enviado ao usuário." })
      setSelectedRequest(null)
      setProofUrl("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const triggerPayoutNotification = async (userId: string, orgName: string, amount: number, proof: string) => {
    if (!db) return;
    try {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const result = await sendPayoutConfirmedEmail({
          to: userData.email,
          userName: userData.name || userData.displayName || "Usuário",
          orgName: orgName,
          amount: amount,
          proofUrl: proof
        });
        
        if (!result.success && result.error) {
          toast({ variant: "destructive", title: "E-mail não enviado", description: result.error });
        }
      }
    } catch (err) {
      console.warn("Falha ao disparar e-mail de saque.", err);
    }
  }

  const handleResendNotification = async (req: any) => {
    if (!req.userId || !req.proofUrl) return;
    setResendingId(req.id);
    try {
      await triggerPayoutNotification(req.userId, req.organizationName, req.amount, req.proofUrl);
      toast({ title: "Tentativa de reenvio realizada!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao reenviar" });
    } finally {
      setResendingId(null);
    }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR');
    } catch (e) { return "---"; }
  }

  const pendingRequests = filteredRequests.filter(r => r.status === 'Pendente')
  const completedRequests = filteredRequests.filter(r => r.status === 'Concluído')

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <SendHorizontal className="w-8 h-8 text-secondary" />
          Transferências Bancárias
        </h1>
        <p className="text-muted-foreground font-medium">Gere e processe os pagamentos das organizações parceiras.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-sm bg-white border-l-4 border-orange-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Saques Pendentes</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-orange-600">{pendingRequests.length}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Saques Pagos</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black text-green-600">{completedRequests.length}</div></CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-secondary text-white">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Total Repassado</CardTitle></CardHeader>
            <CardContent>
               <div className="text-2xl font-black">
                 {formatCurrency(completedRequests.reduce((acc, r) => acc + (r.amount || 0), 0))}
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="relative w-full max-sm:w-full md:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por marca ou protocolo..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl h-11"
        />
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-12">
          <TabsTrigger value="pending" className="rounded-lg px-8 font-bold gap-2">
            <Clock className="w-4 h-4" /> Pendentes ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg px-8 font-bold gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Concluídos ({completedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
             {pendingRequests.length === 0 ? (
               <div className="py-20 text-center text-muted-foreground italic">Nenhum saque aguardando pagamento.</div>
             ) : (
               <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-bold">Protocolo / Data</TableHead>
                       <TableHead className="font-bold">Organização</TableHead>
                       <TableHead className="font-bold">Banco PJ</TableHead>
                       <TableHead className="font-bold text-right">Valor</TableHead>
                       <TableHead className="text-right font-bold">Ações</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {pendingRequests.map((req) => (
                      <TableRow key={req.id} className="hover:bg-muted/10">
                         <TableCell>
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black text-muted-foreground uppercase">#{req.id.slice(-8)}</span>
                               <span className="text-[11px] font-bold">{formatTimestamp(req.requestedAt)}</span>
                            </div>
                         </TableCell>
                         <TableCell>
                            <div className="flex items-center gap-2">
                               <Building2 className="w-4 h-4 text-secondary" />
                               <span className="font-bold text-sm uppercase">{req.organizationName}</span>
                            </div>
                         </TableCell>
                         <TableCell>
                            <div className="flex flex-col text-[10px] font-medium">
                               <span className="font-black text-primary uppercase">{req.bankDetails?.bank}</span>
                               <span className="text-muted-foreground">PIX: {req.bankDetails?.pixKey}</span>
                            </div>
                         </TableCell>
                         <TableCell className="text-right font-black text-primary">
                            {formatCurrency(req.amount)}
                         </TableCell>
                         <TableCell className="text-right">
                            <Button size="sm" onClick={() => setSelectedRequest(req)} className="bg-secondary text-white font-black rounded-lg h-8 text-[9px] uppercase gap-1.5 shadow-lg">
                               <DollarSign className="w-3 h-3" /> Pagar Saque
                            </Button>
                         </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
               </Table>
             )}
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
             {completedRequests.length === 0 ? (
               <div className="py-20 text-center text-muted-foreground italic">Nenhum saque concluído ainda.</div>
             ) : (
               <Table>
                 <TableHeader className="bg-muted/30">
                    <TableRow>
                       <TableHead className="font-bold">Protocolo</TableHead>
                       <TableHead className="font-bold">Organização</TableHead>
                       <TableHead className="font-bold">Processado em</TableHead>
                       <TableHead className="font-bold text-right">Valor Pago</TableHead>
                       <TableHead className="text-right font-bold">Ações</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {completedRequests.map((req) => (
                      <TableRow key={req.id} className="hover:bg-muted/10 opacity-70">
                         <TableCell><span className="text-[10px] font-black uppercase text-muted-foreground">#{req.id.slice(-8)}</span></TableCell>
                         <TableCell><span className="font-bold text-sm uppercase">{req.organizationName}</span></TableCell>
                         <TableCell><span className="text-[11px] font-medium">{formatTimestamp(req.processedAt)}</span></TableCell>
                         <TableCell className="text-right font-black text-green-600">{formatCurrency(req.amount)}</TableCell>
                         <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 className="h-8 rounded-lg text-secondary border-secondary/20 font-bold gap-1.5 text-[9px] uppercase hover:bg-secondary/5"
                                 onClick={() => handleResendNotification(req)}
                                 disabled={resendingId === req.id}
                               >
                                  {resendingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                  Reenviar E-mail
                               </Button>
                               <Button variant="ghost" size="sm" asChild className="h-8 text-secondary font-bold gap-1.5 text-[9px] uppercase">
                                  <a href={req.proofUrl} target="_blank" rel="noopener noreferrer"><FileText className="w-3.5 h-3.5" /> Comprovante</a>
                               </Button>
                            </div>
                         </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
               </Table>
             )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE PAGAMENTO */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && (setSelectedRequest(null), setProofUrl(""))}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <DialogHeader>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Efetivar Transferência</DialogTitle>
               <DialogDescription>
                 Confirme os dados e anexe o comprovante de pagamento para finalizar o saque de <strong>{selectedRequest?.organizationName}</strong>.
               </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
               <div className="p-6 bg-muted/30 rounded-[1.5rem] border space-y-4">
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase opacity-40">Valor Solicitado</span>
                     <span className="text-xl font-black text-primary">{formatCurrency(selectedRequest?.amount || 0)}</span>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase text-secondary">Dados Bancários Destino</p>
                     <div className="text-[11px] font-bold space-y-1">
                        <p>Banco: {selectedRequest?.bankDetails?.bank}</p>
                        <p>Ag: {selectedRequest?.bankDetails?.branch} | Cta: {selectedRequest?.bankDetails?.account}</p>
                        <p>PIX: {selectedRequest?.bankDetails?.pixKey}</p>
                        <p className="text-primary truncate">Favorecido: {selectedRequest?.bankDetails?.accountName}</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Anexar Comprovante (PDF/Imagem)</Label>
                  <div className={cn(
                    "relative h-32 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center transition-all",
                    proofUrl ? "border-green-500 bg-green-50/50" : "hover:bg-muted/50 cursor-pointer"
                  )} onClick={() => !proofUrl && document.getElementById('proof-up')?.click()}>
                     {proofUrl ? (
                       <div className="text-center text-green-600">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-1" />
                          <p className="text-[10px] font-black uppercase">Arquivo Carregado</p>
                       </div>
                     ) : (
                       <div className="text-center text-muted-foreground opacity-50">
                          <Upload className="w-8 h-8 mx-auto mb-1" />
                          <p className="text-[10px] font-black uppercase">Clique para fazer upload</p>
                       </div>
                     )}
                     <input id="proof-up" type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                  </div>
                  {uploadProgress !== null && <Progress value={uploadProgress} className="h-1" />}
               </div>
            </div>

            <DialogFooter className="gap-2">
               <Button variant="ghost" onClick={() => setSelectedRequest(null)} className="rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
               <Button 
                 onClick={handleCompletePayout} 
                 disabled={isSubmitting || !proofUrl} 
                 className="flex-1 bg-secondary text-white font-black h-12 rounded-xl shadow-xl uppercase italic"
               >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                 Confirmar Pagamento
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  )
}
