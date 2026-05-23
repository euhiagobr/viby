
"use client"

import * as React from "react"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Bell, 
  Loader2, 
  UserPlus, 
  AtSign, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Inbox,
  Trash2,
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function NotificacoesPage() {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)

  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(
      collection(db, "notifications"),
      where("targetUid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    )
  }, [db, user])

  const { data: notifications, loading } = useCollection<any>(notificationsQuery)

  const handleMarkAllAsRead = async () => {
    if (!db || !notifications || notifications.length === 0) return
    const batch = writeBatch(db)
    notifications.forEach((n: any) => {
      if (!n.read) {
        batch.update(doc(db, "notifications", n.id), { read: true })
      }
    })
    await batch.commit()
    toast({ title: "Tudo lido!", description: "Suas notificações foram atualizadas." })
  }

  const handleDeleteNotification = async (id: string) => {
    if (!db) return
    try {
      const nRef = doc(db, "notifications", id)
      const batch = writeBatch(db)
      batch.delete(nRef)
      await batch.commit()
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" })
    }
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
            Notificações
          </h1>
          <p className="text-muted-foreground font-medium">Acompanhe menções, novos seguidores e interações.</p>
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

      <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-6 flex items-start gap-4 transition-colors hover:bg-muted/5 group",
                    !n.read && "bg-secondary/5 border-l-4 border-secondary"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl shrink-0",
                    n.type === 'mention' ? "bg-primary/10 text-primary" : 
                    n.type === 'follow' ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                  )}>
                    {n.type === 'mention' ? <AtSign className="w-5 h-5" /> : 
                     n.type === 'follow' ? <UserPlus className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                       <p className="text-sm font-bold text-foreground">
                         {n.message}
                       </p>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                         {formatTime(n.createdAt)}
                       </span>
                    </div>
                    {n.link && (
                      <Button variant="link" asChild className="p-0 h-auto text-[10px] font-black uppercase text-secondary gap-1">
                         <Link href={n.link}>Ver detalhes <ArrowRight className="w-3 h-3" /></Link>
                      </Button>
                    )}
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteNotification(n.id)}
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center space-y-4">
              <Inbox className="w-16 h-16 text-muted-foreground opacity-10 mx-auto" />
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Sua caixa de entrada está limpa.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
