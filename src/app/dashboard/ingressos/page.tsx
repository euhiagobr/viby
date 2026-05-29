
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, or, serverTimestamp } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  Ticket, 
  Calendar, 
  User as UserIcon,
  CheckCircle2,
  History,
  QrCode,
  Mail,
  RotateCcw
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { sendTicketEmail } from "@/app/actions/email"

export default function MeusIngressosPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  // Filtramos apenas ingressos pagos ou disponíveis (gratuitos)
  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "registrations"), 
      where("userId", "==", user.uid),
      where("paymentStatus", "in", ["Pago", "Disponível"])
    )
  }, [db, user])

  const { data: registrations, loading: regLoading } = useCollection<any>(registrationsQuery)

  if (regLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  const myOwned = (registrations || []).sort((a, b) => {
    const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
    const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meus Ingressos</h1>
        <p className="text-muted-foreground font-medium">Sua coleção de experiências confirmadas.</p>
      </div>

      {myOwned.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-border gap-6 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Ticket className="w-10 h-10 text-muted-foreground opacity-30" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-bold">Nenhum ingresso confirmado.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Vouchers aparecem aqui apenas após a confirmação do pagamento.</p>
          </div>
          <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg">
            <Link href="/dashboard">Explorar Eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {myOwned.map((reg) => (
            <TicketListItem key={reg.id} registration={reg} />
          ))}
        </div>
      )}
    </div>
  )
}

function TicketListItem({ registration }: { registration: any }) {
  const auth = useAuth()
  const { user } = useUser(auth)
  const [isSendingEmail, setIsSendingEmail] = React.useState(false)

  const handleResendEmail = async () => {
    if (!registration || !user?.email) return
    setIsSendingEmail(true)
    try {
      const d = registration.eventDate?.toDate ? registration.eventDate.toDate() : new Date(registration.eventDate);
      await sendTicketEmail({
        to: user.email,
        userName: registration.userName || "Participante",
        eventTitle: registration.eventTitle,
        ticketCode: registration.ticketCode,
        eventDate: d.toLocaleString('pt-BR'),
        voucherUrl: `https://viby.club/dashboard/ingressos/${registration.id}/voucher`
      });
      toast({ title: "E-mail enviado!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no envio" });
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-[1.5rem] bg-white flex flex-col sm:flex-row group">
      <div className="relative w-full sm:w-44 h-40 sm:h-auto bg-muted">
        <Image src={registration.eventImage || "https://picsum.photos/seed/event/600/400"} alt="Evento" fill className="object-cover" unoptimized />
        <div className="absolute bottom-3 left-3">
           <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase px-3">Confirmado</Badge>
        </div>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <h3 className="font-black text-lg leading-tight uppercase italic tracking-tighter group-hover:text-secondary transition-colors">
            {registration.eventTitle}
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-tight">
             <Calendar className="w-3.5 h-3.5 text-secondary" />
             {new Date(registration.eventDate?.seconds * 1000 || registration.eventDate).toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/60">
          <span className="text-sm font-black text-primary">{formatCurrency(registration.price || 0)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleResendEmail} disabled={isSendingEmail} className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-secondary text-secondary">
              {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            </Button>
            <Button size="sm" className="h-9 px-4 text-[10px] font-black uppercase rounded-xl bg-primary text-white" asChild>
              <Link href={`/dashboard/ingressos/${registration.id}/voucher`}><QrCode className="w-3.5 h-3.5 mr-1.5" /> Voucher</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
