'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const TERMS_CONTENT = `Ao clicar em aceitar os termos e publicar este evento ou experiência, você ("Organizador") firma um acordo com validade legal e declara estar ciente e de acordo com as seguintes obrigações para a realização da atividade cadastrada:

1. Veracidade e Responsabilidade Legal

- O Organizador declara que todas as informações cadastradas (data, local, horário, cronograma, atrações e valores) são verdadeiras e precisas.
- O Organizador atesta possuir todas as autorizações, alvarás, laudos de segurança e licenças exigidas por lei para a realização deste evento ou experiência.

2. Execução da Atividade e Isenção da Plataforma

- A plataforma Viby atua exclusivamente como fornecedora de tecnologia para a venda e gestão de ingressos.
- A produção, estrutura física, segurança, controle de acesso, cumprimento de roteiros, fornecimento de itens e a entrega da oferta ao consumidor são de responsabilidade integral, única e exclusiva do Organizador. A Viby está isenta de qualquer responsabilidade civil ou criminal sobre ocorrências físicas durante o evento ou experiência.

3. Condições Comerciais e Repasses

- Comissão e Taxas: O Organizador está ciente da condição comercial vigente, que o isenta da comissão da plataforma para este evento ou experiência. A Viby aplicará uma taxa de conveniência no momento do checkout, que será paga exclusivamente pelo comprador final.
- Repasses: O saldo das vendas será liquidado na conta vinculada do Organizador (Stripe Connect) conforme os prazos de processamento do gateway de pagamento, sujeitos a retenções por segurança antifraude.

4. Regras de Cancelamento e Reembolsos

- Reembolso Legal (CDC): O Organizador autoriza a Viby a processar estornos automáticos aos compradores que solicitarem o cancelamento em até 7 dias após a compra, desde que o pedido ocorra com no mínimo 48 horas de antecedência do início do evento ou experiência.
- Cancelamento pelo Organizador: Caso o Organizador decida cancelar, adiar ou alterar substancialmente o cronograma ou local deste evento ou experiência, ele assume 100% da responsabilidade financeira pelo estorno aos compradores.
- Proteção de Taxas: Em caso de cancelamento motivado pelo Organizador, as taxas operacionais e de processamento (gateway financeiro) não são reembolsáveis. O Organizador autoriza expressamente a Viby a debitar de seu saldo as taxas perdidas para garantir o estorno integral ao comprador.

5. Responsabilidade sobre Chargebacks

- O Organizador assume o risco financeiro de contestações de compra (chargebacks) realizadas pelos compradores junto às administradoras de cartão de crédito. Valores contestados e eventuais multas aplicadas pelo gateway serão descontados do saldo do Organizador.

Assinatura Eletrônica: O aceite eletrônico deste termo no ato da publicação do evento ou experiência constitui concordância expressa e irrevogável com todas as cláusulas acima, tendo a mesma validade de um contrato assinado fisicamente.`;

interface TermsAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

export function TermsAcceptanceModal({ open, onOpenChange, onAccept }: TermsAcceptanceModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 10;
    setScrolledToBottom(isAtBottom);
  };

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  React.useEffect(() => {
    setScrolledToBottom(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl font-black uppercase italic">
            Termos e Políticas para Organizadores
          </DialogTitle>
        </DialogHeader>

        {/* Área de conteúdo com HEIGHT FIXA e SCROLL VERTICAL REAL */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {TERMS_CONTENT}
          </div>
        </div>

        {/* Rodapé FIXO com botões */}
        <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl"
          >
            Fechar
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!scrolledToBottom}
            className="flex-1 rounded-2xl font-bold bg-secondary text-white hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scrolledToBottom ? 'Aceitar' : 'Role até o final para aceitar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
