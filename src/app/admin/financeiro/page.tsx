
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, orderBy } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Landmark, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  CreditCard,
  DollarSign,
  User,
  ExternalLink,
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
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function AdminFinanceiroPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

  const companiesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "users"), 
      where("accountType", "==", "Empresa")
    )
  }, [db])

  const { data: users, loading } = useCollection<any>(companiesQuery)

  const filteredUsers = React.useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      (u.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (u.legalName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (u.cnpj?.toLowerCase() || "").includes(search.toLowerCase())
    )
  }, [users, search])

  const [isDepositModalOpen, setIsDepositModalOpen] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<any>(null)
  const [depositAmount, setDepositAmount] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSignalDeposit = async () => {
    if (!db || !selectedUser || !depositAmount) return
    
    const amount = parseFloat(depositAmount.replace(',', '.'))
    if (isNaN(amount) || amount < 0.01 || amount > 0.51) {
      toast({ variant: "destructive", title: "Valor inválido", description: "O valor deve ser entre R$ 0,01 e R$ 0,51." })
      return
    }

    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, "users", selectedUser.id), {
        verificationAmountSent: amount,
        verificationStatus: "waiting_user",
        updatedAt: serverTimestamp()
      })
      toast({ title: "Depósito Sinalizado!", description: "O usuário agora pode inserir o valor no painel dele." })
      setIsDepositModalOpen(false)
      setSelectedUser(null)
      setDepositAmount("")
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleValidateVerification = async (user: any) => {
    if (!db) return
    
    const sent = user.verificationAmountSent
    const input = user.verificationAmountInput

    if (!input) {
      toast({ variant: "destructive", title: "Erro", description: "O usuário ainda não informou o valor recebido." })
      return
    }

    if (Math.abs(sent - input) < 0.001) {
      setIsSubmitting(true)
      try {
        await updateDoc(doc(db, "users", user.id), {
          verificationStatus: "verified",
          updatedAt: serverTimestamp()
        })
        toast({ title: "Conta Verificada!", description: `A conta de ${user.name} foi validada com sucesso.` })
      } catch (e) {
        toast({ variant: "destructive", title: "Erro na validação" })
      } finally {
        setIsSubmitting(false)
      }
    } else {
      toast({ 
        variant: "destructive", 
        title: "Divergência de Valores", 
        description: `O valor informado (R$ ${input.toFixed(2)}) não coincide com o enviado (R$ ${sent.toFixed(2)}).` 
      })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão Financeira</h1>
        <p className="text-muted-foreground">Monitore e valide as contas bancárias para repasses dos organizadores.</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Landmark className="w-5 h-5 text-secondary" />
                Verificação de Contas PJ
              </CardTitle>
              <CardDescription>Total de {filteredUsers.length} empresas monitoradas.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Razão Social, CNPJ ou Nome..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : filteredUsers.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold">Empresa / Titular</TableHead>
                  <TableHead className="font-bold">Dados Bancários</TableHead>
                  <TableHead className="font-bold text-center">Micro-depósito</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="text-right font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm">{user.legalName || user.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{user.cnpj || "Sem CNPJ"}</span>
                        <Badge variant="outline" className="w-fit text-[8px] font-black uppercase">{user.username}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.bankDetails ? (
                        <div className="flex flex-col text-[11px] font-medium text-muted-foreground">
                          <span className="font-bold text-foreground">{user.bankDetails.bank}</span>
                          <span>Ag: {user.bankDetails.branch} | Cta: {user.bankDetails.account}</span>
                          <span className="truncate max-w-[150px]">PIX: {user.bankDetails.pixKey}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground/50">Não configurado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                         <div className="flex items-center gap-2">
                           <div className="flex flex-col">
                             <span className="text-[9px] font-black uppercase text-muted-foreground">Enviado</span>
                             <span className="font-bold text-xs">{user.verificationAmountSent ? `R$ ${user.verificationAmountSent.toFixed(2)}` : '---'}</span>
                           </div>
                           <div className="w-px h-6 bg-border mx-1" />
                           <div className="flex flex-col">
                             <span className="text-[9px] font-black uppercase text-muted-foreground">Input</span>
                             <span className={cn(
                               "font-bold text-xs",
                               user.verificationAmountInput ? "text-primary" : "text-muted-foreground/30"
                             )}>
                               {user.verificationAmountInput ? `R$ ${user.verificationAmountInput.toFixed(2)}` : '---'}
                             </span>
                           </div>
                         </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[10px] font-bold uppercase",
                        user.verificationStatus === 'verified' ? "bg-green-500" :
                        user.verificationStatus === 'waiting_user' ? "bg-blue-500" :
                        user.verificationStatus === 'pending_admin' ? "bg-orange-500" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {user.verificationStatus === 'none' ? 'Inativo' :
                         user.verificationStatus === 'pending_admin' ? 'Pendente' :
                         user.verificationStatus === 'waiting_user' ? 'Aguardando' :
                         'Verificado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.verificationStatus === 'pending_admin' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-[9px] font-black uppercase gap-1.5"
                            onClick={() => { setSelectedUser(user); setIsDepositModalOpen(true); }}
                          >
                            <DollarSign className="w-3 h-3" /> Sinalizar Depósito
                          </Button>
                        )}
                        {user.verificationStatus === 'waiting_user' && user.verificationAmountInput && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="h-8 bg-green-600 text-white text-[9px] font-black uppercase gap-1.5"
                            onClick={() => handleValidateVerification(user)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Validar Conta
                          </Button>
                        )}
                        {user.verificationStatus === 'verified' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-20 text-center">
              <Landmark className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium italic">Nenhum organizador empresa encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="rounded-[2rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Sinalizar Micro-depósito</DialogTitle>
            <DialogDescription>
              Informe o valor exato que você transferiu para <strong>{selectedUser?.legalName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Valor Enviado (R$ 0,01 a 0,51)</Label>
              <Input 
                placeholder="0,32" 
                value={depositAmount} 
                onChange={(e) => setDepositAmount(e.target.value)}
                className="text-2xl font-black h-16 text-center rounded-2xl"
              />
            </div>
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
              <p className="text-[10px] text-orange-800 font-medium">Este valor será a "chave" para o usuário validar a conta dele. Só sinalize após realizar a transferência.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDepositModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button 
              onClick={handleSignalDeposit} 
              disabled={isSubmitting || !depositAmount} 
              className="bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-6"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Sinalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
