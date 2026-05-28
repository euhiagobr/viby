
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc, 
  collection, 
  Firestore 
} from "firebase/firestore";
import { DEFAULT_LEVELS, calculateLevel } from "./gamification";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/**
 * @fileOverview Motor transacional de gamificação para processar ações sociais e culturais.
 */

export async function processGamificationEvent(
  db: Firestore, 
  userId: string, 
  eventKey: string, 
  context?: any,
  uniqueId?: string,
  preloadedUserData?: any
) {
  if (!db || !userId) return;

  // Trava de IDEMPOTÊNCIA (Prevenir duplicação por refresh ou cliques múltiplos)
  const logId = uniqueId ? `${eventKey}_${uniqueId}` : null;
  if (logId) {
    try {
      const logRef = doc(db, "xp_logs", logId);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) return; 
    } catch (e: any) {
      if (e.code !== 'permission-denied') console.error("XP Check Error:", e);
    }
  }

  try {
    // 1. Resolver Pontuação
    const ruleRef = doc(db, "xp_rules", eventKey);
    const ruleSnap = await getDoc(ruleRef);
    
    let points = 0;
    if (ruleSnap.exists()) {
      points = ruleSnap.data().points || 0;
    } else {
      const defaults: Record<string, number> = {
        'on_signup': 50,
        'on_follow_org': 15,
        'on_follow_user': 10,
        'on_ticket_purchase': 30,
        'on_checkin': 100
      };
      points = defaults[eventKey] || 0;
    }

    if (points <= 0) return;

    // 2. Atualizar Nível e XP Total (Sincronizado)
    const gamificationRef = doc(db, "user_gamification", userId);
    const gamificationSnap = await getDoc(gamificationRef);
    
    let currentXp = points;
    if (gamificationSnap.exists()) {
      currentXp = (gamificationSnap.data().totalXp || 0) + points;
    }

    const { current, next } = calculateLevel(currentXp, DEFAULT_LEVELS);

    const updateData = {
      userId,
      totalXp: increment(points),
      level: current.level,
      levelName: current.name,
      nextLevelXp: next?.xpRequired || currentXp,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(gamificationRef, updateData, { merge: true });

    // 3. Registrar Log (Auditoria)
    const logData = {
      userId,
      amount: points,
      reason: eventKey,
      timestamp: serverTimestamp(),
      context: context || {}
    };

    const logRef = logId ? doc(db, "xp_logs", logId) : doc(collection(db, "xp_logs"));
    await setDoc(logRef, logData, { merge: true });

    // 4. Sincronizar campo legível no Perfil Principal
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { 
      totalXp: increment(points),
      level: current.level,
      updatedAt: serverTimestamp()
    });

  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `gamification/${userId}`,
        operation: 'write'
      }));
    }
    console.error("Gamification Process Failure:", error);
  }
}
