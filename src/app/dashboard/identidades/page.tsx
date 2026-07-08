/**
 * src/app/dashboard/identidades/page.tsx
 * 
 * Página para visualizar e gerenciar identidades do usuário.
 * 
 * Phase 4: Identity Management UI
 * - Listar identidades cadastradas
 * - Adicionar nova identidade
 * - Definir identidade principal
 * - Revogar identidade
 * 
 * Não implementa KYC ou upload de documentos (Phase 5+).
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Plus } from 'lucide-react';

import IdentityCard from '@/components/identity/IdentityCard';
import AddIdentityModal, { AddIdentityFormData } from '@/components/identity/AddIdentityModal';

import { serverCreateIdentity, serverSetPrimaryIdentity, serverRemoveIdentity, serverListUserIdentities } from '@/app/actions/identity';

interface IdentityData {
  id: string;
  country: string;
  documentType: string;
  documentMasked: string;
  status: 'pending' | 'verified' | 'expired' | 'revoked';
  level: 'self' | 'document_upload' | 'kyc';
  isActive: boolean;
  createdAt: Date;
}

export default function IdentidadesPage() {
  const auth = useAuth();
  const { user, loading: authLoading } = useUser(auth);
  const router = useRouter();

  const [identities, setIdentities] = useState<IdentityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Carregar identidades ao montar
  useEffect(() => {
    if (!user) return;
    loadIdentities();
  }, [user]);

  const loadIdentities = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await serverListUserIdentities(user.uid);

      if (!result.success) {
        setError('Erro ao carregar identidades. Tente novamente.');
        return;
      }

      const data: IdentityData[] = result.data.map((identity: any) => ({
        id: identity.id,
        country: identity.country,
        documentType: identity.documentType,
        documentMasked: identity.documentMasked,
        status: identity.verificationStatus || 'pending',
        level: identity.verificationLevel || 'self',
        isActive: identity.isActive || false,
        createdAt: new Date(identity.createdAt),
      }));

      setIdentities(data);
    } catch (err) {
      console.error('Erro ao carregar identidades:', err);
      setError('Erro ao carregar identidades. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIdentity = async (formData: AddIdentityFormData) => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      const result = await serverCreateIdentity({
        uid: user.uid,
        country: formData.country,
        documentType: formData.documentType,
        documentValue: formData.documentValue,
        verificationLevel: 'self',
      });

      if (!result.success) {
        setError(result.error?.message || 'Erro ao adicionar identidade');
        return;
      }

      // Atualizar lista
      setAddModalOpen(false);
      await loadIdentities();
    } catch (err: any) {
      console.error('Erro ao adicionar identidade:', err);
      setError(err.message || 'Erro ao adicionar identidade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimary = async (identityId: string) => {
    if (!user) return;

    try {
      const result = await serverSetPrimaryIdentity(user.uid, identityId);

      if (!result.success) {
        setError(result.error?.message || 'Erro ao definir identidade primária');
        return;
      }

      await loadIdentities();
    } catch (err: any) {
      console.error('Erro ao definir primária:', err);
      setError('Erro ao definir identidade primária');
    }
  };

  const handleRemove = async (identityId: string) => {
    if (!user) return;

    try {
      const result = await serverRemoveIdentity(user.uid, identityId);

      if (!result.success) {
        setError(result.error?.message || 'Erro ao revogar identidade');
        return;
      }

      await loadIdentities();
    } catch (err: any) {
      console.error('Erro ao revogar:', err);
      setError('Erro ao revogar identidade');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-white rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Redirecionando para login
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Minhas Identidades</h1>
            <p className="text-gray-600 mt-2">
              Gerencie suas identidades cadastradas
            </p>
          </div>
          <Button
            onClick={() => setAddModalOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Identidade
          </Button>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-700 hover:text-red-800 mt-1"
                >
                  Descartar
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sem identidades */}
        {identities.length === 0 && !error && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-gray-600 mb-4">
                Nenhuma identidade cadastrada ainda.
              </p>
              <Button onClick={() => setAddModalOpen(true)} variant="outline">
                Adicionar Primeira Identidade
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lista de Identidades */}
        {identities.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {identities.map((identity) => (
                <IdentityCard
                  key={identity.id}
                  id={identity.id}
                  country={identity.country}
                  documentType={identity.documentType}
                  documentMasked={identity.documentMasked}
                  status={identity.status}
                  level={identity.level}
                  isActive={identity.isActive}
                  createdAt={identity.createdAt}
                  onSetPrimary={!identity.isActive ? handleSetPrimary : undefined}
                  onRemove={handleRemove}
                  isLoading={isSubmitting}
                />
              ))}
            </div>
          </div>
        )}

        {/* Informações */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-900">
              ℹ️ Você pode ter múltiplas identidades. Uma delas será definida como "principal" e será usada para ingressos e transferências.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal Adicionar */}
      <AddIdentityModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSubmit={handleAddIdentity}
        isLoading={isSubmitting}
      />
    </div>
  );
}
