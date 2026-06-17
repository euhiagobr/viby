/**
 * @fileOverview Utilitários para normalização e geração de slugs de cidades e estados.
 */

export function slugifyLocation(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function parseRegionParam(region: string): { countryCode: string, state: string } | null {
  const parts = region.split('-');
  if (parts.length !== 2) return null;
  return {
    countryCode: parts[0].toUpperCase(),
    state: parts[1].toUpperCase()
  };
}

export function buildRegionParam(countryCode: string, state: string): string {
  return `${countryCode.toLowerCase()}-${state.toLowerCase()}`;
}
