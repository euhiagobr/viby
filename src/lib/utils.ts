import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDays, addWeeks, addMonths, addYears, format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utilitário robusto para converter qualquer formato de data do Firebase/NextJS em objeto Date.
 */
export function safeParseDate(val: any): Date | null {
  if (!val) return null;
  
  // 1. Client SDK Timestamp real
  if (typeof val.toDate === 'function') return val.toDate();
  
  // 2. Serialized Timestamp do servidor { seconds, nanoseconds }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
  }
  
  // 3. Objeto Date nativo
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  // 4. String ISO ou número
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Converte objetos complexos (como Timestamps) em valores primitivos puros (POJOs) 
 * para envio seguro entre Client e Server no Next.js 15.
 * Força a conversão recursiva de qualquer objeto que possa ter métodos internos.
 * Tambem converte 'undefined' em 'null' para evitar erros no Firestore.
 */
export function serializeForServer(data: any): any {
  if (data === undefined) return null;
  if (data === null) return null;
  
  // Caso seja um número, string ou boolean, retorna direto
  if (typeof data !== 'object') return data;

  // Caso seja um objeto Date nativo
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Caso seja um Timestamp do Firebase (Client ou Admin)
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  // Caso seja um objeto com estrutura de Timestamp {seconds, nanoseconds}
  if (typeof data.seconds === 'number') {
    return new Date(data.seconds * 1000).toISOString();
  }

  // Caso seja um array, processa cada item recursivamente
  if (Array.isArray(data)) {
    return data.map(serializeForServer);
  }
  
  // Caso seja um objeto comum
  const result: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      result[key] = serializeForServer(val);
    }
  }
  return result;
}

/**
 * Formata uma data para o padrão aceito pelo input datetime-local (YYYY-MM-DDTHH:mm)
 */
export function formatDateForInput(date: Date | null | string): string {
  const d = safeParseDate(date);
  if (!d) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Converte uma string de data local (do input) para uma string ISO UTC segura para o servidor.
 */
export function dateToAtomsphericISO(localDateStr: string): string {
  if (!localDateStr) return "";
  const d = new Date(localDateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Normaliza e valida datas de eventos.
 */
export function normalizeEventDates(startDateStr: string, endDateStr: string): { startDate: string, endDate: string, isValid: boolean, error?: string } {
  if (!startDateStr || !endDateStr) {
    return { startDate: startDateStr, endDate: endDateStr, isValid: false, error: "Datas incompletas." };
  }

  let start = safeParseDate(startDateStr);
  let end = safeParseDate(endDateStr);

  if (!start || !end) {
    return { startDate: startDateStr, endDate: endDateStr, isValid: false, error: "Formato de data inválido." };
  }

  const now = new Date();
  const nowWithBuffer = new Date(now.getTime() - 10 * 60 * 1000);

  if (start < nowWithBuffer) {
    return { 
      startDate: start.toISOString(), 
      endDate: end.toISOString(), 
      isValid: false, 
      error: "A data de início não pode estar no passado." 
    };
  }

  if (end <= start) {
    const startDay = start.toISOString().split('T')[0];
    const endDay = end.toISOString().split('T')[0];

    if (startDay === endDay) {
      end.setDate(end.getDate() + 1);
    }
  }

  if (end <= start) {
    return { 
      startDate: start.toISOString(), 
      endDate: end.toISOString(), 
      isValid: false, 
      error: "O encerramento deve ser posterior ao início do evento." 
    };
  }

  return { 
    startDate: start.toISOString(), 
    endDate: end.toISOString(), 
    isValid: true 
  };
}

/**
 * Gera um array de datas para eventos recorrentes.
 */
export function generateRecurrenceDates(recurrency: any) {
  if (!recurrency || !recurrency.freq) return [];
  
  const dates: { startDate: Date; endDate: Date }[] = [];
  const start = safeParseDate(recurrency.startDate);
  const until = safeParseDate(recurrency.until);
  
  if (!start) return [];

  let current = new Date(start);
  const max = 150;
  let count = 0;

  const baseStart = safeParseDate(recurrency.startDate)?.getTime() || 0;
  const baseEnd = safeParseDate(recurrency.endDate)?.getTime() || (baseStart + 4 * 60 * 60 * 1000);
  const duration = baseEnd - baseStart;

  if (recurrency.freq === 'custom' && recurrency.customOccurrences) {
    return recurrency.customOccurrences.map((occ: any) => {
      const s = safeParseDate(`${occ.date}T${occ.startTime || '00:00'}`);
      const e = safeParseDate(`${occ.date}T${occ.endTime || '23:59'}`);
      
      if (!s || !e) return null;
      return { startDate: s, endDate: e };
    }).filter((d: any) => d !== null);
  }

  while (count < max) {
    if (until && current > until) break;

    const occurrenceEnd = new Date(current.getTime() + duration);

    dates.push({ 
      startDate: new Date(current), 
      endDate: occurrenceEnd 
    });

    if (recurrency.freq === 'daily') current = addDays(current, 1);
    else if (recurrency.freq === 'weekly') current = addWeeks(current, 1);
    else if (recurrency.freq === 'biweekly') current = addWeeks(current, 2);
    else if (recurrency.freq === 'monthly') current = addMonths(current, 1);
    else if (recurrency.freq === 'yearly') current = addYears(current, 1);
    else break;

    count++;
  }

  return dates;
}

export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;
  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, "");
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultFinal = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (resultFinal !== parseInt(digits.charAt(1))) return false;
  return true;
}

// Lista de nomes de usuário reservados (rotas públicas e páginas do sistema)
const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'ajuda',
  'cadastro',
  'carnaval',
  'checkout',
  'configuracoes',
  'dashboard',
  'empresas',
  'eventos',
  'experiencias',
  'help',
  'login',
  'logout',
  'oficial',
  'official',
  'onboarding',
  'para-organizadores',
  'privacy',
  'privacidade',
  'reembolso',
  'redefinir-senha',
  'refund',
  'reset-password',
  'root',
  'settings',
  'signin',
  'signup',
  'status',
  'suporte',
  'support',
  'sys',
  'system',
  'terms',
  'termos',
  'viby',
]);

export function validateUsername(username: string): boolean {
  const regex = /^[a-z0-9._]+$/;
  const normalizedUsername = username.toLowerCase();
  
  // Verificar formato básico
  if (!regex.test(normalizedUsername) || normalizedUsername.length < 5 || normalizedUsername.length > 30) {
    return false;
  }
  
  // Verificar se é um nome reservado
  if (RESERVED_USERNAMES.has(normalizedUsername)) {
    return false;
  }
  
  return true;
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

export function formatCurrency(value: number, currency: string = 'BRL', locale: string = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}