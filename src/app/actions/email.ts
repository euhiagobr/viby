'use server';

import nodemailer from 'nodemailer';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Serviço de e-mail robusto via Firebase Admin e Nodemailer.
 */

async function logEmail(data: any) {
  try {
    const db = getAdminDb();
    await db.collection('sent_emails').add({
      ...data,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[Email Service] Falha ao logar e-mail:', e);
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
  } catch (e: any) {
    console.error('[Email Service] Erro ao buscar config:', e.message);
    return { smtpUser: null, smtpPass: null };
  }
}

async function getTransporter() {
  const { smtpUser, smtpPass } = await getEmailConfig();
  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP não configurado. Acesse o Painel Admin > Configurações > E-mail.");
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    timeout: 10000,
  });

  try {
    await transporter.verify();
  } catch (verifyError: any) {
    console.error('[SMTP] Erro de Autenticação:', verifyError.message);
    throw new Error(`Falha na conexão SMTP: ${verifyError.message}`);
  }
  
  return { transporter, smtpUser };
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2 style="color: #0f172a;">Seu código de recuperação chegou!</h2>
        <p>Olá, <strong>${data.userName}</strong>. Use o código abaixo para redefinir sua senha:</p>
        <div style="background: #f1f5f9; padding: 30px; text-align: center; border-radius: 15px; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2C52EE; border: 2px dashed #cbd5e1; margin: 20px 0;">
          ${data.otpCode}
        </div>
        <p style="font-size: 13px; color: #64748b;">Este código expira em 15 minutos e só pode ser usado uma vez.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 11px; color: #cbd5e1;">Se você não solicitou esta redefinição, proteja sua conta e ignore este e-mail.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: `🔐 Seu código de acesso: ${data.otpCode}`,
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      type: "password_recovery_otp",
      subject: "Recuperação de Senha",
      sender: "Viby Auth",
      content: htmlContent
    });

    return { success: true };
  } catch (e: any) { 
    console.error('[Mail Error]', e);
    return { success: false, error: e.message }; 
  }
}

export async function sendPayoutConfirmedEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `<div style="font-family: sans-serif; padding: 40px;"><h1>Viby Finance</h1><p>Pagamento de <b>${data.amount}</b> processado para ${data.orgName}.</p><a href="${data.proofUrl}">Ver Comprovante</a></div>`;
    await transporter.sendMail({ from: `"Viby Finance" <${smtpUser}>`, to: data.to, subject: `✅ Pagamento Efetuado: ${data.orgName}`, html: htmlContent });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTicketEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `<div style="font-family: sans-serif; padding: 40px;"><h1>Viby Ingressos</h1><p>Seu ingresso para <b>${data.eventTitle}</b> está pronto!</p><p>Código: ${data.ticketCode}</p><a href="${data.voucherUrl}">Abrir Voucher</a></div>`;
    await transporter.sendMail({ from: `"Viby Ingressos" <${smtpUser}>`, to: data.to, subject: `🎫 Seu ingresso: ${data.eventTitle}`, html: htmlContent });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `<div style="font-family: sans-serif; padding: 40px;"><h1>Bem-vindo à ${data.siteName}!</h1><p>Olá, ${data.userName}. Prepare-se para viver as melhores experiências.</p></div>`;
    await transporter.sendMail({ from: `"${data.siteName}" <${smtpUser}>`, to: data.to, subject: `✨ Bem-vindo à ${data.siteName}`, html: htmlContent });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `<div style="font-family: sans-serif; padding: 40px;"><h1>Convite de Equipe</h1><p>Você foi convidado para gerenciar <b>${data.orgName}</b>.</p></div>`;
    await transporter.sendMail({ from: `"Viby System" <${smtpUser}>`, to: data.to, subject: `🤝 Convite para Equipe: ${data.orgName}`, html: htmlContent });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationStatusEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `<div style="font-family: sans-serif; padding: 40px;"><h1>Viby System</h1><p>${data.userName} ${data.status === 'accepted' ? 'aceitou' : 'recusou'} o convite para ${data.orgName}.</p></div>`;
    await transporter.sendMail({ from: `"Viby System" <${smtpUser}>`, to: data.to, subject: `📢 Atualização de Equipe: ${data.orgName}`, html: htmlContent });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationNoticeEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `<div style="font-family: sans-serif; padding: 40px;"><h1>Viby System</h1><p>Você enviou um convite para ${data.inviteeName}.</p></div>`;
    await transporter.sendMail({ from: `"Viby System" <${smtpUser}>`, to: data.to, subject: `✉️ Convite Enviado: ${data.orgName}`, html: htmlContent });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function resendLoggedEmail(emailData: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    await transporter.sendMail({ from: `"Viby Support" <${smtpUser}>`, to: emailData.recipientEmail, subject: `[REENVIO] ${emailData.subject}`, html: emailData.content });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendCartPendingEmail(data: any) { return { success: true }; }
