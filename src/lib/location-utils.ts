
/**
 * @fileOverview Utilitários para geolocalização, cálculo de distância e busca global.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface AddressComponents {
  venueName?: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
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
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error("Geolocalização não suportada."));
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
 * Busca endereços (Autocomplete Global) usando OpenStreetMap (Nominatim).
 */
export async function searchGlobalAddresses(query: string): Promise<any[]> {
  if (!query || query.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,en-US',
        'User-Agent': 'VibyClub/1.0'
      }
    });
    return await response.json();
  } catch (e) {
    console.error("[Geocoding] Erro na busca global:", e);
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
    street: addr.road || addr.pedestrian || addr.suburb || "",
    number: addr.house_number || "",
    neighborhood: addr.neighbourhood || addr.suburb || addr.quarter || "",
    city: addr.city || addr.town || addr.village || addr.municipality || "",
    state: addr.state || "",
    country: addr.country || "",
    countryCode: addr.country_code?.toUpperCase() || "",
    postalCode: addr.postcode || "",
    latitude: parseFloat(data.lat),
    longitude: parseFloat(data.lon),
    formattedAddress: data.display_name
  };
}

/**
 * Busca coordenadas (Lat/Lng) baseado em um endereço textual.
 */
export async function getCoordinatesFromAddress(address: string, fallbackCep?: string): Promise<Coordinates | null> {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VibyClub/1.0' }
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
    return null;
  }
}
