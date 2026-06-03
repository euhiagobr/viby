'use client';

import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  getDoc
} from "firebase/firestore";
import { db as staticDb } from "@/firebase/database";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateFreeTickets } from "@/app/actions/tickets";
import { calculateVibyOfficialSplit, calculateFinancialBreakdown, toCents } from "@/lib/financial-utils";
import { CartItem } from "@/contexts/CartContext";

export interface PayButtonOptions {
  user: any;
  profile: any;
  items: CartItem[];
  totals: any;
  globalFees: any;
  promotions: any;
  orgsData: Record<string, any>;
  useBalance: boolean;
}

/**
 * @fileOverview Lógica central de checkout.
 * Garante que a criação de ingressos (gratuitos ou pagos) ocorra via Server Actions.
 */
export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals, orgsData } = options;

  if (!user) throw new Error("Usuário não identificado.");

  // Validação preliminar de estoque
  for (const item of items) {
    const eSnap = await getDoc(doc(staticDb, "events", item.eventId));
    if (!eSnap.exists()) throw new Error(`O evento ${item.eventTitle} não está mais disponível.`);
    
    const event = eSnap.data();
    const batch = event.batches?.find((b: any) => b.id === item.batchId);
    const type = batch?.ticketTypes?.find((t: any) => t.id === item.ticketTypeId);

    if (!batch || !type || type.quantity < item.quantity) {
      throw new Error(`A disponibilidade para o lote "${item.batchName}" do evento "${item.eventTitle}" mudou.`);
    }
  }
  
  const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;

  // 1. FLUXO GRATUITO (Via Server Action generateFreeTickets)
  if (isFreeOrder) {
    const result = await generateFreeTickets({
      userId: user.uid,
      userName: profile?.name || user.displayName || "Comprador",
      userEmail: user.email!,
      items: items
    });

    if (!result.success) throw new Error(result.error);
    return { type: 'free', success: true, registrationIds: result.registrationIds };
  }

  // 2. FLUXO PAGO (Stripe Connect)
  // O ticketCode será gerado apenas na finalização do pagamento (Server Side)
  const orderData = {
    userId: user.uid,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: items.map(item => ({
      ...item,
      financials: calculateFinancialBreakdown(item.price)
    })),
    totals: {
      subtotal: totals.subtotal,
      fees: totals.fees,
      balanceUsed: totals.balanceUsed,
      totalToPay: totals.total
    },
    status: 'pending',
    createdAt: serverTimestamp()
  };

  const orderRef = await addDoc(collection(staticDb, "orders"), orderData);

  let totalApplicationFeeCents = 0;
  const stripeLineItems = items.map(item => {
    const split = calculateVibyOfficialSplit(item.price);
    totalApplicationFeeCents += toCents(split.vibyApplicationFee) * item.quantity;
    
    return {
      price_data: {
        currency: 'brl',
        product_data: {
          name: `${item.eventTitle} - ${item.ticketTypeName}`,
          description: `Lote: ${item.batchName}${item.couponCode ? ` (Cupom: ${item.couponCode})` : ''}`,
          images: item.eventImage ? [item.eventImage] : []
        },
        unit_amount: toCents(split.totalCharged),
      },
      quantity: item.quantity,
    };
  });

  const firstOrgId = items[0].organizationId;
  const orgDoc = await getDoc(doc(staticDb, "organizations", firstOrgId));
  const stripeAccountId = orgDoc.data()?.stripeAccountId;

  if (!stripeAccountId) {
    throw new Error("A organização deste evento ainda não configurou os recebimentos.");
  }

  const stripeResult = await createCheckoutSession({
    userEmail: user.email!,
    lineItems: stripeLineItems,
    totalApplicationFeeCents,
    destinationStripeAccount: stripeAccountId,
    metadata: {
      type: "order_checkout",
      orderId: orderRef.id,
      userId: user.uid,
      balanceUsed: totals.balanceUsed.toString()
    }
  });

  if (!stripeResult.success) {
    await updateDoc(orderRef, { status: 'failed', error: stripeResult.error });
    throw new Error(stripeResult.error || "Erro ao iniciar checkout.");
  }

  return { type: 'stripe', url: stripeResult.url };
}
