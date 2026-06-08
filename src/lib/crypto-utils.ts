import CryptoJS from 'crypto-js';

/**
 * @fileOverview Utilitários de criptografia, hashing e mascaramento de dados.
 * Atualizado para conformidade com o novo padrão de segurança Viby.
 */

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_CRYPTO_KEY || 'viby-secure-key-2024-proto';

/**
 * Criptografa o CPF completo para armazenamento recuperável (área restrita).
 * Não utiliza Base64 simples; usa AES-256.
 */
export function encryptCPF(cpf: string): string {
  if (!cpf) return "";
  const clean = cpf.replace(/\D/g, "");
  return CryptoJS.AES.encrypt(clean, ENCRYPTION_KEY).toString();
}

/**
 * Descriptografa o CPF para processos internos que exijam o dado real.
 */
export function decryptCPF(encrypted: string): string {
  if (!encrypted) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return "";
  }
}

/**
 * Gera um hash determinístico do CPF para buscas e controle de unicidade.
 * O dado real nunca pode ser recuperado a partir deste hash.
 */
export function hashCPF(cpf: string): string {
  if (!cpf) return "";
  const clean = cpf.replace(/\D/g, "");
  return CryptoJS.SHA256(clean).toString();
}

/**
 * Mascara o CPF para exibição visual segura.
 * Novo formato: ***.***.***-01 (exibe apenas os 2 últimos dígitos).
 */
export function maskCPF(cpf: string): string {
  if (!cpf) return "***.***.***-**";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return "***.***.***-**";
  return `***.***.***-${clean.substring(9, 11)}`;
}

/**
 * Mascara o e-mail para privacidade.
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  const maskedLocal = local.length > 2 
    ? local.substring(0, 2) + "*".repeat(local.length - 2)
    : local + "*";
  const domainParts = domain.split(".");
  const maskedDomainParts = domainParts.map((part, index) => {
    if (index === 0) {
      return part.length > 2 
        ? part.substring(0, 2) + "*".repeat(part.length - 2)
        : part + "*";
    }
    return "*".repeat(part.length);
  });
  return `${maskedLocal}@${maskedDomainParts.join(".")}`;
}
