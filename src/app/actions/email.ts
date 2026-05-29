'use server';

import nodemailer from 'nodemailer';
import { db } from '@/firebase/database';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * @fileOverview Serviço de e-mail (Server Action) utilizando o Singleton estável do db.
 */

async function getTransporter() {
  const snap = await getDoc(doc(db, 'settings', 'email'));
  const data = snap.data();

  if (!snap.exists() || !data?.smtpUser || !data?.smtpPass) {
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
    await addDoc(collection(db, 'sent_emails'), {
      ...data,
      sender,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("Falha ao registrar log de e-mail");
  }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase; letter-spacing: -1px;">${data.siteName || "Viby"}</h1>
        <h2>Bem-vindo ao Clube!</h2>
        <p>Olá, <strong>${data.userName}</strong>. Sua conta foi criada com sucesso.</p>
        <p>A partir de agora você pode descobrir eventos exclusivos, seguir suas marcas favoritas e garantir ingressos com segurança total.</p>
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

    await logEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject: `👋 Bem-vindo à ${data.siteName || "Viby"}!`,
      content: htmlContent,
      type: 'welcome_email'
    }, `${data.siteName || "Viby"} System`);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

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
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

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
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

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
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

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

export async function sendTeamInvitationEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2>Convite de Equipe</h2>
        <p>Você foi convidado por <strong>${data.inviterName}</strong> para ser <strong>${data.role}</strong> na organização <strong>${data.orgName}</strong>.</p>
        <p>Acesse seu painel para aceitar o convite e começar a colaborar.</p>
        <a href="https://viby.club/dashboard/solicitacoes" style="display: inline-block; padding: 12px 24px; background: #2C52EE; color: white; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px;">Ver Solicitações</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Team" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite para Equipe: ${data.orgName}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationNoticeEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <p>Seu convite para <strong>${data.inviteeName}</strong> ingressar na equipe de <strong>${data.orgName}</strong> como <strong>${data.role}</strong> foi enviado com sucesso.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Team" <${smtpUser}>`,
      to: data.to,
      subject: `📩 Convite Enviado: ${data.inviteeName}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationStatusEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(db, 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const statusText = data.status === 'accepted' ? 'ACEITOU' : 'RECUSOU';

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <p><strong>${data.userName}</strong> <strong>${statusText}</strong> seu convite para a organização <strong>${data.orgName}</strong>.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Viby Team" <${smtpUser}>`,
      to: data.to,
      subject: `🔔 Atualização de Convite: ${data.orgName}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}
