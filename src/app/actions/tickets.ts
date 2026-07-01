
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { sendTicketEmail } from './email';

/**
 * Gera ingressos gratuitos (ou via cupom 100%) garantindo o envio de e-mail com detalhes completos.
 */
export async function generateFreeTickets(data: {
  userId: string;
  userName: string;
  userEmail: string;
  items: any[];
}) {
  try {
    const { userId, userName, userEmail, items } = data;
    const db = getAdminDb();
    const emailsToSend: any[] = [];

    // 1. PRÉ-VALIDAÇÃO: Verificar se já existe registro na coleção principal (Trava de Unicidade)
    for (const item of items) {
      if (item.price === 0 && item.productType !== 'experience') {
        const legacyCheck = await db.collection("registrations")
          .where("userId", "==", userId)
          .where("eventId", "==", item.eventId)
          .where("ticketTypeId", "==", item.ticketTypeId)
          .where("price", "==", 0)
          .limit(1)
          .get();

        if (!legacyCheck.empty) {
          throw new Error("Você já resgatou este ingresso gratuito.");
        }
      }
    }

    const results = await db.runTransaction(async (transaction) => {
      const registrationIds = [];
      const snapshots: any[] = [];
      
      // --- BLOCO DE LEITURA (MANDATÓRIO ANTES DAS ESCRITAS) ---
      for (const item of items) {
        const lockId = `free_lock_${userId}_${item.eventId}_${item.ticketTypeId}`;
        const lockRef = db.collection("registrations_locks").doc(lockId);
        
        // Resolvedor Dinâmico de Coleção
        const sourceColl = item.productType === 'experience' ? "experiences" : "events";
        const eventRef = db.collection(sourceColl).doc(item.eventId);
        const orgRef = db.collection("organizations").doc(item.organizationId);
        
        let occRef = null;
        if (item.productType === 'experience' && item.occurrenceId) {
          occRef = db.collection("experiences").doc(item.eventId).collection("slots").doc(item.occurrenceId);
        } else if (item.occurrenceId) {
          occRef = db.collection("recurring_occurrences").doc(item.occurrenceId);
        }

        const [lockSnap, eventSnap, orgSnap, occSnap] = await Promise.all([
          transaction.get(lockRef),
          transaction.get(eventRef),
          transaction.get(orgRef),
          occRef ? transaction.get(occRef) : Promise.resolve(null)
        ]);

        if (!eventSnap.exists) throw new Error(`Documento ${item.eventId} não localizado em ${sourceColl}`);

        snapshots.push({
          item,
          lockRef,
          lockSnap,
          eventRef,
          eventSnap,
          orgRef,
          occRef,
          occSnap
        });
      }

      // --- BLOCO DE ESCRITA ---
      for (const snap of snapshots) {
        const { item, lockRef, lockSnap, eventRef, eventSnap, orgRef, occRef, occSnap } = snap;
        const isFree = item.price === 0;
        const eventInfo = eventSnap.data();

        if (isFree && item.productType !== 'experience' && lockSnap.exists) {
          throw new Error("Você já resgatou este ingresso gratuito.");
        }

        if (isFree && item.productType !== 'experience') {
          transaction.set(lockRef, { 
            userId, 
            eventId: item.eventId, 
            ticketTypeId: item.ticketTypeId,
            createdAt: admin.firestore.FieldValue.serverTimestamp() 
          });
        }

        const finalQty = isFree ? 1 : item.quantity;

        // Atualização de Inventário
        if (item.productType === 'experience' && occRef && occSnap && occSnap.exists) {
           transaction.update(occRef, {
             sold: admin.firestore.FieldValue.increment(finalQty),
             updatedAt: admin.firestore.FieldValue.serverTimestamp()
           });
        } else {
          transaction.update(eventRef, {
            ingressosVendidos: admin.firestore.FieldValue.increment(finalQty),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          if (occRef && occSnap && occSnap.exists) {
            transaction.update(occRef, {
              ingressosVendidos: admin.firestore.FieldValue.increment(finalQty),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }

        transaction.update(orgRef, {
          totalAttendeesCount: admin.firestore.FieldValue.increment(finalQty),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Criação dos Registros (Registrations)
        for (let i = 0; i < finalQty; i++) {
          const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
          const regRef = db.collection("registrations").doc();

          transaction.set(regRef, {
            ticketCode,
            userId,
            userName,
            userEmail,
            eventId: item.eventId,
            eventTitle: item.eventTitle,
            eventImage: item.eventImage || "",
            eventDate: item.eventDate,
            eventCity: item.eventCity,
            organizationId: item.organizationId,
            organizerId: item.organizerId,
            ticketTypeId: item.ticketTypeId,
            ticketTypeName: item.ticketTypeName,
            batchId: item.batchId,
            batchName: item.batchName,
            occurrenceId: item.occurrenceId || null,
            productType: item.productType || 'event',
            price: 0,
            paymentStatus: "Disponível",
            status: "active",
            checkedIn: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          registrationIds.push(regRef.id);

          // Preparar dados para o e-mail (Sanitizado)
          emailsToSend.push({
            to: userEmail,
            userName,
            eventTitle: item.eventTitle,
            ticketCode,
            eventDate: new Date(item.eventDate).toLocaleString('pt-BR'),
            eventCity: item.eventCity,
            voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`,
            usagePolicy: String(eventInfo?.usagePolicy || "").trim(),
            additionalInfo: String(eventInfo?.additionalInfo || "").trim(),
            description: eventInfo?.description || "",
            inclusions: eventInfo?.inclusions || [],
            exclusions: eventInfo?.exclusions || [],
            rules: eventInfo?.rules || []
          });
        }
      }

      return { success: true, registrationIds };
    });

    // Disparar e-mails fora da transação (Seguro)
    for (const email of emailsToSend) {
      sendTicketEmail(email).catch(err => console.error("[Action Email Error]", err));
    }

    return results;
  } catch (error: any) {
    console.error("[Ticket Action Error]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reenvia um ingresso com todos os metadados oficiais, incluindo regras de uso e QR visual.
 */
export async function resendTicketAction(registrationId: string) {
  try {
    const db = getAdminDb();
    const regSnap = await db.collection("registrations").doc(registrationId).get();
    if (!regSnap.exists) throw new Error("Ingresso não encontrado.");
    const reg = regSnap.data()!;

    // Resolvendo coleção baseada no tipo para capturar regras de uso reais
    const sourceColl = reg.productType === 'experience' ? "experiences" : "events";
    const eventSnap = await db.collection(sourceColl).doc(reg.eventId).get();
    const event = eventSnap.exists ? eventSnap.data() : null;

    const dateVal = reg.eventDate?.toDate ? reg.eventDate.toDate() : new Date(reg.eventDate);

    await sendTicketEmail({
      to: reg.userEmail,
      userName: reg.userName || "Participante",
      eventTitle: reg.eventTitle,
      ticketCode: reg.ticketCode,
      eventDate: dateVal.toLocaleString('pt-BR'),
      eventCity: reg.eventCity,
      voucherUrl: `https://viby.club/dashboard/ingressos/${registrationId}/voucher`,
      usagePolicy: String(event?.usagePolicy || "").trim(),
      additionalInfo: String(event?.additionalInfo || "").trim(),
      description: event?.description || "",
      inclusions: event?.inclusions || [],
      exclusions: event?.exclusions || [],
      rules: event?.rules || []
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
