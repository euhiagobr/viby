'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { hashDocument, maskDocument, normalizeDocument } from '@/lib/identity-utils';
import { hasEventEnded } from '@/lib/ticket-expiry';
import { recordAuditLog } from './audit';

interface CreateTransferParams {
  registrationId: string;
  fromUserId: string;
  recipientDocumentValue: string;
  recipientCountry: string;
  recipientDocumentType: string;
  recipientEmail?: string;
}

interface RespondTransferParams {
  transferId: string;
  userId: string;
  action: 'accept' | 'reject';
}

/**
 * Cria uma solicitação de transferência de ingresso
 * O ingresso permanece com o proprietário atual até aceitar
 */
export async function createTicketTransferAction(params: CreateTransferParams) {
  const db = getAdminDb();

  try {
    // 1. Validar ingresso
    const regRef = db.collection('registrations').doc(params.registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      throw new Error('Ingresso não encontrado');
    }

    const registration = regSnap.data();

    // Verificar se o usuário é o dono
    if (registration.userId !== params.fromUserId) {
      throw new Error('Você não é o proprietário deste ingresso');
    }

    // Validar se evento já terminou
    const eventEndDate = registration.eventEndDate || registration.eventDate;
    const eventEndTime = registration.eventEndTime;
    if (eventEndDate && hasEventEnded(eventEndDate, eventEndTime)) {
      throw new Error('Ingressos de eventos finalizados não podem ser transferidos');
    }

    // Não permitir transferência se já há uma pendente
    const existingTransfer = await db
      .collection('ticket_transfers')
      .where('ticketId', '==', params.registrationId)
      .where('status', 'in', ['pending', 'accepted'])
      .limit(1)
      .get();

    if (!existingTransfer.empty) {
      throw new Error('Já existe uma transferência em andamento para este ingresso');
    }

    // 2. Normalizar e calcular hash do documento do destinatário
    const normalized = normalizeDocument(
      params.recipientDocumentValue,
      params.recipientCountry,
      params.recipientDocumentType
    );
    const docHash = hashDocument(
      params.recipientDocumentValue,
      params.recipientCountry,
      params.recipientDocumentType
    );
    const docMasked = maskDocument(
      params.recipientDocumentValue,
      params.recipientCountry,
      params.recipientDocumentType
    );

    // 3. Buscar identidade existente do destinatário
    // (não bloqueia a criação, mas ajuda a identificar se já conhecemos o usuário)
    const identityQuery = await db
      .collection('user_identities')
      .where('documentHash', '==', docHash)
      .limit(1)
      .get();

    let toUserId: string | null = null;
    if (!identityQuery.empty) {
      toUserId = identityQuery.docs[0].data().userId;
    }

    // 4. Criar documento de transferência
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

    const transferRef = db.collection('ticket_transfers').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await transferRef.set({
      ticketId: params.registrationId,
      eventId: registration.eventId,
      fromUserId: params.fromUserId,
      toUserId: toUserId || null,
      toIdentityHash: docHash,
      toCountry: params.recipientCountry,
      toDocumentType: params.recipientDocumentType,
      toDocumentMasked: docMasked,
      toEmail: params.recipientEmail || null,
      status: 'pending',
      requestedAt: now,
      respondedAt: null,
      acceptedAt: null,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      auditTrail: [
        {
          action: 'created',
          by: params.fromUserId,
          when: now,
        },
      ],
    });

    // 5. Registrar auditoria
    await recordAuditLog({
      action: 'ticket_transfer_created',
      userId: params.fromUserId,
      resourceType: 'ticket',
      resourceId: params.registrationId,
      details: {
        transferId: transferRef.id,
        toIdentity: `${params.recipientCountry}:${params.recipientDocumentType}:${docMasked}`,
        toUserId: toUserId,
      },
    });

    return {
      success: true,
      transferId: transferRef.id,
      message: 'Transferência criada! O destinatário terá 7 dias para aceitar.',
    };
  } catch (error: any) {
    console.error('Erro ao criar transferência:', error);
    return {
      success: false,
      error: error.message || 'Erro ao criar transferência',
    };
  }
}

/**
 * Aceita ou rejeita uma transferência de ingresso
 */
export async function respondTransferAction(params: RespondTransferParams) {
  const db = getAdminDb();

  try {
    // 1. Validar transferência
    const transferRef = db.collection('ticket_transfers').doc(params.transferId);
    const transferSnap = await transferRef.get();

    if (!transferSnap.exists) {
      throw new Error('Transferência não encontrada');
    }

    const transfer = transferSnap.data();

    // Verificar status
    if (transfer.status !== 'pending') {
      throw new Error(`Transferência já foi ${transfer.status}`);
    }

    // Verificar expiração
    const now = new Date();
    const expiresAt = transfer.expiresAt.toDate();
    if (now > expiresAt) {
      throw new Error('Transferência expirou');
    }

    // 2. Se ação for ACEITAR, confirmar identidade do usuário
    if (params.action === 'accept') {
      // Buscar identidade do usuário para validar
      const userIdentities = await db
        .collection('user_identities')
        .where('userId', '==', params.userId)
        .where('country', '==', transfer.toCountry)
        .where('documentType', '==', transfer.toDocumentType)
        .limit(1)
        .get();

      if (userIdentities.empty) {
        throw new Error('Documento não encontrado em sua conta');
      }

      // Verificar se o hash bate
      const userIdentity = userIdentities.docs[0];
      if (userIdentity.data().documentHash !== transfer.toIdentityHash) {
        throw new Error('Dados não coincidem');
      }
    }

    // 3. Atualizar transferência
    const respondedAt = admin.firestore.FieldValue.serverTimestamp();
    const updateData: any = {
      status: params.action === 'accept' ? 'accepted' : 'rejected',
      respondedAt,
      toUserId: params.action === 'accept' ? params.userId : null,
      auditTrail: admin.firestore.FieldValue.arrayUnion({
        action: params.action === 'accept' ? 'accepted' : 'rejected',
        by: params.userId,
        when: respondedAt,
      }),
    };

    if (params.action === 'accept') {
      updateData.acceptedAt = respondedAt;
    }

    await transferRef.update(updateData);

    // 4. Se aceitar, transferir o ingresso
    if (params.action === 'accept') {
      const registrationRef = db.collection('registrations').doc(transfer.ticketId);
      await registrationRef.update({
        userId: params.userId,
        transferredFrom: transfer.fromUserId,
        transferredAt: respondedAt,
        transferId: params.transferId,
      });
    }

    // 5. Registrar auditoria
    await recordAuditLog({
      action: `ticket_transfer_${params.action}`,
      userId: params.userId,
      resourceType: 'ticket_transfer',
      resourceId: params.transferId,
      details: {
        ticketId: transfer.ticketId,
        fromUserId: transfer.fromUserId,
        toUserId: params.userId,
      },
    });

    return {
      success: true,
      message: params.action === 'accept' 
        ? 'Ingresso transferido com sucesso!' 
        : 'Transferência recusada',
    };
  } catch (error: any) {
    console.error('Erro ao responder transferência:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar transferência',
    };
  }
}
