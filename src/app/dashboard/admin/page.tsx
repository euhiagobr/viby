"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Tag, Settings, Loader2, ShieldAlert, LayoutDashboard } from "lucide-react"

export default function AdminPage() {
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading } = useDoc<any>(userDocRef)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">Você não tem permissão de administrador para acessar esta área.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-secondary/10 rounded-lg">
          <LayoutDashboard className="w-6 h-6 text-secondary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie usuários, categorias e configurações globais do Viby Club.</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="w-4 h-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>Visualize e gerencie todos os organizadores cadastrados na plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground italic">Lista de organizadores cadastrados aparecerá aqui.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Categorias de Eventos</CardTitle>
              <CardDescription>Adicione ou edite as categorias disponíveis para classificação de eventos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                <Tag className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground italic">Gerencie as categorias disponíveis para os eventos.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Configurações da Plataforma</CardTitle>
              <CardDescription>Ajustes globais e parâmetros de sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                <Settings className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground italic">Ajustes globais do Viby Club.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}