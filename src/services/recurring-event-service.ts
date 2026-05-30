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
import { 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  Firestore 
} from 'firebase/firestore';

/**
 * @fileOverview Serviço de lógica para geração de ocorrências de eventos recorrentes com capacidade independente.
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

export async function generateOccurrences(db: Firestore, parentId: string, input: RecurringEventInput) {
  const batch = writeBatch(db);
  const occurrencesRef = collection(db, 'recurring_occurrences');
  
  let currentDate = parseISO(input.startDate);
  // Default de 6 meses se não houver data final, para evitar loops infinitos
  const finalDate = input.endDate ? parseISO(input.endDate) : addMonths(currentDate, 6);
  const max = input.maxOccurrences || 100;
  
  let count = 0;

  while (isBefore(currentDate, finalDate) && count < max) {
    const occRef = doc(occurrencesRef);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    batch.set(occRef, {
      parentId,
      name: input.name,
      organizationId: input.organizationId,
      date: dateStr,
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'active',
      // Controle de Capacidade Independente
      capacidadeMaxima: input.capacidadeMaxima || 0,
      ingressosVendidos: 0,
      checkinsRealizados: 0,
      order: count,
      createdAt: serverTimestamp()
    });

    // Incrementar baseados na frequência
    switch (input.frequency) {
      case 'daily': currentDate = addDays(currentDate, 1); break;
      case 'weekly': currentDate = addWeeks(currentDate, 1); break;
      case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
      case 'monthly': currentDate = addMonths(currentDate, 1); break;
      case 'yearly': currentDate = addYears(currentDate, 1); break;
    }
    count++;
  }

  await batch.commit();
  return count;
}
