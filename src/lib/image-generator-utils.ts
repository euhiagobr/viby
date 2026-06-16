/**
 * @fileOverview Utilitários para o Gerador de Imagens Viby.
 * Implementa lógica de encurtamento inteligente de títulos.
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
 * Formata horário para o estilo do template (ex: 18:00H)
 */
export function formatTemplateTime(dateValue: any): string {
  if (!dateValue) return "";
  try {
    const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + "H";
  } catch (e) {
    return "";
  }
}
