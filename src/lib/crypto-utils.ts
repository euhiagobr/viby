
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'viby-secure-key-2024-proto'; // Em produção, usar variável de ambiente

/**
 * Criptografa um dado de forma determinística para permitir buscas.
 */
export function encryptDeterministic(data: string): string {
  if (!data) return "";
  const normalized = data.replace(/\D/g, "");
  // Usamos CTR mode com IV fixo para garantir que o mesmo dado gere o mesmo ciphertext
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
  const iv = CryptoJS.enc.Utf8.parse('viby-fixed-iv-16');
  const encrypted = CryptoJS.AES.encrypt(normalized, key, {
    iv: iv,
    mode: CryptoJS.mode.CTR,
    padding: CryptoJS.pad.NoPadding
  });
  return encrypted.toString();
}

/**
 * Descriptografa um dado criptografado.
 */
export function decryptData(encryptedData: string): string {
  if (!encryptedData) return "";
  try {
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
    const iv = CryptoJS.enc.Utf8.parse('viby-fixed-iv-16');
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: iv,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error("Erro ao descriptografar:", e);
    return "";
  }
}
