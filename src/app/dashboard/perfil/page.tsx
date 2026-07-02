
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  Calendar, 
  Edit, 
  Fingerprint, 
  Settings, 
  Eye, 
  EyeOff, 
  TicketPercent, 
  Zap, 
  ShieldCheck,
  User as UserIcon,
  Mail,
  Building2,
  Trophy
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { maskCPF } from "@/lib/crypto-utils"
import { getUserCPF } from "@/app/actions/user"
import { calculateUserCouponPoints, getNextPointThreshold } from "@/lib/coupon-utils"
import { formatCurrency } from "@/lib/financial-utils"

/**
 * Componente interno para exibir o Card de Cupom com carregamento de dados do Evento.
 */
function UserCouponCard({ coupon, userId }: { coupon: any, userId: string }) {
  const db = useFirestore();
  const eventRef = React.useMemo(() => (db && coupon?.eventId) ? doc(db, "events", coupon.eventId) : null, [db, coupon?.eventId]);
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef);

  const points = calculateUserCouponPoints(coupon.uses || 0);
  const nextGoal = getNextPointThreshold(coupon.uses || 0);
  const progress = nextGoal ? ((coupon.uses || 0) / nextGoal.tickets) * 100 : 100;

  return (
    <Card className="border-none shadow-xl bg-primary text-white overflow-hidden rounded-[2.5rem] relative group animate-in zoom-in-95 duration-500">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase px-3 h-5 shadow-lg">Meu Cupom Exclusivo</Badge>
          <TicketPercent className="w-5 h-5 opacity-20" />
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8 relative z-10">
        <div className="text-center py-6 bg-white/10 rounded-3xl border border-white/10 shadow-inner">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Seu Código</p>
          <p className="text-4xl font-black italic tracking-widest">{coupon.code}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-secondary/20 text-secondary px-3 py-1 rounded-full text-[9px] font-black uppercase">
            <Zap className="w-3 h-3 fill-current" /> {formatCurrency(coupon.discountValue)} OFF
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-muted-foreground opacity-40">Evento Vinculado</p>
            {eventLoading ? (
              <Loader2 className="w-4 h-4 animate-spin opacity-20" />
            ) : (
              <p className="text-xs font-bold uppercase italic truncate text-secondary">
                {event?.title || "Evento não localizado"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[8px] font-black uppercase opacity-40">Ingressos Vendidos</p>
              <p className="text-xl font-black">{coupon.uses || 0}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[8px] font-black uppercase opacity-40">Pontuação Atual</p>
              <p className="text-xl font-black text-secondary">{points} <span className="text-[10px]">PTS</span></p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest opacity-60">
              <span>Progresso para Bônus</span>
              <span>{coupon.uses || 0} / {nextGoal?.tickets || 'MÁX'}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-secondary transition-all duration-1000 shadow-[0_0_10px_rgba(44,82,238,0.5)]" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            {nextGoal && (
              <p className="text-[8px] font-bold text-center opacity-40 uppercase tracking-widest">
                Próxima Recompensa: {nextGoal.points} Pontos
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary/10 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
    </Card>
  );
}

export default function PerfilPage() {
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)
  const db = useFirestore()

  const [fullCPF, setFullCPF] = React.useState<string | null>(null);
  const [showCPF, setShowCPF] = React.useState(false);
  const [loadingCPF, setLoadingCPF] = React.useState(false);

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile, loading: profileLoading } = useDoc<any>(userDocRef)

  const userCouponRef = React.useMemo(() => (db && user) ? doc(db, "user_coupons", user.uid) : null, [db, user])
  const { data: userCoupon } = useDoc<any>(userCouponRef)

  React.useEffect(() => {
    if (user) {
      setLoadingCPF(true);
      getUserCPF(user.uid, user.uid).then(res => {
        if (res.success) setFullCPF(res.cpf!);
        setLoadingCPF(false);
      });
    }
  }, [user]);

  if (authLoading || profileLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary">Meu Perfil</h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Gerencie suas informações e acompanhe seus benefícios.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="rounded-full h-11 px-6 font-bold gap-2 border-secondary/20 text-secondary">
            <Link href="/dashboard/perfil/editar"><Edit className="w-4 h-4" /> Editar Perfil</Link>
          </Button>
          <Button asChild className="bg-primary text-white rounded-full px-8 h-11 font-black uppercase italic shadow-lg">
             <Link href={`/${profile?.username}`} target="_blank">Ver Perfil Público</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-sm overflow-hidden text-center bg-white rounded-[2.5rem]">
              <div className="h-24 bg-muted/30 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-primary/5" />
              </div>
              <CardContent className="pt-0 -mt-12 space-y-6 pb-8 relative z-10">
                 <Avatar className="h-24 w-24 mx-auto border-8 border-background shadow-2xl">
                    <AvatarImage src={profile?.avatar} className="object-cover" />
                    <AvatarFallback className="font-black text-2xl bg-muted">{profile?.name?.charAt(0)}</AvatarFallback>
                 </Avatar>
                 <div>
                    <h2 className="font-black text-xl uppercase italic tracking-tighter text-primary">{profile?.name}</h2>
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1">@{profile?.username}</p>
                 </div>
                 <div className="flex justify-center gap-2">
                    <Badge variant="outline" className="text-[8px] font-black uppercase h-5">{profile?.plan || 'free'}</Badge>
                    <Badge className="bg-green-600 text-white border-none text-[8px] font-black uppercase h-5">{profile?.status || 'Ativo'}</Badge>
                 </div>
              </CardContent>
           </Card>

           {userCoupon && <UserCouponCard coupon={userCoupon} userId={user?.uid!} />}
        </div>

        <div className="lg:col-span-8 space-y-6">
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-secondary" /> Manifesto Pessoal
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                 <p className="text-base text-muted-foreground font-medium leading-relaxed italic">
                    {profile?.bio || "Este membro ainda não escreveu sua apresentação no clube."}
                 </p>
              </CardContent>
           </Card>
           
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-muted/30 p-8 border-b">
                 <CardTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-secondary" /> Segurança e Identidade
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm text-secondary">
                             <Fingerprint className="w-6 h-6" />
                          </div>
                          <div className="space-y-0.5">
                             <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Documento CPF</p>
                             <p className="text-lg font-black text-primary font-mono tracking-widest">
                                {showCPF ? fullCPF : maskCPF(fullCPF || profile?.cpfMasked)}
                             </p>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" onClick={() => setShowCPF(!showCPF)} className="rounded-xl h-10 px-4 font-black text-[10px] uppercase gap-2 hover:bg-white">
                          {loadingCPF ? <Loader2 className="w-4 h-4 animate-spin" /> : showCPF ? <><EyeOff className="w-4 h-4" /> Ocultar</> : <><Eye className="w-4 h-4" /> Revelar</>}
                       </Button>
                    </div>

                    <div className="flex items-center gap-6 p-5 bg-muted/10 rounded-2xl text-[10px] font-bold uppercase tracking-tight">
                       <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-secondary opacity-40" /> {profile?.email}</div>
                       <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-secondary opacity-40" /> Membro desde {new Date(profile?.createdAt?.seconds * 1000 || profile?.createdAt).toLocaleDateString('pt-BR')}</div>
                    </div>
                 </div>

                 <Separator className="border-dashed" />
                 
                 <div className="flex justify-end gap-3">
                    <Button variant="outline" asChild className="rounded-xl h-10 px-6 font-black uppercase text-[10px] gap-2 border-secondary/20 text-secondary">
                       <Link href="/dashboard/perfil/configuracoes"><Settings className="w-4 h-4" /> Configurações de Conta</Link>
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
