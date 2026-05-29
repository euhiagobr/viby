'use client';

import { serverTimestamp, increment } from "firebase/firestore";
import { FirestoreService } from "@/lib/firestore-safe";
import { createCheckoutSession } from "@/app/actions/stripe";
import { generateUniqueTicketCode } from "@/lib/ticket-utils";
import { calculateFinancialBreakdown } from "@/lib/financial-utils";
import { sendTicketEmail } from "@/app/actions/email";
import { CartItem } from "@/contexts/CartContext";
import { processGamificationEvent } from "@/lib/gamification-service";
import { db as staticDb } from "@/firebase/database";

/**
 * @fileOverview TRACE: Orquestrador de Pagamentos.
 */

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

export async function executeCheckoutFlow(options: PayButtonOptions) {
  console.group("[TRACE-VIBY] Checkout Flow Pipeline");
  console.log("STEP 1: Initializing Flow", { items: options.items.length, total: options.totals.total });

  const { user, profile, items, totals, globalFees, promotions, orgsData, useBalance } = options;

  try {
    if (!user) throw new Error("TRACE: User missing in flow");
    
    const isFreeOrder = totals.total <= 0 && totals.balanceUsed === 0;
    const registrationIds: string[] = [];
    const lineItems: any[] = [];

    console.log("STEP 2: Processing Items & Pre-registrations");
    
    for (const item of items) {
      console.log(`  > Item: ${item.eventTitle} (${item.quantity}x)`);
      const breakdown = calculateFinancialBreakdown(item.price, globalFees, promotions, orgsData[item.organizationId]);

      for (let i = 0; i < item.quantity; i++) {
        console.log(`    - Generating Ticket ${i+1}/${item.quantity}`);
        const ticketCode = await generateUniqueTicketCode(staticDb);
        
        const regData = {
          eventId: item.eventId,
          eventTitle: item.eventTitle,
          userId: user.uid,
          paymentStatus: isFreeOrder ? "Disponível" : "Pendente",
          ticketCode,
          timestamp: serverTimestamp()
        };

        // O CRASH ACONTECE AQUI SE O SINGLETON ESTIVER ERRADO
        console.log("    - Calling FirestoreService.add...");
        const docRef = await FirestoreService.add("registrations", regData);
        registrationIds.push(docRef.id);
        console.log("    - Registration Created ID:", docRef.id);
      }
    }

    console.log("STEP 3: Preparing Stripe Session");
    // ... restante do fluxo será mapeado se chegar aqui
    
    const stripeResult = await createCheckoutSession({
      eventTitle: items.length > 1 ? "Múltiplos Ingressos" : items[0].eventTitle,
      totalAmount: Math.round(totals.total * 100),
      userEmail: user.email!,
      metadata: {
        type: "cart_checkout",
        registrationIds: registrationIds.join(","),
        userId: user.uid
      }
    });

    console.log("STEP 4: Stripe Response Received", !!stripeResult.url);
    console.groupEnd();
    
    return { type: 'stripe', url: stripeResult.url };

  } catch (e: any) {
    console.error("[TRACE-VIBY] PIPELINE FAILED", e);
    console.groupEnd();
    throw e;
  }
}
