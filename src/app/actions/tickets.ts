'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

export async function generateFreeTickets(data: {
  userId: string;
  userName: string;
  userEmail: string;
  items: any[];
}) {
  try {
    const { userId, userName, userEmail, items } = data;
    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
      const results = [];

      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
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
            price: 0,
            paymentStatus: "Disponível",
            status: "active",
            checkedIn: false,
            checkedInAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
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