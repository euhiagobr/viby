/**
 * @fileOverview Utilitários para o Gerador de Imagens Viby.
 * Implementa lógica de encurtamento inteligente de títulos e auditoria de renderização.
 */

const NOISY_WORDS = [
  "oficial", "festival", "festa", "encontro", "grande", "evento", 
  "brasileiro", "brasil", "internacional", "mundial", "fifa", "copa", "do", "da", "de"
];

/**
 * Encurta títulos longos mantendo a leitura natural.
 * Regras: Não corta palavras, não usa reticências, remove ruído se necessário.
 */
export function shortenTitle(title: string, maxLength: number = 35): string {
  if (!title || title.length <= maxLength) return title;

  // 1. Tentar limpar palavras de ruído para caber
  let words = title.split(' ');
  let currentTitle = words.join(' ');

  if (currentTitle.length > maxLength) {
    const cleanedWords = words.filter(w => !NOISY_WORDS.includes(w.toLowerCase()));
    if (cleanedWords.length > 0) {
      const cleanedTitle = cleanedWords.join(' ');
      if (cleanedTitle.length <= maxLength) return cleanedTitle;
      words = cleanedWords;
    }
  }

  // 2. Se ainda não couber, remover palavras do fim até caber (mantendo leitura natural)
  while (words.join(' ').length > maxLength && words.length > 1) {
    words.pop();
  }

  return words.join(' ');
}

/**
 * Formata data para o estilo do template (ex: 15 JUL)
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
 * AUDITORIA E CONVERSÃO DE IMAGENS PARA BASE64 (MOBILE STABILITY)
 */
export async function auditAndPrepareImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  console.log(`[Mobile Export] Auditoria iniciada. Encontradas ${images.length} imagens.`);

  const results = await Promise.all(images.map(async (img, idx) => {
    const audit = {
      idx,
      src: img.src,
      currentSrc: img.currentSrc,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      crossOrigin: img.crossOrigin,
      isFirebase: img.src.includes('firebasestorage.googleapis.com')
    };
    
    console.log(`[Mobile Export] Imagem ${idx}:`, audit);

    // Tentar converter para Base64 para garantir desenho no Canvas
    try {
      if (img.src.startsWith('data:')) {
        console.log(`[Mobile Export] Imagem ${idx} já é Base64.`);
        return true;
      }

      const response = await fetch(img.src);
      const blob = await response.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      img.src = dataUrl;
      console.log(`[Mobile Export] Imagem ${idx} convertida p/ Base64 com sucesso.`);
      return true;
    } catch (err) {
      console.warn(`[Mobile Export] Falha na conversão da Imagem ${idx}:`, err);
      return false;
    }
  }));

  const successCount = results.filter(r => r).length;
  console.log(`[Mobile Export] Auditoria finalizada. ${successCount}/${images.length} imagens prontas para Canvas.`);
  
  // Garantir decodificação final
  await Promise.all(images.map(img => img.decode().catch(() => {})));
}
