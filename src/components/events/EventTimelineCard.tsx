"use client"

import * as React from "react"
import { 
  Calendar, 
  MapPin, 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  BadgeCheck,
  ArrowRight,
  Clock,
  Ticket,
  Send,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, orderBy, serverTimestamp, addDoc, doc, deleteDoc, getDocs, where, limit, writeBatch, setDoc } from "firebase/firestore"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { AgeRatingBadge } from "@/lib/age-rating"
import { RichText } from "@/components/ui/rich-text"
import { MentionTextarea } from "@/components/ui/mention-textarea"
import { EventInterest } from "./EventInterest"

function CommentItem({ comment, eventId, isAdmin, onDelete }: { comment: any, eventId: string, isAdmin: boolean, onDelete: (id: string) => void }) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const authorRef = React.useMemo(() => (db && comment.userId) ? doc(db, "users", comment.userId) : null, [db, comment.userId])
  const { data: author } = useDoc<any>(authorRef)

  const canDelete = isAdmin || comment.userId === user?.uid;

  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={author?.avatar} className="object-cover" />
        <AvatarFallback className="text-[10px] font-bold bg-muted">{author?.name?.charAt(0) || "U"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-black uppercase tracking-tight text-primary">
              {author?.name || "Usuário"}
            </span>
            {(author?.isVerified || author?.verified) && <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white" />}
          </div>
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }} className="opacity-0 group-hover:opacity-100 text-destructive hover:scale-110 transition-all">
              <Trash2 className="w-3.5 h-3" />
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          <RichText content={comment.text} />
        </div>
      </div>
    </div>
  );
}

interface EventTimelineCardProps {
  event: any
}

export function EventTimelineCard({ event }: EventTimelineCardProps) {
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)
  
  const isAdmin = profile?.role === 'admin'

  const [showComments, setShowComments] = React.useState(false)
  const [newComment, setNewComment] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date)
  const endDate = event.endDate?.toDate ? event.endDate.toDate() : (event.endDate ? new Date(event.endDate) : new Date(eventDate.getTime() + 4 * 60 * 60 * 1000))
  const isEnded = endDate < new Date()

  const slugOrId = event.slug || event.id;
  const username = event.organizer?.username || 'evento';
  const eventLink = `/${username}/${slugOrId}`

  // Comentários
  const commentsQuery = useMemoFirebase(() => {
    if (!db || !event.id) return null
    return query(collection(db, "events", event.id, "comments"), orderBy("createdAt", "asc"))
  }, [db, event.id])
  const { data: comments, loading: commentsLoading } = useCollection<any>(commentsQuery)

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}${eventLink}`
    navigator.clipboard.writeText(url)
    toast({ title: "Link copiado!" })
  }

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowComments(!showComments)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!db || !user || !newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    const commentData = {
      userId: user.uid,
      text: newComment.trim(),
      createdAt: serverTimestamp()
    }

    addDoc(collection(db, "events", event.id, "comments"), commentData)
      .then(async () => {
        const mentions = newComment.match(/@(\w+)/g)
        if (mentions && mentions.length > 0) {
           const batch = writeBatch(db)
           for (const mention of mentions) {
              const mUsername = mention.slice(1).toLowerCase()
              const uSnap = await getDocs(query(collection(db, "usernames"), where("__name__", "==", mUsername), limit(1)))
              if (!uSnap.empty) {
                 const targetUid = uSnap.docs[0].data().uid
                 if (targetUid !== user.uid) {
                    const notifRef = doc(collection(db, "notifications"))
                    batch.set(notifRef, {
                       targetUid: targetUid,
                       senderId: user.uid,
                       senderName: user.displayName || "Alguém",
                       type: 'mention',
                       message: `${user.displayName || 'Alguém'} mencionou você em um comentário: ${event.title}`,
                       link: `${eventLink}?openComments=true`,
                       read: false,
                       createdAt: serverTimestamp()
                    })
                 }
              }
           }
           await batch.commit()
        }
        setNewComment("")
        toast({ title: "Comentário enviado!" })
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `events/${event.id}/comments`,
          operation: 'create',
          requestResourceData: commentData
        }))
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!db) return
    deleteDoc(doc(db, "events", event.id, "comments", commentId))
  }

  const isVerified = event.organizer?.verified === true || event.organizer?.isVerified === true;

  return (
    <Card 
      className={cn(
        "overflow-hidden border-none shadow-xl bg-white rounded-[2.5rem] transition-all hover:shadow-2xl cursor-pointer w-full max-w-xl mx-auto",
        isEnded && "opacity-70 grayscale-[0.5]"
      )}
      onClick={() => router.push(eventLink)}
    >
      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-secondary/10">
            <AvatarImage src={event.organizer?.avatar} className="object-cover" />
            <AvatarFallback className="font-bold bg-muted">{event.organizer?.name?.charAt(0) || "O"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-sm font-black uppercase italic tracking-tighter text-primary">{event.organizer?.name || "Organizador"}</span>
              {isVerified && <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white" />}
            </div>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">@{event.organizer?.username}</span>
          </div>
        </div>
      </CardHeader>

      <div className="relative aspect-square sm:aspect-[4/3] w-full bg-muted overflow-hidden">
        <Image src={event.image || `https://picsum.photos/seed/${event.id}/800/600`} alt={event.title} fill className={cn("object-cover transition-transform group-hover:scale-105", isEnded && "grayscale")} unoptimized />
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {isEnded && <Badge className="bg-muted text-muted-foreground border-none shadow-lg text-[10px] font-black uppercase px-3 py-1">Encerrado</Badge>}
          <div className="flex items-center gap-2">
             <AgeRatingBadge code={event.ageRating?.code || "free"} className="bg-white/90 p-1.5 rounded-xl shadow-lg" />
             {event.categoryName && <Badge className="bg-white/90 text-primary border-none shadow-lg text-[10px] font-black uppercase px-3 py-1">{event.categoryName}</Badge>}
          </div>
        </div>
      </div>

      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <EventInterest event={event} showButton={true} variant="default" className="gap-2" />
          <button 
            className={cn("p-2 rounded-full transition-colors", showComments ? "text-secondary bg-secondary/10" : "text-muted-foreground hover:bg-muted")}
            onClick={toggleComments}
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <button 
            className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            onClick={handleShare}
          >
            <Share2 className="w-6 h-6" />
          </button>
        </div>
        <Badge variant="outline" className={cn("font-black uppercase text-[9px] h-6 px-3", isEnded ? "border-muted text-muted-foreground" : "border-secondary text-secondary")}>{event.isFree ? "Grátis" : "Bilheteria"}</Badge>
      </div>

      <CardContent className="px-6 pb-6 space-y-4">
        <div className="space-y-1">
          <h3 className={cn("text-xl font-black uppercase italic tracking-tighter leading-tight text-primary", isEnded && "text-muted-foreground")}>{event.title}</h3>
          <div className="text-sm text-muted-foreground line-clamp-2 font-medium leading-relaxed">
            <RichText content={event.description || event.shortDescription} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed border-border/60">
           <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-50 tracking-widest">Quando</p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                 <Calendar className="w-3.5 h-3.5 text-secondary" /> {eventDate.toLocaleDateString('pt-BR')}
                 <span className="opacity-30 mx-1">|</span>
                 <Clock className="w-3.5 h-3.5 text-secondary" /> {eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
           </div>
           <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-50 tracking-widest">Onde</p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                 <MapPin className="w-3.5 h-3.5 text-secondary" /> <span className="truncate">{event.city}</span>
              </div>
           </div>
        </div>

        {showComments && (
          <div className="pt-4 space-y-6 animate-in slide-in-from-top-4 duration-300" onClick={(e) => e.stopPropagation()}>
             <Separator className="border-dashed" />
             <div className="max-h-60 overflow-y-auto space-y-4 px-1 custom-scrollbar">
                {commentsLoading ? (
                   <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
                ) : comments && comments.length > 0 ? (
                   comments.map((comment: any) => (
                     <CommentItem key={comment.id} comment={comment} eventId={event.id} isAdmin={isAdmin} onDelete={handleDeleteComment} />
                   ))
                ) : (
                   <div className="py-4 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground opacity-40">Seja o primeiro a comentar</p></div>
                )}
             </div>

             <form onSubmit={handleAddComment} className="flex gap-2">
                <MentionTextarea 
                  placeholder="Escreva um comentário..." 
                  value={newComment} 
                  onValueChange={setNewComment}
                  className="rounded-xl min-h-[40px] h-10 py-2 text-xs border-dashed border-secondary/30 focus-visible:ring-secondary/30" 
                  disabled={isSubmitting} 
                />
                <Button type="submit" size="icon" disabled={isSubmitting || !newComment.trim()} className="h-10 w-10 shrink-0 bg-secondary text-white rounded-xl shadow-lg transition-all active:scale-90">
                   {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
             </form>
          </div>
        )}

        {!showComments && (
          <Button disabled={isEnded} className={cn("w-full h-12 font-black rounded-2xl uppercase italic text-xs gap-2 group transition-colors", isEnded ? "bg-muted text-muted-foreground" : "bg-primary text-white hover:bg-secondary")}>
            {isEnded ? "Evento Encerrado" : <React.Fragment><Ticket className="w-4 h-4" /> Garantir meu Ingresso <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></React.Fragment>}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
