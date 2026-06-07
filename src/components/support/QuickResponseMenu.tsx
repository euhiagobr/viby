
"use client"

import * as React from "react"
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Zap, MessageSquare } from "lucide-react"

const QUICK_RESPONSES = [
  { 
    id: 'atendimento_iniciado', 
    title: 'Atendimento Iniciado', 
    text: `Olá, [cliente]!\n\nMeu nome é [nome] e a partir de agora serei responsável pelo seu atendimento.\n\nVou analisar sua solicitação e fazer o possível para ajudar da melhor forma.` 
  },
  { 
    id: 'solicitacao_recebida', 
    title: 'Solicitação Recebida', 
    text: `Olá, [cliente]!\n\nRecebemos sua solicitação e ela já está em análise pela nossa equipe.\n\nEm breve retornaremos com mais informações.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'aguardando_retorno', 
    title: 'Aguardando Informações', 
    text: `Olá, [cliente]!\n\nPrecisamos de algumas informações adicionais para continuar seu atendimento.\n\nAssim que possível, responda esta mensagem para que possamos prosseguir.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'problema_identificado', 
    title: 'Problema Identificado', 
    text: `Olá, [cliente]!\n\nIdentificamos a causa da situação relatada e estamos trabalhando na solução.\n\nRetornaremos assim que houver novidades.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'analise_tecnica', 
    title: 'Em Análise Técnica', 
    text: `Olá, [cliente]!\n\nSeu caso foi encaminhado para análise técnica.\n\nNossa equipe está avaliando os detalhes e retornará assim que possível.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'solicitacao_resolvida', 
    title: 'Solicitação Resolvida', 
    text: `Olá, [cliente]!\n\nRealizamos as verificações necessárias e a solicitação foi resolvida.\n\nPedimos que valide novamente e nos informe caso o problema persista.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'confirmacao_usuario', 
    title: 'Confirmação de Resolução', 
    text: `Olá, [cliente]!\n\nGostaríamos de confirmar se sua solicitação foi resolvida.\n\nCaso ainda precise de ajuda, basta responder esta mensagem que continuaremos o atendimento.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'inatividade', 
    title: 'Encerramento por Inatividade', 
    text: `Olá, [cliente]!\n\nNão recebemos novas mensagens em seu atendimento nos últimos dias.\n\nCaso ainda precise de ajuda, basta responder este ticket e nossa equipe continuará o atendimento.\n\nAtenciosamente,\n[nome]\n\n[dataHora]` 
  },
  { 
    id: 'encerramento', 
    title: 'Encerrar Atendimento', 
    text: `Olá, [cliente]!\n\nAgradecemos seu contato e a oportunidade de ajudar.\n\nNeste momento estamos encerrando este atendimento.\n\nCaso tenha qualquer dúvida ou precise de suporte novamente, basta abrir um novo ticket ou responder este atendimento.\n\nAtenciosamente,\n[nome]\n\n[dataHora]` 
  },
  { 
    id: 'agradecimento', 
    title: 'Agradecimento', 
    text: `Olá, [cliente]!\n\nObrigado por entrar em contato com a equipe da Viby.\n\nEstamos sempre trabalhando para oferecer a melhor experiência possível e ficamos felizes em ajudar.\n\nAtenciosamente,\n[nome]` 
  },
  { 
    id: 'solicitacao_concluida', 
    title: 'Caso Concluído', 
    text: `Olá, [cliente]!\n\nApós as verificações realizadas, consideramos sua solicitação concluída.\n\nSe precisar de qualquer ajuda no futuro, nossa equipe estará à disposição.\n\nAtenciosamente,\n[nome]\n\n[dataHora]` 
  }
]

interface QuickResponseMenuProps {
  onSelect: (text: string) => void
  ticketData: any
  agentName: string
}

export function QuickResponseMenu({ onSelect, ticketData, agentName }: QuickResponseMenuProps) {
  const [open, setOpen] = React.useState(false)

  const processText = (rawText: string) => {
    const now = new Date()
    const replacements: Record<string, string> = {
      '[nome]': agentName,
      '[cliente]': ticketData?.userName || 'Cliente',
      '[ticket]': ticketData?.protocol || '',
      '[email]': ticketData?.userEmail || '',
      '[data]': now.toLocaleDateString('pt-BR'),
      '[hora]': now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      '[dataHora]': now.toLocaleString('pt-BR'),
      '[evento]': ticketData?.eventTitle || 'Evento',
      '[organizacao]': ticketData?.orgName || 'Organização'
    }

    let processed = rawText
    Object.entries(replacements).forEach(([key, value]) => {
      processed = processed.split(key).join(value)
    })
    return processed
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 rounded-lg gap-2 font-black text-[9px] uppercase border-secondary/20 text-secondary bg-secondary/5">
          <Zap className="w-3 h-3 fill-current" /> Respostas Rápidas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl border-none shadow-2xl" align="start">
        <Command className="rounded-2xl border">
          <CommandInput placeholder="Buscar resposta..." className="h-10 text-xs" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="p-4 text-[10px] text-center font-bold uppercase text-muted-foreground opacity-40">Nenhuma resposta encontrada.</CommandEmpty>
            <CommandGroup heading="Modelos de Atendimento" className="p-2">
              {QUICK_RESPONSES.map((resp) => (
                <CommandItem
                  key={resp.id}
                  onSelect={() => {
                    onSelect(processText(resp.text))
                    setOpen(false)
                  }}
                  className="rounded-xl p-3 cursor-pointer"
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between">
                       <span className="font-black text-[10px] uppercase text-primary">{resp.title}</span>
                       <MessageSquare className="w-3 h-3 opacity-20" />
                    </div>
                    <p className="text-[9px] text-muted-foreground line-clamp-1 italic">"{resp.text.substring(0, 60)}..."</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
