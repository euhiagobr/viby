
"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useDoc, useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, where, orderBy, addDoc, serverTimestamp, deleteDoc, writeBatch, getDocs, limit, setDoc } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  MapPin, 
  Share2, 
  ArrowLeft, 
  Ticket, 
  Info,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Layers,
  ShoppingCart,
  Plus,
  Minus,
  Map as MapIcon,
  Navigation,
  Users,
  EyeOff,
  TicketX,
  MessageCircle,
  Send,
  Trash2,
  Heart,
  BadgeCheck
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import Footer from "@/components/layout/Footer"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

function CommentItem({ comment, eventId, isAdmin, onDelete }: { comment: any, eventId: string, isAdmin: boolean, onDelete: (id: string) => void }) {
  const db = useFirestore()
  const authorRef = React.useMemo(() => (db && comment.userId) ? doc(db, "users", comment.userId) : null, [db, comment.userId])
  const { data: author } = useDoc<any>(authorRef)

  const renderFormattedText = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(\*\*.*?\*\*|\+.*?\+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-black">{part.slice(2, -2)}</strong>;
      if (part.startsWith('+') && part.endsWith('+')) return <span key={i} className="text-[1.3em] font-bold leading-tight inline-block">{part.slice(1, -1)}</span>;
      if (part.startsWith('@')) {
        const usernameMention = part.slice(1);
        return <Link key={i} href={`/${usernameMention}`} className="text-secondary font-black hover:underline">{part}</Link>;
      }
      return part;
    });
  }

  return (
    <div className="flex gap-4 group">
      <Avatar className="h-10 w-10 border border-muted shrink-0">
        <AvatarImage src={author?.avatar} className="object-cover" />
        <AvatarFallback className="font-bold bg-muted">{author?.name?.charAt(0) || "U"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-black uppercase tracking-tight text-primary">{author?.name || "Usuário"}</span>
            {author?.isVerified && <BadgeCheck className="w-3.5 h-3.5 fill-blue-500 text-white" />}
          </div>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(comment.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {renderFormattedText(comment.text)}
        </p>
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">
          {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleString('pt-BR') : '---'}
        </span>
      </div>
    </div>
  );
}

export default function EventoDetalhesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  const { addItem, items: cartItems } = useCart()
  
  const eventId = params.id as string
  const usernameFromUrl = params.username as string

  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const organizationRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, [db, event?.organizationId])
  const { data: organizationProfile } = useDoc<any>(organizationRef)

  const likeRef = React.useMemo(() => (db && user && eventId) ? doc(db, "events", eventId, "likes", user.uid) : null, [db, user, eventId])
  const { data: userLike } = useDoc<any>(likeRef)
  const isLiked = !!userLike

  // Comentários
  const commentsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "comments"), orderBy("createdAt", "asc"))
  }, [db, eventId])
  const { data: comments, loading: commentsLoading } = useCollection<any>(commentsQuery)

  const [activeBatch, setActiveBatch] = React.useState<any>(null)
  const [selectedTicketType, setSelectedTicketType] = React.useState<any>(null)
  const [saleStatus, setSaleStatus] = React.useState<'open' | 'pending' | 'ended' | 'soldout' | 'suspended' | 'none'>('pending')
  const [quantity, setQuantity] = React.useState(1)
  const [newComment, setNewComment] = React.useState("")
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false)

  const commentsSectionRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (searchParams.get('openComments') === 'true' && commentsSectionRef.current) {
      setTimeout(() => {
        commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 500)
    }
  }, [searchParams, commentsLoading])

  React.useEffect(() => {
    if (!event) return

    if (event.noTickets || event.ticketMode === 'none') {
      setSaleStatus('none')
      return
    }

    if (organizationProfile && organizationProfile.status !== 'Ativo') {
      setSaleStatus('suspended')
      return
    }

    const checkAvailability = () => {
      const now = new Date()
      const batches = event.batches || []
      let foundActiveBatch = null
      let status: 'open' | 'pending' | 'ended' | 'soldout' = 'ended'
      let hasUpcoming = false

      for (const batch of batches) {
        const start = batch.startDate ? new Date(batch.startDate) : null
        const end = batch.endDate ? new Date(batch.endDate) : null
        const isStarted = !start || now >= start
        const isNotEnded = !end || now <= end

        if (!isStarted) {
          hasUpcoming = true; continue;
        }

        if (isStarted && isNotEnded) {
          foundActiveBatch = batch; status = 'open'; break;
        }
      }

      setActiveBatch(foundActiveBatch)
      setSaleStatus(status === 'ended' && hasUpcoming ? 'pending' : status)
    }

    checkAvailability()
  }, [event, organizationProfile])

  const handleLike = async () => {
    if (!db || !user || !likeRef) return
    if (isLiked) {
      deleteDoc(likeRef).catch(() => toast({ variant: "destructive", title: "Erro ao descurtir" }))
    } else {
      setDoc(likeRef, { timestamp: serverTimestamp() })
        .then(() => toast({ title: "Evento curtido!" }))
        .catch(() => toast({ variant: "destructive", title: "Erro ao curtir" }))
    }
  }

  const handleAddToCart = () => {
    if (!selectedTicketType || !event || !activeBatch) return
    addItem({
      id: `${event.id}_${selectedTicketType.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: usernameFromUrl,
      ticketTypeId: selectedTicketType.id,
      ticketTypeName: selectedTicketType.name,
      batchId: activeBatch.id,
      batchName: activeBatch.name,
      price: selectedTicketType.price,
      quantity: quantity,
      requiresProof: selectedTicketType.requiresProof
    });
    toast({ title: "Carrinho atualizado!" });
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || !newComment.trim() || isSubmittingComment) return

    setIsSubmittingComment(true)
    const commentData = {
      userId: user.uid,
      text: newComment.trim(),
      createdAt: serverTimestamp()
    }

    addDoc(collection(db, "events", eventId, "comments"), commentData)
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
                       link: `/${usernameFromUrl}/${eventId}?openComments=true`,
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
          path: `events/${eventId}/comments`,
          operation: 'create',
          requestResourceData: commentData
        }))
      })
      .finally(() => setIsSubmittingComment(false))
  }

  if (eventLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  if (!event) return <div className="flex flex-col items-center py-20"><h2 className="text-2xl font-bold">Evento não encontrado</h2></div>

  const eventDates = {
    start: event.date?.toDate ? event.date.toDate() : new Date(event.date),
    end: event.endDate?.toDate ? event.endDate.toDate() : (event.endDate ? new Date(event.endDate) : new Date(new Date(event.date).getTime() + 4 * 60 * 60 * 1000))
  };
  const isEnded = eventDates.end < new Date();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-6xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
        <div className="flex items-center justify-between">
           <Button variant="ghost" onClick={() => router.back()} className="rounded-full font-bold text-xs uppercase gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
           </Button>
           <div className="flex gap-2">
              <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full", isLiked && "text-red-500 bg-red-50")} onClick={handleLike}>
                <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10 relative" asChild>
                <Link href="/dashboard/carrinho">
                  <ShoppingCart className="w-4 h-4" />
                  {cartItems.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
                </Link>
              </Button>
           </div>
        </div>

        <div className={cn("relative h-[300px] md:h-[450px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white transition-all", isEnded && "grayscale opacity-80")}>
          <Image src={event.image || "https://picsum.photos/seed/event/1200/800"} alt={event.title} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute bottom-10 left-10 text-white space-y-4 pr-10">
             <div className="flex flex-wrap gap-2">
                {isEnded && <Badge className="bg-muted text-muted-foreground px-4 py-1 rounded-full uppercase font-black tracking-widest border-none">Encerrado</Badge>}
                <Badge className="bg-secondary px-4 py-1 rounded-full uppercase font-black tracking-widest">{event.categoryName || "Geral"}</Badge>
             </div>
             <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.9]">{event.title}</h1>
             <div className="flex flex-wrap items-center gap-6 text-sm font-bold opacity-80">
                <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full"><MapPin className="w-4 h-4 text-secondary" /> {event.city}</span>
                <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full"><Calendar className="w-4 h-4 text-secondary" /> {new Date(event.date).toLocaleDateString('pt-BR')}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
           <div className="lg:col-span-8 space-y-8">
              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 pb-4"><CardTitle className="flex items-center gap-2 text-xl font-bold"><Info className="w-5 h-5 text-secondary" /> Sobre o Evento</CardTitle></CardHeader>
                 <CardContent className="pt-6">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg font-medium">
                      {event.description}
                    </p>
                 </CardContent>
              </Card>

              {/* SEÇÃO DE COMENTÁRIOS DINÂMICOS */}
              <Card ref={commentsSectionRef} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 pb-4"><CardTitle className="flex items-center gap-2 text-xl font-bold"><MessageCircle className="w-5 h-5 text-secondary" /> Discussão</CardTitle></CardHeader>
                 <CardContent className="pt-8 space-y-8">
                    <div className="space-y-6 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                       {commentsLoading ? (
                         <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                       ) : comments && comments.length > 0 ? (
                         comments.map((comment: any) => (
                           <CommentItem 
                             key={comment.id} 
                             comment={comment} 
                             eventId={eventId} 
                             isAdmin={event.organizationId && organizationProfile?.members?.[user?.uid || '']}
                             onDelete={(id) => deleteDoc(doc(db!, "events", eventId, "comments", id))}
                           />
                         ))
                       ) : (
                         <div className="py-10 text-center space-y-3 opacity-30">
                            <MessageCircle className="w-10 h-10 mx-auto" />
                            <p className="text-xs font-black uppercase tracking-widest">Nenhuma mensagem ainda.</p>
                         </div>
                       )}
                    </div>

                    <form onSubmit={handleAddComment} className="flex gap-3 pt-6 border-t border-dashed">
                       <Input 
                         placeholder={user ? "Escreva um comentário... @marca alguém" : "Faça login para comentar"} 
                         value={newComment}
                         onChange={e => setNewComment(e.target.value)}
                         disabled={!user || isSubmittingComment}
                         className="rounded-xl h-12 border-dashed border-secondary/30"
                       />
                       <Button type="submit" disabled={!user || !newComment.trim() || isSubmittingComment} className="h-12 w-12 shrink-0 bg-secondary text-white rounded-xl shadow-lg">
                          {isSubmittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                       </Button>
                    </form>
                 </CardContent>
              </Card>
           </div>
           
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2rem] border-t-8 border-secondary overflow-hidden bg-white">
                 <CardHeader><CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {saleStatus === 'open' && activeBatch ? (
                       <div className="space-y-6">
                          <Label className="text-[10px] font-black uppercase opacity-60">Escolha o seu Ingresso ({activeBatch.name})</Label>
                          <div className="space-y-3">
                             {activeBatch.ticketTypes.map((type: any) => (
                               <div key={type.id} onClick={() => setSelectedTicketType(type)} className={cn("p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center", selectedTicketType?.id === type.id ? "border-secondary bg-secondary/5 shadow-inner" : "border-muted hover:border-secondary/20")}>
                                  <div className="space-y-1">
                                     <p className="font-bold text-sm uppercase">{type.name}</p>
                                     <div className="flex gap-2">
                                       {type.requiresProof && <Badge variant="outline" className="text-[7px] h-4 uppercase border-orange-200 text-orange-600">Doc. Obrigatório</Badge>}
                                     </div>
                                  </div>
                                  <p className="font-black text-primary">{type.price === 0 ? 'GRÁTIS' : formatCurrency(type.price)}</p>
                               </div>
                             ))}
                          </div>
                          <Button disabled={!selectedTicketType} onClick={handleAddToCart} className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3">
                             <ShoppingCart className="w-6 h-6" /> Adicionar ao Carrinho
                          </Button>
                       </div>
                    ) : (
                      <div className="p-10 text-center space-y-2 bg-muted/20 rounded-2xl">
                         <TicketX className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                         <p className="font-black uppercase italic">{saleStatus === 'none' ? 'Sem Bilheteria' : 'Vendas Encerradas'}</p>
                      </div>
                    )}
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
