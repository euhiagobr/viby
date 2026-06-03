/**
 * @fileOverview Utilitários para geolocalização e cálculo de distância.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine.
 * @returns Distância em quilômetros.
 */
export function calculateDistance(
  coords1: Coordinates,
  coords2: Coordinates
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (coords2.latitude - coords1.latitude) * (Math.PI / 180);
  const dLon = (coords2.longitude - coords1.longitude) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.latitude * (Math.PI / 180)) *
      Math.cos(coords2.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Obtém a localização atual do dispositivo.
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada pelo navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

/**
 * Busca coordenadas (Lat/Lng) baseado em um endereço textual usando OpenStreetMap (Nominatim).
 */
export async function getCoordinatesFromAddress(address: string): Promise<Coordinates | null> {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VibyClub/1.0'
      }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (e) {
    console.warn("[Geocoding] Falha ao resolver endereço:", e);
    return null;
  }
}
