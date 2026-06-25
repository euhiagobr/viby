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
import { getAdminDb, getAdminApp } from '@/lib/firebase/admin';

export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

export interface CustomOccurrence {
  date: string;
  startTime: string;
  endTime: string;
  batches?: any[];
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
  defaultBatches?: any[];
}

/**
 * Gera ocorrências físicas no Firestore com suporte a ordenação e filtros temporais.
 * Resolve naive strings assumindo o fuso horário de Brasília (-03:00) para evitar desvios no servidor.
 */
export async function generateOccurrences(parentId: string, input: RecurringEventInput) {
  const db = getAdminDb();
  
  try {
    // 1. Limpar agenda antiga para evitar conflitos de data
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
  const TZ_OFFSET = "-03:00"; // Padrão Brasil para Viby

  // MODO 1: RECORRÊNCIA PERSONALIZADA (DATAS MANUAIS)
  if (input.frequency === 'custom' && input.customOccurrences) {
    const finalOccs = [...input.customOccurrences];
    finalOccs.sort((a, b) => a.date.localeCompare(b.date));

    for (const occ of finalOccs) {
      const occRef = occurrencesRef.doc();
      
      // Forçamos o fuso horário para que o servidor (UTC) grave o timestamp correto para o horário local brasileiro
      const sDate = new Date(`${occ.date}T${occ.startTime || '00:00'}:00${TZ_OFFSET}`);
      const eDate = new Date(`${occ.date}T${occ.endTime || '23:59'}:00${TZ_OFFSET}`);

      batch.set(occRef, {
        parentId,
        name: input.name,
        organizationId: input.organizationId,
        date: occ.date,
        startTime: occ.startTime,
        endTime: occ.endTime,
        start_date: admin.firestore.Timestamp.fromDate(sDate),
        end_date: admin.firestore.Timestamp.fromDate(eDate),
        status: 'active',
        capacidadeMaxima: input.capacidadeMaxima || 0,
        ingressosVendidos: 0,
        batches: occ.batches || input.defaultBatches || [],
        order: count,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    }
  } 
  // MODO 2: RECORRÊNCIA AUTOMÁTICA (INTERVALOS)
  else if (input.startDate) {
    // Se a data vier do client, ela já deve ser um ISO absoluto.
    // parseISO trata strings sem Z como local (mas no servidor local é UTC).
    let currentDate = parseISO(input.startDate);
    const finalDate = input.endDate ? parseISO(input.endDate) : addMonths(currentDate, 6);
    const max = input.maxOccurrences || 150;
    
    if (isNaN(currentDate.getTime())) return 0;

    const baseStart = parseISO(input.startDate).getTime();
    const baseEnd = input.endDate ? parseISO(input.endDate).getTime() : (baseStart + 4 * 3600000);
    const duration = baseEnd - baseStart;

    while ((isBefore(currentDate, finalDate) || format(currentDate, 'yyyy-MM-dd') === input.endDate) && count < max) {
      const occRef = occurrencesRef.doc();
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const sTime = input.startTime || "19:00";
      const eTime = input.endTime || "22:00";
      
      // Sincronização de fuso para cada ocorrência gerada automaticamente
      const sDate = new Date(`${dateStr}T${sTime}:00${TZ_OFFSET}`);
      const eDate = new Date(`${dateStr}T${eTime}:00${TZ_OFFSET}`);

      batch.set(occRef, {
        parentId,
        name: input.name,
        organizationId: input.organizationId,
        date: dateStr,
        startTime: sTime,
        endTime: eTime,
        start_date: admin.firestore.Timestamp.fromDate(sDate),
        end_date: admin.firestore.Timestamp.fromDate(eDate),
        status: 'active',
        capacidadeMaxima: input.capacidadeMaxima || 0,
        ingressosVendidos: 0,
        batches: input.defaultBatches || [],
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