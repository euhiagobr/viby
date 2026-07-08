/**
 * AddIdentityModal.tsx
 * 
 * Modal para adicionar uma nova identidade.
 * Fluxo:
 * 1. Escolher país
 * 2. Escolher tipo de documento
 * 3. Informar documento
 * 4. Validar e criar
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  getSupportedCountries,
  getDocumentTypesForCountry,
  getValidationRule,
} from '@/lib/identity-validation';
import { maskDocument, isValidDocumentFormat } from '@/lib/identity-utils';

interface AddIdentityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddIdentityFormData) => Promise<void>;
  isLoading?: boolean;
}

export interface AddIdentityFormData {
  country: string;
  documentType: string;
  documentValue: string;
}

/**
 * Schema de validação usando Zod
 */
const createValidationSchema = (country?: string, documentType?: string) => {
  let schema: any = z.object({
    country: z.string().min(1, 'Selecione um país'),
    documentType: z.string().min(1, 'Selecione o tipo de documento'),
    documentValue: z.string().min(1, 'Informe o documento'),
  });

  if (country && documentType) {
    schema = schema.superRefine(async (data, ctx) => {
      if (!isValidDocumentFormat(data.documentValue, data.country, data.documentType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['documentValue'],
          message: `Formato inválido para ${data.documentType}`,
        });
      }
    });
  }

  return schema;
};

export function AddIdentityModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: AddIdentityModalProps) {
  const [selectedCountry, setSelectedCountry] = React.useState<string>('');
  const [selectedDocType, setSelectedDocType] = React.useState<string>('');

  const supportedCountries = getSupportedCountries();
  const documentTypes = selectedCountry
    ? getDocumentTypesForCountry(selectedCountry)
    : [];

  const validationSchema = createValidationSchema(selectedCountry, selectedDocType);

  const form = useForm<AddIdentityFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      country: '',
      documentType: '',
      documentValue: '',
    },
  });

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedDocType('');
    form.setValue('country', value);
    form.setValue('documentType', '');
  };

  const handleDocTypeChange = (value: string) => {
    setSelectedDocType(value);
    form.setValue('documentType', value);
  };

  const handleDocumentValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    if (selectedCountry && selectedDocType) {
      const rule = getValidationRule(selectedCountry, selectedDocType);
      if (rule) {
        // Remover caracteres especiais, manter apenas números e letras
        value = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        // Aplicar máximo de caracteres
        if (rule.maxLength) {
          value = value.substring(0, rule.maxLength);
        }
      }
    }

    form.setValue('documentValue', value);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      form.reset();
      setSelectedCountry('');
      setSelectedDocType('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao adicionar identidade:', error);
    }
  });

  const currentDocumentValue = form.watch('documentValue');
  const preview =
    selectedCountry && selectedDocType && currentDocumentValue
      ? maskDocument(currentDocumentValue, selectedCountry, selectedDocType)
      : '';

  const countryNames: Record<string, string> = {
    BR: 'Brasil 🇧🇷',
    AR: 'Argentina 🇦🇷',
    US: 'Estados Unidos 🇺🇸',
    ES: 'Espanha 🇪🇸',
    PT: 'Portugal 🇵🇹',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Identidade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* País */}
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={handleCountryChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um país" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {supportedCountries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {countryNames[country] || country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo de Documento */}
          {selectedCountry && (
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Documento</FormLabel>
                  <Select value={field.value} onValueChange={handleDocTypeChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Número do Documento */}
          {selectedDocType && (
            <FormField
              control={form.control}
              name="documentValue"
              render={() => {
                const rule = getValidationRule(selectedCountry, selectedDocType);
                return (
                  <FormItem>
                    <FormLabel>Número do Documento</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          placeholder={rule?.formatExample || 'Digite o número'}
                          value={currentDocumentValue}
                          onChange={handleDocumentValueChange}
                          disabled={isLoading}
                          maxLength={rule?.maxLength || 20}
                          className="font-mono"
                        />
                        {preview && (
                          <div className="p-2 bg-gray-50 rounded">
                            <p className="text-xs text-gray-500">Visualização:</p>
                            <p className="font-mono font-medium text-gray-900">
                              {preview}
                            </p>
                          </div>
                        )}
                        {rule?.helpText && (
                          <FormDescription>{rule.helpText}</FormDescription>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adicionando...' : 'Adicionar Identidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddIdentityModal;
