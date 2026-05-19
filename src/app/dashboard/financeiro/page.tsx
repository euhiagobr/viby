
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Wallet, TrendingUp, ArrowUpRight, CreditCard, Landmark, Loader2, CheckCircle2, AlertCircle, Info, DollarSign, Send, Ticket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, serverTimestamp, query, where, collection } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { Separator } from "@/components/ui/separator"

export default function FinanceiroPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading } = useDoc<any>(userDocRef)

  // Consultar apenas vendas confirmadas do produtor
  const salesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "registrations"), 
      where("organizerId", "==", user.uid),
      where("paymentStatus", "in", ["Pago", "Disponível"])
    )
  }, [db, user])

  const { data: sales, loading: salesLoading } = useCollection<any>(salesQuery)

  const stats = React.useMemo(() => {
    if (!sales) return { netTotal: 0, grossTotal: 0, count: 0, fees: 0 };
    
    return sales.reduce((acc: any, sale: any) => {
      acc.count++;
      acc.grossTotal += (sale.ticketBasePrice || 0);
      acc.netTotal += (sale.producerNetAmount || 0);
      acc.fees += (sale.producerFeeAmount || 0);
      return acc;
    }, { netTotal: 0, grossTotal: 0, count: 0, fees: 0 });
  }, [sales]);

  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isVerifyingOpen, setIsVerifyingOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [verificationValue, setVerificationValue] = React.useState("")

  React.useEffect(() => {
    if (!loading && profile && profile.accountType !== 'Empresa') {
      router.push('/dashboard')
    }
  }, [profile, loading, router])

  const handleSaveBankDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const bankDetails = {
      bank: formData.get("bank") as string,
      branch: formData.get("branch") as string,
      account: formData.get("account") as string,
      accountName: formData.get("accountName") as string,
      cnpj: formData.get("cnpj") as string,
      pixKey: formData.get("pixKey") as string
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        bankDetails,
        verificationStatus: "pending_admin",
        updatedAt: serverTimestamp()
      })
      toast({ title: "Dados salvos!", description: "Iniciaremos o processo de verificação em breve." })
      setIsFormOpen(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmVerification = async () => {
    if (!db || !user || !verificationValue) return

    setIsSubmitting(true)
    try {
      const amount = parseFloat(verificationValue.replace(',', '.'))
      await updateDoc(doc(db, "users", user.uid), {
        verificationAmountInput: amount,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Valor enviado!", description: "Nossa equipe validará se o valor coincide com o depósito." })
      setIsVerifyingOpen(false)
      setVerificationValue("")
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao enviar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || salesLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
  }

  const vStatus = profile?.verificationStatus || "none"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Financeiro</h1>
        <p className="text-muted-foreground font-medium">Controle de receitas, taxas do plano {profile?.plan || 'START'} e valores líquidos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Saldo Líquido (A Receber)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(stats.netTotal)}</div>
            <p className="text-[10px] mt-2 font-bold opacity-40 uppercase">Total após taxas do plano</p>
          </CardContent>
          <Wallet className="absolute -bottom-2 -right-2 w-20 h-20 opacity-5 rotate-12" />
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Faturamento Bruto (Ingressos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{formatCurrency(stats.grossTotal)}</div>
            <div className="flex items-center gap-1 mt-2 text-red-500 text-[10px] font-black uppercase">
              Taxas descontadas: {formatCurrency(stats.fees)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ingressos Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats.count}</div>
            <p className="text-[10px] mt-2 font-bold text-muted-foreground uppercase">Base de pedidos</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ticket Médio (Bruto)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">
              {stats.count > 0 ? formatCurrency(stats.grossTotal / stats.count) : 'R$ 0,00'}
            </div>
            <p className="text-[10px] mt-2 font-bold text-muted-foreground uppercase">Média por venda</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              Detalhamento de Receitas
            </CardTitle>
            <CardDescription>Visualize o breakdown de cada ingresso vendido.</CardDescription>
          </CardHeader>
          <CardContent>
            {sales && sales.length > 0 ? (
               <div className="space-y-4">
                  {sales.slice(0, 10).map((sale: any) => (
                    <div key={sale.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border/50">
                       <div className="flex items-center gap-4">
                          <div className="p-2 bg-white rounded-lg border">
                             <Ticket className="w-4 h-4 text-secondary" />
                          </div>
                          <div>
                             <p className="text-sm font-bold truncate max-w-[200px]">{sale.eventTitle}</p>
                             <p className="text-[10px] font-medium text-muted-foreground">@{sale.userName}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-primary">{formatCurrency(sale.producerNetAmount)} LÍQUIDO</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Bruto: {formatCurrency(sale.ticketBasePrice)}</p>
                       </div>
                    </div>
                  ))}
               </div>
            ) : (
              <div className="py-10 text-center">
                <Landmark className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-10" />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhuma venda registrada ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-secondary/5 border-2 border-dashed border-secondary/20">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-secondary" />
              Conta para Recebimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Para receber os valores líquidos das vendas, configure sua conta bancária vinculada ao CNPJ do perfil.
            </p>
            
            <div className="p-4 bg-white rounded-2xl border border-secondary/10 flex items-center gap-4">
              <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                <Landmark className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tighter">Status Bancário</p>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px] uppercase font-black",
                    vStatus === 'verified' ? "bg-green-50 text-green-600 border-green-200" :
                    vStatus === 'waiting_user' ? "bg-blue-50 text-blue-600 border-blue-200" :
                    "bg-orange-50 text-orange-600 border-orange-200"
                  )}
                >
                  {vStatus === 'none' ? 'Pendente' :
                   vStatus === 'pending_admin' ? 'Em análise' :
                   vStatus === 'waiting_user' ? 'Aguardando Valor' :
                   'Verificada'}
                </Badge>
              </div>
            </div>

            {vStatus === 'none' && (
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-secondary text-white font-black rounded-xl h-12 shadow-lg">Configurar Recebimento</Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2rem] max-w-md">
                  <form onSubmit={handleSaveBankDetails} className="space-y-6">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Dados de Recebimento</DialogTitle>
                      <DialogDescription>Insira os dados da conta PJ para onde enviaremos seus ganhos.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Banco</Label>
                        <Input name="bank" placeholder="Ex: Itaú, Nubank, etc" required className="rounded-xl" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Agência</Label>
                          <Input name="branch" placeholder="0001" required className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Conta</Label>
                          <Input name="account" placeholder="12345-6" required className="rounded-xl" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Razão Social / Nome da Conta</Label>
                        <Input name="accountName" placeholder="Nome idêntico ao registro no banco" required className="rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">CNPJ</Label>
                        <Input name="cnpj" placeholder="00.000.000/0000-00" required className="rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Chave PIX (E-mail ou CNPJ)</Label>
                        <Input name="pixKey" placeholder="contato@empresa.com" required className="rounded-xl" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white font-black h-12 rounded-xl">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Salvar e Iniciar Verificação
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {vStatus === 'pending_admin' && (
              <div className="p-4 bg-muted/50 rounded-2xl border border-dashed border-border text-center space-y-2">
                <Clock className="w-6 h-6 mx-auto text-muted-foreground opacity-40" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">
                  Nossa equipe fará um depósito entre R$ 0,01 e R$ 0,51 em sua conta em até 48h para confirmar sua titularidade.
                </p>
              </div>
            )}

            {vStatus === 'waiting_user' && (
              <Dialog open={isVerifyingOpen} onOpenChange={setIsVerifyingOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary text-white font-black rounded-xl h-12 shadow-lg animate-pulse">Confirmar Valor Recebido</Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] max-w-sm">
                  <div className="space-y-6 text-center">
                    <DialogHeader>
                      <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-2">
                        <DollarSign className="w-8 h-8 text-secondary" />
                      </div>
                      <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Validar Conta</DialogTitle>
                      <DialogDescription>
                        Insira o valor exato que caiu na sua conta (ex: 0,32). O valor pode levar até 48h para aparecer no seu extrato.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-secondary">R$</span>
                        <Input 
                          placeholder="0,00" 
                          value={verificationValue}
                          onChange={(e) => setVerificationValue(e.target.value)}
                          className="text-center h-16 text-2xl font-black rounded-2xl pl-10 border-secondary/20"
                        />
                      </div>
                      <Button 
                        onClick={handleConfirmVerification} 
                        disabled={isSubmitting || !verificationValue}
                        className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl shadow-secondary/20 uppercase italic"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                        Enviar para Conferência
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {vStatus === 'verified' && (
              <div className="p-4 bg-green-50 rounded-2xl border border-green-200 flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-xs font-black text-green-800 uppercase">Conta Verificada</p>
                  <p className="text-[10px] text-green-700 font-medium">Seus repasses serão processados automaticamente.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center pt-8">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center justify-center gap-2 opacity-50">
          <Info className="w-4 h-4" /> Viby Financeiro opera em conformidade com as normas do BACEN
        </p>
      </div>
    </div>
  )
}
