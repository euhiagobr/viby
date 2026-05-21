"use client"

import * as React from "react"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Building2, 
  ArrowRight, 
  ShieldCheck, 
  Users, 
  LayoutGrid,
  ChevronRight,
  Globe
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function MinhasOrganizacoesPage() {
  const { organizations, currentOrg, setCurrentOrg, loading } = useCurrentOrganization()

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Organizações</h1>
          <p className="text-muted-foreground">Gerencie suas produtoras, ONGs e marcas.</p>
        </div>
        
        <Button asChild className="gap-2 bg-secondary text-white hover:bg-secondary/90 font-bold rounded-full px-6">
          <Link href="/dashboard/organizations/new">
            <Plus className="w-4 h-4" />
            Nova Organização
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-muted/50 border-none h-48 rounded-[2rem]" />
          ))
        ) : organizations.length > 0 ? (
          organizations.map((org) => {
            const isActive = currentOrg?.id === org.id
            return (
              <Card 
                key={org.id} 
                className={cn(
                  "overflow-hidden border-none shadow-sm transition-all rounded-[2rem] bg-white group",
                  isActive && "ring-2 ring-secondary"
                )}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <Avatar className="h-16 w-16 border-2 border-muted shadow-sm">
                      <AvatarImage src={org.avatar} className="object-cover" />
                      <AvatarFallback className="bg-primary text-white font-bold">
                        {org.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-end gap-2">
                      {isActive && (
                        <Badge className="bg-secondary text-white uppercase text-[9px] font-black h-5">Ativa no Painel</Badge>
                      )}
                      {org.verified && (
                        <ShieldCheck className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <CardTitle className="text-xl font-bold line-clamp-1">{org.name}</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase text-secondary flex items-center gap-1">
                      <Globe className="w-3 h-3" /> @{org.username}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setCurrentOrg(org)}
                      disabled={isActive}
                      variant={isActive ? "secondary" : "outline"} 
                      className="flex-1 rounded-xl font-bold text-xs h-10"
                    >
                      {isActive ? "Selecionada" : "Ativar no Painel"}
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" asChild>
                      <Link href={`/dashboard/organizations/${org.id}`}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-border gap-6 shadow-sm">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <Building2 className="w-10 h-10 text-muted-foreground opacity-30" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold">Você ainda não tem organizações.</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">Para publicar eventos e gerenciar vendas, crie seu primeiro perfil comercial.</p>
            </div>
            <Button asChild className="bg-secondary text-white font-black px-10 h-12 rounded-full shadow-lg">
              <Link href="/dashboard/organizations/new">Criar minha primeira Organização</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
