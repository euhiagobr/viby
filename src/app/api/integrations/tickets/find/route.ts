
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { hashCPF, maskCPF } from '@/lib/crypto-utils';
import crypto from 'crypto';
import * as admin from 'firebase-admin';

/**
 * @fileOverview API Privada de Integração para busca de ingressos.
 * Autenticação via DB-backed API Tokens.
 */

const AUTHORIZED_DOMAINS = process.env.AUTHORIZED_DOMAINS?.split(',') || [];

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: Request) {
  const db = getAdminDb();

  // 1. Validação de CORS (Origem)
  const origin = req.headers.get('origin');
  if (process.env.NODE_ENV === 'production' && origin && !AUTHORIZED_DOMAINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  // 2. Autenticação via Token em Banco
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: "Unauthorized: Missing token" }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const hashedToken = hashToken(token);

  try {
    const tokenQuery = await db.collection('api_tokens')
      .where('hash', '==', hashedToken)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (tokenQuery.empty) {
      return NextResponse.json({ success: false, error: "Unauthorized: Invalid or revoked token" }, { status: 401 });
    }

    const tokenDoc = tokenQuery.docs[0];
    const tokenData = tokenDoc.data();

    // Verificação de Permissões
    if (!tokenData.permissions?.['tickets.find']) {
      return NextResponse.json({ success: false, error: "Forbidden: Missing permissions" }, { status: 403 });
    }

    // Registro de Uso
    await tokenDoc.ref.update({
      requestCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const { eventId, cpf } = await req.json();

    // 3. Validação de Payload
    if (!eventId || !cpf) {
      return NextResponse.json({ success: false, error: "eventId and cpf are required" }, { status: 400 });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ success: false, error: "Invalid CPF format" }, { status: 400 });
    }

    const hashedCpf = hashCPF(cleanCpf);

    // 4. Localizar Usuário pelo CPF Hash
    const usersSnap = await db.collection("users")
      .where("cpfHash", "==", hashedCpf)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    const userData = usersSnap.docs[0].data();
    const userId = usersSnap.docs[0].id;

    // 5. Localizar Ingresso Ativo e Pago
    const registrationsSnap = await db.collection("registrations")
      .where("eventId", "==", eventId)
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .where("paymentStatus", "in", ["Pago", "Disponível"])
      .limit(1)
      .get();

    if (registrationsSnap.empty) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    const reg = registrationsSnap.docs[0].data();
    const regId = registrationsSnap.docs[0].id;

    // 6. Buscar Detalhes do Evento
    let eventData: any = null;
    const eventDoc = await db.collection("events").doc(eventId).get();
    
    if (eventDoc.exists) {
      eventData = eventDoc.data();
    } else {
      const expDoc = await db.collection("experiences").doc(eventId).get();
      if (expDoc.exists) eventData = expDoc.data();
    }

    const ticketResponse = {
      id: regId,
      eventId: reg.eventId,
      eventTitle: reg.eventTitle || eventData?.title || "Evento Viby",
      ticketType: reg.ticketTypeName || "Geral",
      participantName: reg.userName || userData.name,
      participantCpf: userData.cpfMasked || maskCPF(cleanCpf),
      participantEmail: reg.userEmail || userData.email,
      orderNumber: reg.orderId || reg.ticketCode,
      status: reg.status,
      qrCode: reg.ticketCode,
      qrToken: regId,
      coverImage: eventData?.image || reg.eventImage || "",
      eventStartDate: eventData?.date?.toDate ? eventData.date.toDate().toISOString() : (eventData?.date || reg.eventDate),
      eventEndDate: eventData?.endDate?.toDate ? eventData.endDate.toDate().toISOString() : (eventData?.endDate || ""),
      location: eventData?.location || eventData?.address?.venueName || reg.eventCity || ""
    };

    return NextResponse.json({
      success: true,
      ticket: ticketResponse
    });

  } catch (error: any) {
    console.error("[Integration API Error]", error.message);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
