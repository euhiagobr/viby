'use server';

import nodemailer from 'nodemailer';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * @fileOverview Serviço de e-mail (Server Action) utilizando credenciais do Firestore.
 */

async function getTransporter() {
  const db = getAdminDb();
  const snap = await db.collection('settings').doc('email').get();
  const data = snap.data();

  if (!snap.exists || !data?.smtpUser || !data?.smtpPass) {
    throw new Error("Serviço de E-mail não configurado no painel Admin.");
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: data.smtpUser, pass: data.smtpPass },
  });
}

async function logEmail(data: any, sender: string) {
  try {
    const db = getAdminDb();
    await db.collection('sent_emails').add({
      ...data,
      sender,
      timestamp: new Date()
    });
  } catch (e) {
    console.warn("Falha ao registrar log de e-mail");
  }
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSnap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Recuperação de Acesso</h2>
        <p>Olá, <strong>${data.userName}</strong>. Use o código abaixo para redefinir sua senha:</p>
        <div style="background: #f1f5f9; padding: 30px; text-align: center; border-radius: 15px; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2C52EE; border: 2px dashed #cbd5e1; margin: 20px 0;">
          ${data.otpCode}
        </div>
        <p style="font-size: 13px; color: #64748b;">Este código expira em 60 minutos.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: `🔐 Código de Segurança: ${data.otpCode}`,
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject: `🔐 Código de Segurança: ${data.otpCode}`,
      content: htmlContent,
      type: 'password_reset_otp'
    }, "Viby Security");

    return { success: true };
  } catch (e: any) { 
    return { success: false, error: e.message }; 
  }
}

export async function sendPayoutConfirmedEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSnap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 40px;">
        <h1 style="color: #2C52EE;">Viby Finance</h1>
        <p>Pagamento de <b>R$ ${data.amount}</b> processado para ${data.orgName}.</p>
        <a href="${data.proofUrl}" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px;">Ver Comprovante</a>
      </div>
    `;
    await transporter.sendMail({ 
      from: `"Viby Finance" <${smtpUser}>`, 
      to: data.to, 
      subject: `✅ Pagamento Efetuado: ${data.orgName}`, 
      html: htmlContent 
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTicketEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSnap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Seu Ingresso Chegou!</h1>
        <p style="font-size: 16px;">Olá <strong>${data.userName}</strong>, sua presença está confirmada!</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 15px; margin: 20px 0;">
           <p><b>Evento:</b> ${data.eventTitle}</p>
           <p><b>Data:</b> ${data.eventDate}</p>
           <p><b>Local:</b> ${data.eventCity}</p>
           <p><b>Código:</b> ${data.ticketCode}</p>
        </div>
        <a href="${data.voucherUrl}" style="display: block; text-align: center; padding: 16px; background: #2C52EE; color: white; border-radius: 12px; text-decoration: none; font-weight: 900; text-transform: uppercase;">Abrir Voucher Digital</a>
      </div>
    `;
    await transporter.sendMail({ 
      from: `"Viby Ingressos" <${smtpUser}>`, 
      to: data.to, 
      subject: `🎫 Ingresso Confirmado: ${data.eventTitle}`, 
      html: htmlContent 
    });

    await logEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject: `🎫 Ingresso Confirmado: ${data.eventTitle}`,
      content: htmlContent,
      type: 'ticket_confirmation'
    }, "Viby Ingressos");

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function resendLoggedEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSnap.data()?.smtpUser;

    await transporter.sendMail({
      from: `"Viby Support" <${smtpUser}>`,
      to: data.recipientEmail,
      subject: `[REENVIO] ${data.subject}`,
      html: data.content
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
