/**
 * @fileOverview Validação de validade de ingressos baseada em datas/horas de eventos
 * Comparação usando UTC-3 (fuso horário padrão da plataforma)
 */

const BRAZIL_TZ_OFFSET = -3; // UTC-3

/**
 * Converte uma data/hora com offset de timezone para Date objeto
 * @param dateInput - Data em formato ISO, timestamp, Date, ou Firestore Timestamp
 * @param timeStr - Hora em formato HH:mm (opcional)
 * @param tzOffset - Offset de timezone em horas (padrão: UTC-3)
 * @returns Date objeto em UTC
 */
function parseDateTimeInTimezone(dateInput: any, timeStr?: string, tzOffset: number = BRAZIL_TZ_OFFSET): Date {
  let dateObj: Date;

  // Se for timestamp em ms (number)
  if (typeof dateInput === 'number') {
    dateObj = new Date(dateInput);
  }
  // Se for objeto Firestore Timestamp com método toDate()
  else if (dateInput && typeof dateInput === 'object' && 'toDate' in dateInput) {
    dateObj = (dateInput as any).toDate();
  }
  // Se for objeto Firestore Timestamp serializado (com seconds e nanoseconds)
  else if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
    // Converter Firestore Timestamp para Date
    const milliseconds = dateInput.seconds * 1000 + dateInput.nanoseconds / 1000000;
    dateObj = new Date(milliseconds);
  }
  // Se já for uma Date
  else if (dateInput instanceof Date) {
    dateObj = new Date(dateInput);
  }
  // Se for string
  else if (typeof dateInput === 'string') {
    dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format: ${dateInput}`);
    }
  }
  // Fallback para tentar converter
  else {
    dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format: ${JSON.stringify(dateInput)}`);
    }
  }

  // Se houver horário, adicionar
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    dateObj.setUTCHours(hours, minutes, 0, 0);
  } else {
    // Se não houver hora, usar meia-noite
    dateObj.setUTCHours(0, 0, 0, 0);
  }

  // Ajustar para timezone local (converter de UTC para offset específico)
  const utcTime = dateObj.getTime();
  const localTime = utcTime - (tzOffset * 60 * 60 * 1000);
  return new Date(localTime);
}

/**
 * Obtém a hora atual em UTC-3 (hora de Brasília)
 * @returns Date objeto representando agora em UTC-3
 */
export function getNowInBrazilTZ(): Date {
  const now = new Date();
  const utcTime = now.getTime();
  
  // UTC-3 = subtract 3 hours (ou adicionar 3 horas offset negativo)
  // Para obter "agora em UTC-3", precisamos:
  // 1. Pegar agora em UTC
  // 2. Calcular o offset UTC-3
  
  const brazilOffset = -3 * 60 * 60 * 1000; // -3 horas em ms
  return new Date(utcTime + brazilOffset);
}

/**
 * Valida se um evento já terminou
 * @param eventEndDate - Data de término do evento (ISO string, timestamp, Date, ou Firestore Timestamp)
 * @param eventEndTime - Hora de término (formato HH:mm, opcional - padrão: 23:59)
 * @returns true se evento já terminou, false caso contrário
 */
export function hasEventEnded(
  eventEndDate: any,
  eventEndTime?: string
): boolean {
  try {
    // Se não houver data de fim, evento é válido indefinidamente
    if (!eventEndDate) {
      return false;
    }

    let endDateTime: Date;

    // Se já for uma Date, usar diretamente
    if (eventEndDate instanceof Date) {
      endDateTime = new Date(eventEndDate);
    }
    // Se for objeto Firestore Timestamp
    else if (typeof eventEndDate === 'object' && 'toDate' in eventEndDate) {
      endDateTime = eventEndDate.toDate();
    }
    // Se for timestamp em ms (number)
    else if (typeof eventEndDate === 'number') {
      endDateTime = new Date(eventEndDate);
    }
    // Se for string, fazer parse completo com timezone
    else if (typeof eventEndDate === 'string') {
      const timeToUse = eventEndTime || '23:59';
      endDateTime = parseDateTimeInTimezone(eventEndDate, timeToUse);
    }
    // Fallback para tentar converter
    else {
      endDateTime = parseDateTimeInTimezone(eventEndDate, eventEndTime || '23:59');
    }

    // Comparar com agora em UTC-3
    const now = getNowInBrazilTZ();
    
    // Evento terminou se agora > data/hora de término
    return now > endDateTime;
  } catch (error) {
    console.error('[Ticket Expiry] Error checking event end:', error);
    // Em caso de erro, considerar evento como válido (não bloquear usuário)
    return false;
  }
}

/**
 * Calcula quantos dias faltam para um evento terminar
 * Retorna negativo se evento já terminou
 * @param eventEndDate - Data de término
 * @param eventEndTime - Hora de término (opcional)
 * @returns Número de dias
 */
export function getDaysUntilEventEnd(
  eventEndDate: string | number | any,
  eventEndTime?: string
): number {
  try {
    if (!eventEndDate) {
      return Infinity; // Evento válido indefinidamente
    }

    let endDateTime: Date;

    if (typeof eventEndDate === 'object' && 'toDate' in eventEndDate) {
      endDateTime = eventEndDate.toDate();
    } else if (typeof eventEndDate === 'number') {
      endDateTime = new Date(eventEndDate);
    } else {
      const timeToUse = eventEndTime || '23:59';
      endDateTime = parseDateTimeInTimezone(eventEndDate as string, timeToUse);
    }

    const now = getNowInBrazilTZ();
    const diffMs = endDateTime.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return Math.ceil(diffDays);
  } catch (error) {
    console.error('[Ticket Expiry] Error calculating days:', error);
    return Infinity; // Em caso de erro, considerar inválido
  }
}

/**
 * Retorna o status de validade de um ingresso
 * PRIORIDADE: Utilizado > Expirado > Válido
 * Leva em conta: status do ingresso + se evento terminou + se foi utilizado
 * @param registration - Dados do ingresso
 * @returns Status: 'valid', 'expired', 'cancelled', 'refunded', 'pending', 'used'
 */
export function getTicketValidity(registration: any): 'valid' | 'expired' | 'cancelled' | 'refunded' | 'pending' | 'used' {
  // PRIORIDADE 1: Verificar se já foi utilizado (NUNCA deve ser expirado se foi usado)
  if (registration.checkedIn === true || registration.status === 'used') {
    return 'used';
  }

  // PRIORIDADE 2: Verificar status de cancelamento/estorno (antes de expirado)
  if (registration.status === 'cancelled' || registration.paymentStatus === 'Cancelado') {
    return 'cancelled';
  }
  
  if (registration.status === 'refunded' || registration.paymentStatus === 'refunded_wallet' || registration.paymentStatus === 'Estornado') {
    return 'refunded';
  }

  if (registration.paymentStatus === 'Pendente') {
    return 'pending';
  }

  // PRIORIDADE 3: Verificar se evento terminou (só se não foi utilizado)
  const eventEndDate = registration.eventEndDate || registration.eventDate;
  const eventEndTime = registration.eventEndTime;

  if (hasEventEnded(eventEndDate, eventEndTime)) {
    return 'expired';
  }

  // PRIORIDADE 4: Ingresso está válido
  return 'valid';
}

/**
 * Interface para resposta estruturada de validação
 */
export interface TicketValidationResult {
  isValid: boolean;
  status: 'valid' | 'expired' | 'cancelled' | 'refunded' | 'pending' | 'used' | 'other';
  reason?: string;
  daysUntilExpiry?: number;
}

/**
 * Valida completamente um ingresso
 * PRIORIDADE: Utilizado > Expirado > Cancelado > Refunded > Pending > Válido
 * @param registration - Dados do ingresso com evento
 * @returns Resultado estruturado da validação
 */
export function validateTicket(registration: any): TicketValidationResult {
  const validity = getTicketValidity(registration);
  
  const eventEndDate = registration.eventEndDate || registration.eventDate;
  const eventEndTime = registration.eventEndTime;
  const daysRemaining = eventEndDate ? getDaysUntilEventEnd(eventEndDate, eventEndTime) : undefined;

  switch (validity) {
    case 'used':
      return {
        isValid: true, // Ingresso já foi utilizado, é válido (já serviu seu propósito)
        status: 'used',
        reason: 'Este ingresso já foi utilizado',
        daysUntilExpiry: daysRemaining,
      };
    case 'expired':
      return {
        isValid: false,
        status: 'expired',
        reason: 'Este evento já terminou',
        daysUntilExpiry: daysRemaining,
      };
    case 'cancelled':
      return {
        isValid: false,
        status: 'cancelled',
        reason: 'Este ingresso foi cancelado',
      };
    case 'refunded':
      return {
        isValid: false,
        status: 'refunded',
        reason: 'Este ingresso foi estornado',
      };
    case 'pending':
      return {
        isValid: false,
        status: 'pending',
        reason: 'O pagamento deste ingresso está pendente',
      };
    case 'valid':
    default:
      return {
        isValid: true,
        status: 'valid',
        daysUntilExpiry: daysRemaining,
      };
  }
}
