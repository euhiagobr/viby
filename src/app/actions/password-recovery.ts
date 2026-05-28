
'use server';

import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';
import { headers } from 'next/headers';
import nodemailer from 'nodemailer';

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();
const auth = admin.auth();

const GENERATOR_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOTP(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += GENERATOR_CHARS.charAt(Math.floor(Math.random() * GENERATOR_CHARS.length));
  }
  return code;
}

async function getEmailConfig() {
  const emailDoc = await db.collection('settings').doc('email').get();
  if (!emailDoc.exists) return { user: null, pass: null };
  const data = emailDoc.data();
  return { user: data?.smtpUser || null, pass: data?.smtpPass || null };
}

export async function requestPasswordRecovery(email: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const head = await headers();
    const ip = head.get('x-forwarded-for') || 'unknown';
    const userAgent = head.get('user-agent') || 'unknown';

    // Rate limit: 3 envios por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSends = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('createdAt', '>', oneHourAgo)
      .get();

    if (recentSends.size >= 3) {
      return { success: false, error: 'Muitas solicitações. Tente novamente em uma hora.' };
    }

    // Verificar se usuário existe (sem revelar ao client)
    let userExists = false;
    try {
      await auth.getUserByEmail(normalizedEmail);
      userExists = true;
    } catch (e) {}

    if (!userExists) {
      return { success: true }; // Resposta genérica por segurança
    }

    // Invalida códigos antigos
    const oldCodes = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('used', '==', false)
      .get();
    
    const batch = db.batch();
    oldCodes.forEach(doc => batch.update(doc.ref, { used: true, invalidatedAt: admin.firestore.FieldValue.serverTimestamp() }));

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const codeRef = db.collection('password_reset_codes').doc();
    batch.set(codeRef, {
      email: normalizedEmail,
      code,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0,
      ip,
      userAgent
    });

    await batch.commit();

    // Enviar E-mail
    const { user: smtpUser, pass: smtpPass } = await getEmailConfig();
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
          <h2 style="color: #000; text-transform: uppercase; font-style: italic;">Viby.Club</h2>
          <h1 style="font-size: 24px; color: #333;">Recuperação de Senha</h1>
          <p>Você solicitou a redefinição de sua senha. Use o código abaixo para prosseguir:</p>
          <div style="background: #f4f4f4; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0;">
            <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #2C52EE;">${code}</span>
          </div>
          <p style="font-size: 13px; color: #666;">Este código expira em 15 minutos e é de uso único.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 11px; color: #999;">Se você não solicitou esta alteração, ignore este e-mail por segurança.</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"Suporte Viby" <${smtpUser}>`,
        to: normalizedEmail,
        subject: "Recuperação de senha • Viby",
        html
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Erro ao processar solicitação.' };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', cleanCode)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'Código inválido.' };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.attempts >= 5) {
      return { success: false, error: 'Muitas tentativas. Solicite um novo código.' };
    }

    if (data.expiresAt.toDate() < new Date()) {
      return { success: false, error: 'Código expirado.' };
    }

    return { success: true, token: doc.id };
  } catch (error) {
    return { success: false, error: 'Erro na validação.' };
  }
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 8) return { success: false, error: 'A senha deve ter no mínimo 8 caracteres.' };

    const snapshot = await db.collection('password_reset_codes')
      .where('email', '==', normalizedEmail)
      .where('code', '==', code.toUpperCase())
      .where('used', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return { success: false, error: 'Sessão inválida.' };

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.expiresAt.toDate() < new Date()) return { success: false, error: 'Sessão expirada.' };

    // Atualizar no Auth
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, { password });

    // Marcar como usado
    await doc.ref.update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Falha ao redefinir senha.' };
  }
}
