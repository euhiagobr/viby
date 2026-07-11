'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface OrganizerTermsCheckboxProps {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
}

export function OrganizerTermsCheckbox({ accepted, onAcceptChange }: OrganizerTermsCheckboxProps) {
  const [scrolledToBottom, setScrolledToBottom] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setScrolledToBottom(isAtBottom);
    }
  };

  const handleViewTerms = () => {
    window.open('/termos', '_blank');
  };

  return (
    <Card className="border-2 border-dashed border-secondary/30 rounded-[2rem] bg-secondary/5">
      <CardContent className="p-8 space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-black uppercase italic text-primary">
            Aceitar Termos e Políticas
          </h3>
          <p className="text-sm font-medium text-muted-foreground">
            Leia atentamente os termos abaixo e role até o final para aceitar.
          </p>
        </div>

        {/* Scrollable terms preview */}
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="max-h-60 overflow-y-auto bg-white rounded-2xl border-2 border-dashed border-muted/30 p-6 space-y-4"
        >
          <div className="space-y-3 text-xs leading-relaxed">
            <h4 className="font-black uppercase text-sm text-primary">Termos e Políticas para Organizadores de Eventos — Viby</h4>
            
            <p>Bem-vindo à Viby! Para garantir o sucesso do seu evento e a segurança de todos os participantes, estabelecemos este Acordo de Prestação de Serviços ("Acordo").</p>

            <div className="space-y-2">
              <p className="font-bold text-primary">1. O Papel da Viby (Nossas Responsabilidades)</p>
              <p>A Viby atua estritamente como uma prestadora de serviços de tecnologia, oferecendo a infraestrutura necessária para a gestão e comercialização de ingressos.</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-primary">2. O Papel do Organizador (Suas Responsabilidades)</p>
              <p>O Organizador é o proprietário e único responsável legal, civil e criminal pelo evento.</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-primary">3. Regras Financeiras, Taxas e Repasses</p>
              <p>A Viby isenta o Organizador do pagamento da comissão de plataforma. O Organizador receberá o valor integral nominal do ingresso.</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-primary">4. Política de Reembolso e Chargebacks</p>
              <p>O Organizador reconhece e concorda que opera em conformidade com o Código de Defesa do Consumidor (CDC) e as políticas da Viby.</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-primary">5. Responsabilidades do Comprador</p>
              <p>Ao utilizar a plataforma, o cliente final também possui obrigações que o Organizador deve conhecer.</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-primary">6. Validade Jurídica (Clickwrap Agreement)</p>
              <p>O Organizador reconhece que a marcação do checkbox constitui sua assinatura eletrônica. O sistema registrará o aceite com data, hora e IP.</p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        {!scrolledToBottom && (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-secondary/60 animate-bounce">
            <ChevronDown className="w-4 h-4" />
            Role até o final para aceitar
          </div>
        )}

        {/* Botão para ver termos completos */}
        <Button
          type="button"
          variant="outline"
          onClick={handleViewTerms}
          className="w-full rounded-2xl border-2 border-secondary/50 text-secondary font-bold hover:bg-secondary/10"
        >
          Ver Termos Completos
        </Button>

        {/* Checkbox */}
        <div className="pt-4 border-t-2 border-dashed border-muted/30 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(checked) => onAcceptChange(checked === true)}
              disabled={!scrolledToBottom}
              className={`mt-1 h-5 w-5 rounded-lg ${!scrolledToBottom ? 'opacity-50' : ''}`}
            />
            <label
              htmlFor="accept-terms"
              className={`text-sm font-bold leading-tight ${scrolledToBottom ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            >
              Li e concordo com os Termos e Políticas para Organizadores da Viby
            </label>
          </div>

          {scrolledToBottom && (
            <p className="text-xs text-muted-foreground font-medium">
              ✓ Você pode agora confirmar
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
