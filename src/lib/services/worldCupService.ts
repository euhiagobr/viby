
/**
 * @fileOverview Serviço oficial para consumo dos dados da Copa do Mundo.
 * Refatorado para consumir rotas internas (Proxy) e evitar erros de CORS no navegador.
 */

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Erro ao carregar dados esportivos.');
  }

  return response.json();
};

export const WC_ENDPOINTS = {
  standings: `/api/world-cup/standings`,
  matches: `/api/world-cup/matches`,
};
