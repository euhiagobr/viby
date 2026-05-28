'use server';

import nodemailer from 'nodemailer';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Serviço de e-mail exclusivo de servidor usando Firebase Admin.
 */

async function logEmail(data: any) {
  try {
    const db = getAdminDb();
    await db.collection('sent_emails').add({
      ...data,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Erro ao logar e-mail:', e);
  }
}

export async function getEmailConfig() {
  try {
    const db = getAdminDb();
    const emailDoc = await db.collection('settings').doc('email').get();
    if (!emailDoc.exists) return { smtpUser: null, smtpPass: null };
    const data = emailDoc.data();
    return {
      smtpUser: data?.smtpUser || null,
      smtpPass: data?.smtpPass || null,
    };
  } catch (e) {
    return { smtpUser: null, smtpPass: null };
  }
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    if (!smtpUser || !smtpPass) throw new Error("Configuração SMTP incompleta.");

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2563eb;">Viby.Club</h1>
        <h2>Seu código de recuperação chegou!</h2>
        <p>Olá, ${data.userName}. Use o código abaixo para redefinir sua senha:</p>
        <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 10px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a;">
          ${data.otpCode}
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Este código expira em 15 minutos.</p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.verify();
    await transporter.sendMail({
      from: `"Viby Auth" <${smtpUser}>`,
      to: data.to,
      subject: "🔐 Seu código de recuperação Viby",
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      type: "password_recovery_otp",
      subject: "Recuperação de Senha"
    });

    return { success: true };
  } catch (e: any) { 
    console.error("Erro no envio SMTP:", e.message);
    return { success: false, error: e.message }; 
  }
}

// ... outras funções de e-mail devem seguir o mesmo padrão usando getAdminDb()
