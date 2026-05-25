
"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Flag, Loader2, Send } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

export function ReportDialog({ isOpen, onOpenChange, eventId, eventTitle, userId }: any) {
  const db = useFirestore()
  const [reason, setReason] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !reason) return

    setLoading(true)
    try {
      await addDoc(collection(db, "reports"), {
        type: 'event',
        targetId: eventId,
        targetName: eventTitle,
        reason,
        description,
        reporterId: userId || 'anonymous',
        status: 'Pendente',
        timestamp: serverTimestamp()
      })
      toast({ title: "Denúncia enviada!", description: "Analisaremos em até 48h." })
      onOpenChange(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar denúncia" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2.5rem]">
        <form onSubmit={handleSendReport} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              Denunciar Evento
            </DialogTitle>
            <DialogDescription>Relate irregularidades ou suspeitas de fraude.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Motivo</Label>
                <Select value={reason} onValueChange={setReason} required>
                   <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="Fraude">Fraude ou Golpe</SelectItem>
                      <SelectItem value="Incorreto">Informações Erradas</SelectItem>
                      <SelectItem value="Ofensivo">Conteúdo Impróprio</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-60">Descrição</Label>
                <Textarea placeholder="Detalhes do ocorrido..." value={description} onChange={(e) => setDescription(e.target.value)} required className="rounded-xl min-h-[120px]" />
             </div>
          </div>

          <DialogFooter>
             <Button type="submit" disabled={loading} className="w-full bg-destructive text-white font-black h-14 rounded-2xl shadow-xl uppercase italic">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Enviar Denúncia
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
