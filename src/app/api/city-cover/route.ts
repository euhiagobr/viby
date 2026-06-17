
import { NextResponse } from 'next/server';
import { processCityCoverGeneration } from '@/services/city-cover-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * @fileOverview Route Handler para gatilhos externos ou legacy.
 */
export async function POST(req: Request) {
  try {
    const input = await req.json();
    const result = await processCityCoverGeneration(input);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  }
}
