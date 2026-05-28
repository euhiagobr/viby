'use server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { sendPasswordResetLinkEmail } from './email';

/**
 * @fileOverview Server Actions para recuperação de senha com normalização rigorosa.
 */

const GENERATOR_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOTP(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += GENERATOR_CHARS.charAt(Math.floor(Math.random() * GENERATOR_CHARS.length));
  }
  return code;
}

export async function requestPasswordRecovery(identifier: string) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    // 1. Resolver identificador (E-mail ou @Username) com normalização
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    const searchField = isEmail ? "email" : "username";
    const searchValue = inputClean.replace('@', '');

    console.log(`[Recovery] Iniciando busca por ${searchField}: ${searchValue}`);

    const userSnap = await db.collection("users")
      .where(searchField, "==", searchValue)
      .limit(1)
      .get();
    
    if (userSnap.empty) {
      return { success: false, error: 'Usuário não encontrado em nossa base.' }; 
    }

    const userData = userSnap.docs[0].data();
    const email = userData.email.toLowerCase().trim();
    const userName = userData.name || userData.displayName || "Usuário";

    // 2. Verificar se o usuário existe no Firebase Auth
    try {
      await auth.getUserByEmail(email);
    } catch (e: any) {
       console.error(`[Recovery] Erro Auth: ${email}`, e.message);
       return { success: false, error: 'Falha na integridade da conta.' };
    }

    // 3. Gerar código OTP e salvar
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

    await db.collection('password_reset_codes').add({
      email,
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0,
      ip,
      userAgent
    });

    console.log(`[Recovery] Código ${code} gerado para ${email}`);

    // 4. Enviar E-mail via SMTP
    const emailResult = await sendPasswordResetLinkEmail({
      to: email,
      userName,
      otpCode: code
    });

    if (!emailResult.success) {
      return { success: false, error: `Falha no envio de e-mail. Verifique o SMTP no Painel Admin.` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Recovery Error]', error);
    return { success: false, error: `Erro no servidor: ${error.message}` };
  }
}

/**
 * Valida o código em memória para evitar erro 9 FAILED_PRECONDITION (falta de índice).
 */
export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const db = getAdminDb();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    console.log(`[Verify] Validando ${cleanCode} para ${normalizedEmail}`);

    // Consulta básica que NÃO exige índice composto
    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('used', '==', false)
      .get();

    if (snapshot.empty) {
      console.warn(`[Verify] Nenhum código pendente para ${normalizedEmail}`);
      return { success: false, error: 'Código inválido ou já utilizado.' };
    }
    
    // Filtragem em memória (CPU amigável para volumes pequenos de recuperação)
    const validCodes = snapshot.docs
      .map(d => d.data())
      .filter(d => d.code === cleanCode)
      .filter(d => d.expiresAt.toDate() > new Date());

    if (validCodes.length === 0) {
      console.warn(`[Verify] Código incorreto ou expirado para ${normalizedEmail}`);
      return { success: false, error: 'Código incorreto ou expirado.' };
    }

    console.log(`[Verify] Sucesso para ${normalizedEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Verify Error]', error);
    return { success: false, error: `Falha técnica: ${error.message}` };
  }
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();
    
    console.log(`[Reset] Troca de senha solicitada: ${normalizedEmail}`);

    // Localizar o registro do código para marcar como usado
    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .get();

    if (snapshot.empty) throw new Error("Validação de segurança falhou. Solicite novo código.");

    const latestDoc = snapshot.docs[0];

    // Atualizar no Firebase Auth
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, { password });
    
    // Marcar como utilizado
    await latestDoc.ref.update({ 
      used: true, 
      usedAt: FieldValue.serverTimestamp() 
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Reset Error]', error);
    return { success: false, error: `Não foi possível trocar a senha: ${error.message}` };
  }
}
