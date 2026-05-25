
"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useFirebaseApp, useDoc } from "@/firebase"
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  collectionGroup,
  increment,
  updateDoc,
  addDoc
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { 
  Loader2, 
  AlertTriangle, 
  MapPin, 
  Globe, 
  Instagram, 
  Calendar,
  Users,
  Grid,
  Heart,
  Share2,
  ExternalLink,
  Building2,
  Bell,
  Plus,
  Check,
  Handshake,
  Info,
  BadgeCheck,
  Phone,
  Flag,
  Camera,
  Paperclip,
  X,
  Send,
  ShieldAlert,
  EyeOff,
  Trophy,
  Zap,
  Award,
  Sparkles,
  TrendingUp,
  BarChart3,
  Map as MapIcon,
  ChevronRight,
  Target,
  Navigation,
  Search,
  LayoutGrid,
  Lock,
  Eye,
  Clock,
  Wallet,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { EventCard } from "@/components/events/EventCard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { OrganizationProvider, useCurrentOrganization } from "@/contexts/OrganizationContext"
import Footer from "@/components/layout/Footer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { calculateLevel, DEFAULT_LEVELS } from "@/lib/gamification"
import { processGamificationEvent } from "@/lib/gamification-service"
import { formatCurrency } from '@/lib/financial-utils'

const roleTranslations: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  finance: 'Financeiro',
  checkin: 'Check-in'
};

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

export default function OrganizationDashboardPage() {
  const { currentOrg, userRole, loading: orgLoading } = useCurrentOrganization();
  const db = useFirestore();

  // Permissões
  const isFinanceManager = ['owner', 'admin', 'finance'].includes(userRole || '');

  // Consulta de Eventos
  const eventsQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(
      collection(db, 'events'), 
      where('organizationId', '==', currentOrg.id)
    );
  }, [db, currentOrg?.id]);

  const { data: rawEvents, loading: eventsLoading } = useCollection<any>(eventsQuery);

  const events = React.useMemo(() => {
    if (!rawEvents) return [];
    const now = new Date();
    
    return [...rawEvents]
      .filter(e => {
        // Filtrar por status ativo
        if (e.status !== 'Ativo') return false;
        
        // Filtrar para remover eventos que já terminaram
        const start = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        const end = e.endDate?.toDate ? e.endDate.toDate() : (e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 60 * 60 * 1000));
        
        return end >= now;
      })
      .sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      })
      .slice(0, 5);
  }, [rawEvents]);

  // Consulta de Vendas (Registrations) para métricas financeiras
  const salesQuery = useMemoFirebase(() => {
    if (!db || !currentOrg || !isFinanceManager) return null;
    return query(
      collection(db, "registrations"), 
      where("organizationId", "==", currentOrg.id)
    );
  }, [db, currentOrg?.id, isFinanceManager]);

  const { data: sales, loading: salesLoading } = useCollection<any>(salesQuery);

  const salesStats = React.useMemo(() => {
    if (!sales) return { today: 0, month: 0 };
    
    const now = new Date();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const monthStart = new Date();
    monthStart.setDate(now.getDate() - 30);

    return sales.reduce((acc: any, sale: any) => {
      // Apenas vendas confirmadas entram na receita líquida
      if (!["Pago", "Disponível"].includes(sale.paymentStatus)) return acc;
      
      const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
      const netAmount = sale.producerNetAmount || 0;

      if (saleDate >= todayStart) {
        acc.today += netAmount;
      }
      if (saleDate >= monthStart) {
        acc.month += netAmount;
      }
      return acc;
    }, { today: 0, month: 0 });
  }, [sales]);

  // Consulta de Membros
  const membersQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return collection(db, 'organizations', currentOrg.id, 'members');
  }, [db, currentOrg?.id]);

  const { data: members } = useCollection<any>(membersQuery);

  // Consulta de Seguidores
  const followersQuery = useMemoFirebase(() => {
    if (!db || !currentOrg) return null;
    return query(collection(db, 'follows'), where('followingId', '==', currentOrg.id));
  }, [db, currentOrg?.id]);

  const { data: followers } = useCollection<any>(followersQuery);

  const followerStats = React.useMemo(() => {
    if (!followers) return { total: 0, last30Days: 0, growth: 0 };
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const last30 = followers.filter((f: any) => {
      const date = f.timestamp?.toDate ? f.timestamp.toDate() : new Date(f.timestamp);
      return date > thirtyDaysAgo;
    }).length;

    const previousTotal = followers.length - last30;
    const growth = previousTotal > 0 ? (last30 / previousTotal) * 100 : (last30 > 0 ? 100 : 0);

    return {
      total: followers.length,
      last30Days: last30,
      growth: Math.round(growth)
    };
  }, [followers]);

  if (orgLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>;
  }

  if (!currentOrg) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Marca não encontrada</h2>
        <Button asChild className="mt-4" variant="outline"><Link href="/dashboard/organizacoes">Voltar para Minhas Marcas</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <LayoutGrid className="w-8 h-8 text-secondary" />
          Dashboard da Marca
        </h1>
        <p className="text-muted-foreground font-medium">Gestão centralizada de {currentOrg.name}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Eventos Ativos
              <Megaphone className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{events?.filter(e => e.status === 'Ativo').length || 0}</div>
          </CardContent>
        </Card>

        {/* MÉTRICAS REAIS DE ACESSO */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Acessos (Total)
              <Eye className="w-4 h-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline gap-2">
               <span className="text-2xl font-black">{(currentOrg.totalViews || 0).toLocaleString()}</span>
               <span className="text-[9px] font-bold text-muted-foreground uppercase">Views</span>
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-sm font-black text-secondary">{(currentOrg.totalReach || 0).toLocaleString()}</span>
               <span className="text-[9px] font-bold text-muted-foreground uppercase">Únicos</span>
            </div>
          </CardContent>
        </Card>

        {/* RECEITA HOJE */}
        <Card className="border-none shadow-sm bg-white border-l-4 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Receita Hoje
              <Clock className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFinanceManager ? (
              salesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="text-2xl font-black text-green-600">{formatCurrency(salesStats.today)}</div>
              )
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tight">Restrito</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RECEITA 30 DIAS */}
        <Card className="border-none shadow-sm bg-white border-l-4 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
              Receita (30d)
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFinanceManager ? (
              salesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="text-2xl font-black text-primary">{formatCurrency(salesStats.month)}</div>
              )
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tight">Restrito</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-secondary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest flex justify-between">
              Meu Cargo
              <ShieldCheck className="w-4 h-4 text-white" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black uppercase italic truncate">{userRole ? roleTranslations[userRole] || userRole : 'Membro'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
             <div>
                <CardTitle className="text-lg font-bold">Eventos Ativos</CardTitle>
                <CardDescription>Próximas publicações no ar.</CardDescription>
             </div>
             <Button variant="ghost" size="sm" asChild className="rounded-xl font-bold uppercase text-[10px] gap-2">
               <Link href={`/dashboard/organizacoes/${currentOrg.username}/events`}>Ver Todos <ArrowRight className="w-3 h-3" /></Link>
             </Button>
          </CardHeader>
          <CardContent className="p-0">
             {eventsLoading ? (
               <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
             ) : events && events.length > 0 ? (
               <div className="divide-y">
                 {events.map((event: any) => {
                   const dateValue = event.startDate || event.date;
                   const formattedDate = dateValue ? (dateValue.toDate ? dateValue.toDate().toLocaleDateString('pt-BR') : new Date(dateValue).toLocaleDateString('pt-BR')) : 'Sem data';
                   
                   return (
                     <div key={event.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden relative">
                              {event.image && <img src={event.image} className="w-full h-full object-cover" />}
                           </div>
                           <div>
                              <p className="font-bold text-sm leading-tight">{event.title}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase">{formattedDate}</p>
                           </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black uppercase">{event.status}</Badge>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="p-12 text-center text-muted-foreground italic text-sm">Nenhum evento ativo no momento.</div>
             )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-primary text-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" /> 
              Crescimento de Marca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm opacity-80 leading-relaxed font-medium">
              Sua marca está sendo visualizada por milhares de usuários. Use o Viby para impulsionar seus eventos e alcançar o público certo.
            </p>
            <div className="p-6 bg-white/10 rounded-2xl border border-white/10">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Seguidores Totais</p>
                     <p className="text-4xl font-black italic">{followerStats.total}</p>
                     {followerStats.last30Days > 0 && (
                       <div className="flex items-center gap-2 text-green-400 text-[10px] font-black uppercase">
                         <TrendingUp className="w-3 h-3" />
                         +{followerStats.last30Days} nos últimos 30 dias ({followerStats.growth}%)
                       </div>
                     )}
                  </div>
                  <Button asChild className="bg-secondary text-white font-black uppercase text-[10px] italic h-10 px-6 rounded-xl hover:scale-105 transition-transform shadow-xl">
                    <Link href={`/dashboard/organizacoes/${currentOrg.username}/anuncios`}>Impulsionar</Link>
                  </Button>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
