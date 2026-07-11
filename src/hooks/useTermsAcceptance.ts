import { useState, useEffect, useMemo } from 'react';
import { CURRENT_TERMS_VERSION } from '@/lib/terms-version';

interface UseTermsAcceptanceProps {
  isEditing?: boolean;
  initialData?: any;
}

interface UseTermsAcceptanceReturn {
  termsAccepted: boolean;
  setTermsAccepted: (accepted: boolean) => void;
  isTermsUpdated: boolean;
  shouldRequireAcceptance: boolean;
}

/**
 * Hook centralizado para gerenciar aceite de termos
 * Reutilizável em todos os fluxos de criação e edição
 */
export function useTermsAcceptance({ isEditing, initialData }: UseTermsAcceptanceProps): UseTermsAcceptanceReturn {
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Verificar versão dos termos ao carregar (criação ou edição)
  useEffect(() => {
    // Na criação: termsAccepted começa false, usuário deve aceitar
    if (!isEditing) {
      setTermsAccepted(false);
      return;
    }

    // Na edição: verificar versão aceita anteriormente
    if (isEditing && initialData?.termsAcceptance) {
      const acceptedVersion = initialData.termsAcceptance.version;
      const versionMismatch = acceptedVersion !== CURRENT_TERMS_VERSION;

      if (versionMismatch) {
        // Versão dos termos foi atualizada, requer novo aceite
        setTermsAccepted(false);
      } else {
        // Mesma versão, pode manter aceito
        setTermsAccepted(true);
      }
    } else if (isEditing && !initialData?.termsAcceptance) {
      // Evento antigo sem termsAcceptance, requer novo aceite
      setTermsAccepted(false);
    }
  }, [isEditing, initialData]);

  // Detectar se os termos foram atualizados em relação à versão aceita
  const isTermsUpdated = useMemo(() => {
    if (!isEditing || !initialData?.termsAcceptance) return false;
    return initialData.termsAcceptance.version !== CURRENT_TERMS_VERSION;
  }, [isEditing, initialData]);

  // Verificar se deve exigir aceite (sempre true para criar/editar)
  const shouldRequireAcceptance = useMemo(() => {
    return true; // Aceite é sempre obrigatório
  }, []);

  return {
    termsAccepted,
    setTermsAccepted,
    isTermsUpdated,
    shouldRequireAcceptance,
  };
}
