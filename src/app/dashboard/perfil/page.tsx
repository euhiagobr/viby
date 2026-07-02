
"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, Calendar, Hash, Globe, ExternalLink, Edit, MapPin, Instagram, Fingerprint, Settings, Eye, EyeOff, TicketPercent, Zap, TrendingUp } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { maskCPF } from "@/lib/crypto-utils"
import { getUserCPF } from "@/app/actions/user"
import { calculateUserCouponPoints, getNextPointThreshold } from "@/lib/coupon-utils"

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

  const points = userCoupon ? calculateUserCouponPoints(userCoupon.uses || 0) : 0;
  const nextGoal = userCoupon ? getNextPointThreshold(userCoupon.uses || 0) : null;
  const progress = nextGoal ? ((userCoupon.uses || 0) / nextGoal.tickets) * 100 : 100;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações e acompanhe seus benefícios.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="rounded-full font-bold">
            <Link href="/dashboard/perfil/editar"><Edit className="w-4 h-4 mr-2" /> Editar</Link>
          </Button>
          <Button asChild className="bg-secondary text-white rounded-full px-6 font-bold">
             <Link href={`/${profile.username}`} target="_blank">Ver Público</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-none shadow-sm overflow-hidden text-center">
              <div className="h-20 bg-muted/30" />
              <CardContent className="pt-0 -mt-10 space-y-4">
                 <Avatar className="h-20 w-20 mx-auto border-4 border-background">
                    <AvatarImage src={profile.avatar} />
                    <AvatarFallback className="font-black">{profile.name?.charAt(0)}</AvatarFallback>
                 </Avatar>
                 <div>
                    <h2 className="font-bold text-lg">{profile.name}</h2>
                    <p className="text-xs text-muted-foreground">@{profile.username}</p>
                 </div>
              </CardContent>
           </Card>

           {userCoupon && (
             <Card className="border-none shadow-xl bg-primary text-white overflow-hidden relative group">
                <CardHeader className="pb-2">
                   <div className="flex justify-between items-start">
                      <Badge className="bg-secondary text-white border-none text-[8px] font-black uppercase px-2 h-5">Meu Cupom</Badge>
                      <TicketPercent className="w-5 h-5 opacity-20" />
                   </div>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                   <div className="text-center py-4 bg-white/10 rounded-2xl border border-white/10">
                      <p className="text-3xl font-black italic tracking-widest">{userCoupon.code}</p>
                      <p className="text-[10px] font-bold opacity-60 uppercase">Desconto: {formatCurrency(userCoupon.discountValue)}</p>
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-end">
                         <div className="space-y-0.5">
                            <p className="text-[8px] font-black uppercase opacity-40">Pontuação</p>
                            <p className="text-2xl font-black italic text-secondary">{points} PTS</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[8px] font-black uppercase opacity-40">Vendas</p>
                            <p className="font-black text-sm">{userCoupon.uses || 0}</p>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <div className="flex justify-between text-[8px] font-black uppercase">
                            <span>Progresso</span>
                            <span>{userCoupon.uses || 0} / {nextGoal?.tickets || 'MAX'}</span>
                         </div>
                         <Progress value={progress} className="h-1.5 bg-white/10" />
                      </div>
                   </div>
                </CardContent>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
             </Card>
           )}
        </div>

        <div className="lg:col-span-2 space-y-6">
           <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-lg">Bio</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground italic leading-relaxed">{profile.bio || "Sem biografia."}</p></CardContent>
           </Card>
           
           <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-lg">Dados e Segurança</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border">
                    <div className="flex items-center gap-3">
                       <Fingerprint className="w-5 h-5 text-muted-foreground" />
                       <span className="text-sm font-bold font-mono">{showCPF ? fullCPF : maskCPF(fullCPF || profile.cpfMasked)}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowCPF(!showCPF)} className="text-[10px] uppercase font-black">
                       {showCPF ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />} {showCPF ? "Ocultar" : "Revelar"}
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}
