
"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore"
import { 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updatePassword, 
  signOut 
} from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Loader2, 
  ArrowLeft, 
  Lock as LockIcon, 
  ShieldAlert, 
  EyeOff, 
  Trash2, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Building2,
  Coins
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrency, CurrencyCode } from "@/contexts/CurrencyContext"

export default function ConfiguraçõesContaPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const { currency, setCurrency } = useCurrency()

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const [isProcessing, setIsProcessing] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  
  const [isActionModalOpen, setIsActionModalOpen] = useState<'deactivate' | 'delete' | null>(null)
  const [actionPassword, setActionPassword] = useState("")

  const handleReauthenticate = async (password: string) => {
    if (!auth?.currentUser || !password) return false
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, password)
      await reauthenticateWithCredential(auth.currentUser, credential)
      return true
    } catch (e) {
      toast({ variant: "destructive", title: "Senha incorreta", description: "Verifique sua senha atual e tente novamente." })
      return false
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth?.currentUser || isProcessing) return

    setIsProcessing(true)
    const authenticated = await handleReauthenticate(currentPassword)
    
    if (authenticated) {
      try {
        await updatePassword(auth.currentUser, newPassword)
        toast({ title: "Senha atualizada!", description: "Sua nova senha já está em vigor." })
        setCurrentPassword("")
        setNewPassword("")
      } catch (e: any) {
        toast({ variant: "destructive", title: "Erro ao atualizar", description: e.message })
      }
    }
    setIsProcessing(false)
  }

  const handleDeactivateAccount = async () => {
    if (!db || !user || !auth || isProcessing) return
    
    setIsProcessing(true)
    const authenticated = await handleReauthenticate(actionPassword)
    
    if (authenticated) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          status: 'Desativado',
          deactivatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        toast({ title: "Conta Desativada", description: "Seu perfil foi ocultado. Até logo!" })
        await signOut(auth)
        router.push("/login")
      } catch (e) {
        toast({ variant: "destructive", title: "Erro na operação" })
      }
    }
    setIsProcessing(false)
  }

  const handleScheduleDeletion = async () => {
    if (!db || !user || !auth || isProcessing) return

    setIsProcessing(true)
    const authenticated = await handleReauthenticate(actionPassword)
    
    if (authenticated) {
      try {
        const deletionDate = new Date()
        deletionDate.setDate(deletionDate.getDate() + 30)

        await updateDoc(doc(db, "users", user.uid), {
          status: 'Exclusão Programada',
          deletionScheduledAt: deletionDate.toISOString(),
          updatedAt: serverTimestamp()
        })

        toast({ title: "Exclusão Programada", description: "Sua conta será apagada em 30 dias. Para cancelar, basta fazer login novamente." })
        await signOut(auth)
        router.push("/login")
      } catch (e) {
        toast({ variant: "destructive", title: "Erro na operação" })
      }
    }
    setIsProcessing(false)
  }

  if (profileLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-secondary" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/perfil"><ArrowLeft className="w-5 h-5" /></Link></Button>
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Segurança e Conta</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          {/* MOEDA PREFERIDA */}
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 p-8">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                 <Coins className="w-5 h-5 text-secondary" /> Moeda de Exibição
               </CardTitle>
               <CardDescription className="font-medium">Defina a moeda em que deseja ver todos os preços na plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60">Sua Moeda Preferida</Label>
                     <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
                        <SelectTrigger className="rounded-xl h-12">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                           <SelectItem value="BRL">Real Brasileiro (R$)</SelectItem>
                           <SelectItem value="USD">US Dollar ($)</SelectItem>
                           <SelectItem value="EUR">Euro (€)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="p-4 bg-secondary/5 rounded-2xl flex gap-3 border border-secondary/10">
                     <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                     <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed">
                        Os valores originais permanecem em BRL no sistema. A conversão é dinâmica baseada na cotação do momento.
                     </p>
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* TROCA DE SENHA */}
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 p-8">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                 <LockIcon className="w-5 h-5 text-secondary" /> Alterar Senha
               </CardTitle>
               <CardDescription className="font-medium">Mantenha sua conta protegida com uma senha forte.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
               <form onSubmit={handleChangePassword} className="space-y-6">
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Senha Atual</Label>
                        <Input 
                          type="password" 
                          value={currentPassword} 
                          onChange={e => setCurrentPassword(e.target.value)} 
                          placeholder="••••••••" 
                          className="rounded-xl h-11"
                          required 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nova Senha</Label>
                        <Input 
                          type="password" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          placeholder="Mínimo 6 caracteres" 
                          className="rounded-xl h-11"
                          required 
                        />
                     </div>
                  </div>
                  <Button type="submit" disabled={isProcessing || !newPassword || newPassword.length < 6} className="w-full bg-primary text-white font-black h-12 rounded-xl shadow-lg uppercase italic">
                     {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Atualizar Senha"}
                  </Button>
               </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-8">
           {/* ZONA DE PERIGO */}
           <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border-t-8 border-destructive/20">
              <CardHeader className="bg-destructive/5 p-8">
                 <CardTitle className="text-lg font-black uppercase italic tracking-tighter text-destructive flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" /> Zona de Perigo
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-1">
                    <p className="font-bold text-sm">Desativar Perfil</p>
                    <p className="text-[10px] text-muted-foreground uppercase leading-tight">Oculta seu perfil público e gamificação instantaneamente. Você será desconectado.</p>
                    <Button 
                      variant="outline" 
                      onClick={() => { setIsActionModalOpen('deactivate'); setActionPassword(""); }}
                      className="w-full mt-3 h-10 rounded-xl font-bold uppercase text-[10px] border-secondary/20 text-secondary hover:bg-secondary/5"
                    >
                      Desativar Temporariamente
                    </Button>
                 </div>

                 <Separator className="border-dashed" />

                 <div className="space-y-1">
                    <p className="font-bold text-sm text-destructive">Excluir Conta</p>
                    <p className="text-[10px] text-muted-foreground uppercase leading-tight">Agenda a remoção permanente de todos os seus dados em 30 dias.</p>
                    <Button 
                      variant="ghost" 
                      onClick={() => { setIsActionModalOpen('delete'); setActionPassword(""); }}
                      className="w-full mt-3 h-10 rounded-xl font-black uppercase text-[10px] text-destructive hover:bg-destructive/10"
                    >
                      Excluir Minha Conta
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>

      <Dialog open={!!isActionModalOpen} onOpenChange={() => setIsActionModalOpen(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-sm">
           <DialogHeader>
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2 text-destructive">
                 <AlertTriangle className="w-8 h-8" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">
                 {isActionModalOpen === 'deactivate' ? 'Confirmar Desativação' : 'Confirmar Exclusão'}
              </DialogTitle>
              <DialogDescription className="text-center font-medium">
                 {isActionModalOpen === 'deactivate' 
                   ? 'Seu perfil ficará invisível até o próximo login.' 
                   : 'Sua conta será marcada para deleção definitiva em 30 dias.'}
              </DialogDescription>
           </DialogHeader>
           <div className="space-y-6 py-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><LockIcon className="w-3 h-3" /> Sua Senha Atual</Label>
                 <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={actionPassword}
                    onChange={e => setActionPassword(e.target.value)}
                    className="h-12 rounded-xl"
                    required
                 />
              </div>
           </div>
           <DialogFooter>
              <Button 
                onClick={isActionModalOpen === 'deactivate' ? handleDeactivateAccount : handleScheduleDeletion} 
                disabled={isProcessing || !actionPassword} 
                className="w-full bg-destructive text-white font-black h-14 rounded-2xl shadow-xl uppercase italic"
              >
                 {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Confirmar Ação"}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
