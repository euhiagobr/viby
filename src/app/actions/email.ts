'use server';

import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';

async function getBranding() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('site').get();
    const data = snap.data();
    
    const defaultLogo = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Flogo_placeholder.png?alt=media";
    
    return {
      logoUrl: data?.logoUrl || defaultLogo,
      siteName: data?.siteName || "Viby",
      baseUrl: "https://viby.club"
    };
  } catch (e) {
    return {
      logoUrl: "",
      siteName: "Viby",
      baseUrl: "https://viby.club"
    };
  }
}

async function getTransporter() {
  const db = getAdminDb();
  const snap = await db.collection('settings').doc('email').get();
  
  if (!snap.exists) {
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
    auth: { user: data.smtpUser, pass: data.smtpPass.replace(/\s/g, '') }, // Garante que a senha não tenha espaços
  });
}

async function logSentEmail(data: {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  content: string;
  type: string;
  sender: string;
}) {
  try {
    const db = getAdminDb();
    await db.collection('sent_emails').add({
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn("[Email Audit Log] Falha ao registrar cópia de segurança", e);
  }
}

function getEmailTemplate(branding: any, content: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 30px; padding: 20px;">
        ${branding.logoUrl ? 
          `<img src="${branding.logoUrl}" alt="${branding.siteName}" style="max-height: 45px; width: auto; display: block; margin: 0 auto;">` : 
          `<h1 style="color: #2C52EE; font-style: italic; margin: 0; font-weight: 900;">${branding.siteName.toUpperCase()}</h1>`
        }
      </div>
      <div style="background: #ffffff; padding: 40px; border-radius: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        ${content}
      </div>
      <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
        © 2026 ${branding.siteName} • Porto Alegre, RS
      </div>
    </div>
  `;
}

export async function sendOTPRecoveryEmail(data: { to: string; userName: string; otpCode: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; margin-bottom: 10px; font-weight: 900;">Recuperação de Acesso</h2>
      <p>Olá, <strong>${data.userName}</strong>. Utilize o código de segurança abaixo para redefinir sua senha na <strong>${branding.siteName}</strong>:</p>
      <div style="background: #f8fafc; padding: 30px; text-align: center; border-radius: 20px; font-size: 32px; font-weight: 900; color: #2C52EE; border: 2px dashed #dbeafe; margin: 30px 0; letter-spacing: 5px;">
        ${data.otpCode}
      </div>
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Este código expira em 10 minutos. Se você não solicitou esta alteração, ignore este e-mail por segurança.</p>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🔐 Código de acesso: ${data.otpCode}`;

    await transporter.sendMail({
      from: `"${branding.siteName} Security" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "otp_recovery",
      sender: "Viby Security"
    });

    return { success: true };
  } catch (e: any) { 
    console.error("[sendOTPRecoveryEmail]", e);
    return { success: false, error: e.message }; 
  }
}

export async function sendPasswordChangedNotificationEmail(data: { 
  to: string; 
  userName: string; 
  ip: string; 
  location: string; 
  timestamp: string; 
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 48px;">🛡️</span>
      </div>
      <h2 style="color: #2C52EE; text-transform: uppercase; margin-bottom: 10px; font-weight: 900;">Senha Alterada</h2>
      <p>Olá, <strong>${data.userName}</strong>. Detectamos que a senha da sua conta foi alterada com sucesso.</p>
      <div style="background: #fff1f2; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #fecaca; text-align: left;">
        <p style="margin: 5px 0; font-size: 13px; color: #991b1b;"><strong>IP:</strong> ${data.ip}</p>
        <p style="margin: 5px 0; font-size: 13px; color: #991b1b;"><strong>Local:</strong> ${data.location}</p>
        <p style="margin: 5px 0; font-size: 13px; color: #991b1b;"><strong>Data/Hora:</strong> ${data.timestamp} (Brasília)</p>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Se você <strong>não</strong> realizou esta alteração, entre em contato imediatamente com o nosso suporte oficial ou tente recuperar seu acesso agora.</p>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🛡️ Alerta de Segurança: Senha Alterada`;

    await transporter.sendMail({
      from: `"${branding.siteName} Security" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "password_changed",
      sender: "Viby Security"
    });

    return { success: true };
  } catch (e: any) { 
    console.error("[sendPasswordChangedNotificationEmail]", e);
    return { success: false, error: e.message }; 
  }
}

// ... (o resto do arquivo com a mesma modificação nos blocos catch)

