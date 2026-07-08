import LandingPageClient from "@/app/LandingPageClient";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useTranslation } from "@/i18n/server";
import { getAdminDb } from "@/lib/firebase/admin";

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
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

async function getInitialEvents() {
  try {
    const db = getAdminDb();
    const now = new Date();
    
    // Primeiro, tenta com índice composto (endDate + status)
    // Se não existir, o Firebase retorna um erro com link para criar
    try {
      const snap = await db.collection('events')
        .where('status', '==', 'Ativo')
        .where('endDate', '>=', now)
        .orderBy('endDate', 'asc')
        .limit(60)
        .get();
      
      const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return serializeData(events);
    } catch (indexError: any) {
      // Se falhar por índice, tenta abordagem alternativa com date
      console.warn('[getInitialEvents] Usando fallback sem índice composto');
      const snap = await db.collection('events')
        .where('status', '==', 'Ativo')
        .orderBy('date', 'asc')
        .limit(120)
        .get();
      
      const events = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => {
          const endDate = e.endDate || e.date;
          if (!endDate) return false;
          const endTime = new Date(endDate).getTime();
          return endTime >= now.getTime();
        })
        .slice(0, 60);
      
      return serializeData(events);
    }
  } catch (e) {
    console.error('[getInitialEvents Error]', e);
    return [];
  }
}

export default async function Home() {
  const { t } = await useTranslation();
  const initialEvents = await getInitialEvents();

  const headerTexts = {
    announce: t('header.announce'),
    dashboard: t('header.dashboard'),
    login: t('header.login'),
  };

  return (
    <main>
      <PublicHeader texts={headerTexts} />
      <LandingPageClient initialEvents={initialEvents} />
    </main>
  );
}
