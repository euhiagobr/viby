
"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Send, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { serverTimestamp, collection, addDoc } from "firebase/firestore"
import { useFirestore } from "@/firebase"
import { toast } from "@/hooks/use-toast"

export function ReportDialog({ isOpen, onOpenChange, eventId, eventTitle, userId }: any) {
  const db = useFirestore()
  const [reason, setReason] = React.useState("")
  const [desc, setDesc] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !userId || !reason) return

    setLoading(true)
    try {
      await addDoc(collection(db, "reports"), {
        type: 'event',
        targetId: eventId,
        targetName: eventTitle,
        reason,
        description: desc,
        reporterId: userId,
        status: 'Pendente',
        timestamp: serverTimestamp()
      })
      toast({ title: "Denúncia enviada!", description: "Nossa equipe analisará este evento." })
      onOpenChange(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center mb-2 mx-auto text-destructive">
               <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-center">Denunciar Evento</DialogTitle>
            <DialogDescription className="text-center font-medium">Sua denúncia ajuda a manter a comunidade Viby segura.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Motivo da Denúncia</Label>
                <Select value={reason} onValueChange={setReason} required>
                   <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="Fraude ou Golpe">Fraude ou Golpe</SelectItem>
                      <SelectItem value="Conteúdo Impróprio">Conteúdo Impróprio</SelectItem>
                      <SelectItem value="Evento Falso">Evento Inexistente</SelectItem>
                      <SelectItem value="Violação de Direitos">Violação de Direitos</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Detalhes (Opcional)</Label>
                <Textarea 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  placeholder="Descreva o que aconteceu..." 
                  className="rounded-xl min-h-[100px] resize-none"
                />
             </div>
          </div>

          <DialogFooter>
             <Button type="submit" disabled={loading || !reason} className="w-full bg-destructive text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Flag className="w-5 h-5 mr-2" />}
                Enviar Denúncia
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
