"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { doc, collection, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Loader2, 
  MessageCircle, 
  History as HistoryIcon, 
  Calendar, 
  Clock, 
  Building2, 
  Mail, 
  Phone, 
  Instagram, 
  CheckCircle2, 
  ShieldCheck,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  User,
  Users,
  Plus,
  Send,
  MoreVertical,
  Layers,
  AtSign,
  Zap,
  Tag,
  Ticket,
  MapPin,
  ChevronRight,
  Database
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  updateLeadAction, 
  registerContactAction, 
  scheduleFollowUpAction, 
  convertLeadAction 
} from "@/app/actions/crm"
import { formatCurrency } from "@/lib/financial-utils"
import Link from "next/link"

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'sem_contato', label: 'Sem Contato' },
  { value: 'contatado', label: 'Contatado' },
  { value: 'negociando', label: 'Negociando' },
  { value: 'aguardando_retorno', label: 'Aguardando Retorno' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'perdido', label: 'Perdido' },
  { value: 'arquivado', label: 'Arquivado' }
];

const SOURCES = ["Landing Page", "Instagram", "WhatsApp", "Indicação", "Evento", "Manual"];
const PRIORITIES = ["baixa", "media", "alta", "urgente"];
const POTENTIALS = ["baixo", "medio", "alto"];

export default function LeadDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user, profile } = useUser(auth)
  
  const leadRef = React.useMemo(() => (db && id) ? doc(db, "organizer_leads", id) : null, [db, id])
  const { data: lead, loading } = useDoc<any>(leadRef)

  const historyQuery = useMemoFirebase(() => 
    (db && id) ? query(collection(db, "crm_lead_history"), where("leadId", "==", id), orderBy("createdAt", "desc")) : null, 
    [db, id]
  )
  const { data: history, loading: loadingHistory, error: historyError } = useCollection<any>(historyQuery)

  const adminsQuery = useMemoFirebase(() => db ? query(collection(db, "system_admins"), where("status", "==", "Ativo")) : null, [db]);
  const { data: admins } = useCollection<any>(adminsQuery);

  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false)
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = React.useState(false)
  const [isConversionModalOpen, setIsConversionModalOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const adminName = profile?.name || user?.displayName || "Admin"

  const handleUpdateLead = async (field: string, value: any) => {
    if (!lead || isSaving) return
    setIsSaving(true)
    try {
      const res = await updateLeadAction(lead.id, { [field]: value }, adminName)
      if (!res.success) throw new Error(res.error)
      toast({ title: "Campo atualizado!" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await registerContactAction({
        leadId: lead.id,
        canal: formData.get("canal") as string,
        resultado: formData.get("resultado") as string,
        descricao: formData.get("descricao") as string,
        adminName
      })
      if (!res.success) throw new Error(res.error)
      toast({ title: "Contato registrado!" })
      setIsContactModalOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFollowUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await scheduleFollowUpAction({
        leadId: lead.id,
        date: formData.get("date") as string,
        time: formData.get("time") as string,
        observation: formData.get("observation") as string,
        adminName
      })
      if (!res.success) throw new Error(res.error)
      toast({ title: "Follow-up agendado!" })
      setIsFollowUpModalOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConversionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await convertLeadAction({
        leadId: lead.id,
        adminName,
        stripeStatus: formData.get("stripeStatus") as string,
        publishedCount: parseInt(formData.get("publishedCount") as string) || 0
      })
      if (!res.success) throw new Error(res.error)
      toast({ title: "Lead convertido!", description: "Parabéns por fechar este parceiro." })
      setIsConversionModalOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="py-32 flex justify-center"><Loader2 className="animate-spin text-secondary w-10 h-10" /></div>
  if (!lead) return <div className="py-20 text-center uppercase font-black opacity-20">Lead não localizado.</div>

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/admin/leads"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-primary">{lead.nome}</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{lead.empresa || "Pessoa Física"} • Cadastrado em {new Date(lead.createdAt?.seconds * 1000).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-secondary text-secondary" onClick={() => setIsContactModalOpen(true)}><MessageCircle className="w-4 h-4" /> Registrar Contato</Button>
           <Button variant="outline" className="rounded-full h-11 px-6 font-black uppercase text-[10px] gap-2 border-primary text-primary" onClick={() => setIsFollowUpModalOpen(true)}><Calendar className="w-4 h-4" /> Agendar Follow-up</Button>
           {lead.status !== 'convertido' && (
             <Button className="bg-green-600 text-white rounded-full h-11 px-8 shadow-lg font-black uppercase italic text-xs" onClick={() => setIsConversionModalOpen(true)}>Converter Lead</Button>
           )}
        </div>
      </div>

      {historyError && (
        <Alert variant="destructive" className="rounded-2xl border-2 shadow-lg bg-red-50">
           <Database className="h-5 w-5" />
           <AlertTitle className="font-black uppercase italic">Erro de Sincronização</AlertTitle>
           <AlertDescription className="text-xs font-bold uppercase leading-relaxed">
              Não foi possível carregar o histórico. {historyError.code === 'failed-precondition' ? "O índice do Firestore está sendo criado. Aguarde alguns minutos." : historyError.message}
           </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-10">
           {/* DADOS ORIGINAIS */}
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-lg font-black uppercase italic tracking-tighter">Ficha de Inscrição</CardTitle>
              </CardHeader>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <DetailItem label="Cidade" value={lead.cidade} icon={MapPin} />
                 <DetailItem label="WhatsApp" value={lead.whatsapp} icon={Phone} link={`https://wa.me/${lead.whatsapp?.replace(/\D/g, "")}`} />
                 <DetailItem label="E-mail" value={lead.email} icon={Mail} link={`mailto:${lead.email}`} />
                 <DetailItem label="Instagram" value={lead.instagram ? `@${lead.instagram}` : "---"} icon={Instagram} link={lead.instagram ? `https://instagram.com/${lead.instagram.replace('@','')}` : undefined} />
                 <DetailItem label="Tipo de Evento" value={lead.tipoEvento} icon={Layers} />
                 <DetailItem label="Público Médio" value={lead.publicoMedio} icon={Users} />
                 <div className="md:col-span-2 space-y-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Mensagem Original</p>
                    <p className="text-sm font-medium leading-relaxed italic">"{lead.mensagem || "Sem mensagem informada."}"</p>
                 </div>
              </CardContent>
           </Card>

           {/* NEGOCIAÇÃO */}
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-lg font-black uppercase italic tracking-tighter">Dados da Negociação</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Interesse em:</Label>
                       <Select value={lead.interessePrincipal || ""} onValueChange={v => handleUpdateLead('interessePrincipal', v)}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="gratuitos">Eventos Gratuitos</SelectItem>
                             <SelectItem value="venda">Venda de Ingressos</SelectItem>
                             <SelectItem value="divulgacao">Divulgação / Ads</SelectItem>
                             <SelectItem value="parceria">Parceria Estratégica</SelectItem>
                             <SelectItem value="patrocinio">Patrocínio</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Valor Negociado (Estimado)</Label>
                       <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-30">R$</span>
                          <Input 
                            type="number" 
                            step="0.01" 
                            defaultValue={lead.valorNegociado} 
                            onBlur={e => handleUpdateLead('valorNegociado', parseFloat(e.target.value) || 0)}
                            className="rounded-xl h-11 pl-9 font-black text-primary" 
                          />
                       </div>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Observações Comerciais</Label>
                    <Textarea 
                      defaultValue={lead.observacoesComerciais} 
                      onBlur={e => handleUpdateLead('observacoesComerciais', e.target.value)}
                      placeholder="Detalhes sobre a proposta, descontos ou acordos..."
                      className="rounded-xl min-h-[100px]"
                    />
                 </div>
              </CardContent>
           </Card>

           {/* TIMELINE */}
           <div className="space-y-6">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary flex items-center gap-3 px-2">
                 <HistoryIcon className="w-5 h-5 text-secondary" /> Histórico de Gestão
              </h2>
              <div className="relative pl-8 space-y-12 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border/60 before:border-dashed before:border-l">
                 {loadingHistory ? <div className="flex justify-center"><Loader2 className="animate-spin w-4 h-4" /></div> : 
                  history && history.length > 0 ? history.map((h, i) => (
                    <div key={h.id} className="relative">
                       <div className={cn(
                         "absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-background shadow-md z-10",
                         h.tipo === 'contato' ? "bg-green-600 text-white" : 
                         h.tipo === 'conversao' ? "bg-secondary text-white" : 
                         h.tipo === 'follow_up' ? "bg-orange-500 text-white" : "bg-primary text-white"
                       )}>
                          {h.tipo === 'contato' ? <Send className="w-3 h-3" /> : 
                           h.tipo === 'conversao' ? <Zap className="w-3 h-3 fill-current" /> :
                           h.tipo === 'follow_up' ? <Clock className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                       </div>
                       <div className="space-y-1">
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black uppercase text-muted-foreground">{new Date(h.createdAt?.seconds * 1000).toLocaleString('pt-BR')}</span>
                             <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5">{h.usuarioResponsavel}</Badge>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                             <p className="text-xs font-black uppercase text-primary italic">{h.tipo.replace('_',' ')} {h.canal && `via ${h.canal}`}</p>
                             <p className="text-xs font-medium text-foreground/70 leading-relaxed">
                                {h.descricao}
                             </p>
                             {h.resultado && (
                               <Badge className="bg-muted text-primary text-[8px] font-black h-4 px-2 uppercase border-none">{h.resultado}</Badge>
                             )}
                          </div>
                       </div>
                    </div>
                  )) : (
                    <p className="text-xs italic text-muted-foreground opacity-40 px-2 uppercase font-bold tracking-widest">Nenhuma interação registrada.</p>
                  )}
              </div>
           </div>
        </div>

        <aside className="lg:col-span-4 space-y-8">
           {/* CONTROLE COMERCIAL */}
           <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 space-y-8 sticky top-24">
              <div className="space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Status Atual</Label>
                    <Select value={lead.status || ""} onValueChange={v => handleUpdateLead('status', v)}>
                       <SelectTrigger className="h-12 rounded-xl font-black italic uppercase"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Responsável</Label>
                    <Select value={lead.responsavel || ""} onValueChange={v => handleUpdateLead('responsavel', v)}>
                       <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o agente" /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {admins?.map((adm: any) => (
                             <SelectItem key={adm.uid} value={adm.nome}>{adm.nome.toUpperCase()}</SelectItem>
                          ))}
                          <SelectItem value="Parceiro Externo">PARCEIRO EXTERNO</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>

                 <Separator className="border-dashed" />

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Prioridade</Label>
                       <Select value={lead.prioridade || ""} onValueChange={v => handleUpdateLead('prioridade', v)}>
                          <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Definir" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Potencial</Label>
                       <Select value={lead.potencial || ""} onValueChange={v => handleUpdateLead('potencial', v)}>
                          <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Definir" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {POTENTIALS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Origem do Lead</Label>
                    <Select value={lead.origem || ""} onValueChange={v => handleUpdateLead('origem', v)}>
                       <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {SOURCES.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-dashed">
                 <Label className="text-[10px] font-black uppercase opacity-60">Anotações Internas</Label>
                 <Textarea 
                   defaultValue={lead.observacoesInternas} 
                   onBlur={e => handleUpdateLead('observacoesInternas', e.target.value)}
                   placeholder="Notas rápidas para a equipe..." 
                   className="min-h-[120px] rounded-xl resize-none text-xs border-dashed border-secondary/20" 
                 />
              </div>

              <div className="p-4 bg-secondary/5 rounded-2xl flex items-start gap-3">
                 <ShieldCheck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                 <p className="text-[9px] text-secondary font-bold uppercase leading-relaxed">Audit Trail ativo. Todas as alterações em campos comerciais são registradas permanentemente.</p>
              </div>
           </Card>
        </aside>
      </div>

      {/* MODAL: REGISTRAR CONTATO */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleContactSubmit} className="space-y-6">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Registrar Contato</DialogTitle>
                  <DialogDescription>Qual foi o resultado da última interação?</DialogDescription>
               </DialogHeader>
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Canal</Label>
                        <Select name="canal" required defaultValue="WhatsApp">
                           <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                              <SelectItem value="Instagram">Instagram</SelectItem>
                              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                              <SelectItem value="Telefone">Telefone</SelectItem>
                              <SelectItem value="E-mail">E-mail</SelectItem>
                              <SelectItem value="Presencial">Presencial</SelectItem>
                              <SelectItem value="Outro">Outro</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Resultado</Label>
                        <Select name="resultado" required defaultValue="Interessado">
                           <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                              <SelectItem value="Sem resposta">Sem resposta</SelectItem>
                              <SelectItem value="Visualizou">Visualizou</SelectItem>
                              <SelectItem value="Respondeu">Respondeu</SelectItem>
                              <SelectItem value="Interessado">Interessado</SelectItem>
                              <SelectItem value="Muito interessado">Muito interessado</SelectItem>
                              <SelectItem value="Não interessado">Não interessado</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Descrição da Conversa</Label>
                     <Textarea name="descricao" required placeholder="Resumo do que foi conversado..." className="rounded-xl resize-none h-24" />
                  </div>
               </div>
               <DialogFooter>
                  <Button type="submit" disabled={isSaving} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                     {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : "Salvar Registro"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>

      {/* MODAL: FOLLOW-UP */}
      <Dialog open={isFollowUpModalOpen} onOpenChange={setIsFollowUpModalOpen}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleFollowUpSubmit} className="space-y-6">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Agendar Próximo Passo</DialogTitle>
                  <DialogDescription>Quando devemos falar com este lead novamente?</DialogDescription>
               </DialogHeader>
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Data</Label>
                        <Input name="date" type="date" required className="rounded-xl h-11" />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60">Hora</Label>
                        <Input name="time" type="time" required className="rounded-xl h-11" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">O que fazer?</Label>
                     <Input name="observation" required placeholder="Ex: Enviar proposta por e-mail" className="rounded-xl h-11" />
                  </div>
               </div>
               <DialogFooter>
                  <Button type="submit" disabled={isSaving} className="w-full bg-primary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                     {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : "Agendar Follow-up"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>

      {/* MODAL: CONVERSÃO */}
      <Dialog open={isConversionModalOpen} onOpenChange={setIsConversionModalOpen}>
         <DialogContent className="max-w-md rounded-[2.5rem]">
            <form onSubmit={handleConversionSubmit} className="space-y-6">
               <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Finalizar Conversão</DialogTitle>
                  <DialogDescription>Registre os dados de ativação deste novo parceiro.</DialogDescription>
               </DialogHeader>
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Stripe Connect</Label>
                     <Select name="stripeStatus" defaultValue="pendente">
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           <SelectItem value="sim">Configurado e Ativo</SelectItem>
                           <SelectItem value="pendente">Em análise / Pendente</SelectItem>
                           <SelectItem value="nao">Não configurou ainda</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Eventos já publicados</Label>
                     <Input name="publishedCount" type="number" defaultValue="0" className="rounded-xl h-11 font-black" />
                  </div>
               </div>
               <DialogFooter>
                  <Button type="submit" disabled={isSaving} className="w-full bg-green-600 text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                     {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : "Marcar como CONVERTIDO"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailItem({ label, value, icon: Icon, link }: { label: string; value: string; icon: any; link?: string }) {
  const content = (
    <div className="flex items-center gap-3">
       <div className="p-2.5 bg-muted rounded-xl text-secondary"><Icon className="w-4 h-4" /></div>
       <div className="min-w-0">
          <p className="text-[8px] font-black uppercase opacity-40 leading-none mb-1">{label}</p>
          <p className="text-xs font-bold text-primary uppercase">{value}</p>
       </div>
    </div>
  );

  if (link) return <a href={link} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">{content}</a>;
  return content;
}
