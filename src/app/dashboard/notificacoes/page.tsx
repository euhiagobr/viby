"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit, doc, writeBatch } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Bell, 
  Loader2, 
  UserPlus, 
  AtSign, 
  CheckCircle2, 
  Inbox,
  ArrowRight,
  BadgeCheck
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { RichText } from "@/components/ui/rich-text"
import { useTranslation } from "@/i18n/i18n-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const VIBY_AVATAR = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FiconUrl_1780427863977?alt=media&token=1ab99264-b05c-4d1d-ab5a-0c27b7bfb77b";

export default function NotificacoesPage() {
  const { t } = useTranslation()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "notifications"),
      where("targetUid", "==", user.uid),
      limit(100)
    )
  }, [db, user?.uid])

  const { data: rawNotifications, loading } = useCollection<any>(notificationsQuery)

  const notifications = React.useMemo(() => {
    if (!rawNotifications) return []
    return [...rawNotifications].sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0) || 0
      const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0) || 0
      return tB - tA
    })
  }, [rawNotifications])

  React.useEffect(() => {
    if (!db || !notifications || notifications.length === 0) return

    const unread = notifications.filter((n: any) => !n.read)
    if (unread.length > 0) {
      const batch = writeBatch(db)
      unread.forEach((n: any) => {
        batch.update(doc(db, "notifications", n.id), { read: true })
      })
      batch.commit().catch(e => console.error("Erro ao marcar lidas auto:", e))
    }
  }, [db, notifications])

  const handleMarkAllAsRead = async () => {
    if (!db || !notifications || notifications.length === 0) return
    const batch = writeBatch(db)
    notifications.forEach((n: any) => {
      if (!n.read) {
        batch.update(doc(db, "notifications", n.id), { read: true })
      }
    })
    await batch.commit()
    toast({ title: t('common.success') })
  }

  const formatTime = (ts: any) => {
    if (!ts) return "---"
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
            <Bell className="w-8 h-8 text-secondary" />
            {t('common.notifications')}
          </h1>
          <p className="text-muted-foreground font-medium">Acompanhe menções, novos seguidores e comunicados oficiais.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleMarkAllAsRead}
          disabled={!notifications || notifications.length === 0}
          className="rounded-xl font-bold text-xs uppercase h-10 border-secondary/20 text-secondary"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar tudo como lido
        </Button>
      </div>

      <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((n: any) => {
                const isSystem = n.type === 'system';
                const isMention = n.type === 'mention';
                const isFollow = n.type === 'follow';

                return (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-6 flex items-start gap-4 transition-colors hover:bg-muted/5 group",
                      !n.read && "bg-secondary/5 border-l-4 border-secondary"
                    )}
                  >
                    <div className="shrink-0 pt-1">
                      {isSystem ? (
                        <div className="relative">
                          <Avatar className="h-11 w-11 border-2 border-primary/10 shadow-sm">
                            <AvatarImage src={VIBY_AVATAR} className="object-cover" />
                            <AvatarFallback className="font-black bg-primary text-white">V</AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                            <BadgeCheck className="w-4 h-4 fill-blue-500 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className={cn(
                          "p-3 rounded-2xl",
                          isMention ? "bg-primary/10 text-primary" : 
                          isFollow ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                        )}>
                          {isMention ? <AtSign className="w-5 h-5" /> : 
                           isFollow ? <UserPlus className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2">
                            {isSystem && (
                              <span className="text-[10px] font-black uppercase italic text-primary tracking-widest flex items-center gap-1.5">
                                Viby <BadgeCheck className="w-3 h-3 fill-blue-500 text-white" />
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                              {formatTime(n.createdAt)}
                            </span>
                         </div>
                      </div>

                      <div className="text-sm font-medium text-foreground/90 leading-relaxed pr-8">
                        <RichText content={n.message} />
                      </div>

                      {n.link && (
                        <Button variant="link" asChild className="p-0 h-auto text-[10px] font-black uppercase text-secondary gap-1 group/btn">
                           <Link href={n.link}>
                              Ver detalhes <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                           </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-32 text-center space-y-4">
              <Inbox className="w-16 h-16 text-muted-foreground opacity-10 mx-auto" />
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Sua caixa de entrada está limpa.</p>
              <Button asChild variant="outline" className="rounded-xl h-10 px-6 font-bold text-xs uppercase border-dashed">
                <Link href="/dashboard">Explorar Viby</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
