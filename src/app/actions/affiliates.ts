
"use server"

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const firestore = getAdminDb();

// Helper to generate a unique 10-digit numeric code
const generateUniqueCode = async (): Promise<string> => {
  let code = "";
  let isUnique = false;
  while (!isUnique) {
    code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const doc = await firestore.collection("affiliateCodes").doc(code).get();
    if (!doc.exists) {
      isUnique = true;
    }
  }
  return code;
};

export async function generateAffiliateCodeAction(params: { userId: string }) {
  const { userId } = params;
  if (!userId) {
    return { success: false, error: "Usuário não autenticado." };
  }

  try {
    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userDoc.exists || !userData) {
      return { success: false, error: "Usuário não encontrado." };
    }

    if (userData.affiliateCode) {
      return { success: false, error: "Usuário já possui um código de afiliado." };
    }

    const newCode = await generateUniqueCode();

    // Update user document
    await userRef.update({ affiliateCode: newCode });

    // Create entry in affiliateCodes collection
    await firestore.collection("affiliateCodes").doc(newCode).set({
      code: newCode,
      userId: userId,
      userName: userData.name || "Usuário Viby",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      commissionType: "default",
      commissionValue: 0 
    });
    
    // Also create the stats doc if it doesn't exist
    const statsRef = firestore.collection("affiliate_stats").doc(userId);
    const statsSnap = await statsRef.get();
    if (!statsSnap.exists) {
        await statsRef.set({
          userId: userId,
          totalTicketsSold: 0,
          totalUsersReferred: 0,
          totalOrgsLinked: 0,
          currentLevel: 0,
          balances: {
            BRL: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
            USD: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
            EUR: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 }
          },
          updatedAt: FieldValue.serverTimestamp()
        });
    }

    return { success: true, code: newCode };
  } catch (e: any) {
    console.error("Error generating affiliate code:", e);
    return { success: false, error: e.message };
  }
}

export async function requestAffiliatePayout(params: {
    userId: string,
    amount: number,
    currency: string,
    pixKey: string,
    pixType: string,
    bankDetails: string
}) {
    const { userId, amount, currency, pixKey, pixType, bankDetails } = params;

    if (!userId || !amount || !currency) {
        return { success: false, error: "Parâmetros inválidos." };
    }

    try {
        await firestore.collection("affiliate_payouts").add({
            userId,
            amount,
            currency,
            status: "Pendente",
            method: currency === "BRL" ? "PIX" : "Bank Transfer",
            details: currency === "BRL" ? { pixKey, pixType } : { bankDetails },
            createdAt: FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error requesting payout:", e);
        return { success: false, error: e.message };
    }
}

export async function generatePendingAffiliateCodesAction() {
    try {
        const usersSnapshot = await firestore.collection('users').where('affiliateCode', '==', null).get();
        const allUsersSnapshot = await firestore.collection('users').get();

        if (usersSnapshot.empty) {
            return { success: true, count: 0, skipped: allUsersSnapshot.size, errors: 0 };
        }

        let processedCount = 0;
        let errorCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            try {
                const newCode = await generateUniqueCode();
                await userDoc.ref.update({ affiliateCode: newCode });

                await firestore.collection("affiliateCodes").doc(newCode).set({
                    code: newCode,
                    userId: userDoc.id,
                    userName: userDoc.data().name || "N/A",
                    active: true,
                    createdAt: FieldValue.serverTimestamp(),
                });
                processedCount++;
            } catch (e) {
                console.error(`Failed to generate code for user ${userDoc.id}:`, e);
                errorCount++;
            }
        }
        
        const skippedCount = allUsersSnapshot.size - processedCount;

        return { success: true, count: processedCount, skipped: skippedCount, errors: errorCount };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getAffiliatePublicRanking() {
  try {
    const statsSnap = await firestore.collection("affiliate_stats")
      .orderBy("totalTicketsSold", "desc")
      .limit(10)
      .get();

    const ranking = await Promise.all(statsSnap.docs.map(async (d) => {
      const data = d.data();
      const userSnap = await firestore.collection("users").doc(d.id).get();
      const userData = userSnap.data();
      
      return {
        name: userData?.name || userData?.displayName || "Membro Viby",
        sales: data.totalTicketsSold || 0,
        level: data.currentLevel || 0,
        orgs: data.totalOrgsLinked || 0
      };
    }));

    return { success: true, ranking };
  } catch (e: any) {
    console.error("[Affiliate Action] Ranking Error:", e.message);
    return { success: false, error: e.message, ranking: [] };
  }
}
