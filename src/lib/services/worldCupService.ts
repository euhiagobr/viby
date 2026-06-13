
/**
 * @fileOverview Serviço oficial para consumo da API Football Data.
 */

const API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

export const fetcher = async (url: string) => {
  if (!API_KEY) {
    throw new Error('API Key da Football Data não configurada.');
  }

  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': API_KEY,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Não foi possível carregar os dados da Copa do Mundo.');
  }

  return response.json();
};

export const WC_ENDPOINTS = {
  standings: `${BASE_URL}/competitions/WC/standings`,
  matches: `${BASE_URL}/competitions/WC/matches`,
};
