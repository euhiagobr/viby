"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, orderBy, doc } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { Button } from "@/components/ui/button"
import { Globe, Search, ArrowRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"

export default function LandingPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events"), orderBy("createdAt", "desc"), limit(6))
  }, [db])

  const { data: events, loading } = useCollection<any>(eventsQuery)

  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <div className="w-10 h-10 relative flex items-center justify-center">
                <img src={settings.logoUrl} alt={siteName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>

          <div className="hidden md:flex flex-1 max-w-sm mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar eventos..." 
              className="pl-10 bg-muted/50 border-none rounded-full h-9 focus-visible:ring-secondary"
            />
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <Button asChild variant="ghost" className="font-semibold">
                <Link href="/dashboard">Meu Painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="font-semibold">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-secondary text-white hover:bg-secondary/90 font-bold px-6 rounded-full">
                  <Link href="/cadastro">Cadastrar-se</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-bold animate-fade-in">
            {settings?.iconUrl ? (
               <img src={settings.iconUrl} className="w-5 h-5 object-contain" alt="Site Icon" />
            ) : (
               <Globe className="w-4 h-4" />
            )}
            <span>A maior vitrine de eventos do Brasil</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground max-w-4xl mx-auto leading-[1.1]">
            Descubra experiências <span className="text-secondary">inesquecíveis</span> perto de você.
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium">
            De festivais de música a conferências de tecnologia. Explore, compartilhe e viva o momento com a {siteName}.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-primary text-white hover:bg-primary/90 rounded-full px-8 h-12 font-bold group">
              <Link href="/dashboard">
                Começar a Explorar
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-12 font-bold border-2">
              <Link href="/cadastro">Anunciar meu Evento</Link>
            </Button>
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      </section>

      {/* Events Feed */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Em Destaque</h2>
            <p className="text-muted-foreground font-medium mt-1">Os eventos que estão bombando hoje.</p>
          </div>
          <Button variant="link" asChild className="text-secondary font-bold">
            <Link href="/dashboard" className="flex items-center gap-2">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-secondary" />
            <p className="text-muted-foreground font-medium animate-pulse">Carregando experiências...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events && events.length > 0 ? (
              events.map((event: any) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-muted/30 rounded-3xl border-2 border-dashed border-border">
                <p className="text-lg font-bold text-muted-foreground">Nenhum evento em destaque no momento.</p>
                <p className="text-sm text-muted-foreground mt-2">Fique ligado, novidades estão por vir!</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={siteName} className="h-8 object-contain" />
            ) : (
              <>
                <div className="w-6 h-6 bg-secondary rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{siteName.charAt(0)}</span>
                </div>
                <span className="font-bold text-lg">{siteName}</span>
              </>
            )}
          </div>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {siteName} © 2024 - Transformando a maneira como você descobre e vive eventos.
          </p>
        </div>
      </footer>
    </div>
  )
}