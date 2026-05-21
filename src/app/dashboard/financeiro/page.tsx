
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { 
  Landmark, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  DollarSign, 
  Send, 
  ShieldCheck, 
  ArrowLeft,
  Building2,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Wallet,
  Coins,
  CreditCard
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { Separator } from "@/components/ui/separator"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import Link from "next/link"

export default function FinanceiroPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  const { currentOrg, loading: orgLoading, refreshOrg, userRole } = useCurrentOrganization()
  
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isVerifyingOpen, setIsVerifyingOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [verificationValue, setVerificationValue] = React.useState("")

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole || '')
  const vStatus = currentOrg?.payoutSettings?.status || "none"

  const handleSaveBankDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !currentOrg || !isOwnerOrAdmin) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const payoutSettings = {
      bank: formData.get("bank") as string,
      branch: formData.get("branch") as string,
      account: formData.get("account") as string,
      accountName: formData.get("accountName") as string,
      cnpj: formData.get("cnpj") as string,
      pixKey: formData.get("pixKey") as string,
      status: "pending_admin",
      updatedAt: new Date().toISOString()
    }

    try {
      await updateDoc(doc(db, "organizations", currentOrg.id), {
        payoutSettings,
        updatedAt: serverTimestamp()
      })
      await refreshOrg()
      toast({ title: "Dados salvos!", description: "Iniciaremos o processo de verificação em breve." })
      setIsFormOpen(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique suas permissões." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmVerification = async () => {
    if (!db || !currentOrg || !verificationValue || !isOwnerOrAdmin) return

    setIsSubmitting(true)
    try {
      const amount = parseFloat(verificationValue.replace(',', '.'))
      await updateDoc(doc(db, "organizations", currentOrg.id), {
        "payoutSettings.verificationAmountInput": amount,
        updatedAt: serverTimestamp()
      })
      await refreshOrg()
      toast({ title: "Valor enviado!", description: "Nossa equipe validará se o valor coincide com o depósito." })
      setIsVerifyingOpen(false)
      setVerificationValue("")
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao enviar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (orgLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Building2 className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold italic uppercase tracking-tighter">Nenhuma Marca Selecionada</h2>
        <p className="text-muted-foreground font-medium max-w-sm">Selecione uma organização para gerenciar os dados de recebimento.</p>
        <Button asChild variant="outline" className="rounded-full mt-4"><Link href="/dashboard/organizacoes">Ver Minhas Marcas</Link></Button>
      </div>
    );
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold italic uppercase tracking-tighter">Acesso Restrito</h2>
        <p className="text-muted-foreground font-medium max-w-sm">Apenas proprietários e administradores da marca podem gerenciar dados bancários.</p>
        <Button asChild variant="outline" className="rounded-full mt-4"><Link href={`/dashboard/organizacoes/${currentOrg.username}`}>Voltar ao Painel</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/organizacoes/${currentOrg.username}/finance`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Conta de Recebimento</h1>
          <p className="text-muted-foreground font-medium">Configurações de repasse bancário para <strong>{currentOrg.name}</strong>.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 p-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                     <Landmark className="w-5 h-5 text-secondary" /> 
                     Dados Bancários PJ
                   </CardTitle>
                   <CardDescription className="font-medium">Vínculo obrigatório com o CNPJ da organização.</CardDescription>
                </div>
                <Badge 
                  className={cn(
                    "uppercase text-[9px] font-black h-6 px-3",
                    vStatus === 'verified' ? "bg-green-500 text-white" : 
                    vStatus === 'none' ? "bg-orange-50 text-orange-600 border-orange-200" :
                    "bg-blue-500 text-white"
                  )}
                  variant={vStatus === 'none' ? 'outline' : 'default'}
                >
                  {vStatus === 'none' ? 'Pendente' :
                   vStatus === 'pending_admin' ? 'Em análise' :
                   vStatus === 'waiting_user' ? 'Aguardando Valor' :
                   'Verificada'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
               {vStatus === 'none' ? (
                 <div className="py-6 text-center space-y-6">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                       <CreditCard className="w-10 h-10 text-muted-foreground opacity-30" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="font-bold text-lg">Configuração Inicial</h3>
                       <p className="text-sm text-muted-foreground max-w-sm mx-auto">Insira os dados da conta bancária da sua empresa para que possamos iniciar o processo de validação de titularidade.</p>
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-secondary text-white font-black rounded-xl h-14 px-10 shadow-xl shadow-secondary/20 uppercase italic transition-all hover:scale-105">
                           Cadastrar Dados Bancários
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2.5rem] max-w-md">
                        <form onSubmit={handleSaveBankDetails} className="space-y-6">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Dados de Recebimento</DialogTitle>
                            <DialogDescription>Use uma conta vinculada à razão social da organização.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Banco</Label>
                              <Input name="bank" placeholder="Ex: Itaú, Nubank, Santander..." required className="rounded-xl h-11" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Agência</Label>
                                <Input name="branch" placeholder="0001" required className="rounded-xl h-11" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Conta e Dígito</Label>
                                <Input name="account" placeholder="12345-6" required className="rounded-xl h-11" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Razão Social do Titular</Label>
                              <Input name="accountName" placeholder="Exatamente como no extrato" required className="rounded-xl h-11" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CNPJ do Titular</Label>
                              <Input name="cnpj" placeholder="00.000.000/0000-00" defaultValue={currentOrg.cnpj} required className="rounded-xl h-11" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Chave PIX Principal</Label>
                              <Input name="pixKey" placeholder="CNPJ, E-mail ou Celular" required className="rounded-xl h-11" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                              Confirmar e Validar
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                 </div>
               ) : (
                 <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-muted/20 rounded-3xl border border-border/50">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Instituição</p>
                          <p className="font-black uppercase italic text-primary">{currentOrg.payoutSettings?.bank}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Dados</p>
                          <p className="font-bold text-sm">Ag: {currentOrg.payoutSettings?.branch} | Cta: {currentOrg.payoutSettings?.account}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Titular</p>
                          <p className="font-bold text-sm truncate">{currentOrg.payoutSettings?.accountName}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">PIX</p>
                          <p className="font-mono text-[11px] font-bold text-secondary">{currentOrg.payoutSettings?.pixKey}</p>
                       </div>
                    </div>

                    {vStatus === 'verified' ? (
                       <div className="flex items-center gap-4 p-6 bg-green-50 rounded-[2rem] border-2 border-dashed border-green-200">
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                             <CheckCircle2 className="w-7 h-7" />
                          </div>
                          <div className="space-y-1">
                             <p className="font-black uppercase text-xs text-green-800 italic">Conta Verificada com Sucesso!</p>
                             <p className="text-xs text-green-700 font-medium">Sua organização está pronta para receber os repasses automaticamente.</p>
                          </div>
                       </div>
                    ) : (
                       <div className="space-y-6">
                          <div className="flex items-center gap-4 p-6 bg-blue-50 rounded-[2rem] border-2 border-dashed border-blue-200">
                             <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0">
                                {vStatus === 'pending_admin' ? <Clock className="w-7 h-7 animate-pulse" /> : <ShieldCheck className="w-7 h-7" />}
                             </div>
                             <div className="space-y-1">
                                <p className="font-black uppercase text-xs text-blue-800 italic">
                                   {vStatus === 'pending_admin' ? 'Aguardando Micro-depósito' : 'Sinalize o Valor Recebido'}
                                </p>
                                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                   {vStatus === 'pending_admin' 
                                     ? 'Nossa equipe fará um depósito de centavos em sua conta em até 48h. Fique atento ao seu extrato bancário.' 
                                     : 'Já identificamos o envio do depósito. Agora, informe o valor exato que você recebeu.'}
                                </p>
                             </div>
                          </div>

                          {vStatus === 'waiting_user' && (
                             <Dialog open={isVerifyingOpen} onOpenChange={setIsVerifyingOpen}>
                                <DialogTrigger asChild>
                                   <Button className="w-full h-16 bg-secondary text-white font-black text-lg rounded-2xl shadow-xl shadow-secondary/20 uppercase italic hover:scale-[1.02] transition-transform">
                                      Inserir Valor do Depósito
                                   </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-sm rounded-[2.5rem]">
                                   <div className="text-center space-y-6 py-4">
                                      <DialogHeader>
                                         <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-secondary">
                                            <DollarSign className="w-8 h-8" />
                                         </div>
                                         <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Validar Recebimento</DialogTitle>
                                         <DialogDescription className="font-medium">
                                            Consulte seu extrato e insira o valor exato recebido do Viby Club (ex: 0,32).
                                         </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                         <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                                            <Input 
                                               placeholder="0,00" 
                                               value={verificationValue}
                                               onChange={e => setVerificationValue(e.target.value)}
                                               className="h-16 text-2xl font-black text-center rounded-2xl pl-10 border-secondary/20"
                                            />
                                         </div>
                                         <Button onClick={handleConfirmVerification} disabled={isSubmitting || !verificationValue} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-lg uppercase italic">
                                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                                            Confirmar e Finalizar
                                         </Button>
                                      </div>
                                   </div>
                                </DialogContent>
                             </Dialog>
                          )}
                       </div>
                    )}
                 </div>
               )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] bg-muted/10 border border-dashed">
             <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><Info className="w-4 h-4" /> Termos de Repasse</CardTitle></CardHeader>
             <CardContent className="space-y-4 text-xs font-medium text-muted-foreground leading-relaxed">
                <p>1. Os repasses são realizados automaticamente para a conta PJ verificada conforme o ciclo de faturamento (D+30 padrão ou antecipação disponível).</p>
                <p>2. A conta bancária deve obrigatoriamente estar vinculada ao mesmo CNPJ cadastrado nas configurações da marca.</p>
                <p>3. Em caso de chargeback ou contestação, os valores poderão ser retidos do seu saldo disponível para cobertura operacional.</p>
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
           <Card className="border-none shadow-xl rounded-[2rem] bg-primary text-white overflow-hidden relative">
              <CardHeader className="pb-2">
                 <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> 
                    Segurança de Repasse
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                 <div className="space-y-2">
                    <p className="text-xl font-black italic uppercase tracking-tight">Por que verificamos?</p>
                    <p className="text-sm opacity-80 leading-relaxed">
                       Para garantir que os ganhos da marca cheguem com segurança aos verdadeiros proprietários, utilizamos um processo de validação em duas etapas: verificação de documento (CNPJ) e prova de titularidade bancária.
                    </p>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><Coins className="w-4 h-4 text-secondary" /></div>
                       <div>
                          <p className="font-bold text-xs">Transferências Seguras</p>
                          <p className="text-[10px] opacity-60">Utilizamos o barramento do BACEN para garantir agilidade no PIX.</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-white/10 rounded-lg"><Wallet className="w-4 h-4 text-secondary" /></div>
                       <div>
                          <p className="font-bold text-xs">Retenção de Impostos</p>
                          <p className="text-[10px] opacity-60">Sua organização recebe o valor líquido já descontado de taxas.</p>
                       </div>
                    </div>
                 </div>
              </CardContent>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white">
              <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Etapas do Processo</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 {[
                   { step: 1, title: "Cadastro de Dados", desc: "Você preenche os dados da conta PJ.", done: vStatus !== 'none' },
                   { step: 2, title: "Micro-depósito", desc: "Nós enviamos um valor aleatório para sua conta.", done: vStatus === 'waiting_user' || vStatus === 'verified' },
                   { step: 3, title: "Conferência", desc: "Você informa o valor recebido no sistema.", done: vStatus === 'verified' },
                   { step: 4, title: "Liberação de Saque", desc: "Sua conta é habilitada para receber os repasses.", done: vStatus === 'verified' },
                 ].map((item) => (
                   <div key={item.step} className="flex gap-4 relative">
                      {item.step < 4 && <div className="absolute left-4 top-8 w-px h-10 bg-border" />}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors",
                        item.done ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                      )}>
                         {item.done ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                      </div>
                      <div className="space-y-0.5">
                         <p className={cn("text-xs font-bold", item.done ? "text-primary" : "text-muted-foreground")}>{item.title}</p>
                         <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                      </div>
                   </div>
                 ))}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
