'use client';

import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  getDoc,
  serverTimestamp
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
 * @fileOverview Lógica central de checkout com correção de split financeiro.
 * Implementa o rateio unitário de descontos para garantir precisão no repasse.
 */
export async function executeCheckoutFlow(options: PayButtonOptions) {
  const { user, profile, items, totals } = options;

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

  // 1. FLUXO GRATUITO
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
  // Calculamos os dados financeiros unitários com precisão para o banco de dados
  const processedItems = items.map(item => {
    // IMPORTANTE: No carrinho, item.price pode já ser o valor com desconto.
    // Garantimos que o split oficial seja calculado sobre esse valor unitário final.
    const unitPrice = Number(item.price); 
    const financials = calculateFinancialBreakdown(unitPrice);
    
    return {
      ...item,
      financials
    };
  });

  const orderData = {
    userId: user.uid,
    userEmail: user.email,
    userName: profile?.name || user.displayName || "Comprador",
    items: processedItems,
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
  const stripeLineItems = processedItems.map(item => {
    const split = calculateVibyOfficialSplit(item.price);
    // Acumula a taxa de aplicação total para o Stripe PaymentIntent
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
    throw new Error("A organização deste evento ainda não configurou os recebimentos no Stripe.");
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
    throw new Error(stripeResult.error || "Erro ao iniciar sessão de pagamento.");
  }

  return { type: 'stripe', url: stripeResult.url };
}
