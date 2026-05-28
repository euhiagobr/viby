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

async function getTransporter() {
  const { smtpUser, smtpPass } = await getEmailConfig();
  if (!smtpUser || !smtpPass) throw new Error("Configuração SMTP incompleta no Painel Admin.");

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.verify();
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
      type: "password_recovery_otp",
      subject: "Recuperação de Senha",
      sender: "Viby Auth"
    });

    return { success: true };
  } catch (e: any) { 
    console.error("Erro no envio de e-mail de recuperação:", e.message);
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
        <p>Olá, ${data.userName}. O repasse de <b>${data.orgName}</b> foi processado com sucesso.</p>
        <p><b>Valor:</b> R$ ${data.amount.toFixed(2)}</p>
        <p>O comprovante oficial está em anexo ou disponível no link abaixo:</p>
        <a href="${data.proofUrl}" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver Comprovante</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Finance" <${smtpUser}>`,
      to: data.to,
      subject: `✅ Pagamento Efetuado: ${data.orgName}`,
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      type: "payout_confirmation",
      subject: "Confirmação de Repasse",
      sender: "Viby Finance"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
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
           <p><b>Local:</b> ${data.eventCity}</p>
        </div>
        <p>Acesse seu voucher digital e QR Code clicando no botão abaixo:</p>
        <a href="${data.voucherUrl}" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Abrir Meu Voucher</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Ingressos" <${smtpUser}>`,
      to: data.to,
      subject: `🎫 Seu ingresso: ${data.eventTitle}`,
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      type: "ticket_confirmation",
      subject: `Ingresso: ${data.eventTitle}`,
      sender: "Viby System"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Bem-vindo à ${data.siteName}!</h1>
        <p>Olá, ${data.userName}. É um prazer ter você conosco.</p>
        <p>Agora você pode explorar as melhores experiências, seguir suas marcas favoritas e garantir sua presença nos eventos mais exclusivos do Brasil.</p>
        <a href="https://viby.club/dashboard" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Explorar Eventos</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"${data.siteName}" <${smtpUser}>`,
      to: data.to,
      subject: `✨ Bem-vindo à ${data.siteName}`,
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      type: "welcome_email",
      subject: "Bem-vindo à Viby",
      sender: "Viby System"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendTeamInvitationEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Convite de Equipe</h1>
        <p>Você foi convidado por <b>${data.inviterName}</b> para gerenciar a marca <b>${data.orgName}</b> na Viby.</p>
        <p><b>Cargo:</b> ${data.role}</p>
        <p>Acesse seu painel de solicitações para aceitar o convite:</p>
        <a href="https://viby.club/dashboard/solicitacoes" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Ver Solicitação</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite para Equipe: ${data.orgName}`,
      html: htmlContent
    });

    await logEmail({
      recipientEmail: data.to,
      type: "team_invitation",
      subject: "Convite de Equipe",
      sender: "Viby System"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendTeamInvitationNoticeEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.to,
      subject: `📤 Convite enviado para ${data.inviteeName}`,
      html: `<p>Você enviou um convite de equipe para <b>${data.inviteeName}</b> entrar na marca <b>${data.orgName}</b> como ${data.role}.</p>`
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendTeamInvitationStatusEmail(data: any) {
  try {
    const { transporter, smtpUser } = await getTransporter();
    const action = data.status === 'accepted' ? 'aceitou' : 'recusou';
    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.to,
      subject: `🔔 Resposta de Convite: ${data.userName}`,
      html: `<p>O usuário <b>${data.userName}</b> <b>${action}</b> o seu convite para a equipe de <b>${data.orgName}</b>.</p>`
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendCartPendingEmail(data: any) {
  // Implementação futura se necessário
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

    await logEmail({
      recipientEmail: emailData.recipientEmail,
      type: `resend_${emailData.type}`,
      subject: `Reenvio: ${emailData.subject}`,
      sender: "Viby Admin"
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
