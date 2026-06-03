'use server';

import nodemailer from 'nodemailer';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Serviço de e-mail SMTP auditado para fluxos de segurança e boas-vindas.
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

/**
 * Envia o código OTP de 6 dígitos para recuperação de senha.
 */
export async function sendOTPRecoveryEmail(data: { to: string; userName: string; otpCode: string }) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase; letter-spacing: -1px;">Viby.Club</h1>
        <h2 style="color: #333; margin-top: 30px;">Recuperação de Acesso</h2>
        <p style="color: #555; line-height: 1.6;">Olá, <strong>${data.userName}</strong>. Recebemos uma solicitação para redefinir sua senha.</p>
        <p style="color: #555; line-height: 1.6;">Utilize o código de segurança de 6 dígitos abaixo para prosseguir:</p>
        
        <div style="background: #f8fafc; padding: 35px; text-align: center; border-radius: 20px; font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #2C52EE; border: 2px dashed #cbd5e1; margin: 30px 0; font-family: monospace;">
          ${data.otpCode}
        </div>
        
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          Este código é válido por <strong>10 minutos</strong> e pode ser utilizado apenas uma vez.<br>
          Se você não solicitou esta alteração, proteja sua conta e ignore este e-mail.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: `🔐 Seu código de acesso: ${data.otpCode}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { 
    console.error("[Email Error]", e.message);
    return { success: false, error: e.message }; 
  }
}

/**
 * Envia notificação de segurança após alteração de senha.
 */
export async function sendPasswordChangedNotificationEmail(data: { 
  to: string; 
  userName: string; 
  ip: string; 
  location: string; 
  timestamp: string; 
}) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">Viby Security</h1>
        <h2 style="color: #333; margin-top: 30px;">Senha Alterada</h2>
        <p style="color: #555; line-height: 1.6;">Olá, <strong>${data.userName}</strong>. Este é um aviso de segurança para confirmar que sua senha foi alterada com sucesso.</p>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid #e2e8f0;">
          <h4 style="margin-top: 0; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 1px;">Detalhes do Evento:</h4>
          <p style="margin: 5px 0; font-size: 13px; color: #1e293b;"><strong>Data/Hora:</strong> ${data.timestamp} (Brasília)</p>
          <p style="margin: 5px 0; font-size: 13px; color: #1e293b;"><strong>Endereço IP:</strong> ${data.ip}</p>
          <p style="margin: 5px 0; font-size: 13px; color: #1e293b;"><strong>Localização:</strong> ${data.location}</p>
        </div>
        
        <p style="color: #555; line-height: 1.6;">Se foi você quem realizou esta alteração, ignore este e-mail.</p>
        <p style="color: #ef4444; font-weight: bold; line-height: 1.6;">Caso você NÃO reconheça esta atividade, entre em contato imediatamente com o suporte Viby.</p>
        
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #eee; padding-top: 20px; margin-top: 40px;">
          Esta é uma mensagem automática de segurança.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: `🛡️ Segurança: Sua senha foi alterada`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) {
    console.error("[Email Notification Error]", e.message);
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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
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
