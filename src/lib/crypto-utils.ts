
import CryptoJS from 'crypto-js';

/**
 * @fileOverview Utilitários de criptografia.
 * ADVERTÊNCIA: A chave ENCRYPTION_KEY deve ser configurada via variáveis de ambiente.
 * A descriptografia deve ocorrer preferencialmente no servidor.
 */

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_CRYPTO_KEY || 'viby-secure-key-2024-proto';

/**
 * Criptografa um dado de forma determinística para permitir buscas.
 */
export function encryptDeterministic(data: string): string {
  if (!data) return "";
  const normalized = data.replace(/\D/g, "");
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

/**
 * Mascara o CPF para exibição visual segura.
 */
export function maskCPF(cpf: string): string {
  if (!cpf) return "***.***.***-**";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return "***.***.***-**";
  return `***.${clean.substring(3, 6)} .***-**`;
}
