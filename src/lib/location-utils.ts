/**
 * @fileOverview Utilitários para geolocalização, cálculo de distância e busca global.
 * Atualizado para padronização ISO 3166-1 alpha-2 e resiliência de rede.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface AddressComponents {
  venueName?: string;
  addressLine1: string; // Substitui 'street'
  addressLine2?: string; // Substitui 'complement'
  streetNumber?: string;
  neighborhood: string;
  city: string;
  stateRegion: string; // Substitui 'state'
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2 (BR, US, etc)
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
}

const NOMINATIM_TIMEOUT = 8000; // 8 segundos

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
 * Obtém a localização atual do dispositivo com tratamento de erro.
 */
export async function getCurrentLocation(): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });
}

/**
 * Busca endereços (Autocomplete Global) usando OpenStreetMap (Nominatim).
 * Implementa timeout para evitar travamento da UI.
 */
export async function searchGlobalAddresses(query: string): Promise<any[]> {
  if (!query || query.length < 3) return [];
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'pt-BR,en-US',
        'User-Agent': 'VibyClub/1.1'
      }
    });
    clearTimeout(id);
    return await response.json();
  } catch (e) {
    console.warn("[Geocoding] Busca global falhou ou excedeu o tempo limite.");
    return [];
  }
}

/**
 * Converte um resultado do Nominatim para a estrutura de AddressComponents da Viby.
 */
export function mapNominatimToAddress(data: any): Partial<AddressComponents> {
  const addr = data.address;
  return {
    venueName: data.display_name.split(',')[0],
    addressLine1: addr.road || addr.pedestrian || addr.suburb || "",
    neighborhood: addr.neighbourhood || addr.suburb || addr.quarter || "",
    city: addr.city || addr.town || addr.village || addr.municipality || "",
    stateRegion: addr.state || addr.region || "",
    country: addr.country || "",
    countryCode: addr.country_code?.toUpperCase() || "",
    postalCode: addr.postcode || "",
    latitude: parseFloat(data.lat),
    longitude: parseFloat(data.lon),
    formattedAddress: data.display_name
  };
}

/**
 * Busca coordenadas (Lat/Lng) baseado em um endereço textual com timeout.
 */
export async function getCoordinatesFromAddress(address: string): Promise<Coordinates | null> {
  if (!address) return null;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VibyClub/1.1' }
    });
    clearTimeout(id);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}
