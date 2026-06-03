'use server';

import nodemailer from 'nodemailer';
import { doc, getDoc, getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Serviço de e-mail SMTP auditado para fluxos de segurança, boas-vindas e operação.
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
 * Helper para registrar e-mails disparados no banco para auditoria.
 */
async function logSentEmail(data: {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  content: string;
  type: string;
  sender: string;
}) {
  try {
    const db = await getDb();
    await addDoc(collection(db, 'sent_emails'), {
      ...data,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("[Email Log] Falha ao registrar log", e);
  }
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
          Este código é válido por <strong>10 minutos</strong> e pode ser utilizado apenas uma vez.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: `🔐 Seu código de acesso: ${data.otpCode}`,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject: "Recuperação de Acesso",
      content: htmlContent,
      type: "otp_recovery",
      sender: "Viby Security"
    });

    return { success: true };
  } catch (e: any) { 
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
        <p style="color: #555; line-height: 1.6;">Olá, <strong>${data.userName}</strong>. Sua senha foi alterada com sucesso.</p>
        <div style="background: #f8fafc; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 5px 0; font-size: 13px;"><strong>Data/Hora:</strong> ${data.timestamp}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>IP:</strong> ${data.ip}</p>
          <p style="margin: 5px 0; font-size: 13px;"><strong>Local:</strong> ${data.location}</p>
        </div>
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

/**
 * Envia o voucher do ingresso.
 */
export async function sendTicketEmail(data: {
  to: string;
  userName: string;
  eventTitle: string;
  ticketCode: string;
  eventDate: string;
  voucherUrl: string;
  eventCity?: string;
}) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">Viby Ingressos</h1>
        <h2>Sua presença está garantida!</h2>
        <p>Olá, <strong>${data.userName}</strong>. Seu ingresso para <strong>${data.eventTitle}</strong> já está disponível.</p>
        <div style="background: #f8fafc; padding: 25px; border-radius: 15px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 24px; font-weight: 900; color: #2C52EE; margin: 0;">${data.ticketCode}</p>
        </div>
        <p><a href="${data.voucherUrl}" style="background: #2C52EE; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Ver Voucher Digital</a></p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Ingressos" <${smtpUser}>`,
      to: data.to,
      subject: `🎟️ Seu ingresso: ${data.eventTitle}`,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject: `Seu ingresso: ${data.eventTitle}`,
      content: htmlContent,
      type: "ticket_confirmation",
      sender: "Viby Ingressos"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Reenvia um e-mail a partir dos dados brutos (usado pelo admin).
 */
export async function resendLoggedEmail(data: {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  content: string;
  type: string;
}) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    await transporter.sendMail({
      from: `"Viby Club" <${smtpUser}>`,
      to: data.recipientEmail,
      subject: data.subject,
      html: data.content
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendTeamInvitationEmail(data: { to: string; orgName: string; role: string; inviterName: string }) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">Viby Team</h1>
        <h2>Convite de Colaboração</h2>
        <p><strong>${data.inviterName}</strong> convidou você para ser <strong>${data.role}</strong> na marca <strong>${data.orgName}</strong>.</p>
        <p>Acesse o seu dashboard para aceitar o convite.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Team" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite de Equipe: ${data.orgName}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendTeamInvitationNoticeEmail(data: any) { return { success: true }; }
export async function sendTeamInvitationStatusEmail(data: any) { return { success: true }; }

/**
 * Notifica o produtor sobre o sucesso de um repasse.
 */
export async function sendPayoutConfirmedEmail(data: {
  to: string;
  userName: string;
  orgName: string;
  amount: number;
  proofUrl: string;
}) {
  try {
    const transporter = await getTransporter();
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">Viby Finance</h1>
        <h2>Pagamento Processado</h2>
        <p>Olá, <strong>${data.userName}</strong>. O repasse para <strong>${data.orgName}</strong> no valor de <strong>R$ ${data.amount.toFixed(2)}</strong> foi realizado.</p>
        <p><a href="${data.proofUrl}" style="color: #2C52EE; font-weight: bold;">Clique aqui para baixar o comprovante</a></p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Finance" <${smtpUser}>`,
      to: data.to,
      subject: `💰 Repasse Confirmado: ${data.orgName}`,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject: `Repasse Confirmado: ${data.orgName}`,
      content: htmlContent,
      type: "payout_confirmation",
      sender: "Viby Finance"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
