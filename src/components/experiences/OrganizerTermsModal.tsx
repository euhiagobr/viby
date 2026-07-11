'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ExternalLink } from 'lucide-react';

const ORGANIZER_TERMS = `# Termos e Políticas para Organizadores de Eventos — Viby

Bem-vindo à Viby! Para garantir o sucesso do seu evento e a segurança de todos os participantes, estabelecemos este Acordo de Prestação de Serviços ("Acordo"). Ao marcar a caixa de seleção *"Aceito os termos e políticas de eventos da Viby"* durante a criação do seu evento, você (doravante "Organizador") firma um contrato legalmente vinculativo com a plataforma Viby.

Leia atentamente as cláusulas abaixo, pois elas definem as responsabilidades operacionais e financeiras da nossa parceria.

## 1. O Papel da Viby (Nossas Responsabilidades)

A Viby atua estritamente como uma prestadora de serviços de tecnologia, oferecendo a infraestrutura necessária para a gestão e comercialização de ingressos. Nossas obrigações consistem em:

- Fornecer a plataforma digital para a publicação do evento e venda de ingressos.
- Processar os pagamentos de forma segura através do nosso gateway financeiro integrado (Stripe).
- Gerar e disponibilizar os ingressos digitais (QR Codes) para os compradores aprovados.
- Fornecer ao Organizador as ferramentas tecnológicas para controle de acesso (check-in) no dia do evento.
- **Isenção de Responsabilidade Física:** A Viby não é produtora, co-produtora ou financiadora dos eventos divulgados. Não nos responsabilizamos por infraestrutura física, alvarás, segurança, controle de tráfego, qualidade do som, fornecimento de bebidas ou qualquer ocorrência no mundo físico durante a realização do evento.

## 2. O Papel do Organizador (Suas Responsabilidades)

O Organizador é o proprietário e único responsável legal, civil e criminal pelo evento. Ao publicar um evento na Viby, o Organizador compromete-se a:

- Garantir que todas as informações divulgadas na página do evento sejam verdadeiras, claras e precisas.
- Possuir todas as licenças, alvarás de funcionamento, laudos do Corpo de Bombeiros e autorizações de órgãos públicos e de direitos autorais (ex: Ecad) necessários para a realização legal do evento.
- Entregar aos participantes exatamente o que foi prometido na descrição do evento (horários, atrações, open bar, estrutura, etc.).
- Garantir a segurança física dos participantes, contratando equipe qualificada para a gestão do espaço.

## 3. Regras Financeiras, Taxas e Repasses

- **Condição Especial de Lançamento:** Atualmente, a Viby isenta o Organizador do pagamento da comissão de plataforma. O Organizador receberá o valor integral nominal do ingresso definido na criação do evento.
- **Taxa de Serviço:** Será cobrada uma taxa de serviço (conveniência) adicionada ao valor do ingresso, paga integralmente pelo comprador final. Esta taxa remunera a plataforma Viby.
- **Processamento e Liquidação:** Os valores arrecadados nas vendas são processados pela Stripe. O repasse ao Organizador ocorrerá conforme o fluxo de liquidação da conta Stripe Connect, sujeito aos prazos de D+30 (ou outro prazo acordado) e às políticas antifraude do gateway de pagamento.

## 4. Política de Reembolso, Cancelamento e Chargebacks (Cláusula de Proteção)

O Organizador reconhece e concorda que opera em conformidade com o Código de Defesa do Consumidor (CDC) e as políticas da Viby:

- **Reembolso por Arrependimento (Automático):** A Viby processará automaticamente o estorno integral para compras canceladas pelo usuário em até 7 dias após a transação, desde que a solicitação ocorra com antecedência mínima de 48 horas do início do evento.
- **Cancelamento ou Alteração do Evento:** Se o Organizador cancelar, adiar ou alterar substancialmente o evento (mudança de local ou atração principal), ele assume a responsabilidade total pelo estorno aos compradores.
- **Retenção de Taxas (Culpa do Organizador):** Em caso de cancelamentos em massa motivados pelo Organizador, as taxas de serviço da plataforma e os custos de processamento do gateway (cartão de crédito/Pix) **não são reembolsáveis**. O Organizador autoriza expressamente a Viby e a Stripe a debitarem do seu saldo retido, ou do seu método de pagamento cadastrado, o valor correspondente a essas taxas perdidas, a fim de garantir a devolução de 100% do valor aos compradores sem gerar prejuízos à plataforma.
- **Chargebacks (Contestação de Compra):** O Organizador é o único responsável financeiro por chargebacks (compras contestadas diretamente na operadora de cartão). A Viby debitará o valor do ingresso contestado, acrescido das eventuais multas aplicadas pelo gateway, diretamente do saldo do Organizador.

## 5. Responsabilidades do Comprador (Cliente Final)

Ao utilizar a plataforma, o cliente final também possui obrigações que o Organizador deve conhecer:

- Fornecer dados cadastrais e financeiros verdadeiros.
- Proteger o seu QR Code, evitando o compartilhamento em redes sociais ou com terceiros para prevenir falsificações.
- Respeitar a janela de 48 horas de antecedência do evento para o acionamento da garantia de reembolso automático (CDC).

## 6. Validade Jurídica (Clickwrap Agreement)

O Organizador reconhece que a marcação do checkbox *"Aceito os termos e políticas de eventos da Viby"* no momento da criação do evento constitui sua assinatura eletrônica. O sistema da plataforma registrará o aceite, incluindo data, hora e endereço de IP, servindo como prova irrefutável da concordância com todas as cláusulas deste Acordo.`;

interface OrganizerTermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizerTermsModal({ open, onOpenChange }: OrganizerTermsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] rounded-[2.5rem]">
        <DialogHeader className="relative pr-12">
          <DialogTitle className="text-2xl font-black uppercase italic text-primary">
            Termos e Políticas para Organizadores
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-0 top-0 p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-120px)] pr-4">
          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-4 pb-4">
            {ORGANIZER_TERMS.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('#')) {
                const level = paragraph.match(/^#+/)?.[0].length || 1;
                const text = paragraph.replace(/^#+\s/, '');
                const className = 
                  level === 1 ? 'text-2xl font-black uppercase italic tracking-tighter' :
                  level === 2 ? 'text-lg font-black uppercase italic tracking-tight mt-6' :
                  'text-base font-bold';
                return <h3 key={idx} className={`${className} text-primary`}>{text}</h3>;
              }
              
              if (paragraph.startsWith('-')) {
                return (
                  <ul key={idx} className="space-y-2 ml-4">
                    {paragraph.split('\n').map((item, i) => (
                      <li key={i} className="flex gap-3 text-muted-foreground font-medium">
                        <span className="text-secondary font-bold flex-shrink-0">•</span>
                        <span>{item.replace(/^-\s/, '')}</span>
                      </li>
                    ))}
                  </ul>
                );
              }
              
              return <p key={idx} className="text-muted-foreground font-medium">{paragraph}</p>;
            })}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
