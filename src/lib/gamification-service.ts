
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc, 
  arrayUnion, 
  collection, 
  addDoc, 
  Firestore 
} from "firebase/firestore";
import { DEFAULT_LEVELS, calculateLevel } from "./gamification";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/**
 * @fileOverview Serviço para processar eventos de gamificação e atualizar o progresso do usuário.
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

  // TRAVA DE IDEMPOTÊNCIA: Verifica se este evento já foi processado
  const logId = uniqueId ? `${eventKey}_${uniqueId}` : null;
  if (logId) {
    try {
      const logRef = doc(db, "xp_logs", logId);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) {
        return; 
      }
    } catch (e: any) {
      // Se der erro de permissão na leitura do log, tratamos como se não existisse
      if (e.code !== 'permission-denied') {
        console.error("Erro ao verificar log de XP:", e);
      }
    }
  }

  try {
    // 0. Obter dados do usuário para localização e ranking
    let userProfile = preloadedUserData;
    if (!userProfile) {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) return;
      userProfile = userSnap.data();
    }

    // 1. Buscar a regra de XP para o evento
    const ruleRef = doc(db, "xp_rules", eventKey);
    const ruleSnap = await getDoc(ruleRef);
    
    let points = 0;
    if (ruleSnap.exists()) {
      points = ruleSnap.data().points || 0;
    } else {
      const fallbacks: Record<string, number> = {
        'on_signup': 50,
        'on_profile_complete': 100,
        'on_follow_org': 15,
        'on_follow_user': 10,
        'on_ticket_purchase': 30,
        'on_checkin': 100
      };
      points = fallbacks[eventKey] || 0;
    }

    if (points <= 0) return;

    // 2. Atualizar Progresso de Nível e XP Total
    const gamificationRef = doc(db, "user_gamification", userId);
    const gamificationSnap = await getDoc(gamificationRef);
    
    let currentTotalXp = points;
    if (gamificationSnap.exists()) {
      currentTotalXp = (gamificationSnap.data().totalXp || 0) + points;
    }

    const levelInfo = calculateLevel(currentTotalXp, DEFAULT_LEVELS);

    const gamificationData = {
      userId,
      totalXp: increment(points),
      level: levelInfo.current.level,
      levelName: levelInfo.current.name,
      lastActivityAt: serverTimestamp(),
      city: context?.city?.trim() || userProfile.city || null,
      neighborhood: context?.neighborhood?.trim() || null,
      state: userProfile.state || null,
      country: userProfile.country || "Brasil"
    };

    setDoc(gamificationRef, gamificationData, { merge: true })
      .catch(async (serverError) => {
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: gamificationRef.path,
            operation: 'write',
            requestResourceData: gamificationData
          }));
        }
      });

    // 3. Registrar Log de XP
    const logData = {
      userId,
      amount: points,
      reason: eventKey,
      timestamp: serverTimestamp(),
      context: context || {}
    };

    const logRef = logId ? doc(db, "xp_logs", logId) : doc(collection(db, "xp_logs"));
    setDoc(logRef, logData, { merge: true })
      .catch(async (serverError) => {
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: logRef.path,
            operation: 'write',
            requestResourceData: logData
          }));
        }
      });

    // 4. Atualizar Estatísticas Culturais
    const statsRef = doc(db, "cultural_stats", userId);
    const statsUpdate: any = {
      userId,
      lastActivityAt: serverTimestamp()
    };

    if (eventKey === 'on_ticket_purchase') statsUpdate.totalEvents = increment(1);
    if (eventKey === 'on_checkin') statsUpdate.totalCheckins = increment(1);

    if (context?.categoryName?.trim()) {
      const cat = context.categoryName.trim();
      statsUpdate.categoriesExplored = arrayUnion(cat);
      statsUpdate.topCategory = cat; 
    }

    if (context?.neighborhood?.trim()) {
      const neigh = context.neighborhood.trim();
      statsUpdate.neighborhoodsExplored = arrayUnion(neigh);
      statsUpdate.topNeighborhood = neigh;
    }

    if (context?.city?.trim()) {
      const city = context.city.trim();
      statsUpdate.citiesExplored = arrayUnion(city);
      statsUpdate.topCity = city;
    }

    if (context?.orgName?.trim()) {
      statsUpdate.favoriteOrganizers = arrayUnion(context.orgName.trim());
    }

    setDoc(statsRef, statsUpdate, { merge: true })
      .catch(async (serverError) => {
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: statsRef.path,
            operation: 'write',
            requestResourceData: statsUpdate
          }));
        }
      });

  } catch (error) {
    console.error("Erro ao processar gamificação:", error);
  }
}
