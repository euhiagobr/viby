
"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs, limit, serverTimestamp, writeBatch } from "firebase/firestore"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, 
  Search, 
  CalendarDays, 
  ExternalLink, 
  Trash2,
  Edit2,
  MapPin,
  Clock,
  RefreshCcw,
  AlertTriangle,
  TicketPercent
} from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"

export default function AdminEventoCuponsPage() {
  const { id } = useParams<{ id: string }>()
  const db = useFirestore()
  const [search, setSearch] = React.useState("")
  const [isProcessing, setIsProcessing] = React.useState(false)

  const couponsQuery = useMemoFirebase(() => {
    if (!db || !id) return null
    // Assuming coupons are stored in a 'coupons' collection with an 'eventId' field
    return query(
      collection(db, "coupons"), 
      where("eventId", "==", id), 
      orderBy("createdAt", "desc")
    )
  }, [db, id])

  const { data: coupons, loading } = useCollection<any>(couponsQuery)

  const filteredCoupons = React.useMemo(() => {
    if (!coupons) return []
    return coupons.filter(coupon => 
      coupon.code?.toLowerCase().includes(search.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(search.toLowerCase())
    )
  }, [coupons, search])

  const handleDeleteCoupon = async (couponId: string, couponCode: string) => {
    if (!db) return
    if (!confirm(`Tem certeza que deseja remover o cupom "${couponCode}"?`)) return

    setIsProcessing(true)
    try {
      await deleteDoc(doc(db, "coupons", couponId));
      toast({ title: "Cupom removido com sucesso!" });
    } catch (error: any) {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `coupons/${couponId}`,
        operation: "delete",
      }))
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "---";
    try {
      let d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString('pt-BR');
    } catch (e) { return "---"; }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="bg-white border-b pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <TicketPercent className="w-5 h-5 text-secondary" />
              Gerenciador de Cupons
            </CardTitle>
            <CardDescription>Total de {filteredCoupons.length} cupons cadastrados para este evento.</CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por código ou descrição..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2">
             <Button asChild>
               <Link href={`/admin/eventos/${id}/cupons/novo`}>
                 Criar Novo Cupom
               </Link>
             </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[200px] font-bold">Código</TableHead>
              <TableHead className="font-bold">Descrição</TableHead>
              <TableHead className="font-bold text-center">Tipo</TableHead>
              <TableHead className="font-bold text-center">Valor</TableHead>
              <TableHead className="font-bold text-center">Validade</TableHead>
              <TableHead className="text-right font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCoupons.length > 0 ? (
              filteredCoupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <span className="font-bold text-sm">{coupon.code}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{coupon.description}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">
                      {coupon.type === 'percentage' ? 'Porcentagem' : coupon.type === 'fixed' ? 'Valor Fixo' : 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : `R$ ${coupon.value.toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-center">
                    {coupon.expiresAt ? formatDate(coupon.expiresAt) : "Indefinido"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/admin/eventos/${id}/cupons/${coupon.id}/editar`}>
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        disabled={isProcessing}
                        onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                  Nenhum cupom encontrado para este evento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
