"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, Calendar, Hash, Globe, ExternalLink, Edit, MapPin, Link as LinkIcon, Instagram, Phone, EyeOff, Building2, User as UserIcon, Briefcase } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { cn } from "@/lib/utils"

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M22.5 12.5C22.5 18.0228 18.0228 22.5 12.5 22.5C6.97715 22.5 2.5 18.0228 2.5 12.5C2.5 6.97715 6.97715 2.5 12.5 2.5C18.0228 2.5 22.5 6.97715 22.5 12.5Z" 
        fill="#0095F6"
      />
      <path 
        d="M10 14.5L7.5 12L6.5 13L10 16.5L17.5 9L16.5 8L10 14.5Z" 
        fill="white" 
        stroke="white" 
        strokeWidth="0.5"
      />
    </svg>
  )
}

export default function PerfilPage() {
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "events"), where("organizerId", "==", user.uid))
  }, [db, user])
  const { data: events, loading: eventsLoading } = useCollection<any>(eventsQuery)

  const stats = React.useMemo(() => {
    if (!events) return { total: 0, active: 0, finished: 0 }
    return {
      total: events.length,
      active: events.filter((e: any) => e.status !== 'Concluído').length,
      finished: events.filter((e: any) => e.status === 'Concluído').length
    }
  }, [events])

  if (authLoading || profileLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Usuário não encontrado</h2>
        <p className="text-muted-foreground">Por favor, faça login novamente.</p>
      </div>
    )
  }

  const locationStr = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e links de contato.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2 font-bold rounded-full">
            <Link href="/dashboard/perfil/editar">
              <Edit className="w-4 h-4" />
              Editar Dados
            </Link>
          </Button>
          <Button asChild className="bg-secondary text-white hover:bg-secondary/90 gap-2 font-bold rounded-full px-6">
            <Link href={`/${profile.username}`} target="_blank">
              Ver Perfil Público
              <ExternalLink className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-24 bg-secondary/10 relative" />
            <CardContent className="pt-0 -mt-12 flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar || user.photoURL || undefined} alt={profile.name} />
                <AvatarFallback className="text-2xl font-bold bg-muted">
                  {profile.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="mt-4 space-y-1">
                <h2 className="text-xl font-bold flex items-center justify-center gap-1.5">
                  {profile.name}
                  {profile.isVerified && <InstagramVerifiedBadge className="w-4 h-4" />}
                </h2>
                <div className="flex flex-col gap-1 items-center">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    {profile.username}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {profile.accountType === 'Empresa' ? <Building2 className="w-3 h-3 mr-1" /> : <UserIcon className="w-3 h-3 mr-1" />}
                    {profile.accountType || "Usuário"}
                  </Badge>
                </div>
              </div>
            </CardContent>
            <Separator />
            <CardContent className="py-6 space-y-4">
              <div className="space-y-3">
                {profile.email && (
                  <div className={cn("flex items-center gap-3 text-sm", profile.showEmail === false && "opacity-50")}>
                    < Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium truncate">{profile.email}</span>
                    {profile.showEmail === false && <EyeOff className="w-3 h-3" />}
                  </div>
                )}
                {locationStr && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{locationStr}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Membro desde {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR') : 'Recentemente'}</span>
                </div>
              </div>

              {(profile.website || profile.instagram || profile.whatsapp) && (
                <>
                  <Separator />
                  <div className="space-y-3 pt-2">
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-secondary transition-colors">
                        <LinkIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium truncate">Site Oficial</span>
                      </a>
                    )}
                    {profile.instagram && (
                      <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-secondary transition-colors">
                        <Instagram className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">@{profile.instagram.replace('@', '')}</span>
                      </a>
                    )}
                    {profile.whatsapp && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{profile.whatsapp}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {profile.accountType === 'Empresa' && (
            <Card className="border-none shadow-sm border-l-4 border-secondary">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-secondary" />
                  Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.legalName && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Razão Social</p>
                    <p className="font-semibold text-sm">{profile.legalName}</p>
                  </div>
                )}
                {profile.cnpj && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">CNPJ</p>
                    <p className="font-semibold text-sm">{profile.cnpj}</p>
                  </div>
                )}
                {profile.businessCategory && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Categoria de Negócio</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs font-medium">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {profile.businessCategory}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Atividade na Plataforma</CardTitle>
              <CardDescription>Resumo de seus eventos publicados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-6 rounded-2xl">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Total de Eventos</p>
                  <p className="text-3xl font-black text-foreground">
                    {eventsLoading ? "..." : stats.total}
                  </p>
                </div>
                <div className="bg-muted/50 p-6 rounded-2xl">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Eventos Ativos</p>
                  <p className="text-3xl font-black text-foreground">
                    {eventsLoading ? "..." : stats.active}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {profile.bio && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Bio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line italic">
                  {profile.bio}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
