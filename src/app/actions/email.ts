'use server';

import nodemailer from 'nodemailer';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Serviço de e-mail centralizado via Firebase Admin e Nodemailer.
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
    throw new Error("SMTP não configurado no Painel Administrativo.");
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
    throw new Error(`Conexão SMTP recusada: ${verifyError.message}`);
  }
  
  return { transporter, smtpUser };
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Seu código de recuperação chegou!</h2>
        <p>Olá, ${data.userName}. Use o código abaixo para redefinir sua senha:</p>
        <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 10px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a;">
          ${data.otpCode}
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Este código expira em 15 minutos.</p>
        <p style="font-size: 11px; color: #cbd5e1;">Se você não solicitou este código, ignore este e-mail.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
      to: data.to,
      subject: "🔐 Seu código de recuperação Viby",
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
    return { success: false, error: e.message }; 
  }
}

export async function sendPayoutConfirmedEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Pagamento Realizado!</h2>
        <p>Olá, ${data.userName}. O repasse de <b>${data.orgName}</b> foi processado.</p>
        <p><b>Valor:</b> R$ ${data.amount.toFixed(2)}</p>
        <a href="${data.proofUrl}" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver Comprovante</a>
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
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Sua presença está confirmada!</h2>
        <p>Olá, ${data.userName}. Aqui está o seu ingresso para o evento <b>${data.eventTitle}</b>.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
           <p><b>Protocolo:</b> ${data.ticketCode}</p>
           <p><b>Data:</b> ${data.eventDate}</p>
        </div>
        <a href="${data.voucherUrl}" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Abrir Voucher</a>
      </div>
    `;
    await transporter.sendMail({
      from: `"Viby Ingressos" <${smtpUser}>`,
      to: data.to,
      subject: `🎫 Seu ingresso: ${data.eventTitle}`,
      html: htmlContent
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Bem-vindo à ${data.siteName}!</h1>
        <p>Olá, ${data.userName}. Prepare-se para viver as melhores experiências.</p>
        <a href="https://viby.club/dashboard" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Explorar Eventos</a>
      </div>
    `;
    await transporter.sendMail({
      from: `"${data.siteName}" <${smtpUser}>`,
      to: data.to,
      subject: `✨ Bem-vindo à ${data.siteName}`,
      html: htmlContent
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Convite de Equipe</h1>
        <p>Você foi convidado por <b>${data.inviterName}</b> para gerenciar <b>${data.orgName}</b>.</p>
        <p>Acesse seu painel para aceitar: <a href="https://viby.club/dashboard/solicitacoes">Viby Solicitacoes</a></p>
      </div>
    `;
    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite para Equipe: ${data.orgName}`,
      html: htmlContent
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationStatusEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const statusLabel = data.status === 'accepted' ? 'ACEITOU' : 'RECUSOU';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Atualização de Equipe</h2>
        <p>Olá. <b>${data.userName}</b> ${statusLabel} o convite para a marca <b>${data.orgName}</b>.</p>
      </div>
    `;
    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.to,
      subject: `📢 Atualização de Equipe: ${data.orgName}`,
      html: htmlContent
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationNoticeEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Convite Enviado</h2>
        <p>Olá. Você enviou um convite para <b>${data.inviteeName}</b> entrar para <b>${data.orgName}</b>.</p>
      </div>
    `;
    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.to,
      subject: `✉️ Convite Enviado: ${data.orgName}`,
      html: htmlContent
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendCartPendingEmail(data: any) {
  return { success: true };
}

export async function sendTeamInvitationStatusEmailNotice(data: any) {
  return { success: true };
}

export async function resendLoggedEmail(emailData: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    await transporter.sendMail({
      from: `"Viby Support" <${smtpUser}>`,
      to: emailData.recipientEmail,
      subject: `[REENVIO] ${emailData.subject}`,
      html: emailData.content
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}
