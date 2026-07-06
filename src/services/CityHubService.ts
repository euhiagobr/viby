import { getAdminDb } from '@/lib/firebase/admin';
import { slugifyLocation } from '@/lib/city-utils';

const db = getAdminDb();

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) return String(data);
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }
  return data;
}

export async function fetchCityExperiences(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('experiences')
      .where('city', '==', cityName)
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityRestaurants(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('organizations')
      .where('city', '==', cityName)
      .where('type', '==', 'restaurant')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityBars(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('organizations')
      .where('city', '==', cityName)
      .where('type', '==', 'bar')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityCafes(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('organizations')
      .where('city', '==', cityName)
      .where('type', '==', 'cafe')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityCoupons(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('coupons')
      .where('city', '==', cityName)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityGiftCards(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('giftCards')
      .where('city', '==', cityName)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityMenus(cityName: string, limit: number = 8) {
  try {
    // Buscar organizações com menus na cidade
    const orgsSnap = await db.collection('organizations')
      .where('city', '==', cityName)
      .limit(100)
      .get();

    const menus = [];
    
    for (const orgDoc of orgsSnap.docs) {
      const org = orgDoc.data();
      const itemsSnap = await db.collection('organizations')
        .doc(orgDoc.id)
        .collection('menu_items')
        .limit(1)
        .get();

      if (!itemsSnap.empty) {
        menus.push({
          id: orgDoc.id,
          organizationId: orgDoc.id,
          organizationName: org.name || org.nome,
          organizationAvatar: org.avatar || org.logoUrl,
          hasMenu: true,
          ...org
        });
      }

      if (menus.length >= limit) break;
    }

    return serializeData(menus);
  } catch (e) {
    return [];
  }
}

export async function fetchCityReservations(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('reservations')
      .where('city', '==', cityName)
      .where('isAvailable', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}

export async function fetchCityTourism(cityName: string, limit: number = 12) {
  try {
    const q = db.collection('tourismAttractions')
      .where('city', '==', cityName)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snap = await q.get();
    return serializeData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) {
    return [];
  }
}
