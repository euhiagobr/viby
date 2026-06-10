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
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Serviço de Eventos Recorrentes.
 * Marcado como 'use server' para atuar como Server Action e isolar o Admin SDK do cliente.
 */

export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

export interface CustomOccurrence {
  date: string;
  startTime: string;
  endTime: string;
}

export interface RecurringEventInput {
  name: string;
  description: string;
  organizationId: string;
  organizerName: string;
  frequency: RecurrenceType;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  capacidadeMaxima: number;
  maxOccurrences?: number;
  customOccurrences?: CustomOccurrence[];
}

export async function generateOccurrences(parentId: string, input: RecurringEventInput) {
  const db = getAdminDb();
  
  try {
    const oldOccsSnap = await db.collection('recurring_occurrences').where('parentId', '==', parentId).get();
    if (!oldOccsSnap.empty) {
      const deleteBatch = db.batch();
      oldOccsSnap.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
    }
  } catch (e) {
    console.warn("[Recurrence] Falha ao limpar agenda antiga, prosseguindo...");
  }

  const batch = db.batch();
  const occurrencesRef = db.collection('recurring_occurrences');
  
  let count = 0;

  // MODO 1: RECORRÊNCIA PERSONALIZADA (DATAS MANUAIS)
  if (input.frequency === 'custom' && input.customOccurrences) {
    // Garantir que a data de início principal também seja uma ocorrência se não estiver na lista customizada
    const mainDate = input.startDate;
    const hasMainDate = mainDate && input.customOccurrences.some(o => o.date === mainDate);
    
    const finalOccs = [...input.customOccurrences];
    if (mainDate && !hasMainDate) {
      finalOccs.unshift({
        date: mainDate,
        startTime: input.startTime || "19:00",
        endTime: input.endTime || "22:00"
      });
    }

    // Ordenar por data antes de salvar
    finalOccs.sort((a, b) => a.date.localeCompare(b.date));

    for (const occ of finalOccs) {
      const occRef = occurrencesRef.doc();
      batch.set(occRef, {
        parentId,
        name: input.name,
        organizationId: input.organizationId,
        date: occ.date,
        startTime: occ.startTime,
        endTime: occ.endTime,
        status: 'active',
        capacidadeMaxima: input.capacidadeMaxima || 0,
        ingressosVendidos: 0,
        checkinsRealizados: 0,
        order: count,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    }
  } 
  // MODO 2: RECORRÊNCIA AUTOMÁTICA (INTERVALOS)
  else if (input.startDate) {
    let currentDate = parseISO(input.startDate);
    const finalDate = input.endDate ? parseISO(input.endDate) : addMonths(currentDate, 6);
    const max = input.maxOccurrences || 150;
    
    if (isNaN(currentDate.getTime())) {
      console.error("[Recurrence Error] Data inicial inválida.");
      return 0;
    }

    while ((isBefore(currentDate, finalDate) || format(currentDate, 'yyyy-MM-dd') === input.endDate) && count < max) {
      const occRef = occurrencesRef.doc();
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      batch.set(occRef, {
        parentId,
        name: input.name,
        organizationId: input.organizationId,
        date: dateStr,
        startTime: input.startTime || "19:00",
        endTime: input.endTime || "22:00",
        status: 'active',
        capacidadeMaxima: input.capacidadeMaxima || 0,
        ingressosVendidos: 0,
        checkinsRealizados: 0,
        order: count,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
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
  }

  if (count > 0) {
    await batch.commit();
  }
  
  return count;
}