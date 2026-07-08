/**
 * @fileOverview Utilitários para identidades internacionais
 * Normalização, hashing, masking e validação de documentos.
 * Mantém compatibilidade com funções legadas de CPF.
 */

import CryptoJS from 'crypto-js';

// ============================================================================
// TIPOS
// ============================================================================

export interface DocumentNormalized {
  country: string;
  documentType: string;
  normalized: string;
}

// ============================================================================
// NORMALIZAÇÃO
// ============================================================================

/**
 * Remove caracteres especiais do documento e normaliza conforme o tipo.
 * @example normalizeDocument("123.456.789-00", "BR", "CPF") → "12345678900"
 * @example normalizeDocument("12.345.678", "AR", "DNI") → "12345678"
 */
export function normalizeDocument(
  value: string,
  country: string,
  documentType: string
): string {
  if (!value) return '';

  // Remove tudo que não é número ou letra
  let clean = value.replace(/[^0-9A-Za-z]/g, '');

  // Validações específicas por país/tipo
  switch (`${country}:${documentType}`) {
    case 'BR:CPF':
      return clean.padStart(11, '0').slice(-11);
    case 'BR:RG':
      return clean.padStart(7, '0').slice(-9);
    case 'AR:DNI':
      return clean.padStart(8, '0').slice(-8);
    case 'US:PASSPORT':
      return clean.toUpperCase().slice(0, 9);
    case 'US:SSN':
      return clean.padStart(9, '0').slice(-9);
    case 'US:DRIVER_LICENSE':
      return clean.toUpperCase().slice(0, 20);
    case 'ES:NIE':
      return clean.toUpperCase().slice(0, 9);
    case 'PT:CARTAO_CIDADAO':
      return clean.padStart(8, '0').slice(-8);
    default:
      return clean;
  }
}

// ============================================================================
// HASHING (IRREVERSÍVEL)
// ============================================================================

/**
 * Gera hash SHA256 determinístico do documento normalizado.
 * Composição: "PAÍS:TIPO:DOCUMENTO_NORMALIZADO"
 * O documento NUNCA pode ser recuperado a partir do hash.
 * @example hashDocument("12345678900", "BR", "CPF") → "abc123def..."
 */
export function hashDocument(
  value: string,
  country: string,
  documentType: string
): string {
  if (!value) return '';

  const normalized = normalizeDocument(value, country, documentType);
  if (!normalized) return '';

  // Composição: país:tipo:documento (para garantir unicidade global)
  const composite = `${country}:${documentType}:${normalized}`;
  return CryptoJS.SHA256(composite).toString();
}

/**
 * COMPATIBILIDADE: Wrapper para código legado que usa hashCPF().
 * @deprecated Use hashDocument() para novos documentos
 */
export function hashCPF(cpf: string): string {
  return hashDocument(cpf, 'BR', 'CPF');
}

// ============================================================================
// MASKING (DISPLAY SAFE)
// ============================================================================

/**
 * Mascara documento para exibição segura.
 * Nunca expõe o documento completo no frontend.
 * @example maskDocument("12345678900", "BR", "CPF") → "***.***.789-00"
 */
export function maskDocument(
  value: string,
  country: string,
  documentType: string
): string {
  const normalized = normalizeDocument(value, country, documentType);
  if (!normalized) return `${'*'.repeat(8)}-**`;

  switch (`${country}:${documentType}`) {
    case 'BR:CPF':
      // Formato: ***.***.789-00 (mostra últimas 4)
      if (normalized.length !== 11) return '***.***.***-**';
      const cpfLast4 = normalized.substring(7, 11);
      return `***.***.***-${cpfLast4.substring(2)}`;

    case 'BR:RG':
      // Formato: *****67 (mostra últimas 2)
      if (normalized.length < 7) return '*'.repeat(normalized.length);
      return `${'*'.repeat(normalized.length - 2)}${normalized.substring(-2)}`;

    case 'AR:DNI':
      // Formato: ****5678 (mostra últimas 4)
      if (normalized.length !== 8) return '****' + '*'.repeat(Math.max(0, normalized.length - 4));
      return `****${normalized.substring(4)}`;

    case 'US:PASSPORT':
      // Formato: PASS***BC (mostra 4 primeiro, últimas 2)
      if (normalized.length < 6) return normalized;
      return `${normalized.substring(0, 4)}${'*'.repeat(Math.max(0, normalized.length - 6))}${normalized.substring(-2)}`;

    case 'US:SSN':
      // Formato: ***-**-1234 (mostra últimas 4)
      if (normalized.length !== 9) return '***-**-****';
      return `***-**-${normalized.substring(5)}`;

    case 'US:DRIVER_LICENSE':
      // Formato: ****5678 (mostra últimas 4)
      if (normalized.length < 4) return '*'.repeat(normalized.length);
      return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.substring(-4)}`;

    case 'ES:NIE':
      // Formato: X***567L (mostra primeiro, últimas 2, e letra)
      if (normalized.length < 9) return '*'.repeat(normalized.length);
      return `${normalized.substring(0, 1)}${'*'.repeat(5)}${normalized.substring(7)}`;

    case 'PT:CARTAO_CIDADAO':
      // Formato: ****5678 (mostra últimas 4)
      if (normalized.length < 4) return '*'.repeat(normalized.length);
      return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.substring(-4)}`;

    default:
      // Fallback: mostra apenas últimas 4 caracteres
      if (normalized.length <= 4) return '*'.repeat(normalized.length);
      return `${'*'.repeat(normalized.length - 4)}${normalized.substring(-4)}`;
  }
}

/**
 * COMPATIBILIDADE: Wrapper para código legado que usa maskCPF().
 * @deprecated Use maskDocument() para novos documentos
 */
export function maskCPF(cpf: string): string {
  return maskDocument(cpf, 'BR', 'CPF');
}

// ============================================================================
// VALIDAÇÃO BÁSICA
// ============================================================================

/**
 * Validação básica de formato (NÃO faz verificação de dígito verificador).
 * Uso: validação inicial de entrada do usuário.
 */
export function isValidDocumentFormat(
  value: string,
  country: string,
  documentType: string
): boolean {
  const normalized = normalizeDocument(value, country, documentType);
  if (!normalized) return false;

  switch (`${country}:${documentType}`) {
    case 'BR:CPF':
      return normalized.length === 11 && /^\d{11}$/.test(normalized);

    case 'BR:RG':
      return normalized.length >= 7 && normalized.length <= 9 && /^\d{7,9}$/.test(normalized);

    case 'AR:DNI':
      return normalized.length === 8 && /^\d{8}$/.test(normalized);

    case 'US:PASSPORT':
      return normalized.length >= 6 && normalized.length <= 9 && /^[A-Z0-9]{6,9}$/.test(normalized);

    case 'US:SSN':
      return normalized.length === 9 && /^\d{9}$/.test(normalized);

    case 'US:DRIVER_LICENSE':
      return normalized.length >= 5 && normalized.length <= 20 && /^[A-Z0-9]+$/.test(normalized);

    case 'ES:NIE':
      return normalized.length === 9 && /^[XYZ]\d{7}[A-Z]$/i.test(normalized);

    case 'PT:CARTAO_CIDADAO':
      return normalized.length === 8 && /^\d{8}$/.test(normalized);

    default:
      return normalized.length > 0;
  }
}

/**
 * COMPATIBILIDADE: Wrapper para código legado que usa validateCPF().
 * @deprecated Use isValidDocumentFormat() para novos documentos
 */
export function validateCPF(cpf: string): boolean {
  return isValidDocumentFormat(cpf, 'BR', 'CPF');
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Extrai o tipo de documento recomendado baseado no país.
 * Retorna o tipo principal para aquele país.
 */
export function getDefaultDocumentTypeForCountry(country: string): string | null {
  const defaults: { [key: string]: string } = {
    BR: 'CPF',
    AR: 'DNI',
    US: 'PASSPORT',
    ES: 'NIE',
    PT: 'CARTAO_CIDADAO',
  };
  return defaults[country] || null;
}

/**
 * Valida se um país é suportado.
 */
export function isSupportedCountry(country: string): boolean {
  return ['BR', 'AR', 'US', 'ES', 'PT'].includes(country);
}

/**
 * Valida se um tipo de documento é suportado em um país.
 */
export function isSupportedDocumentType(country: string, documentType: string): boolean {
  const supported: { [key: string]: string[] } = {
    BR: ['CPF', 'RG'],
    AR: ['DNI'],
    US: ['PASSPORT', 'SSN', 'DRIVER_LICENSE'],
    ES: ['NIE'],
    PT: ['CARTAO_CIDADAO'],
  };
  return supported[country]?.includes(documentType) || false;
}

/**
 * Retorna lista de tipos de documento suportados em um país.
 */
export function getDocumentTypesForCountry(country: string): string[] {
  const types: { [key: string]: string[] } = {
    BR: ['CPF', 'RG'],
    AR: ['DNI'],
    US: ['PASSPORT', 'SSN', 'DRIVER_LICENSE'],
    ES: ['NIE'],
    PT: ['CARTAO_CIDADAO'],
  };
  return types[country] || [];
}
