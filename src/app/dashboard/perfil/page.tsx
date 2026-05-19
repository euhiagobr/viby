"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, User, ShieldCheck, Calendar, MapPin, Hash, Globe, ExternalLink } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export default function PerfilPage() {
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e visualize seu perfil público.</p>
        </div>
        <Button asChild className="bg-secondary text-white hover:bg-secondary/90 gap-2 font-bold rounded-full px-6">
          <Link href={`/${profile.username}`} target="_blank">
            Ver Perfil Público
            <ExternalLink className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
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
                  {profile.isVerified && <ShieldCheck className="w-5 h-5 text-secondary" />}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Hash className="w-3.5 h-3.5" />
                  {profile.username}
                </p>
                {profile.role === 'admin' && (
                  <Badge variant="secondary" className="mt-2 bg-secondary/10 text-secondary border-none">Administrador</Badge>
                )}
              </div>
            </CardContent>
            <Separator />
            <CardContent className="py-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Membro desde {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR') : 'Recentemente'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Atividade na Plataforma</CardTitle>
              <CardDescription>Resumo de suas conquistas e eventos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-6 rounded-2xl">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Total de Eventos</p>
                  <p className="text-3xl font-black text-foreground">{profile.totalEvents || 0}</p>
                </div>
                <div className="bg-muted/50 p-6 rounded-2xl">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Engajamento</p>
                  <p className="text-3xl font-black text-foreground">Altíssimo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase">Plataforma</p>
                  <p className="font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-secondary" />
                    Viby Club
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase">Status da Conta</p>
                  <p className="font-medium text-green-500">Ativa</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
