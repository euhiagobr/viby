/**
 * @fileOverview Utilitários para normalização e geração de slugs de cidades e estados.
 */

const BRAZIL_STATE_MAP: Record<string, string> = {
  "acre": "ac", "alagoas": "al", "amapa": "ap", "amazonas": "am",
  "bahia": "ba", "ceara": "ce", "distrito-federal": "df", "espirito-santo": "es",
  "goias": "go", "maranhao": "ma", "mato-grosso": "mt", "mato-grosso-do-sul": "ms",
  "minas-gerais": "mg", "para": "pa", "paraiba": "pb", "parana": "pr",
  "pernambuco": "pe", "piaui": "pi", "rio-de-janeiro": "rj", "rio-grande-do-norte": "rn",
  "rio-grande-do-sul": "rs", "rondonia": "ro", "roraima": "rr", "santa-catarina": "sc",
  "sao-paulo": "sp", "sergipe": "se", "tocantins": "to"
};

export function slugifyLocation(text: string): string {
  if (!text) return "";
  const slug = text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  // Se for um estado brasileiro por extenso, retorna a sigla
  if (BRAZIL_STATE_MAP[slug]) {
    return BRAZIL_STATE_MAP[slug];
  }

  return slug;
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
  return `${countryCode.toLowerCase()}-${slugifyLocation(state)}`;
}
