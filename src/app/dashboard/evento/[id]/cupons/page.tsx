
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { 
  TicketPercent, 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  Hash,
  Tag,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function EventCuponsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const eventRef = React.useMemo(() => (db && eventId) ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  const cuponsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "coupons"), where("eventId", "==", eventId))
  }, [db, eventId])

  const { data: cupons, loading: cuponsLoading } = useCollection<any>(cuponsQuery)

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleCreateCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !eventId) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const couponData = {
      code: (formData.get("code") as string).toUpperCase().replace(/\s+/g, ""),
      discountType: formData.get("discountType") as string,
      discountValue: parseFloat(formData.get("discountValue") as string),
      maxUses: parseInt(formData.get("maxUses") as string) || 0,
      currentUses: 0,
      eventId: eventId,
      organizerId: user.uid,
      validFrom: formData.get("validFrom") as string,
      validUntil: formData.get("validUntil") as string,
      status: "Ativo",
      createdAt: serverTimestamp()
    }

    try {
      await addDoc(collection(db, "coupons"), couponData)
      toast({ title: "Cupom criado!", description: `O cupom ${couponData.code} foi ativado.` })
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCoupon = async (id: string) => {
    if (!db) return
    if (!confirm("Deseja remover este cupom permanentemente?")) return

    try {
      await deleteDoc(doc(db, "coupons", id))
      toast({ title: "Cupom removido" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
  }

  if (eventLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!event) return null

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/projetos"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cupons de Desconto</h1>
            <p className="text-muted-foreground line-clamp-1">{event.title}</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold gap-2 bg-secondary text-white shadow-lg">
              <Plus className="w-4 h-4" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <form onSubmit={handleCreateCoupon}>
              <DialogHeader>
                <DialogTitle>Criar Novo Cupom</DialogTitle>
                <DialogDescription>Configure as regras de desconto para seu evento.</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código do Cupom</Label>
                  <Input id="code" name="code" placeholder="Ex: VIBY2024" required className="rounded-xl uppercase font-bold" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Desconto</Label>
                    <Select name="discountType" defaultValue="percentage">
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountValue">Valor</Label>
                    <Input id="discountValue" name="discountValue" type="number" step="0.01" placeholder="0.00" required className="rounded-xl" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxUses">Limite de Uso (Opcional)</Label>
                  <Input id="maxUses" name="maxUses" type="number" placeholder="Deixe vazio para ilimitado" className="rounded-xl" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início da Validade</Label>
                    <Input name="validFrom" type="datetime-local" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim da Validade</Label>
                    <Input name="validUntil" type="datetime-local" className="rounded-xl" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-secondary text-white font-bold h-12 rounded-xl" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Ativar Cupom
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cuponsLoading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
        ) : cupons && cupons.length > 0 ? (
          cupons.map((coupon: any) => (
            <Card key={coupon.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-2xl bg-white border-l-4 border-secondary group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary group-hover:text-white transition-colors">
                    <TicketPercent className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-black uppercase",
                    coupon.status === 'Ativo' ? "border-green-500 text-green-600" : "border-muted text-muted-foreground"
                  )}>
                    {coupon.status}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black mt-3 italic tracking-tighter uppercase">{coupon.code}</CardTitle>
                <CardDescription className="text-xs font-bold text-secondary">
                  {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `R$ ${coupon.discountValue.toFixed(2)} OFF`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-y border-dashed border-border">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Usos</p>
                    <div className="flex items-center gap-1.5 text-sm font-bold">
                      <Users className="w-3.5 h-3.5 text-secondary" />
                      {coupon.currentUses} / {coupon.maxUses || '∞'}
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Expira em</p>
                    <p className="text-xs font-bold">
                      {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('pt-BR') : 'Sem expiração'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 h-9 rounded-xl text-destructive hover:bg-destructive/10 font-bold gap-2 text-[10px] uppercase"
                    onClick={() => handleDeleteCoupon(coupon.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-border shadow-inner">
            <TicketPercent className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Nenhum cupom ativo para este evento.</p>
            <Button variant="link" className="mt-2 text-secondary font-bold" onClick={() => setIsDialogOpen(true)}>Criar meu primeiro cupom</Button>
          </div>
        )}
      </div>
    </div>
  )
}
