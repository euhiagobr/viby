'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { sendTicketEmail } from './email';

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

    // 1. PRÉ-VALIDAÇÃO: Verificar se já existe registro na coleção principal (Legado/Inconsistência)
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
      
      // BLOCO DE LEITURA
      for (const item of items) {
        const lockId = `free_lock_${userId}_${item.eventId}_${item.ticketTypeId}`;
        const lockRef = db.collection("registrations_locks").doc(lockId);
        
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

        if (!eventSnap.exists) throw new Error(`Document ${item.eventId} not found in ${sourceColl}`);

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

      // BLOCO DE ESCRITA
      for (const snap of snapshots) {
        const { item, lockRef, lockSnap, eventRef, eventSnap, orgRef, occRef, occSnap } = snap;
        const isFree = item.price === 0;

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
        const eventData = eventSnap.data();

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

        for (let i = 0; i < finalQty; i++) {
          const ticketCode = Math.random().toString(36).substring(2, 10).toUpperCase();
          const regRef = db.collection("registrations").doc();

          const ticketData = {
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
            checkedInAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          };

          transaction.set(regRef, ticketData);
          registrationIds.push(regRef.id);

          // Coleta dados para e-mail
          emailsToSend.push({
            to: userEmail,
            userName,
            eventTitle: item.eventTitle,
            ticketCode,
            eventDate: new Date(item.eventDate).toLocaleString('pt-BR'),
            eventCity: item.eventCity,
            voucherUrl: `https://viby.club/dashboard/ingressos/${regRef.id}/voucher`,
            usagePolicy: eventData?.usagePolicy || "",
            additionalInfo: eventData?.additionalInfo || ""
          });
        }
      }

      return { success: true, registrationIds };
    });

    // Disparar e-mails fora da transação
    for (const email of emailsToSend) {
      sendTicketEmail(email).catch(err => console.error("[Action Email Error]", err));
    }

    return results;
  } catch (error: any) {
    console.error("[Ticket Action Error]", error);
    return { success: false, error: error.message };
  }
}