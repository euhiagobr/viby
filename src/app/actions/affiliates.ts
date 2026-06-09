
"use server"

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const firestore = getAdminDb();

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

    await userRef.update({ affiliateCode: newCode });

    await firestore.collection("affiliateCodes").doc(newCode).set({
      code: newCode,
      userId: userId,
      userName: userData.name || userData.displayName || "Membro Viby",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      commissionType: "default",
      commissionValue: 0.50 
    });
    
    const statsRef = firestore.collection("affiliate_stats").doc(userId);
    const statsSnap = await statsRef.get();
    if (!statsSnap.exists) {
        await statsRef.set({
          userId: userId,
          userName: userData.name || userData.displayName || "Membro Viby",
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

export async function generatePendingAffiliateCodesAction() {
    try {
        const usersSnapshot = await firestore.collection('users').get();
        let processedCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (!userData.affiliateCode) {
                const newCode = await generateUniqueCode();
                await userDoc.ref.update({ affiliateCode: newCode });

                await firestore.collection("affiliateCodes").doc(newCode).set({
                    code: newCode,
                    userId: userDoc.id,
                    userName: userData.name || userData.displayName || "Membro Viby",
                    active: true,
                    createdAt: FieldValue.serverTimestamp(),
                });

                const statsRef = firestore.collection("affiliate_stats").doc(userDoc.id);
                const statsSnap = await statsRef.get();
                if (!statsSnap.exists) {
                    await statsRef.set({
                        userId: userDoc.id,
                        userName: userData.name || userData.displayName || "Membro Viby",
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
                processedCount++;
            }
        }
        
        return { success: true, count: processedCount };
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

    const ranking = statsSnap.docs.map(d => ({
      id: d.id,
      name: d.data().userName || "Membro Viby",
      sales: d.data().totalTicketsSold || 0,
      level: d.data().currentLevel || 0
    }));

    return { success: true, ranking };
  } catch (e: any) {
    return { success: false, error: e.message, ranking: [] };
  }
}
