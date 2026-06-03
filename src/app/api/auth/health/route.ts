
import { NextResponse } from 'next/server';

/**
 * @fileOverview Healthcheck do sistema.
 * Removidas dependências do Admin SDK para evitar erros de compilação.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
}
