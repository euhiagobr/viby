'use server';

import nodemailer from 'nodemailer';
import { doc, getDoc, getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Serviço de e-mail SMTP auditado com branding dinâmico.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Recupera as configurações de branding (Logo e Nome) do banco.
 */
async function getBranding() {
  try {
    const db = await getDb();
    const snap = await getDoc(doc(db, 'settings', 'site'));
    const data = snap.data();
    return {
      logoUrl: data?.logoUrl || "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Flogo_placeholder.png?alt=media",
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
 * Template base para e-mails oficiais.
 */
function getEmailTemplate(branding: any, content: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="text-align: center; margin-bottom: 30px;">
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.siteName}" style="max-height: 50px; width: auto;">` : `<h1 style="color: #2C52EE; font-style: italic; margin: 0;">${branding.siteName}</h1>`}
      </div>
      <div style="background: #fff; padding: 40px; border-radius: 30px; border: 1px solid #f0f0f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        ${content}
      </div>
      <div style="text-align: center; margin-top: 30px; color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
        © 2024 ${branding.siteName} Club • Porto Alegre, RS
      </div>
    </div>
  `;
}

export async function sendOTPRecoveryEmail(data: { to: string; userName: string; otpCode: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; margin-bottom: 10px;">Recuperação de Acesso</h2>
      <p>Olá, <strong>${data.userName}</strong>. Utilize o código de segurança abaixo para redefinir sua senha:</p>
      <div style="background: #f8fafc; padding: 30px; text-align: center; border-radius: 20px; font-size: 32px; font-weight: 900; color: #2C52EE; border: 2px dashed #dbeafe; margin: 30px 0;">
        ${data.otpCode}
      </div>
      <p style="font-size: 12px; color: #999;">Este código expira em 10 minutos. Se você não solicitou esta alteração, ignore este e-mail.</p>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🔐 Seu código de acesso: ${data.otpCode}`;

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
  } catch (e: any) { return { success: false, error: e.message }; }
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
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase; margin-bottom: 10px;">🛡️ Segurança: Senha Alterada</h2>
      <p>Olá, <strong>${data.userName}</strong>. Detectamos que a senha da sua conta foi alterada com sucesso.</p>
      <div style="background: #fff1f2; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #fecaca;">
        <p style="margin: 5px 0; font-size: 13px;"><strong>IP:</strong> ${data.ip}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>Local:</strong> ${data.location}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>Data/Hora:</strong> ${data.timestamp} (Brasília)</p>
      </div>
      <p style="font-size: 13px; color: #666;">Se você não realizou esta alteração, entre em contato imediatamente com o suporte ou tente recuperar seu acesso.</p>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🛡️ Segurança: Sua senha foi alterada`;

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
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendVerificationStatusEmail(data: {
  to: string;
  userName: string;
  targetName: string;
  targetUsername?: string;
  type: 'user' | 'organization';
  status: 'approved' | 'removed';
}) {
  try {
    const branding = await getBranding();
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
        ? `Temos o prazer de informar que seu perfil <strong>${data.targetName}</strong> agora possui o selo oficial de verificação da Viby.`
        : `Sua marca <strong>${data.targetName}</strong> foi aprovada em nossa auditoria e agora é uma Marca Verificada na plataforma.`;
    } else {
      msg = data.type === 'user'
        ? `O selo oficial de verificação do seu perfil <strong>${data.targetName}</strong> foi removido após revisão administrativa.`
        : `O selo oficial da sua marca <strong>${data.targetName}</strong> foi removido por decisão administrativa.`;
    }

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        ${isApproved ? `<img src="https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fverified_badge.png?alt=media" alt="Verificado" style="width: 60px; height: 60px;">` : `⚠️`}
      </div>
      <h2 style="color: ${isApproved ? '#10b981' : '#ef4444'}; text-align: center; text-transform: uppercase; margin-top: 0;">${label}</h2>
      <p>Olá, <strong>${data.userName}</strong>.</p>
      <p style="line-height: 1.6;">${msg}</p>
      <div style="background: ${isApproved ? '#f0fdf4' : '#fff1f2'}; padding: 25px; border-radius: 20px; margin: 30px 0; text-align: center; border: 1px solid ${isApproved ? '#dcfce7' : '#fecaca'};">
        <p style="color: ${isApproved ? '#166534' : '#991b1b'}; font-weight: 900; margin: 0; font-size: 14px; text-transform: uppercase;">STATUS DA CONTA ATUALIZADO</p>
      </div>
      
      ${data.targetUsername ? `
        <div style="text-align: center; margin-top: 40px;">
          <a href="${branding.baseUrl}/${data.targetUsername}" style="background: #2C52EE; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Ver Perfil Público</a>
        </div>
      ` : ''}
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = isApproved 
      ? `🌟 Parabéns! Sua verificação foi aprovada: ${data.targetName}`
      : `⚠️ Importante: Status de verificação alterado: ${data.targetName}`;

    await transporter.sendMail({
      from: `"${branding.siteName} Oficial" <${smtpUser}>`,
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

export async function sendTicketEmail(data: {
  to: string;
  userName: string;
  eventTitle: string;
  ticketCode: string;
  eventDate: string;
  voucherUrl: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase; margin-bottom: 5px;">Sua presença está confirmada!</h2>
      <p>Prepare-se, <strong>${data.userName}</strong>. Seu ingresso para <strong>${data.eventTitle}</strong> já está disponível.</p>
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: left;">
        <p style="margin: 5px 0; font-size: 13px;"><strong>Evento:</strong> ${data.eventTitle}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>Data:</strong> ${data.eventDate}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>Código:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">${data.ticketCode}</span></p>
      </div>
      <div style="text-align: center; margin-top: 35px;">
        <a href="${data.voucherUrl}" style="background: #2C52EE; color: #fff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 15px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Acessar Voucher Digital</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🎟️ Seu ingresso confirmado: ${data.eventTitle}`;

    await transporter.sendMail({
      from: `"${branding.siteName} Ingressos" <${smtpUser}>`,
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
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase;">Bem-vindo ao Clube!</h2>
      <p>Olá, <strong>${data.userName}</strong>. Sua conta na <strong>${branding.siteName}</strong> foi criada com sucesso.</p>
      <p style="line-height: 1.6;">Estamos felizes em ter você conosco. Explore os melhores eventos, siga suas marcas favoritas e viva experiências inesquecíveis.</p>
      <div style="text-align: center; margin-top: 40px;">
        <a href="${branding.baseUrl}/dashboard" style="background: #2C52EE; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 14px; display: inline-block; text-transform: uppercase;">Explorar Experiências</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `👋 Bem-vindo à ${branding.siteName}!`;

    await transporter.sendMail({
      from: `"${branding.siteName} Club" <${smtpUser}>`,
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

export async function resendLoggedEmail(data: {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  content: string;
  type: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    await transporter.sendMail({
      from: `"${branding.siteName} Club" <${smtpUser}>`,
      to: data.recipientEmail,
      subject: data.subject,
      html: data.content
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationEmail(data: { to: string; orgName: string; role: string; inviterName: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase;">Convite de Colaboração</h2>
      <p><strong>${data.inviterName}</strong> convidou você para ser <strong>${data.role}</strong> na marca <strong>${data.orgName}</strong>.</p>
      <p>Acesse seu painel para aceitar o convite e começar a colaborar.</p>
      <div style="text-align: center; margin-top: 40px;">
        <a href="${branding.baseUrl}/dashboard/solicitacoes" style="background: #2C52EE; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 14px; display: inline-block; text-transform: uppercase;">Ver Convite</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🤝 Convite de Equipe: ${data.orgName}`;

    await transporter.sendMail({
      from: `"${branding.siteName} Team" <${smtpUser}>`,
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
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const statusLabel = data.status === 'accepted' ? 'aceitou' : 'recusou';
    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase;">Status de Convite</h2>
      <p>Informamos que <strong>${data.userName}</strong> ${statusLabel} o convite para colaborar na marca <strong>${data.orgName}</strong>.</p>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🤝 Equipe: Convite ${data.status === 'accepted' ? 'Aceito' : 'Recusado'}`;

    await transporter.sendMail({
      from: `"${branding.siteName} Team" <${smtpUser}>`,
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
    const branding = await getBranding();
    const transporter = await getTransporter();
    const snap = await getDoc(doc(await getDb(), 'settings', 'email'));
    const smtpUser = snap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase;">💰 Repasse Processado</h2>
      <p>Olá, <strong>${data.userName}</strong>. O repasse para a marca <strong>${data.orgName}</strong> no valor de <strong>${data.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> foi concluído.</p>
      <p>O comprovante da transferência já está disponível para visualização.</p>
      <div style="text-align: center; margin-top: 40px;">
        <a href="${data.proofUrl}" style="background: #10b981; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 14px; display: inline-block; text-transform: uppercase;">Baixar Comprovante</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `💰 Repasse Confirmado: ${data.orgName}`;

    await transporter.sendMail({
      from: `"${branding.siteName} Finance" <${smtpUser}>`,
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
