'use server';

import { 
  addDays, 
  addWeeks, 
  addMonths, 
  addYears, 
  isBefore, 
  parseISO, 
  format 
} from 'date-fns';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Serviço de lógica para geração de ocorrências de eventos recorrentes.
 * Refatorado para usar o Admin SDK, eliminando erros de serialização de instância de banco.
 */

export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringEventInput {
  name: string;
  description: string;
  organizationId: string;
  organizerName: string;
  frequency: RecurrenceType;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  capacidadeMaxima: number;
  maxOccurrences?: number;
}

export async function generateOccurrences(parentId: string, input: RecurringEventInput) {
  const db = getAdminDb();
  const batch = db.batch();
  const occurrencesRef = db.collection('recurring_occurrences');
  
  let currentDate = parseISO(input.startDate);
  // Default de 6 meses se não houver data final, para evitar loops infinitos
  const finalDate = input.endDate ? parseISO(input.endDate) : addMonths(currentDate, 6);
  const max = input.maxOccurrences || 100;
  
  let count = 0;

  // Trava de segurança: se a data inicial for inválida, aborta para evitar loop infinito
  if (isNaN(currentDate.getTime())) {
    console.error("[Recurrence Error] Invalid start date provided.");
    return 0;
  }

  while (isBefore(currentDate, finalDate) && count < max) {
    const occRef = occurrencesRef.doc();
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    batch.set(occRef, {
      parentId,
      name: input.name,
      organizationId: input.organizationId,
      date: dateStr,
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'active',
      capacidadeMaxima: input.capacidadeMaxima || 0,
      ingressosVendidos: 0,
      checkinsRealizados: 0,
      order: count,
      createdAt: FieldValue.serverTimestamp()
    });

    // Avançar a data baseado na frequência
    const previousDate = new Date(currentDate);
    switch (input.frequency) {
      case 'daily': currentDate = addDays(currentDate, 1); break;
      case 'weekly': currentDate = addWeeks(currentDate, 1); break;
      case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
      case 'monthly': currentDate = addMonths(currentDate, 1); break;
      case 'yearly': currentDate = addYears(currentDate, 1); break;
      default: currentDate = addDays(currentDate, 1); // Fallback de segurança
    }

    // Trava final de segurança: se a data não avançou por algum erro matemático, para o loop
    if (currentDate.getTime() <= previousDate.getTime()) break;
    
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }
  
  return count;
}
