
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
  Search
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

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("w-5 h-5 fill-blue-500 text-white", className)} />
  )
}

function ProfileHeader() {
  const { currentOrg, organizations, setCurrentOrg } = useCurrentOrganization()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()

  const unreadQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "notifications"), where("targetUid", "==", user.uid), where("read", "==", false))
  }, [db, user])
  const { data: unreadNotifications } = useCollection<any>(unreadQuery)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <SidebarTrigger />
      
      <div className="flex items-center gap-4">
        {user && organizations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl h-10 border-dashed border-secondary/40 hover:border-secondary transition-all">
                <Building2 className="w-4 h-4 text-secondary" />
                <span className="font-bold text-xs uppercase tracking-tight">
                  {currentOrg?.name || "Selecionar Organização"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl" align="start">
              <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Minhas Organizações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem 
                  key={org.id} 
                  onClick={() => setCurrentOrg(org)}
                  className={currentOrg?.id === org.id ? "bg-secondary/10 font-bold" : ""}
                >
                  {org.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/organizacoes/new" className="flex items-center gap-2 text-secondary font-bold">
                  <Plus className="w-4 h-4" />
                  Nova Organização
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}

export default function ProfilePageClient({ username }: { username: string }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<any>(null)
  const [type, setType] = React.useState<'user' | 'organization' | null>(null)
  const [ownedEvents, setOwnedEvents] = React.useState<any[]>([])
  
  React.useEffect(() => {
    if (!db || !username) return
    const fetchData = async () => {
      setLoading(true)
      const uRef = doc(db, "usernames", username.toLowerCase());
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const { uid, type: resType } = uSnap.data();
        setType(resType);
        const dataSnap = await getDoc(doc(db, resType === 'user' ? 'users' : 'organizations', uid));
        if (dataSnap.exists()) setData({ id: dataSnap.id, ...dataSnap.data() });
      }
      setLoading(false)
    }
    fetchData()
  }, [db, username])

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  if (!data) return <div className="flex-1 flex flex-col items-center justify-center p-20"><p>Perfil não encontrado.</p></div>

  return (
    <OrganizationProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-[#f8fafc]">
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-y-auto">
            <ProfileHeader />
            <div className="p-10">
               <h1 className="text-4xl font-black italic uppercase">{data.name || data.displayName}</h1>
               <p className="text-muted-foreground">@{username}</p>
            </div>
            <Footer />
          </main>
        </div>
      </SidebarProvider>
    </OrganizationProvider>
  )
}
