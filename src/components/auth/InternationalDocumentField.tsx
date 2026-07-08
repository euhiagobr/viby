/**
 * @fileOverview Componente para seleção de documento internacional
 * Renderiza campo de entrada específico por país/tipo
 * 
 * Phase 3: Validação frontend por país
 */

import React from 'react';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDocumentTypesForCountry, maskDocument } from '@/lib/identity-utils';
import { getValidationRule } from '@/lib/identity-validation';
import { Fingerprint, Loader2, Check, X } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

interface InternationalDocumentFieldProps {
  country: string;
  form: UseFormReturn<any>;
  isChecking?: boolean;
  validationStatus?: 'idle' | 'valid' | 'invalid' | 'taken';
}

/**
 * Componente que renderiza campo de documento específico por país
 */
export function InternationalDocumentField({
  country,
  form,
  isChecking = false,
  validationStatus = 'idle',
}: InternationalDocumentFieldProps) {
  const documentTypes = getDocumentTypesForCountry(country);
  const selectedType = form.watch('documentType');
  const documentValue = form.watch('documentValue');
  const validationRule = selectedType ? getValidationRule(country, selectedType) : null;

  // Auto-selecionar documentType quando há apenas 1 tipo disponível
  React.useEffect(() => {
    if (documentTypes.length === 1 && !selectedType) {
      form.setValue('documentType', documentTypes[0]);
    }
  }, [documentTypes, selectedType, form]);

  // Placeholder específico por país
  const getPlaceholder = (): string => {
    if (!validationRule) return 'Número do documento';
    return validationRule.formatExample;
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Tipo de Documento */}
      {documentTypes.length > 1 && (
        <FormField
          control={form.control}
          name="documentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">
                Tipo de Documento
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-14 rounded-2xl border-dashed border-primary/20">
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

      {/* Campo de Entrada do Documento */}
      {selectedType && (
        <FormField
          control={form.control}
          name="documentValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">
                {selectedType}
              </FormLabel>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <FormControl>
                  <Input
                    placeholder={getPlaceholder()}
                    className="h-14 rounded-2xl pl-12 pr-10 font-mono border-dashed border-primary/20"
                    {...field}
                    onChange={(e) => {
                      // Remover caracteres especiais, manter apenas números e letras
                      const cleaned = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
                      field.onChange(cleaned);
                    }}
                  />
                </FormControl>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  ) : validationStatus === 'valid' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : validationStatus === 'invalid' || validationStatus === 'taken' ? (
                    <X className="w-4 h-4 text-destructive" />
                  ) : null}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Mensagem Informativa */}
      {validationRule && (
        <p className="text-xs text-muted-foreground px-1">
          Formato: {validationRule.formatExample}
          {validationRule.hasChecksum && ' (com validação)'}
        </p>
      )}
    </div>
  );
}
