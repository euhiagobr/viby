import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { hashCPF, maskCPF } from '@/lib/crypto-utils';
import { safeParseDate } from '@/lib/utils';

/**
 * @fileOverview API Privada de Integração para busca de ingressos.
 * Regras: Autenticação Bearer, Validação de CPF (Hash), Filtro por Evento e Status de Pagamento.
 */

const INTEGRATION_TOKEN = process.env.INTEGRATION_TOKEN || 'viby_internal_dev_token';
const AUTHORIZED_DOMAINS = process.env.AUTHORIZED_DOMAINS?.split(',') || [];

export async function POST(req: Request) {
  // 1. Validação de CORS (Origem)
  const origin = req.headers.get('origin');
  if (process.env.NODE_ENV === 'production' && origin && !AUTHORIZED_DOMAINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  // 2. Autenticação Bearer Token
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${INTEGRATION_TOKEN}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { eventId, cpf } = await req.json();

    // 3. Validação de Payload
    if (!eventId || !cpf) {
      return NextResponse.json({ success: false, error: "eventId and cpf are required" }, { status: 400 });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ success: false, error: "Invalid CPF format" }, { status: 400 });
    }

    const db = getAdminDb();
    const hashedCpf = hashCPF(cleanCpf);

    // 4. Localizar Usuário pelo CPF Hash (Privacidade)
    const usersSnap = await db.collection("users")
      .where("cpfHash", "==", hashedCpf)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      console.log(`[Integration API] User not found for hashed CPF suffix: ${hashedCpf.slice(-6)}`);
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
      console.log(`[Integration API] Ticket not found for User ${userId} at Event ${eventId}`);
      return NextResponse.json({ success: false }, { status: 404 });
    }

    const reg = registrationsSnap.docs[0].data();
    const regId = registrationsSnap.docs[0].id;

    // 6. Buscar Detalhes do Evento (ou Experiência)
    let eventData: any = null;
    const eventDoc = await db.collection("events").doc(eventId).get();
    
    if (eventDoc.exists) {
      eventData = eventDoc.data();
    } else {
      const expDoc = await db.collection("experiences").doc(eventId).get();
      if (expDoc.exists) eventData = expDoc.data();
    }

    // 7. Construção do Objeto de Resposta Protegido
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
