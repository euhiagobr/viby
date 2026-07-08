/**
 * @fileOverview Tabela centralizada de validação de documentos por país.
 * Configuração para suportar múltiplos tipos de documento internacionais.
 */

export interface DocumentValidationRule {
  name: string;
  description: string;
  minLength: number;
  maxLength: number;
  regex: RegExp;
  formatExample: string;
  hasChecksum: boolean;
}

export interface CountryDocuments {
  [documentType: string]: DocumentValidationRule;
}

/**
 * TABELA CENTRALIZADA: Configuração de documentos por país
 * Adicione novos países/tipos conforme necessário
 */
export const COUNTRY_DOCUMENTS: { [countryCode: string]: CountryDocuments } = {
  BR: {
    CPF: {
      name: 'CPF',
      description: 'Cadastro de Pessoa Física (PF)',
      minLength: 11,
      maxLength: 11,
      regex: /^\d{11}$/,
      formatExample: '123.456.789-00',
      hasChecksum: true,
    },
    CNPJ: {
      name: 'CNPJ',
      description: 'Cadastro Nacional de Pessoa Jurídica (PJ)',
      minLength: 14,
      maxLength: 14,
      regex: /^\d{14}$/,
      formatExample: '12.345.678/0000-00',
      hasChecksum: true,
    },
    RG: {
      name: 'RG',
      description: 'Registro Geral (Identidade)',
      minLength: 7,
      maxLength: 9,
      regex: /^\d{7,9}$/,
      formatExample: '12.345.678',
      hasChecksum: false,
    },
  },
  AR: {
    DNI: {
      name: 'DNI',
      description: 'Documento Nacional de Identidad (PF)',
      minLength: 8,
      maxLength: 8,
      regex: /^\d{8}$/,
      formatExample: '12.345.678',
      hasChecksum: false,
    },
    CUIT: {
      name: 'CUIT',
      description: 'Código Único de Identificación Tributaria (PJ)',
      minLength: 11,
      maxLength: 11,
      regex: /^\d{11}$/,
      formatExample: '20.345.678.900',
      hasChecksum: true,
    },
  },
  US: {
    SSN: {
      name: 'SSN',
      description: 'Social Security Number (PF)',
      minLength: 9,
      maxLength: 9,
      regex: /^\d{9}$/,
      formatExample: '123-45-6789',
      hasChecksum: false,
    },
    EIN: {
      name: 'EIN',
      description: 'Employer Identification Number (PJ)',
      minLength: 9,
      maxLength: 9,
      regex: /^\d{9}$/,
      formatExample: '12-3456789',
      hasChecksum: false,
    },
    PASSPORT: {
      name: 'Passport',
      description: 'U.S. Passport',
      minLength: 6,
      maxLength: 9,
      regex: /^[A-Z0-9]{6,9}$/,
      formatExample: 'C12345ABC',
      hasChecksum: false,
    },
    DRIVER_LICENSE: {
      name: 'Driver License',
      description: 'Driver License',
      minLength: 5,
      maxLength: 20,
      regex: /^[A-Z0-9]+$/,
      formatExample: 'ABC12345',
      hasChecksum: false,
    },
  },
  ES: {
    DNI: {
      name: 'DNI',
      description: 'Documento Nacional de Identidad (PF)',
      minLength: 9,
      maxLength: 9,
      regex: /^[0-9]{8}[A-Z]$/,
      formatExample: '12345678A',
      hasChecksum: true,
    },
    NIE: {
      name: 'NIE',
      description: 'Número de Identidad de Extranjero (PF)',
      minLength: 9,
      maxLength: 9,
      regex: /^[XYZ]\d{7}[A-Z]$/i,
      formatExample: 'X1234567L',
      hasChecksum: true,
    },
    CIF: {
      name: 'CIF',
      description: 'Código de Identificación Fiscal (PJ)',
      minLength: 9,
      maxLength: 9,
      regex: /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/,
      formatExample: 'A12345678',
      hasChecksum: true,
    },
  },
  PT: {
    NIF: {
      name: 'NIF',
      description: 'Número de Identificação Fiscal',
      minLength: 9,
      maxLength: 9,
      regex: /^\d{9}$/,
      formatExample: '123456789',
      hasChecksum: false,
    },
    CARTAO_CIDADAO: {
      name: 'Cartão de Cidadão',
      description: 'Portuguese Citizen Card',
      minLength: 8,
      maxLength: 8,
      regex: /^\d{8}$/,
      formatExample: '12345678',
      hasChecksum: false,
    },
  },
};

/**
 * Retorna a lista de tipos de documentos suportados em um país.
 * @example getDocumentTypesForCountry('BR') → ['CPF', 'RG']
 */
export function getDocumentTypesForCountry(countryCode: string): string[] {
  return Object.keys(COUNTRY_DOCUMENTS[countryCode] || {});
}

/**
 * Retorna o tipo de documento padrão para um país (o primeiro na lista).
 * @example getDefaultDocumentType('BR') → 'CPF'
 * @example getDefaultDocumentType('AR') → 'DNI'
 */
export function getDefaultDocumentType(countryCode: string): string {
  const types = getDocumentTypesForCountry(countryCode);
  return types.length > 0 ? types[0] : '';
}

/**
 * Retorna lista de todos os países suportados.
 * @example getSupportedCountries() → ['BR', 'AR', 'US', 'ES', 'PT']
 */
export function getSupportedCountries(): string[] {
  return Object.keys(COUNTRY_DOCUMENTS);
}

/**
 * Obtém regra de validação de um tipo de documento específico.
 * @example getValidationRule('BR', 'CPF') → { name: 'CPF', regex: /^\d{11}$/, ... }
 */
export function getValidationRule(
  countryCode: string,
  documentType: string
): DocumentValidationRule | null {
  return COUNTRY_DOCUMENTS[countryCode]?.[documentType] || null;
}

/**
 * Valida se um país é suportado.
 * @example isSupportedCountry('BR') → true
 */
export function isSupportedCountry(countryCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(COUNTRY_DOCUMENTS, countryCode);
}

/**
 * Valida se um tipo de documento é suportado em um país.
 * @example isSupportedDocumentType('BR', 'CPF') → true
 */
export function isSupportedDocumentType(countryCode: string, documentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    COUNTRY_DOCUMENTS[countryCode] || {},
    documentType
  );
}
