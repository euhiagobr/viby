
/**
 * @fileOverview Utilitários para o Gerador de Imagens Viby.
 * Implementa lógica de encurtamento inteligente de títulos, resolução de recorrências e auditoria.
 */

import { safeParseDate } from "./utils";

const NOISY_WORDS = [
  "oficial", "festival", "festa", "encontro", "grande", "evento", 
  "brasileiro", "brasil", "internacional", "mundial", "fifa", "copa", "do", "da", "de"
];

/**
 * Encurta títulos longos mantendo a leitura natural.
 * Atualizado para permitir até 50 caracteres com quebra de linha.
 */
export function shortenTitle(title: string, maxLength: number = 50): string {
  if (!title || title.length <= maxLength) return title;

  let words = title.split(' ');
  let currentTitle = words.join(' ');

  // Se for muito longo, tenta remover palavras de ruído primeiro
  if (currentTitle.length > maxLength) {
    const cleanedWords = words.filter(w => !NOISY_WORDS.includes(w.toLowerCase()));
    if (cleanedWords.length > 0) {
      const cleanedTitle = cleanedWords.join(' ');
      if (cleanedTitle.length <= maxLength) return cleanedTitle;
      words = cleanedWords;
    }
  }

  // Se ainda for longo, remove palavras do final até caber
  while (words.join(' ').length > maxLength && words.length > 1) {
    words.pop();
  }

  const final = words.join(' ');
  return final.length > maxLength ? final.substring(0, maxLength) : final;
}

/**
 * Resolve a próxima data válida e o contador de recorrências futuras.
 */
export function resolveNextOccurrence(event: any, occurrences: any[], now: Date) {
  const eventDate = safeParseDate(event.date);
  
  if (!event.isRecurring) {
    if (!eventDate || eventDate < now) return null;
    return { nextDate: eventDate, additionalCount: 0 };
  }

  const myOccs = (occurrences || []).filter(o => o.parentId === event.id && o.status === 'active');
  const futureOccs = myOccs
    .map(o => ({ ...o, _dt: safeParseDate(`${o.date}T${o.startTime || '19:00'}:00`) }))
    .filter(o => o._dt && o._dt >= now)
    .sort((a, b) => a._dt!.getTime() - b._dt!.getTime());

  if (futureOccs.length === 0) {
    if (eventDate && eventDate >= now) {
      return { nextDate: eventDate, additionalCount: 0 };
    }
    return null;
  }

  return {
    nextDate: futureOccs[0]._dt!,
    additionalCount: futureOccs.length - 1
  };
}

/**
 * Formata data para o estilo do template.
 * Removido sufixo de recorrência (+N) conforme solicitação UX v5.
 */
export function formatTemplateDate(dateValue: any): string {
  if (!dateValue) return "";
  try {
    const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    return `${day} ${month}`;
  } catch (e) {
    return "---";
  }
}

/**
 * Formata horário para o estilo do template (ex: 18:00 - 22:00H)
 */
export function formatTemplateTime(dateValue: any, endDateValue?: any): string {
  if (!dateValue) return "";
  try {
    const dStart = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    const startStr = dStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    if (endDateValue) {
      const dEnd = endDateValue.toDate ? endDateValue.toDate() : new Date(endDateValue);
      const endStr = dEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${startStr} - ${endStr}H`;
    }
    
    return `${startStr}H`;
  } catch (e) {
    return "";
  }
}

/**
 * Gatilho de download robusto para mobile via Blob/ObjectUrl.
 */
export async function triggerVisualProofDownload(dataUrl: string, fileName: string) {
  if (!dataUrl) return;
  
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 200);
  } catch (e) {
    console.error("[Download Utility Error]", e);
  }
}

/**
 * AUDITORIA E CONVERSÃO DE IMAGENS PARA BASE64
 */
export async function auditAndPrepareImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  
  await Promise.all(images.map(async (img) => {
    try {
      if (img.src.startsWith('data:')) return true;

      const response = await fetch(img.src);
      const blob = await response.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      img.src = dataUrl;
      return true;
    } catch (err) {
      return false;
    }
  }));

  await Promise.all(images.map(img => img.decode().catch(() => {})));
}
