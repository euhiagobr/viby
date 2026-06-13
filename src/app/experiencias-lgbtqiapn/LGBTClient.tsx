"use client"

import * as React from "react"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, where, orderBy } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { PublicHeader } from "@/components/layout/PublicHeader"
import Footer from "@/components/layout/Footer"
import { Badge } from "@/components/ui/badge"
import { Loader2, Inbox, Sparkles, FilterX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, normalizeText } from "@/lib/utils"

const LGBT_CATEGORY_IDS = [
  "bNr5g766mc0vGskU1RBq",
  "bnxzzfbroJjdEjwlBfy0"
]

const LGBT_TAGS = [
  "lgbt", "lgbtqiapn", "lgbtqia+", "gay", "lesbica", "lésbica", 
  "bissexual", "bi", "trans", "travesti", "transgenero", "queer", 
  "diversidade", "pride", "parada lgbt"
]

export default function LGBTClient({ initialEvents = [] }: { initialEvents: any[] }) {
  const db = useFirestore()
  const [filter, setFilter] = React.useState("all")

  const eventsQuery = React.useMemo(() => {
    if (!db) return null
    return query(collection(db, "events"), where("status", "==", "Ativo"), orderBy("date", "asc"))
  }, [db])

  const { data: rawEvents, loading } = useCollection<any>(eventsQuery)
  
  const displayEvents = React.useMemo(() => {
    const source = rawEvents?.length > 0 ? rawEvents : initialEvents;
    
    return source.filter(event => {
      const byCategory = LGBT_CATEGORY_IDS.includes(event.categoryId)
      const byTags = event.tags?.some((tag: string) => 
        LGBT_TAGS.includes(tag.toLowerCase())
      )
      
      const isLGBT = byCategory || byTags
      if (!isLGBT) return false

      if (filter === 'festas') return normalizeText(event.title || "").includes("festa") || normalizeText(event.description || "").includes("balada")
      if (filter === 'cultura') return event.categoryName?.toLowerCase().includes("cultura")
      if (filter === 'gratis') return event.startingPrice === 0 || event.isFree === true
      
      return true
    })
  }, [rawEvents, initialEvents, filter])

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <PublicHeader />

      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden animate-rainbow-bg">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <div className="container mx-auto px-4 relative z-10 text-center text-white space-y-6">
          <Badge className="bg-white/20 backdrop-blur-md text-white border-white/20 px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest animate-bounce">
            Espaço de Diversidade
          </Badge>
          <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-none shadow-sm">
            Experiências <span className="text-secondary">LGBTQIAPN+</span>
          </h1>
          <p className="text-lg md:text-2xl font-medium max-w-2xl mx-auto opacity-90 leading-relaxed uppercase tracking-wide">
            Eventos, celebrações e espaços de diversidade para viver o agora.
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-16 flex-1 space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-primary">Agenda da Diversidade</h2>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Encontre o seu próximo rolê.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Tudo</FilterButton>
            <FilterButton active={filter === 'festas'} onClick={() => setFilter('festas')}>Festas</FilterButton>
            <FilterButton active={filter === 'cultura'} onClick={() => setFilter('cultura')}>Cultura</FilterButton>
            <FilterButton active={filter === 'gratis'} onClick={() => setFilter('gratis')}>Gratuitos</FilterButton>
          </div>
        </div>

        {loading && rawEvents.length === 0 ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
        ) : displayEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayEvents.map((event) => (
              <div key={event.id} className="relative group/lgbt">
                 {/* Borda Arco-Íris Sutil */}
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 via-yellow-500 to-purple-500 rounded-3xl opacity-20 group-hover/lgbt:opacity-100 transition-opacity blur-[2px] group-hover/lgbt:blur-md" />
                 <div className="relative">
                    <EventCard event={event} />
                    <div className="absolute top-4 left-4 pointer-events-none">
                       <Badge className="bg-secondary text-white font-black uppercase text-[8px] h-5 shadow-xl border-none">LGBTQ+</Badge>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 opacity-40 shadow-inner">
             <Inbox className="w-12 h-12" />
             <p className="text-sm font-black uppercase tracking-widest">Nenhum evento localizado para este filtro.</p>
             <Button variant="link" onClick={() => setFilter('all')} className="font-bold uppercase text-xs">Ver todas as experiências</Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function FilterButton({ children, active, onClick }: any) {
  return (
    <Button 
      variant={active ? 'default' : 'outline'} 
      onClick={onClick}
      className={cn(
        "rounded-xl h-10 px-6 font-black uppercase italic text-[10px] tracking-widest transition-all",
        active ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "bg-white hover:border-secondary hover:text-secondary"
      )}
    >
      {children}
    </Button>
  )
}