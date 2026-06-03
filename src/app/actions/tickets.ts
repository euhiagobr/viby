'use server';

import { db } from '@/firebase/database';
import { collection, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { generateUniqueTicketCode } from '@/lib/ticket-utils';

/**
 * @fileOverview Server Action para geração de ingressos gratuitos.
 * Garante que a criação ocorra apenas no servidor.
 */

export async function generateFreeTickets(data: {
  userId: string;
  userName: string;
  userEmail: string;
  items: any[];
}) {
  try {
    const { userId, userName, userEmail, items } = data;

    return await runTransaction(db, async (transaction) => {
      const results = [];

      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketCode = await generateUniqueTicketCode(db);
          const regRef = doc(collection(db, "registrations"));

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
            price: 0,
            paymentStatus: "Disponível",
            status: "active", // Padrão solicitado: active, used, cancelled
            checkedIn: false,
            checkedInAt: null,
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp()
          };

          transaction.set(regRef, ticketData);
          results.push(regRef.id);
        }
      }

      return { success: true, registrationIds: results };
    });
  } catch (error: any) {
    console.error("[Ticket Action Error]", error);
    return { success: false, error: error.message };
  }
}
