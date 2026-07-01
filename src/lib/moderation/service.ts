/**
 * @fileOverview Motor de Moderação Automática da Viby.
 * Executa normalização e detecção de conteúdo proibido.
 */

import { FORBIDDEN_WORDS, SENSITIVE_PATTERNS, MODERATION_RULES } from './config';

/**
 * Normaliza o texto para análise: remove acentos, excessos e normaliza caracteres.
 */
export function normalizeForModeration(text: string): string {
  if (!text) return "";
  
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[0-9]/g, (n) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" }[n] || n)) // Leet speak básico
    .replace(/(.)\1{2,}/g, "$1") // Reduz repetições (aaa -> a)
    .replace(/\s+/g, " ") // Espaços extras
    .trim();
}

/**
 * Valida o conteúdo de uma avaliação.
 * Retorna { isValid: boolean; reason?: string }
 */
export function validateReviewContent(content: { title: string; text: string; likedMost: string; canImprove: string }): { isValid: boolean; reason?: string } {
  const allText = `${content.title} ${content.text} ${content.likedMost} ${content.canImprove}`;
  const normalized = normalizeForModeration(allText);

  // 1. Verificação de Dados Sensíveis
  if (SENSITIVE_PATTERNS.EMAIL.test(allText)) return { isValid: false, reason: "Por segurança, avaliações não podem conter e-mails." };
  if (SENSITIVE_PATTERNS.PHONE.test(allText)) return { isValid: false, reason: "Por segurança, avaliações não podem conter números de telefone." };
  if (SENSITIVE_PATTERNS.CPF.test(allText)) return { isValid: false, reason: "Por segurança, avaliações não podem conter números de CPF." };
  if (SENSITIVE_PATTERNS.URL.test(allText)) return { isValid: false, reason: "Por segurança, avaliações não podem conter links para outros sites." };
  if (SENSITIVE_PATTERNS.SOCIAL_HANDLE.test(allText)) return { isValid: false, reason: "Por segurança, não é permitido divulgar redes sociais nas avaliações." };

  // 2. Verificação de Termos Proibidos
  const words = normalized.split(/\s+/);
  
  for (const [category, list] of Object.entries(FORBIDDEN_WORDS)) {
    const found = list.find(forbidden => normalized.includes(forbidden));
    if (found) {
      if (category === 'INSULTS' || category === 'HATE_SPEECH') {
        return { isValid: false, reason: "Sua avaliação contém termos que violam nossas diretrizes de respeito e convivência." };
      }
      if (category === 'FRAUD' || category === 'SPAM') {
        return { isValid: false, reason: "Detectamos conteúdo publicitário ou suspeito que não é permitido nas avaliações." };
      }
      return { isValid: false, reason: "Sua mensagem contém palavras ou expressões não permitidas pela nossa política de moderação." };
    }
  }

  // 3. Verificação de Formatação (Flood / Caps / Emojis)
  const uppercaseCount = (allText.match(/[A-Z]/g) || []).length;
  if (allText.length > 20 && (uppercaseCount / allText.length) * 100 > MODERATION_RULES.MAX_UPPERCASE_PERCENT) {
    return { isValid: false, reason: "Por favor, evite o uso excessivo de letras maiúsculas (Caps Lock)." };
  }

  const emojiCount = (allText.match(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > MODERATION_RULES.MAX_EMOJI_COUNT) {
    return { isValid: false, reason: "Sua avaliação contém excesso de emojis. Tente ser mais descritivo com palavras." };
  }

  // 4. Verificação de Tamanho
  if (content.text.length < MODERATION_RULES.MIN_TEXT_LENGTH) {
    return { isValid: false, reason: `Seu relato está muito curto (mínimo ${MODERATION_RULES.MIN_TEXT_LENGTH} caracteres). Conte um pouco mais sobre sua experiência!` };
  }

  return { isValid: true };
}
