import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utilitário robusto para converter qualquer formato de data do Firebase/NextJS em objeto Date.
 * Lida com Timestamps reais, objetos serializados {seconds, nanoseconds} e strings ISO.
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

export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Normaliza e valida datas de eventos.
 * Caso o horário final seja menor que o inicial na mesma data, 
 * interpreta como encerramento no dia seguinte (virada de noite).
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

export function validateUsername(username: string): boolean {
  const regex = /^[a-z0-9._]+$/;
  return regex.test(username) && username.length >= 5 && username.length <= 30;
}
