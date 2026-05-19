
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, FileText, Loader2, Copy, Check } from "lucide-react"
import { Event } from "@/lib/mock-data"
import { gerarDescricaoEvento } from "@/ai/flows/gerar-descricao-evento"
import { gerarPropostaComercialSimplificada } from "@/ai/flows/gerar-proposta-comercial-simplificada"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"

interface AIToolsProps {
  event: Event
}

export function AITools({ event }: AIToolsProps) {
  const [loading, setLoading] = React.useState<'desc' | 'prop' | null>(null)
  const [result, setResult] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const handleGenerateDesc = async () => {
    setLoading('desc')
    try {
      const response = await gerarDescricaoEvento({
        nomeEvento: event.title,
        tipoEvento: event.type,
        dataEvento: event.date.toLocaleDateString('pt-BR'),
        localEvento: event.location,
        publicoAlvo: "Jovens e entusiastas de cultura",
        palavrasChave: ["Diversão", "Inovação", "Networking"]
      })
      setResult(response.descricao)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar descrição",
        description: "Ocorreu um problema ao processar seu pedido com a IA."
      })
    } finally {
      setLoading(null)
    }
  }

  const handleGenerateProposal = async () => {
    setLoading('prop')
    try {
      const response = await gerarPropostaComercialSimplificada({
        nomeEvento: event.title,
        dataEvento: event.date.toLocaleDateString('pt-BR'),
        localEvento: event.location,
        publicoAlvo: "Marcas focadas em tecnologia e estilo de vida",
        beneficiosPatrocinio: "Visibilidade em telões, stands exclusivos e posts patrocinados nas redes sociais."
      })
      setResult(response.propostaComercial)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar proposta",
        description: "Não foi possível criar a proposta comercial no momento."
      })
    } finally {
      setLoading(null)
    }
  }

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "Copiado!",
        description: "O texto foi copiado para sua área de transferência."
      })
    }
  }

  return (
    <Card className="border-none shadow-sm bg-primary text-primary-foreground">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5" />
          Viby AI Booster
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs opacity-80">Use nossa IA para alavancar a divulgação deste evento.</p>
        
        <div className="grid grid-cols-1 gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            className="w-full gap-2 font-bold"
            onClick={handleGenerateDesc}
            disabled={!!loading}
          >
            {loading === 'desc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Otimizar Descrição
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2 bg-transparent border-white/20 hover:bg-white/10 text-white"
            onClick={handleGenerateProposal}
            disabled={!!loading}
          >
            {loading === 'prop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Gerar Proposta Comercial
          </Button>
        </div>

        {result && (
          <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold opacity-70">Resultado da IA:</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={copyToClipboard}>
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <Textarea 
              value={result} 
              readOnly 
              className="bg-white/10 border-none text-white text-xs min-h-[150px] focus-visible:ring-0"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
