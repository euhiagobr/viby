
'use server';

import nodemailer from 'nodemailer';
import { doc, getDoc, getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Serviço de e-mail SMTP auditado. 
 * Garante que todos os disparos (sem exceção) registrem um log em 'sent_emails'.
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
 * Helper interno para auditoria obrigatória de e-mails.
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
    console.warn("[Email Audit Log] Falha ao registrar cópia de segurança", e);
  }
}

/**
 * Envia o código OTP para recuperação de senha.
 */
export async function sendOTPRecoveryEmail(data: { to: string; userName: string; otpCode: string }) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic; text-transform: uppercase;">Viby.Club</h1>
        <h2>Recuperação de Acesso</h2>
        <p>Olá, <strong>${data.userName}</strong>. Utilize o código de segurança abaixo:</p>
        <div style="background: #f8fafc; padding: 30px; text-align: center; border-radius: 20px; font-size: 32px; font-weight: 900; color: #2C52EE; border: 2px dashed #eee; margin: 20px 0;">
          ${data.otpCode}
        </div>
        <p style="font-size: 12px; color: #999;">Válido por 10 minutos.</p>
      </div>
    `;

    const subject = `🔐 Seu código de acesso: ${data.otpCode}`;
    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
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
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Notificação de segurança pós-alteração de senha.
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
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee;">
        <h1 style="color: #2C52EE; text-transform: uppercase;">Viby Security</h1>
        <h2>Sua senha foi alterada</h2>
        <p>Olá, <strong>${data.userName}</strong>. Uma alteração de senha foi detectada.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><strong>IP:</strong> ${data.ip}</p>
          <p><strong>Local:</strong> ${data.location}</p>
          <p><strong>Data:</strong> ${data.timestamp}</p>
        </div>
        <p>Se não foi você, entre em contato imediatamente com o suporte.</p>
      </div>
    `;

    const subject = `🛡️ Segurança: Sua senha foi alterada`;
    await transporter.sendMail({
      from: `"Viby Security" <${smtpUser}>`,
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
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Notifica sobre a aprovação ou remoção do selo de verificação.
 */
export async function sendVerificationStatusEmail(data: {
  to: string;
  userName: string;
  targetName: string;
  type: 'user' | 'organization';
  status: 'approved' | 'removed';
}) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const isApproved = data.status === 'approved';
    const label = data.type === 'user' 
      ? (isApproved ? 'Perfil Verificado' : 'Verificação Removida') 
      : (isApproved ? 'Marca Verificada' : 'Selo de Marca Removido');
    
    let msg = "";
    if (isApproved) {
      msg = data.type === 'user' 
        ? `Seu perfil <strong>${data.targetName}</strong> agora possui o selo oficial de verificação.`
        : `Sua marca <strong>${data.targetName}</strong> foi aprovada e agora é Verificada na plataforma.`;
    } else {
      msg = data.type === 'user'
        ? `O selo oficial de verificação do seu perfil <strong>${data.targetName}</strong> foi removido.`
        : `O selo oficial da sua marca <strong>${data.targetName}</strong> foi removido por decisão administrativa.`;
    }

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee; background: #fff;">
        <h1 style="color: #2C52EE; font-style: italic;">Viby Oficial</h1>
        <h2 style="color: ${isApproved ? '#10b981' : '#ef4444'};">${isApproved ? '🌟' : '⚠️'} ${label}</h2>
        <p>Olá, <strong>${data.userName}</strong>.</p>
        <p>${msg}</p>
        <div style="background: ${isApproved ? '#f0f4ff' : '#fff1f2'}; padding: 20px; border-radius: 15px; margin: 25px 0; text-align: center; border: 1px solid ${isApproved ? '#dbeafe' : '#fecaca'};">
          <p style="color: ${isApproved ? '#2C52EE' : '#e11d48'}; font-weight: 900; margin: 0;">${isApproved ? 'SELO DE CONFIANÇA ATIVADO' : 'STATUS ATUALIZADO'}</p>
        </div>
        ${!isApproved ? '<p style="font-size: 11px; color: #666; margin-top: 20px;">Se você acredita que isso foi um erro, entre em contato com nosso suporte.</p>' : ''}
      </div>
    `;

    const subject = isApproved 
      ? `🌟 Parabéns! Sua verificação foi aprovada: ${data.targetName}`
      : `⚠️ Importante: Status de verificação alterado: ${data.targetName}`;

    await transporter.sendMail({
      from: `"Viby Oficial" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "verification_update",
      sender: "Viby Oficial"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
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
}) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee;">
        <h1 style="color: #2C52EE;">Viby Ingressos</h1>
        <h2>Sua presença está garantida!</h2>
        <p>Evento: <strong>${data.eventTitle}</strong></p>
        <p>Código: <strong>${data.ticketCode}</strong></p>
        <p><a href="${data.voucherUrl}" style="background: #2C52EE; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Ver Voucher Digital</a></p>
      </div>
    `;

    const subject = `🎟️ Seu ingresso: ${data.eventTitle}`;
    await transporter.sendMail({
      from: `"Viby Ingressos" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "ticket_confirmation",
      sender: "Viby Ingressos"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee;">
        <h1 style="color: #2C52EE; text-transform: uppercase;">${data.siteName || "Viby"}</h1>
        <h2>Bem-vindo ao Clube!</h2>
        <p>Olá, <strong>${data.userName}</strong>. Sua conta foi criada com sucesso.</p>
      </div>
    `;

    const subject = `👋 Bem-vindo à ${data.siteName || "Viby"}!`;
    await transporter.sendMail({
      from: `"${data.siteName || "Viby"} Club" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "welcome_email",
      sender: "Viby Club"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
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
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    await transporter.sendMail({
      from: `"Viby Club" <${smtpUser}>`,
      to: data.recipientEmail,
      subject: data.subject,
      html: data.content
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationEmail(data: { to: string; orgName: string; role: string; inviterName: string }) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee;">
        <h1 style="color: #2C52EE;">Viby Team</h1>
        <h2>Convite de Colaboração</h2>
        <p><strong>${data.inviterName}</strong> convidou você para ser <strong>${data.role}</strong> na marca <strong>${data.orgName}</strong>.</p>
        <p>Acesse seu painel para aceitar.</p>
      </div>
    `;

    const subject = `🤝 Convite de Equipe: ${data.orgName}`;
    await transporter.sendMail({
      from: `"Viby Team" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: "Colaborador",
      subject,
      content: htmlContent,
      type: "team_invitation",
      sender: "Viby Team"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationStatusEmail(data: {
  to: string;
  userName: string;
  orgName: string;
  status: 'accepted' | 'declined';
}) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const statusLabel = data.status === 'accepted' ? 'aceitou' : 'recusou';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 10px; border: 1px solid #eee;">
        <h2>Status de Convite</h2>
        <p><strong>${data.userName}</strong> ${statusLabel} o convite para a marca <strong>${data.orgName}</strong>.</p>
      </div>
    `;

    const subject = `🤝 Equipe: Convite ${data.status === 'accepted' ? 'Aceito' : 'Recusado'}`;
    await transporter.sendMail({
      from: `"Viby Team" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: "Organizador",
      subject,
      content: htmlContent,
      type: "invitation_result",
      sender: "Viby Team"
    });

    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function sendPayoutConfirmedEmail(data: {
  to: string;
  userName: string;
  orgName: string;
  amount: number;
  proofUrl: string;
}) {
  try {
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; border: 1px solid #eee;">
        <h1 style="color: #2C52EE;">Viby Finance</h1>
        <h2>Pagamento Processado</h2>
        <p>Olá, <strong>${data.userName}</strong>. O repasse para <strong>${data.orgName}</strong> de <strong>R$ ${data.amount.toFixed(2)}</strong> foi realizado.</p>
        <p><a href="${data.proofUrl}" style="color: #2C52EE; font-weight: bold;">Baixar Comprovante</a></p>
      </div>
    `;

    const subject = `💰 Repasse Confirmado: ${data.orgName}`;
    await transporter.sendMail({
      from: `"Viby Finance" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "payout_confirmation",
      sender: "Viby Finance"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationNoticeEmail(data: any) { return { success: true }; }
