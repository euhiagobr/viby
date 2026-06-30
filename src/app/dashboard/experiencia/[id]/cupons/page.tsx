"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useCollection, useMemoFirebase, useAuth, useUser } from "@/firebase"
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from "firebase/firestore"
import { 
  TicketPercent, 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowLeft, 
  CheckCircle2, 
  Gift,
  Inbox
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

export default function ExperienciaCuponsPage() {
  const params = useParams()
  const router = useRouter()
  const expId = params.id as string
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const expRef = React.useMemo(() => (db && expId) ? doc(db, "experiences", expId) : null, [db, expId])
  const { data: experience, loading: expLoading } = useDoc<any>(expRef)

  const cuponsQuery = useMemoFirebase(() => {
    if (!db || !expId) return null
    return query(collection(db, "coupons"), where("eventId", "==", expId), orderBy("createdAt", "desc"))
  }, [db, expId])

  const { data: cupons, loading: cuponsLoading } = useCollection<any>(cuponsQuery)

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedDiscountType, setSelectedDiscountType] = React.useState("percentage")

  const handleCreateCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user || !expId) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const discountType = formData.get("discountType") as string
    const discountValue = discountType === "free_ticket" ? 100 : parseFloat(formData.get("discountValue") as string)

    const couponData = {
      code: (formData.get("code") as string).toUpperCase().replace(/\s+/g, ""),
      discountType,
      discountValue,
      maxUses: parseInt(formData.get("maxUses") as string) || 0,
      currentUses: 0,
      eventId: expId, // Usamos o campo eventId para manter compatibilidade no carrinho
      organizerId: user.uid,
      validFrom: formData.get("validFrom") as string || null,
      validUntil: formData.get("validUntil") as string || null,
      status: "Ativo",
      createdAt: serverTimestamp()
    }

    try {
      await addDoc(collection(db, "coupons"), couponData)
      toast({ title: "Cupom criado!", description: `O código ${couponData.code} foi ativado para esta experiência.` })
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

  if (expLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!experience) return null

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cupons de Desconto</h1>
            <p className="text-muted-foreground line-clamp-1">{experience.title}</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold gap-2 bg-secondary text-white shadow-lg h-11 px-6 uppercase italic">
              <Plus className="w-4 h-4" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2rem]">
            <form onSubmit={handleCreateCoupon}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Criar Cupom</DialogTitle>
                <DialogDescription>Defina as regras de desconto para sua experiência.</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-[10px] font-black uppercase opacity-60">Código (Ex: VIBY10)</Label>
                  <Input id="code" name="code" placeholder="CÓDIGO" required className="rounded-xl uppercase font-black" />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Tipo de Benefício</Label>
                    <Select name="discountType" defaultValue="percentage" onValueChange={setSelectedDiscountType}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="percentage">Porcentagem (%) OFF</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$) OFF</SelectItem>
                        <SelectItem value="free_ticket">Cortesia (100% OFF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedDiscountType !== "free_ticket" && (
                    <div className="space-y-2">
                      <Label htmlFor="discountValue" className="text-[10px] font-black uppercase opacity-60">Valor</Label>
                      <Input id="discountValue" name="discountValue" type="number" step="0.01" required className="rounded-xl h-11" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxUses" className="text-[10px] font-black uppercase opacity-60">Limite Global de Usos</Label>
                  <Input id="maxUses" name="maxUses" type="number" placeholder="Opcional" className="rounded-xl h-11" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Início</Label>
                    <Input name="validFrom" type="datetime-local" className="rounded-xl text-xs h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Expiração</Label>
                    <Input name="validUntil" type="datetime-local" className="rounded-xl text-xs h-11" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-secondary text-white font-black h-14 rounded-2xl shadow-xl uppercase italic" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Ativar Código"}
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
            <Card key={coupon.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[2rem] bg-white border-l-4 border-secondary group">
              <CardHeader className="p-6">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 bg-secondary/10 rounded-xl group-hover:bg-secondary group-hover:text-white transition-colors">
                    <TicketPercent className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-black uppercase",
                    coupon.status === 'Ativo' ? "border-green-500 text-green-600" : "border-muted text-muted-foreground"
                  )}>
                    {coupon.status}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black mt-4 italic tracking-tighter uppercase">{coupon.code}</CardTitle>
                <CardDescription className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                  {coupon.discountType === 'percentage' ? `${coupon.discountValue}% de Desconto` : 
                   coupon.discountType === 'fixed' ? `R$ ${coupon.discountValue.toFixed(2)} de Desconto` : 
                   "Cortesia (100% OFF)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-6">
                <Separator className="border-dashed" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black uppercase opacity-40">Uso Total</p>
                    <div className="text-sm font-bold">{coupon.currentUses} / {coupon.maxUses || '∞'}</div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                    onClick={() => handleDeleteCoupon(coupon.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 opacity-40 italic">
            <Inbox className="w-12 h-12" />
            <p className="text-xs font-black uppercase tracking-widest">Nenhum cupom ativo nesta experiência.</p>
          </div>
        )}
      </div>
    </div>
  )
}
