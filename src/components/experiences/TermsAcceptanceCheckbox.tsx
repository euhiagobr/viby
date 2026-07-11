'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TermsAcceptanceModal } from './TermsAcceptanceModal';
import { AlertCircle } from 'lucide-react';

interface TermsAcceptanceCheckboxProps {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  isTermsUpdated?: boolean;
}

export function TermsAcceptanceCheckbox({ accepted, onAcceptedChange, isTermsUpdated }: TermsAcceptanceCheckboxProps) {
  const [modalOpen, setModalOpen] = React.useState(false);

  const handleAcceptModal = () => {
    onAcceptedChange(true);
  };

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setModalOpen(true);
  };

  return (
    <>
      <TermsAcceptanceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAccept={handleAcceptModal}
      />

      <div className="space-y-4">
        {/* Alerta quando os termos foram atualizados */}
        {isTermsUpdated && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-900">
              Os Termos e Políticas foram atualizados. Por favor, releia e aceite a nova versão para continuar.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 py-4">
          <Checkbox
            id="accept-organizer-terms"
            checked={accepted}
            disabled={true}
            className="mt-1 h-5 w-5 rounded-lg cursor-not-allowed opacity-70"
          />
          <label htmlFor="accept-organizer-terms" className="text-sm font-bold leading-tight">
            Li e concordo com os{' '}
            <button
              type="button"
              onClick={openModal}
              className="text-secondary hover:underline font-black cursor-pointer"
            >
              Termos e Políticas para Organizadores
            </button>{' '}
            da Viby
          </label>
        </div>
      </div>
    </>
  );
}
