"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, Calendar, Hash, Globe, ExternalLink, Edit, MapPin, Link as LinkIcon, Instagram, Phone, EyeOff, User as UserIcon, Users as UsersIcon, Fingerprint } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { decryptData } from "@/lib/crypto-utils"

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

  const locationStr = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");

  const maskCPF = (encryptedCpf: string) => {
    if (!encryptedCpf) return "Não informado";
    const raw = decryptData(encryptedCpf);
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 11) return "***.***.***-**";
    return `***.${digits.substring(3, 6)}.***-**`;
  };

  const formatJoinDate = (dateValue: any) => {
    if (!dateValue) return 'Recentemente';
    try {
      const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(d.getTime())) return 'Recentemente';
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return 'Recentemente';
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil Pessoal</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e configurações de conta.</p>
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
            <div className="h-24 bg-primary/5 relative" />
            <CardContent className="pt-0 -mt-12 flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar || user.photoURL || undefined} alt={profile.name} />
                <AvatarFallback className="text-2xl font-bold bg-muted">
                  {profile.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="mt-4 space-y-1">
                <h2 className="text-xl font-bold">{profile.name}</h2>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Hash className="w-3.5 h-3.5" />
                  {profile.username}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {profile.gender && (
                    <Badge variant="outline" className="uppercase text-[10px] font-bold">
                       {profile.gender}
                    </Badge>
                  )}
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
                <div className="flex items-center gap-3 text-sm">
                  <Fingerprint className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{maskCPF(profile.cpf)}</span>
                </div>
                {locationStr && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{locationStr}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Membro desde {formatJoinDate(profile.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Bio</CardTitle>
              <CardDescription>Uma breve descrição sobre você.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line italic">
                {profile.bio || "Nenhuma biografia adicionada."}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Redes & Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {profile.instagram && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-bold">@{profile.instagram.replace('@', '')}</span>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank">Visitar</a>
                  </Button>
                </div>
               )}
               {profile.website && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold">Site Oficial</span>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={profile.website} target="_blank">Abrir</a>
                  </Button>
                </div>
               )}
               {!profile.instagram && !profile.website && (
                 <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum link social configurado.</p>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}