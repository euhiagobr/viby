import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';

async function getSiteSettings() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('site').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();
  const siteName = settings?.siteName || 'Viby';
  
  // Fonte única oficial
  const rawIconUrl = settings?.siteIconUrl || settings?.iconUrl || '/favicon.ico';
  
  // Cache busting para o manifest
  const version = settings?.imageVersion || Date.now();
  const separator = rawIconUrl.includes('?') ? '&' : '?';
  const iconUrl = rawIconUrl.startsWith('http') ? `${rawIconUrl}${separator}cache_v=${version}` : rawIconUrl;

  return {
    name: siteName,
    short_name: siteName,
    description: 'Centralize seus eventos e promova experiências memoráveis.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
