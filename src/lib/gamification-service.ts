
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

/**
 * @fileOverview Serviço para processar eventos de gamificação e atualizar o progresso do usuário com travas de duplicidade.
 */

export async function processGamificationEvent(
  db: Firestore, 
  userId: string, 
  eventKey: string, 
  context?: any,
  uniqueId?: string // ID que torna o evento único (ex: ID da compra, ID do checkin)
) {
  if (!db || !userId) return;

  // TRAVA DE IDEMPOTÊNCIA: Verifica se este evento já foi processado
  const logId = uniqueId ? `${eventKey}_${uniqueId}` : null;
  if (logId) {
    const logRef = doc(db, "xp_logs", logId);
    const logSnap = await getDoc(logRef);
    if (logSnap.exists()) {
      return; // Já computado, evita duplicidade de XP e Stats
    }
  }

  try {
    // 1. Buscar a regra de XP para o evento
    const ruleRef = doc(db, "xp_rules", eventKey);
    const ruleSnap = await getDoc(ruleRef);
    
    let points = 0;
    if (ruleSnap.exists()) {
      points = ruleSnap.data().points || 0;
    } else {
      // Fallbacks caso o banco não esteja semeado
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
      lastActivityAt: serverTimestamp()
    };

    if (gamificationSnap.exists()) {
      await updateDoc(gamificationRef, gamificationData);
    } else {
      await setDoc(gamificationRef, { ...gamificationData, totalXp: points });
    }

    // 3. Registrar Log de XP
    const logData = {
      userId,
      amount: points,
      reason: eventKey,
      timestamp: serverTimestamp(),
      context: context || {}
    };

    if (logId) {
      await setDoc(doc(db, "xp_logs", logId), logData);
    } else {
      await addDoc(collection(db, "xp_logs"), logData);
    }

    // 4. Atualizar Estatísticas Culturais
    const statsRef = doc(db, "cultural_stats", userId);
    const statsSnap = await getDoc(statsRef);
    
    const statsUpdate: any = {
      userId,
      lastActivityAt: serverTimestamp()
    };

    if (eventKey === 'on_ticket_purchase') {
      statsUpdate.totalEvents = increment(1);
    }

    if (eventKey === 'on_checkin') {
      statsUpdate.totalCheckins = increment(1);
    }

    if (context?.categoryName) {
      statsUpdate.categoriesExplored = arrayUnion(context.categoryName);
      statsUpdate.topCategory = context.categoryName; 
    }

    if (context?.neighborhood) {
      statsUpdate.neighborhoodsExplored = arrayUnion(context.neighborhood);
      statsUpdate.topNeighborhood = context.neighborhood;
    }

    if (context?.city) {
      statsUpdate.citiesExplored = arrayUnion(context.city);
      statsUpdate.topCity = context.city;
    }

    if (context?.orgName) {
      statsUpdate.favoriteOrganizers = arrayUnion(context.orgName);
    }

    if (statsSnap.exists()) {
      await updateDoc(statsRef, statsUpdate);
    } else {
      await setDoc(statsRef, {
        ...statsUpdate,
        categoriesExplored: context?.categoryName ? [context.categoryName] : [],
        neighborhoodsExplored: context?.neighborhood ? [context.neighborhood] : [],
        citiesExplored: context?.city ? [context.city] : [],
        favoriteOrganizers: context?.orgName ? [context.orgName] : [],
        totalEvents: eventKey === 'on_ticket_purchase' ? 1 : 0,
        totalCheckins: eventKey === 'on_checkin' ? 1 : 0
      });
    }

  } catch (error) {
    console.error("Erro ao processar gamificação:", error);
  }
}
