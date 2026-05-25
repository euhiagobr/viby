
"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy } from "firebase/firestore"
import { Loader2, ArrowLeft, Share2, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/CartContext"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Componentes da Refatoração
import { EventHero } from "@/components/events/public/EventHero"
import { OrganizerInfo } from "@/components/events/public/OrganizerInfo"
import { EventDescription } from "@/components/events/public/EventDescription"
import { EventLocation } from "@/components/events/public/EventLocation"
import { TicketSection } from "@/components/events/public/TicketSection"
import { CheckoutSidebar } from "@/components/events/public/CheckoutSidebar"
import { MobileCheckout } from "@/components/events/public/MobileCheckout"
import { ReportDialog } from "@/components/events/public/ReportDialog"

export default function EventoPublicoPage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { addItem } = useCart()
  
  const eventId = params.id as string
  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)

  // Busca setores do mapa
  const setoresQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "setores"), orderBy("zIndex", "asc"))
  }, [db, eventId])
  const { data: setores, loading: setoresLoading } = useCollection<any>(setoresQuery)

  // Busca parceiros (Co-organizadores)
  const partnersQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "partners"), where("status", "==", "accepted"))
  }, [db, eventId])
  const { data: partners } = useCollection<any>(partnersQuery)

  // Estado de Seleção
  const [selectedSector, setSelectedSector] = React.useState<any>(null)
  const [selectedSeat, setSelectedSeat] = React.useState<any>(null)
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null)
  const [quantity, setQuantity] = React.useState(1)
  const [isReportOpen, setIsReportOpen] = React.useState(false)

  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!event) return null

  const handleAddToCart = () => {
    if (!selectedTicketType) {
      toast({ variant: "destructive", title: "Selecione um ingresso" });
      return;
    }

    if (selectedSector && (selectedSector.tipo === 'assentos' || selectedSector.tipo === 'mesas') && !selectedSeat) {
      toast({ variant: "destructive", title: "Selecione um lugar no mapa" });
      return;
    }

    const batch = selectedTicketType._batch;

    addItem({
      id: `${event.id}_${batch.id}_${selectedTicketType.id}_${selectedSector?.id || 'global'}_${selectedSeat?.id || 'any'}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId || event.createdBy,
      organizerUsername: params.username as string,
      ticketTypeId: selectedTicketType.id,
      ticketTypeName: selectedTicketType.name,
      batchId: batch.id,
      batchName: batch.name,
      price: selectedTicketType.price,
      quantity: quantity,
      requiresProof: selectedTicketType.requiresProof || false,
      sectorId: selectedSector?.id,
      sectorName: selectedSector?.nome || selectedSector?.name,
      poolId: selectedTicketType.poolId,
      poolName: selectedTicketType.poolName,
      // @ts-ignore
      seatId: selectedSeat?.id,
      seatCode: selectedSeat?.codigo
    });

    toast({ title: "Adicionado ao carrinho!" });
    if (selectedSeat) setSelectedSeat(null);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-body antialiased selection:bg-secondary/20 selection:text-secondary">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="rounded-full hover:bg-muted font-bold text-[10px] uppercase tracking-widest gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copiado!" }); }}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => setIsReportOpen(true)}>
              <Flag className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full pt-16">
        <EventHero event={event} />

        <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-20">
            <div className="lg:col-span-8 space-y-16">
              <div className="space-y-10">
                <OrganizerInfo organizer={event.organizer} />
                {partners && partners.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">Co-realização</p>
                    <div className="flex flex-wrap gap-4">
                      {partners.map((p: any) => (
                        <Link key={p.id} href={`/${p.username || p.uid}`} className="flex items-center gap-2 bg-muted/30 p-2 pr-4 rounded-full hover:bg-muted transition-colors border border-border/40">
                          <Avatar className="h-8 w-8 border border-white">
                            <AvatarImage src={p.avatar} />
                            <AvatarFallback className="text-[10px] font-bold">{p.orgName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold uppercase tracking-tight">{p.orgName}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator className="opacity-50" />
              <EventDescription description={event.description} />
              <Separator className="opacity-50" />
              <EventLocation address={event.address} location={event.location} city={event.city} eventId={event.id} />

              <section id="tickets" className="pt-8">
                 <TicketSection 
                   event={event} 
                   setores={setores} 
                   selectedSector={selectedSector}
                   setSelectedSector={setSelectedSector}
                   selectedSeat={selectedSeat}
                   setSelectedSeat={setSelectedSeat}
                   selectedTicketType={selectedTicketType}
                   setSelectedTicketType={setSelectedTicketType}
                   quantity={quantity}
                   setQuantity={setQuantity}
                 />
              </section>
            </div>

            <aside className="hidden lg:block lg:col-span-4">
               <div className="sticky top-24 space-y-6">
                  <CheckoutSidebar 
                    event={event} 
                    selectedTicketType={selectedTicketType}
                    quantity={quantity}
                    selectedSector={selectedSector}
                    selectedSeat={selectedSeat}
                    onConfirm={handleAddToCart}
                  />
               </div>
            </aside>
          </div>
        </div>
      </main>

      <MobileCheckout 
        event={event}
        selectedTicketType={selectedTicketType}
        quantity={quantity}
        onConfirm={handleAddToCart}
      />

      <ReportDialog 
        isOpen={isReportOpen} 
        onOpenChange={setIsReportOpen} 
        eventId={eventId} 
        eventTitle={event.title}
        userId={user?.uid}
      />
    </div>
  )
}

function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />
}

function Avatar({ className, children }: { className?: string, children: React.ReactNode }) {
  return <div className={cn("relative flex shrink-0 overflow-hidden rounded-full", className)}>{children}</div>
}

function AvatarImage({ src, className }: { src?: string, className?: string }) {
  return <img src={src} className={cn("aspect-square h-full w-full object-cover", className)} />
}

function AvatarFallback({ className, children }: { className?: string, children: React.ReactNode }) {
  return <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground", className)}>{children}</div>
}
