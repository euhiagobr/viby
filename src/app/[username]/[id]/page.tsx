
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  BadgeCheck,
  Armchair,
  Layout,
  Grid3X3,
  Circle,
  Square,
  Accessibility,
  UserCheck
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { useCart } from "@/contexts/CartContext"
import Footer from "@/components/layout/Footer"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { reserveSeat } from "@/lib/ticketing-service"

const renderFormattedText = (text: string) => {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*|\+.*?\+|@[\w.]+)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-black">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('+') && part.endsWith('+')) {
      return <span key={i} className="text-[1.3em] font-bold leading-tight inline-block">{part.slice(1, -1)}</span>;
    }
    if (part.startsWith('@')) {
      const usernameMention = part.slice(1).toLowerCase();
      return <Link key={i} href={`/${usernameMention}`} className="text-secondary font-black hover:underline" onClick={(e) => e.stopPropagation()}>{part}</Link>;
    }
    return part;
  });
}

function CommentItem({ comment, eventId, isAdmin, onDelete }: { comment: any, eventId: string, isAdmin: boolean, onDelete: (id: string) => void }) {
  const db = useFirestore()
  const authorRef = React.useMemo(() => (db && comment.userId) ? doc(db, "users", comment.userId) : null, [db, comment.userId])
  const { data: author } = useDoc<any>(authorRef)

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
        <div className="text-sm text-muted-foreground leading-relaxed">
          {renderFormattedText(comment.text)}
        </div>
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

  const userDocRef = React.useMemo(() => (db && user) ? doc(db, "users", user.uid) : null, [db, user])
  const { data: profile } = useDoc<any>(userDocRef)
  const isAdmin = profile?.role === 'admin'

  const eventRef = React.useMemo(() => db ? doc(db, "events", eventId) : null, [db, eventId])
  const { data: event, loading: eventLoading } = useDoc<any>(eventRef)
  
  const organizationRef = React.useMemo(() => (db && event?.organizationId) ? doc(db, "organizations", event.organizationId) : null, [db, event?.organizationId])
  const { data: organizationProfile } = useDoc<any>(organizationRef)

  const feesRef = React.useMemo(() => db ? doc(db, 'settings', 'fees') : null, [db])
  const { data: globalFees } = useDoc<any>(feesRef)

  const likeRef = React.useMemo(() => (db && user && eventId) ? doc(db, "events", eventId, "likes", user.uid) : null, [db, user, eventId])
  const { data: userLike } = useDoc<any>(likeRef)
  const isLiked = !!userLike

  const setoresQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "setores"), where("ativo", "==", true), orderBy("ordem", "asc"))
  }, [db, eventId])
  const { data: setores } = useCollection<any>(setoresQuery)

  const [selectedSector, setSelectedSector] = React.useState<any>(null)
  const [selectedSeat, setSelectedSeat] = React.useState<any>(null)
  const [isReserving, setIsReserving] = React.useState(false)

  const commentsQuery = useMemoFirebase(() => {
    if (!db || !eventId) return null
    return query(collection(db, "events", eventId, "comments"), orderBy("createdAt", "asc"))
  }, [db, eventId])
  const { data: comments, loading: commentsLoading } = useCollection<any>(commentsQuery)

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

  const handleSeatClick = async (seat: any) => {
    if (!user) { toast({ title: "Ação necessária", description: "Faça login para selecionar assentos." }); router.push("/login"); return; }
    if (!db || isReserving || seat.status !== 'disponivel') return;

    setIsReserving(true);
    try {
      await reserveSeat(db, eventId, selectedSector.id, seat.id, user.uid);
      setSelectedSeat(seat);
      toast({ title: "Assento selecionado!", description: "Você tem 10 minutos para concluir a compra." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsReserving(false);
    }
  }

  const handleAddToCart = () => {
    if (!selectedSector || !event || !globalFees) return
    
    const isNumbered = selectedSector.tipo !== 'livre';
    if (isNumbered && !selectedSeat) {
      toast({ variant: "destructive", title: "Selecione um lugar", description: "Este setor exige escolha de assento ou mesa." });
      return;
    }

    addItem({
      id: isNumbered ? `${event.id}_${selectedSector.id}_${selectedSeat.id}` : `${event.id}_${selectedSector.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventImage: event.image || "",
      eventDate: event.date,
      eventCity: event.city || "",
      organizationId: event.organizationId,
      organizerId: event.organizerId,
      organizerUsername: usernameFromUrl,
      ticketTypeId: selectedSector.id,
      ticketTypeName: `${selectedSector.nome}${selectedSeat ? ` (${selectedSeat.codigo})` : ''}`,
      batchId: "map",
      batchName: selectedSector.nome,
      price: selectedSector.preco,
      quantity: isNumbered ? 1 : quantity,
      requiresProof: selectedSeat?.categoria && selectedSeat.categoria !== 'comum',
      seatId: selectedSeat?.id,
      seatCode: selectedSeat?.codigo,
      sectorId: selectedSector.id
    });
    toast({ title: "Carrinho atualizado!" });
    if (isNumbered) {
      setSelectedSeat(null);
    }
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

  const isEnded = event.endDate && new Date(event.endDate) < new Date();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="max-w-7xl mx-auto px-4 pt-10 space-y-8 flex-1 w-full">
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
                    <div className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg font-medium">
                      {renderFormattedText(event.description)}
                    </div>
                 </CardContent>
              </Card>

              {event.possuiMapa && setores && (
                <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                   <CardHeader className="bg-primary p-12 border-b relative overflow-hidden">
                      <div className="relative z-10 text-center space-y-3">
                         <div className="w-full h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white font-black italic uppercase tracking-[0.8em] shadow-2xl border border-white/20 text-lg">
                            {event.palcoNome || "PALCO"}
                         </div>
                         <div className="flex justify-center flex-wrap gap-4 pt-4">
                            <div className="flex items-center gap-1.5 text-white"><div className="w-2.5 h-2.5 bg-white border border-secondary rounded-sm" /> <span className="text-[8px] font-black uppercase">Livre</span></div>
                            <div className="flex items-center gap-1.5 text-white"><div className="w-2.5 h-2.5 bg-secondary rounded-sm" /> <span className="text-[8px] font-black uppercase">Selecionado</span></div>
                            <div className="flex items-center gap-1.5 text-white/50"><div className="w-2.5 h-2.5 bg-white/20 rounded-sm" /> <span className="text-[8px] font-black uppercase">Ocupado</span></div>
                            <div className="w-px h-3 bg-white/20" />
                            <div className="flex items-center gap-1.5 text-cyan-400"><Accessibility className="w-3 h-3" /> <span className="text-[8px] font-black uppercase">PCD</span></div>
                            <div className="flex items-center gap-1.5 text-orange-400"><Accessibility className="w-3 h-3" /> <span className="text-[8px] font-black uppercase">Obeso</span></div>
                         </div>
                      </div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                   </CardHeader>
                   <CardContent className="p-8 lg:p-12 bg-[#fafafa]">
                      <div className="grid grid-cols-12 gap-8 items-start">
                         {setores.map((setor: any) => (
                           <div 
                             key={setor.id} 
                             style={{ gridColumn: `${(setor.posicaoGrade || 0) + 1} / span ${setor.larguraGrade || 12}` }}
                             className="space-y-4"
                           >
                              <div className="flex justify-between items-center px-2">
                                 <h4 className="font-black uppercase italic text-primary text-[10px]">{setor.nome}</h4>
                                 <Badge className="bg-secondary/10 text-secondary border-none font-black text-[9px]">{formatCurrency(setor.preco)}</Badge>
                              </div>
                              
                              {setor.tipo === 'livre' ? (
                                <button 
                                  onClick={() => { setSelectedSector(setor); setSelectedSeat(null); }}
                                  className={cn(
                                    "w-full h-24 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02]",
                                    selectedSector?.id === setor.id ? "bg-secondary text-white border-secondary shadow-lg" : "bg-white text-muted-foreground"
                                  )}
                                  style={{ borderColor: selectedSector?.id === setor.id ? 'transparent' : setor.cor }}
                                >
                                   <Users className="w-5 h-5 opacity-20" />
                                   <span className="font-black text-[10px] uppercase">Selecionar este Setor</span>
                                </button>
                              ) : (
                                <SectorMapViewer 
                                  eventoId={eventId} 
                                  setor={setor} 
                                  selectedSeat={selectedSeat}
                                  onSelect={(s) => { setSelectedSector(setor); handleSeatClick(s); }}
                                  isReserving={isReserving}
                                />
                              )}
                           </div>
                         ))}
                      </div>
                   </CardContent>
                </Card>
              )}

              <Card ref={commentsSectionRef} className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-muted/30 pb-4"><CardTitle className="flex items-center gap-2 text-xl font-bold"><MessageCircle className="w-5 h-5 text-secondary" /> Discussão</CardTitle></CardHeader>
                 <CardContent className="pt-8 space-y-8">
                    <div className="space-y-6 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                       {commentsLoading ? (
                         <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-secondary" /></div>
                       ) : comments && comments.length > 0 ? (
                         comments.map((comment: any) => (
                           <CommentItem key={comment.id} comment={comment} eventId={eventId} isAdmin={isAdmin} onDelete={(id) => deleteDoc(doc(db!, "events", eventId, "comments", id))} />
                         ))
                       ) : (
                         <div className="py-10 text-center space-y-3 opacity-30">
                            <MessageCircle className="w-10 h-10 mx-auto" />
                            <p className="text-xs font-black uppercase tracking-widest">Nenhuma mensagem ainda.</p>
                         </div>
                       )}
                    </div>
                    <form onSubmit={handleAddComment} className="flex gap-3 pt-6 border-t border-dashed">
                       <Input placeholder={user ? "Escreva um comentário..." : "Faça login para comentar"} value={newComment} onChange={e => setNewComment(e.target.value)} disabled={!user || isSubmittingComment} className="rounded-xl h-12 border-dashed border-secondary/30" />
                       <Button type="submit" disabled={!user || !newComment.trim() || isSubmittingComment} className="h-12 w-12 shrink-0 bg-secondary text-white rounded-xl shadow-lg">
                          {isSubmittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                       </Button>
                    </form>
                 </CardContent>
              </Card>
           </div>
           
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] border-t-8 border-secondary overflow-hidden bg-white sticky top-24">
                 <CardHeader><CardTitle className="flex items-center gap-2 font-black italic uppercase tracking-tighter"><Ticket className="w-5 h-5 text-secondary" /> Bilheteria</CardTitle></CardHeader>
                 <CardContent className="space-y-6">
                    {selectedSector ? (
                       <div className="space-y-6 animate-in slide-in-from-right-4">
                          <div className="p-5 bg-muted/30 rounded-2xl space-y-3">
                             <div className="flex justify-between"><span className="text-[10px] font-black uppercase opacity-40">Setor</span><span className="font-bold text-sm uppercase">{selectedSector.nome}</span></div>
                             {selectedSeat && (
                               <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase opacity-40">Lugar</span>
                                 <div className="flex flex-col items-end">
                                    <span className="font-black text-secondary uppercase italic">{selectedSeat.codigo}</span>
                                    {selectedSeat.categoria !== 'comum' && <Badge variant="outline" className="text-[8px] h-4 uppercase border-secondary text-secondary">{selectedSeat.categoria}</Badge>}
                                 </div>
                               </div>
                             )}
                             <Separator className="border-dashed" />
                             <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-40">Valor</span><span className="text-xl font-black text-primary">{formatCurrency(selectedSector.preco)}</span></div>
                          </div>

                          {selectedSector.tipo === 'livre' && (
                             <div className="flex items-center justify-center gap-6 py-4 bg-muted/10 rounded-2xl">
                                <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="w-4 h-4" /></Button>
                                <span className="font-black text-xl">{quantity}</span>
                                <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={() => setQuantity(quantity + 1)}><Plus className="w-4 h-4" /></Button>
                             </div>
                          )}

                          <Button 
                            disabled={selectedSector.tipo !== 'livre' && !selectedSeat}
                            onClick={handleAddToCart} 
                            className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.02] transition-transform gap-3"
                          >
                             <ShoppingCart className="w-6 h-6" /> {selectedSector.tipo !== 'livre' ? "Garantir Lugar" : "Adicionar ao Carrinho"}
                          </Button>

                          {selectedSeat?.categoria && selectedSeat.categoria !== 'comum' && (
                            <div className="flex gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                               <Info className="w-4 h-4 text-blue-600 shrink-0" />
                               <p className="text-[9px] text-blue-800 font-bold uppercase leading-tight">Este lugar possui reserva especial ({selectedSeat.categoria}). Será exigido documento comprobatório no acesso.</p>
                            </div>
                          )}
                       </div>
                    ) : (
                      <div className="p-10 text-center space-y-4 opacity-30">
                         <MapIcon className="w-8 h-8 mx-auto" />
                         <p className="text-[10px] font-black uppercase italic">Escolha um lugar no mapa para prosseguir</p>
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

function SectorMapViewer({ eventoId, setor, selectedSeat, onSelect, isReserving }: { eventoId: string, setor: any, selectedSeat: any, onSelect: (s: any) => void, isReserving: boolean }) {
  const db = useFirestore()
  const assentosQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events", eventoId, "setores", setor.id, "assentos"), orderBy("codigo", "asc"))
  }, [db, setor.id])

  const { data: assentos, loading } = useCollection<any>(assentosQuery)

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground opacity-20" /></div>

  return (
    <div className={cn(
      "grid gap-1.5 p-3 bg-white rounded-2xl border shadow-sm",
      setor.tipo === 'assentos' ? "grid-cols-8 sm:grid-cols-10 md:grid-cols-12" : "grid-cols-4 sm:grid-cols-6"
    )}>
       {assentos?.map((a: any) => {
         const isSelected = selectedSeat?.id === a.id;
         const isSold = a.status === 'vendido';
         const isReserved = a.status === 'reservado';
         const isBlocked = a.status === 'bloqueado';
         const isAvailable = a.status === 'disponivel';

         return (
           <TooltipProvider key={a.id}>
             <Tooltip>
                <TooltipTrigger asChild>
                   <button
                     disabled={!isAvailable || isReserving}
                     onClick={() => onSelect(a)}
                     className={cn(
                       "aspect-square rounded-[4px] border transition-all relative flex items-center justify-center group",
                       isAvailable ? "hover:scale-110 active:scale-95" : "cursor-not-allowed",
                       isSelected ? "bg-secondary border-secondary text-white shadow-lg z-10 scale-125" : 
                       isSold ? "bg-muted border-transparent opacity-20" :
                       isReserved ? "bg-orange-400 border-orange-400 text-white" :
                       isBlocked ? "bg-muted border-muted text-muted-foreground" : 
                       a.categoria === 'pcd' ? "bg-cyan-100 border-cyan-400 text-cyan-700" :
                       a.categoria === 'acompanhante' ? "bg-blue-50 border-blue-300 text-blue-600" :
                       a.categoria === 'obeso' ? "bg-orange-50 border-orange-300 text-orange-600" :
                       "bg-white border-muted-foreground/20"
                     )}
                   >
                      {a.categoria === 'pcd' && !isSelected ? <Accessibility className="w-2 h-2" /> :
                       a.categoria === 'acompanhante' && !isSelected ? <UserCheck className="w-2 h-2" /> :
                       a.categoria === 'obeso' && !isSelected ? <Accessibility className="w-2 h-2" /> :
                       <span className="text-[6px] font-black">{setor.tipo === 'assentos' ? a.codigo.slice(1) : a.codigo}</span>}
                      {isReserving && isSelected && <Loader2 className="absolute w-2 h-2 animate-spin text-white" />}
                   </button>
                </TooltipTrigger>
                <TooltipContent className="rounded-xl font-bold uppercase text-[9px] p-2">
                   {a.codigo} • {a.categoria !== 'comum' ? a.categoria : 'Comum'} • {isAvailable ? "Livre" : isSold ? "Ocupado" : isReserved ? "Reservado" : "Bloqueado"}
                </TooltipContent>
             </Tooltip>
           </TooltipProvider>
         )
       })}
    </div>
  )
}
