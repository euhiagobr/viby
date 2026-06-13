import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normaliza e valida datas de eventos.
 * Caso o horário final seja menor que o inicial na mesma data, 
 * interpreta como encerramento no dia seguinte.
 */
export function normalizeEventDates(startDateStr: string, endDateStr: string): { startDate: string, endDate: string, isValid: boolean, error?: string } {
  if (!startDateStr || !endDateStr) {
    return { startDate: startDateStr, endDate: endDateStr, isValid: false, error: "Datas incompletas." };
  }

  let start = new Date(startDateStr);
  let end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { startDate: startDateStr, endDate: endDateStr, isValid: false, error: "Formato de data inválido." };
  }

  // Se o fim for menor ou igual ao início
  if (end <= start) {
    const startDay = start.toISOString().split('T')[0];
    const endDay = end.toISOString().split('T')[0];

    // Se estiverem no mesmo dia de calendário, interpretamos como virada de noite
    if (startDay === endDay) {
      end.setDate(end.getDate() + 1);
    }
  }

  // Validação final após tentativa de normalização
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
 * Valida CPF Brasileiro (Algoritmo de dígitos verificadores)
 */
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, "");
  
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

/**
 * Valida CNPJ Brasileiro
 */
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

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Valida formato de Username (Apenas letras, números, ponto e underline)
 * Mínimo 5 caracteres conforme regra de negócio oficial.
 */
export function validateUsername(username: string): boolean {
  const regex = /^[a-z0-9._]+$/;
  return regex.test(username) && username.length >= 5 && username.length <= 30;
}
