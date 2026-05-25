
"use client"

import * as React from "react"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, query, limit, orderBy, doc, where, getDocs } from "firebase/firestore"
import { EventCard } from "@/components/events/EventCard"
import { AdCard } from "@/components/ads/AdCard"
import { Button } from "@/components/ui/button"
import { Globe, Search, ArrowRight, Loader2, MapPin, Tag, FilterX } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"
import { useMemoFirebase } from "@/firebase/firestore/use-memo-firebase"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrentLocation, calculateDistance, type Coordinates } from "@/lib/location-utils"
import Footer from "@/components/layout/Footer"

export default function LandingPageClient() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const [searchName, setSearchName] = React.useState("")
  const [selectedCity, setSelectedCity] = React.useState("all")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [sortBy, setSortBy] = React.useState<'date' | 'distance'>('date')
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(null)
  const [inactiveOrgIds, setInactiveOrgIds] = React.useState<Set<string>>(new Set())

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events"), where("status", "==", "Ativo"), limit(100))
  }, [db])

  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const categoriesQuery = useMemoFirebase(() => db ? collection(db, "categories") : null, [db])
  const { data: categories } = useCollection<any>(categoriesQuery)

  const adsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "ads"), where("status", "==", "Ativo"))
  }, [db])
  const { data: activeAds } = useCollection<any>(adsQuery)

  React.useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getCurrentLocation()
        setUserLocation(loc)
      } catch (err) {}
    }
    fetchLocation()
  }, [])

  const uniqueCities = React.useMemo(() => {
    if (!events) return []
    const cities = events
      .filter((e: any) => e.city && e.status === 'Ativo')
      .map((e: any) => e.city)
    return Array.from(new Set(cities)).sort() as string[]
  }, [events])

  const interleavedContent = React.useMemo(() => {
    if (!events) return [];
    return events.map(e => ({ ...e, isSponsored: false, _isAdObject: false }));
  }, [events]);

  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={siteName} width={120} height={40} className="h-10 w-auto object-contain" priority />
            ) : (
              <span className="text-xl font-bold tracking-tight">{siteName}</span>
            )}
          </Link>
        </div>
      </nav>

      <section className="py-24 container mx-auto px-4 flex-1">
        <h1 className="text-6xl font-black uppercase italic">Explorar</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-12">
            {interleavedContent.map((item: any, idx: number) => (
              <EventCard key={idx} event={item} userLocation={userLocation} />
            ))}
        </div>
      </section>
      <Footer />
    </div>
  )
}
