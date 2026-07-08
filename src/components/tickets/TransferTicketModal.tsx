'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createTicketTransferAction } from '@/app/actions/ticket-transfers';
import {
  getSupportedCountries,
  getDocumentTypesForCountry,
  getDefaultDocumentType,
} from '@/lib/identity-validation';
import { maskDocument, isValidDocumentFormat } from '@/lib/identity-utils';
import { useUser } from '@/firebase';

interface TransferTicketModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  userId: string;
  eventTitle: string;
  onSuccess?: () => void;
  userCountry?: string;
}

export function TransferTicketModal({
  isOpen,
  onOpenChange,
  registrationId,
  userId,
  eventTitle,
  onSuccess,
  userCountry = 'BR',
}: TransferTicketModalProps) {
  const [country, setCountry] = React.useState<string>(userCountry);
  const [documentType, setDocumentType] = React.useState<string>('');
  const [documentValue, setDocumentValue] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const supportedCountries = getSupportedCountries();
  const documentTypes = getDocumentTypesForCountry(country);

  // Atualizar tipo de documento padrão quando país muda
  React.useEffect(() => {
    const defaultType = getDefaultDocumentType(country);
    setDocumentType(defaultType);
    setDocumentValue('');
    setError(null);
  }, [country]);

  const isValidFormat = documentValue
    ? isValidDocumentFormat(documentValue, country, documentType)
    : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!documentValue || !isValidFormat) {
      setError('Documento inválido');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createTicketTransferAction({
        registrationId,
        fromUserId: userId,
        recipientDocumentValue: documentValue,
        recipientCountry: country,
        recipientDocumentType: documentType,
        recipientEmail: email || undefined,
      });

      if (result.success) {
        toast({
          title: 'Transferência iniciada! 🎫',
          description: 'A solicitação foi enviada. O destinatário terá 7 dias para aceitar.',
        });
        onOpenChange(false);
        setDocumentValue('');
        setEmail('');
        onSuccess?.();
      } else {
        setError(result.error || 'Erro ao criar transferência');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar transferência');
    } finally {
      setIsLoading(false);
    }
  };

  const maskedValue = documentValue
    ? maskDocument(documentValue, country, documentType)
    : '';

  const countryNames: Record<string, string> = {
    BR: 'Brasil',
    AR: 'Argentina',
    CL: 'Chile',
    CO: 'Colômbia',
    PE: 'Peru',
    MX: 'México',
    ES: 'Espanha',
    US: 'Estados Unidos',
    FR: 'França',
    DE: 'Alemanha',
    IT: 'Itália',
    PT: 'Portugal',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black italic uppercase text-primary">
            Transferir Ingresso
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            <span className="font-semibold text-foreground">{eventTitle}</span>
            <br />
            Escolha o documento do destinatário para fazer a transferência.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* País */}
          <div className="space-y-2">
            <Label htmlFor="country" className="text-xs font-black uppercase">
              País
            </Label>
            <Select value={country} onValueChange={setCountry} disabled={isLoading}>
              <SelectTrigger
                id="country"
                className="h-10 rounded-lg border-secondary focus:ring-secondary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedCountries.map((countryCode) => (
                  <SelectItem key={countryCode} value={countryCode}>
                    {countryCode} - {countryNames[countryCode] || countryCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Documento */}
          <div className="space-y-2">
            <Label htmlFor="docType" className="text-xs font-black uppercase">
              Tipo de Documento
              <span className="text-secondary ml-2 text-[10px]">
                (Padrão: {documentType})</span>
            </Label>
            <Select
              value={documentType}
              onValueChange={setDocumentType}
              disabled={isLoading || !documentTypes.length}
            >
              <SelectTrigger
                id="docType"
                className="h-10 rounded-lg border-secondary focus:ring-secondary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Seu documento é {country === 'BR' ? 'CPF' : documentType}. Você pode alterar se necessário.
            </p>
          </div>

          {/* Campo de Documento */}
          <div className="space-y-2">
            <Label htmlFor="document" className="text-xs font-black uppercase">
              {documentType}
            </Label>
            <Input
              id="document"
              placeholder={`Digite o ${documentType}`}
              value={documentValue}
              onChange={(e) => {
                setDocumentValue(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              className="h-10 rounded-lg focus:ring-secondary"
            />
            {maskedValue && isValidFormat && (
              <p className="text-[10px] text-green-600 font-semibold">✓ {maskedValue}</p>
            )}
            {documentValue && !isValidFormat && (
              <p className="text-[10px] text-red-600 font-semibold">✗ Formato inválido</p>
            )}
          </div>

          {/* Email (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-black uppercase">
              Email do Destinatário
              <span className="text-muted-foreground ml-2 text-[10px]">(Opcional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-10 rounded-lg focus:ring-secondary"
            />
          </div>

          {/* Info */}
          <div className="flex gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600">
              O destinatário terá 7 dias para aceitar a transferência. Você pode cancelar a solicitação a qualquer momento.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 h-10 rounded-lg border-secondary"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isValidFormat || isLoading}
              className="flex-1 h-10 rounded-lg bg-primary text-white font-black uppercase"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Transferir Ingresso'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
