
import { NextResponse } from 'next/server';

/**
 * Proxy Server-side para buscar as partidas da Copa do Mundo.
 * Evita erros de CORS e permite cache agressivo no servidor.
 */
export async function GET() {
  const API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || 'd9f25b7c88d04f9fa7c73bf1e08fc51d';
  
  try {
    const response = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      next: { revalidate: 300 } // Cache de 5 minutos no servidor
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[World Cup API Proxy] Matches Error:", error.message);
    return NextResponse.json({ message: "Falha ao conectar com o provedor de dados." }, { status: 502 });
  }
}
