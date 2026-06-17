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
    auth: { user: data.smtpUser, pass: data.smtpPass.replace(/\s/g, '') },
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
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${branding.siteName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f8fafc; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
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
</body>
</html>
  `.trim();
}

export async function sendManualMarketingEmail(data: { to: string; subject: string; content: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const formattedBody = data.content.replace(/\n/g, '<br>');
    const htmlContent = getEmailTemplate(branding, `<div style="font-size: 16px; line-height: 1.6; color: #334155;">${formattedBody}</div>`);

    await transporter.sendMail({
      from: `"${branding.siteName}" <${smtpUser}>`,
      to: data.to,
      subject: data.subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: "Destinatário Manual",
      subject: data.subject,
      content: htmlContent,
      type: "manual_marketing",
      sender: `Viby Marketing (${branding.siteName})`
    });

    return { success: true };
  } catch (e: any) {
    console.error("[sendManualMarketingEmail]", e);
    return { success: false, error: e.message };
  }
}

export async function sendCampaignEmailAction(data: { to: string; subject: string; html: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    await transporter.sendMail({
      from: `"${branding.siteName}" <${smtpUser}>`,
      to: data.to,
      subject: data.subject,
      html: data.html
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: "Destinatário Campanha",
      subject: data.subject,
      content: data.html,
      type: "campaign_dispatch",
      sender: `Viby CRM (${branding.siteName})`
    });

    return { success: true };
  } catch (e: any) {
    console.error("[sendCampaignEmailAction]", e);
    return { success: false, error: e.message };
  }
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

export async function sendWelcomeEmail(data: { to: string; userName: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; margin-bottom: 10px; font-weight: 900;">Bem-vindo(a) à ${branding.siteName}!</h2>
      <p>Olá, <strong>${data.userName}</strong>. Sua conta foi criada com sucesso.</p>
      <p>A partir de agora, você faz parte do clube exclusivo de experiências memoráveis. Explore eventos, siga suas marcas favoritas e descubra o que o agora tem a oferecer.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${branding.baseUrl}/dashboard" style="background-color: #2C52EE; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-style: italic;">Explorar Eventos</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    await transporter.sendMail({
      from: `"${branding.siteName}" <${smtpUser}>`,
      to: data.to,
      subject: `✨ Bem-vindo(a) ao clube, ${data.userName}!`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendAdminNewUserAlert(data: { userName: string; username: string; email: string; uid: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE;">Novo Cadastro Realizado</h2>
      <p><strong>Nome:</strong> ${data.userName}</p>
      <p><strong>Username:</strong> @${data.username}</p>
      <p><strong>E-mail:</strong> ${data.email}</p>
      <p><strong>UID:</strong> ${data.uid}</p>
    `;

    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: smtpUser, 
      subject: `👤 Novo Usuário: ${data.userName}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendVerificationStatusEmail(data: { to: string; userName: string; targetName: string; targetUsername: string; type: 'user' | 'organization'; status: 'approved' | 'removed' }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const isApproved = data.status === 'approved';
    const content = `
      <h2 style="color: ${isApproved ? '#10b981' : '#ef4444'}; text-transform: uppercase; font-weight: 900; font-style: italic;">
        ${isApproved ? 'Selo de Verificação Ativado!' : 'Atualização de Verificação'}
      </h2>
      <p>Olá, <strong>${data.userName}</strong>.</p>
      <p>Seu pedido de verificação para <strong>${data.targetName} (@${data.targetUsername})</strong> foi processado.</p>
      <p>Status atual: <strong>${isApproved ? 'Verificado' : 'Não verificado'}</strong></p>
      ${isApproved ? '<p>Seu perfil agora exibe o selo de autenticidade oficial da rede.</p>' : ''}
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Compliance" <${smtpUser}>`,
      to: data.to,
      subject: `${isApproved ? '✅' : 'ℹ️'} Verificação de Perfil: ${data.targetName}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTicketEmail(data: { to: string; userName: string; eventTitle: string; ticketCode: string; eventDate: string; eventCity?: string; voucherUrl: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; font-weight: 900;">Seu Ingresso está aqui!</h2>
      <p>Olá, <strong>${data.userName}</strong>. Prepare-se para a sua próxima experiência.</p>
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; border: 2px dashed #e2e8f0; margin: 25px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 900; color: #1e293b;">${data.eventTitle.toUpperCase()}</p>
        <p style="margin: 5px 0; font-size: 13px; color: #64748b;">📅 ${data.eventDate}</p>
        ${data.eventCity ? `<p style="margin: 5px 0; font-size: 13px; color: #64748b;">📍 ${data.eventCity}</p>` : ''}
        <p style="margin: 15px 0 0 0; font-size: 24px; font-weight: 900; color: #2C52EE; font-family: monospace;">${data.ticketCode}</p>
      </div>
      <div style="text-align: center;">
        <a href="${data.voucherUrl}" style="background-color: #000; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-style: italic; display: inline-block;">Ver QR Code de Acesso</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Ingressos" <${smtpUser}>`,
      to: data.to,
      subject: `🎟️ Seu ingresso para: ${data.eventTitle}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendSupportTicketReceivedEmail(data: { to: string; userName: string; ticketNumber: string; ticketSubject: string; ticketMessage: string; ticketUrl: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; font-weight: 900;">Chamado Recebido</h2>
      <p>Olá, <strong>${data.userName}</strong>. Recebemos sua solicitação sob o protocolo <strong>#${data.ticketNumber}</strong>.</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 15px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Assunto:</p>
        <p style="margin: 5px 0 0 0; font-weight: 700;">${data.ticketSubject}</p>
      </div>
      <p>Nossa equipe analisará os detalhes e retornará o mais breve possível.</p>
      <div style="text-align: center; margin-top: 25px;">
        <a href="${data.ticketUrl}" style="color: #2C52EE; font-weight: 900; text-decoration: none; text-transform: uppercase; font-size: 12px;">Acompanhar Atendimento →</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    await transporter.sendMail({
      from: `"${branding.siteName} Suporte" <${smtpUser}>`,
      to: data.to,
      subject: `🎧 Chamado aberto: #${data.ticketNumber}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendSupportTicketResponseEmail(data: { to: string; userName: string; ticketNumber: string; lastReply: string; ticketUrl: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; font-weight: 900;">Nova Resposta no Ticket #${data.ticketNumber}</h2>
      <p>Olá, <strong>${data.userName}</strong>. Nossa equipe de suporte enviou uma nova mensagem para você:</p>
      <div style="background: #f1f5f9; padding: 25px; border-radius: 20px; border-left: 5px solid #2C52EE; margin: 25px 0; font-style: italic;">
        "${data.lastReply}"
      </div>
      <div style="text-align: center;">
        <a href="${data.ticketUrl}" style="background-color: #2C52EE; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-style: italic; display: inline-block;">Responder Agora</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Suporte" <${smtpUser}>`,
      to: data.to,
      subject: `💬 Resposta disponível: Ticket #${data.ticketNumber}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendSupportTicketClosedEmail(data: { to: string; userName: string; ticketNumber: string; historyHtml: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #10b981; font-style: italic; text-transform: uppercase; font-weight: 900;">Atendimento Finalizado</h2>
      <p>Olá, <strong>${data.userName}</strong>. O ticket <strong>#${data.ticketNumber}</strong> foi encerrado com sucesso.</p>
      <p>Abaixo você encontra o histórico completo desta conversa para seus registros:</p>
      <div style="margin: 30px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #f8fafc;">
        ${data.historyHtml}
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Agradecemos por utilizar o suporte oficial da ${branding.siteName}.</p>
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Suporte" <${smtpUser}>`,
      to: data.to,
      subject: `✅ Atendimento Concluído: Ticket #${data.ticketNumber}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationEmail(data: { to: string; orgName: string; role: string; inviterName: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; font-style: italic; text-transform: uppercase; font-weight: 900;">Convite de Equipe</h2>
      <p>Olá! Você foi convidado por <strong>${data.inviterName}</strong> para gerenciar a organização <strong>${data.orgName}</strong>.</p>
      <p>Cargo atribuído: <strong>${data.role}</strong></p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${branding.baseUrl}/dashboard/solicitacoes" style="background-color: #2C52EE; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-style: italic; display: inline-block;">Ver Convite</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Team" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite para colaborar com ${data.orgName}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendTeamInvitationStatusEmail(data: { to: string; userName: string; orgName: string; status: 'accepted' | 'declined' }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const isAccepted = data.status === 'accepted';
    const content = `
      <h2 style="color: ${isAccepted ? '#10b981' : '#ef4444'}; text-transform: uppercase; font-weight: 900;">Resposta de Convite</h2>
      <p>O usuário <strong>${data.userName}</strong> <strong>${isAccepted ? 'aceitou' : 'recusou'}</strong> o convite para a equipe da organização <strong>${data.orgName}</strong>.</p>
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Team" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite ${isAccepted ? 'Aceito' : 'Recusado'}: ${data.orgName}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendPayoutConfirmedEmail(data: { to: string; userName: string; orgName: string; amount: number; proofUrl: string }) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const emailSettingsSnap = await getAdminDb().collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #10b981; font-style: italic; text-transform: uppercase; font-weight: 900;">Saque Efivado</h2>
      <p>Olá, <strong>${data.userName}</strong>. O repasse solicitado para a organização <strong>${data.orgName}</strong> foi processado.</p>
      <div style="background: #f0fdf4; padding: 20px; border-radius: 15px; border: 1px solid #bbf7d0; text-align: center; margin: 20px 0;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase;">Valor do Repasse:</p>
        <p style="margin: 5px 0; font-size: 24px; font-weight: 900; color: #16a34a;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.amount)}</p>
      </div>
      <div style="text-align: center;">
        <a href="${data.proofUrl}" style="background-color: #000; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: 800; font-size: 12px; text-transform: uppercase; display: inline-block;">Ver Comprovante</a>
      </div>
    `;

    await transporter.sendMail({
      from: `"${branding.siteName} Financeiro" <${smtpUser}>`,
      to: data.to,
      subject: `💰 Saque Confirmado: ${data.orgName}`,
      html: getEmailTemplate(branding, content)
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function resendLoggedEmail(data: { recipientEmail: string; recipientName: string; subject: string; content: string; type: string }) {
  try {
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    await transporter.sendMail({
      from: `"Viby System" <${smtpUser}>`,
      to: data.recipientEmail,
      subject: `[Reenvio] ${data.subject}`,
      html: data.content
    });

    await logSentEmail({
      ...data,
      sender: "Viby Manual Resend"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Solicitação de geração de arte via servidor.
 * Envia um e-mail formatado para a administração com os dados da agenda selecionada.
 */
export async function sendAgendaRequestAction(data: {
  events: any[];
  theme: string;
  format: string;
  userEmail: string;
  userName: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const eventsHtml = data.events.map(ev => `
      <div style="padding: 15px; border-bottom: 1px dashed #e2e8f0; display: flex; align-items: center; gap: 15px;">
        <img src="${ev.image}" style="width: 60px; height: 60px; border-radius: 10px; object-fit: cover;" />
        <div>
          <p style="margin: 0; font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase;">${ev.title}</p>
          <p style="margin: 2px 0; font-size: 11px; color: #2C52EE; font-weight: 700;">${ev.city} • ${ev.date}</p>
        </div>
      </div>
    `).join('');

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: #2C52EE; color: white; padding: 10px 20px; border-radius: 50px; display: inline-block; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">Solicitação de Arte</div>
        <h2 style="margin: 15px 0 5px 0; font-style: italic; font-weight: 900; text-transform: uppercase;">Agenda da Semana</h2>
        <p style="margin: 0; font-size: 12px; color: #64748b;">Solicitado por: <strong>${data.userName}</strong> (${data.userEmail})</p>
      </div>

      <div style="background: #f8fafc; border-radius: 20px; padding: 10px; border: 1px solid #e2e8f0;">
        <div style="padding: 15px; border-bottom: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; font-black: 900; text-transform: uppercase; color: #94a3b8;">Configurações</span>
          <span style="font-size: 10px; font-black: 900; text-transform: uppercase; color: #2C52EE;">Tema: ${data.theme} | Formato: ${data.format}</span>
        </div>
        ${eventsHtml}
      </div>

      <div style="margin-top: 30px; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; line-height: 1.5;">Esta solicitação foi enviada automaticamente via painel administrativo mobile para contornar limitações de renderização local.</p>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🎨 Solicitação de Arte: Agenda (${data.theme}) - ${data.userName}`;

    await transporter.sendMail({
      from: `"Viby Studio" <${smtpUser}>`,
      to: "viby@viby.club",
      cc: "hiago@viby.club",
      replyTo: data.userEmail,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: "viby@viby.club, hiago@viby.club",
      recipientName: "Viby Suporte & Hiago",
      subject,
      content: htmlContent,
      type: "agenda_request",
      sender: "Viby Studio Server"
    });

    return { success: true };
  } catch (e: any) {
    console.error("[sendAgendaRequestAction]", e);
    return { success: false, error: e.message };
  }
}
