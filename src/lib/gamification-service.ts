
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
 * @fileOverview Serviço para processar eventos de gamificação e atualizar o progresso do usuário com travas de duplicidade e normalização de dados.
 */

export async function processGamificationEvent(
  db: Firestore, 
  userId: string, 
  eventKey: string, 
  context?: any,
  uniqueId?: string 
) {
  if (!db || !userId) return;

  // TRAVA DE IDEMPOTÊNCIA: Verifica se este evento já foi processado
  const logId = uniqueId ? `${eventKey}_${uniqueId}` : null;
  if (logId) {
    const logRef = doc(db, "xp_logs", logId);
    const logSnap = await getDoc(logRef);
    if (logSnap.exists()) {
      return; 
    }
  }

  try {
    // 0. Validar se o alvo é um usuário e obter dados de localização para ranking
    const userSnap = await getDoc(doc(db, "users", userId));
    if (!userSnap.exists()) return;
    const userProfile = userSnap.data();

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

    // 2. Atualizar Progresso de Nível e XP Total
    const gamificationRef = doc(db, "user_gamification", userId);
    const gamificationSnap = await getDoc(gamificationRef);
    
    let currentTotalXp = points;
    if (gamificationSnap.exists()) {
      currentTotalXp = (gamificationSnap.data().totalXp || 0) + points;
    }

    const levelInfo = calculateLevel(currentTotalXp, DEFAULT_LEVELS);

    // Espelha localização no documento de ranking para permitir queries scoped (Bairro, Cidade, etc)
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

    await setDoc(gamificationRef, gamificationData, { merge: true });

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

    // 4. Atualizar Estatísticas Culturais com Normalização
    const statsRef = doc(db, "cultural_stats", userId);
    
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

    // Normalização: Trim nas strings para evitar duplicados por espaços
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
      const org = context.orgName.trim();
      statsUpdate.favoriteOrganizers = arrayUnion(org);
    }

    await setDoc(statsRef, statsUpdate, { merge: true });

  } catch (error) {
    console.error("Erro ao processar gamificação:", error);
  }
}
