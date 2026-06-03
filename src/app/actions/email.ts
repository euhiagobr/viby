'use server';

import nodemailer from 'nodemailer';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Serviço de e-mail exclusivo via SMTP.
 * Fluxo de recuperação por link mágico removido.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

async function getTransporter() {
  const db = await getDb();
  const snap = await getDoc(doc(db, 'settings', 'email'));
  
  if (!snap.exists()) {
    throw new Error("Serviço de E-mail não configurado.");
  }

  const data = snap.data();
  if (!data?.smtpUser || !data?.smtpPass) {
    throw new Error("Credenciais SMTP ausentes.");
  }

  return nodemailer.createTransport({
    host: data.smtpHost || 'smtp.gmail.com',
    port: Number(data.smtpPort) || 465,
    secure: (data.smtpPort === '465' || !data.smtpPort),
    auth: { user: data.smtpUser, pass: data.smtpPass },
  });
}

export async function sendPasswordResetLinkEmail(data: { to: string; userName: string; otpCode: string }) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">Viby.Club</h1>
        <h2 style="color: #333;">Recuperação de Acesso</h2>
        <p>Olá, <strong>${data.userName}</strong>. Utilize o código de segurança abaixo para redefinir sua senha:</p>
        <div style="background: #f1f5f9; padding: 30px; text-align: center; border-radius: 15px; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2C52EE; border: 2px dashed #cbd5e1; margin: 25px 0;">
          ${data.otpCode}
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
          Este código é válido por 15 minutos e pode ser utilizado apenas uma vez.<br>
          Se você não solicitou esta alteração, ignore este e-mail.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: `🔐 Código de Acesso: ${data.otpCode}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { 
    console.error("[Email Error]", e.message);
    return { success: false, error: e.message }; 
  }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">${data.siteName || "Viby"}</h1>
        <h2>Bem-vindo ao Clube!</h2>
        <p>Olá, <strong>${data.userName}</strong>. Sua conta foi criada com sucesso.</p>
        <div style="margin-top: 30px;">
          <a href="https://viby.club/dashboard" style="background: #2C52EE; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Explorar Eventos</a>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${data.siteName || "Viby"} Club" <${smtpUser}>`,
      to: data.to,
      subject: `👋 Bem-vindo à ${data.siteName || "Viby"}!`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
