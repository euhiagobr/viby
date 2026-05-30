import { 
  addDays, 
  addWeeks, 
  addMonths, 
  addYears, 
  isBefore, 
  parseISO, 
  format 
} from 'date-fns';
import { db } from '@/firebase/database';
import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview Serviço de lógica para geração de ocorrências de eventos recorrentes.
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

/**
 * Gera as ocorrências individuais de uma série recorrente.
 */
export async function generateOccurrences(parentId: string, input: RecurringEventInput) {
  // 1. Limpar ocorrências existentes para evitar duplicidade ao re-gerar
  try {
    const oldOccsQ = query(collection(db, 'recurring_occurrences'), where('parentId', '==', parentId));
    const oldSnap = await getDocs(oldOccsQ);
    if (!oldSnap.empty) {
      const deleteBatch = writeBatch(db);
      oldSnap.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
    }
  } catch (e) {
    console.warn("[Recurrence] Falha ao limpar agenda antiga, prosseguindo...");
  }

  const batch = writeBatch(db);
  const occurrencesRef = collection(db, 'recurring_occurrences');
  
  let currentDate = parseISO(input.startDate);
  // Default de 6 meses se não houver data final
  const finalDate = input.endDate ? parseISO(input.endDate) : addMonths(currentDate, 6);
  const max = input.maxOccurrences || 150;
  
  let count = 0;

  if (isNaN(currentDate.getTime())) {
    console.error("[Recurrence Error] Data inicial inválida.");
    return 0;
  }

  while ((isBefore(currentDate, finalDate) || format(currentDate, 'yyyy-MM-dd') === input.endDate) && count < max) {
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
      capacidadeMaxima: input.capacidadeMaxima || 0,
      ingressosVendidos: 0,
      checkinsRealizados: 0,
      order: count,
      createdAt: serverTimestamp()
    });

    const previousDate = new Date(currentDate);
    switch (input.frequency) {
      case 'daily': currentDate = addDays(currentDate, 1); break;
      case 'weekly': currentDate = addWeeks(currentDate, 1); break;
      case 'biweekly': currentDate = addWeeks(currentDate, 2); break;
      case 'monthly': currentDate = addMonths(currentDate, 1); break;
      case 'yearly': currentDate = addYears(currentDate, 1); break;
      default: currentDate = addDays(currentDate, 1);
    }

    if (currentDate.getTime() <= previousDate.getTime()) break;
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }
  
  return count;
}
