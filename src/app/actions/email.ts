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
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const isApproved = data.status === 'approved';
    const label = data.type === 'user' 
      ? (isApproved ? 'Perfil Verificado' : 'Verificação Removida') 
      : (isApproved ? 'Marca Verificada' : 'Selo de Marca Removido');
    
    let msg = "";
    if (isApproved) {
      msg = data.type === 'user' 
        ? `Temos o prazer de informar que seu perfil <strong>${data.targetName}</strong> agora possui o selo oficial de verificação da ${branding.siteName}.`
        : `Sua marca <strong>${data.targetName}</strong> foi aprovada em nossa auditoria e agora é uma Marca Verificada na plataforma.`;
    } else {
      msg = data.type === 'user'
        ? `O selo oficial de verificação do seu perfil <strong>${data.targetName}</strong> foi removido após revisão administrativa.`
        : `O selo oficial da sua marca <strong>${data.targetName}</strong> foi removido por decisão administrativa.`;
    }

    const content = `
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="display: inline-block; width: 80px; height: 80px; line-height: 80px; border-radius: 50%; background-color: ${isApproved ? '#dcfce7' : '#fee2e2'}; font-size: 40px; text-align: center;">
          ${isApproved ? '🌟' : '⚠️'}
        </div>
      </div>
      <h2 style="color: ${isApproved ? '#10b981' : '#ef4444'}; text-align: center; text-transform: uppercase; margin-top: 0; font-weight: 900; letter-spacing: -1px;">${label}</h2>
      <p style="text-align: center; color: #64748b;">Olá, <strong>${data.userName}</strong>.</p>
      <p style="line-height: 1.6; text-align: center; font-size: 16px;">${msg}</p>
      
      <div style="background: ${isApproved ? '#f0fdf4' : '#fff1f2'}; padding: 20px; border-radius: 20px; margin: 30px 0; text-align: center; border: 1px solid ${isApproved ? '#dcfce7' : '#fecaca'};">
        <p style="color: ${isApproved ? '#166534' : '#991b1b'}; font-weight: 900; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">STATUS ATUALIZADO EM D+0</p>
      </div>
      
      ${data.targetUsername ? `
        <div style="text-align: center; margin-top: 40px;">
          <a href="${branding.baseUrl}/${data.targetUsername}" style="background: #2C52EE; color: #ffffff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Ver Perfil Público</a>
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
  eventCity?: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 48px;">🎟️</span>
      </div>
      <h2 style="color: #2C52EE; text-transform: uppercase; margin-bottom: 5px; font-weight: 900;">Presença Confirmada!</h2>
      <p>Prepare-se, <strong>${data.userName}</strong>. Seu ingresso para <strong>${data.eventTitle}</strong> já está disponível.</p>
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: left;">
        <p style="margin: 8px 0; font-size: 14px; color: #1e293b;"><strong>EVENTO:</strong> ${data.eventTitle}</p>
        <p style="margin: 8px 0; font-size: 14px; color: #1e293b;"><strong>DATA:</strong> ${data.eventDate}</p>
        <p style="margin: 8px 0; font-size: 14px; color: #1e293b;"><strong>CÓDIGO:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-weight: 900;">${data.ticketCode}</span></p>
      </div>
      <div style="text-align: center; margin-top: 35px;">
        <a href="${data.voucherUrl}" style="background: #2C52EE; color: #ffffff; padding: 20px 40px; text-decoration: none; border-radius: 20px; font-weight: 900; font-size: 15px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Acessar Voucher Digital</a>
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
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 48px;">👋</span>
      </div>
      <h2 style="color: #2C52EE; text-transform: uppercase; font-weight: 900;">Bem-vindo ao Clube!</h2>
      <p>Olá, <strong>${data.userName}</strong>. Sua conta na <strong>${branding.siteName}</strong> foi criada com sucesso.</p>
      <p style="line-height: 1.6; color: #64748b;">Estamos felizes em ter você conosco. Explore os melhores eventos, siga suas marcas favoritas e viva experiências inesquecíveis através da nossa plataforma.</p>
      <div style="text-align: center; margin-top: 40px;">
        <a href="${branding.baseUrl}/dashboard" style="background: #2C52EE; color: #ffffff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Explorar Experiências</a>
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

/**
 * Envia um alerta para a administração informando sobre um novo registro de usuário.
 */
export async function sendAdminNewUserAlert(data: {
  userName: string;
  username: string;
  email: string;
  uid: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase; font-weight: 900;">🔔 Novo Usuário Registrado</h2>
      <p>Um novo membro acabou de se juntar à plataforma <strong>${branding.siteName}</strong>.</p>
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: left;">
        <p style="margin: 8px 0; font-size: 13px; color: #1e293b;"><strong>NOME:</strong> ${data.userName}</p>
        <p style="margin: 8px 0; font-size: 13px; color: #1e293b;"><strong>USERNAME:</strong> @${data.username}</p>
        <p style="margin: 8px 0; font-size: 13px; color: #1e293b;"><strong>E-MAIL:</strong> ${data.email}</p>
        <p style="margin: 8px 0; font-size: 13px; color: #1e293b;"><strong>UID:</strong> <span style="font-family: monospace; font-size: 11px;">${data.uid}</span></p>
        <p style="margin: 8px 0; font-size: 13px; color: #1e293b;"><strong>DATA:</strong> ${timestamp}</p>
      </div>
      <div style="text-align: center; margin-top: 35px;">
        <a href="${branding.baseUrl}/admin/usuarios" style="background: #2C52EE; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 15px; font-weight: 900; font-size: 12px; display: inline-block; text-transform: uppercase;">Ver no Painel Admin</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `🔔 Novo Usuário: @${data.username} (${data.userName})`;

    await transporter.sendMail({
      from: `"${branding.siteName} System" <${smtpUser}>`,
      to: "viby@viby.club",
      subject,
      html: htmlContent
    });

    return { success: true };
  } catch (e: any) {
    console.warn("[Admin Alert Email] Failed to send notification", e);
    return { success: false, error: e.message };
  }
}

export async function sendSupportTicketReceivedEmail(data: {
  to: string;
  userName: string;
  ticketNumber: string;
  ticketSubject: string;
  ticketMessage: string;
  ticketUrl: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase; font-weight: 900;">Solicitação Recebida</h2>
      <p>Olá, <strong>${data.userName}</strong>.</p>
      <p>Recebemos sua solicitação e ela já foi encaminhada para nossa equipe.</p>
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: left;">
        <p style="margin: 5px 0; font-size: 12px; color: #64748b;"><strong>NÚMERO DO TICKET:</strong> #${data.ticketNumber}</p>
        <p style="margin: 5px 0; font-size: 12px; color: #64748b;"><strong>ASSUNTO:</strong> ${data.ticketSubject}</p>
        <p style="margin: 15px 0 5px 0; font-size: 12px; color: #64748b;"><strong>MENSAGEM ENVIADA:</strong></p>
        <p style="margin: 0; font-style: italic; font-size: 13px; color: #1e293b; line-height: 1.5;">"${data.ticketMessage}"</p>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Nossa equipe analisará sua solicitação e responderá em até 48 horas.</p>
      <div style="text-align: center; margin-top: 35px;">
        <a href="${data.ticketUrl}" style="background: #2C52EE; color: #ffffff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Acompanhar Atendimento</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `Recebemos sua solicitação (#${data.ticketNumber})`;

    await transporter.sendMail({
      from: `"${branding.siteName} Suporte" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "support_ticket_received",
      sender: "Viby Suporte"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendSupportTicketResponseEmail(data: {
  to: string;
  userName: string;
  ticketNumber: string;
  lastReply: string;
  ticketUrl: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase; font-weight: 900;">Nova Resposta da Equipe</h2>
      <p>Olá, <strong>${data.userName}</strong>.</p>
      <p>Nossa equipe respondeu sua solicitação.</p>
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: left;">
        <p style="margin: 5px 0; font-size: 12px; color: #64748b;"><strong>TICKET:</strong> #${data.ticketNumber}</p>
        <p style="margin: 15px 0 5px 0; font-size: 12px; color: #64748b;"><strong>ÚLTIMA RESPOSTA:</strong></p>
        <p style="margin: 0; font-size: 13px; color: #1e293b; line-height: 1.5;">"${data.lastReply}"</p>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Caso necessário, você poderá responder diretamente pelo painel da Viby.</p>
      <div style="text-align: center; margin-top: 35px;">
        <a href="${data.ticketUrl}" style="background: #2C52EE; color: #ffffff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Visualizar Conversa</a>
      </div>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `Sua solicitação recebeu uma resposta (#${data.ticketNumber})`;

    await transporter.sendMail({
      from: `"${branding.siteName} Suporte" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "support_ticket_received",
      sender: "Viby Suporte"
    });

    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendSupportTicketClosedEmail(data: {
  to: string;
  userName: string;
  ticketNumber: string;
  historyHtml: string;
}) {
  try {
    const branding = await getBranding();
    const transporter = await getTransporter();
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 48px;">✅</span>
      </div>
      <h2 style="color: #10b981; text-transform: uppercase; font-weight: 900;">Solicitação Encerrada</h2>
      <p>Olá, <strong>${data.userName}</strong>. Sua solicitação <strong>#${data.ticketNumber}</strong> foi encerrada por nossa equipe.</p>
      <p style="color: #64748b; font-size: 13px;">Abaixo segue o histórico completo da conversa para sua referência:</p>
      
      <div style="background: #f8fafc; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: left; max-height: 400px; overflow-y: auto;">
        ${data.historyHtml}
      </div>
      
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">Caso precise de mais ajuda, você pode abrir um novo chamado em nosso portal.</p>
    `;

    const htmlContent = getEmailTemplate(branding, content);
    const subject = `Sua solicitação foi encerrada (#${data.ticketNumber})`;

    await transporter.sendMail({
      from: `"${branding.siteName} Suporte" <${smtpUser}>`,
      to: data.to,
      subject,
      html: htmlContent
    });

    await logSentEmail({
      recipientEmail: data.to,
      recipientName: data.userName,
      subject,
      content: htmlContent,
      type: "support_ticket_closed",
      sender: "Viby Suporte"
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
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

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
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 48px;">🤝</span>
      </div>
      <h2 style="color: #2C52EE; text-transform: uppercase; font-weight: 900;">Convite de Colaboração</h2>
      <p><strong>${data.inviterName}</strong> convidou você para ser <strong>${data.role}</strong> na marca <strong>${data.orgName}</strong>.</p>
      <p style="color: #64748b;">Acesse seu painel administrativo para aceitar o convite e começar a colaborar na gestão de eventos desta marca.</p>
      <div style="text-align: center; margin-top: 40px;">
        <a href="${branding.baseUrl}/dashboard/solicitacoes" style="background: #2C52EE; color: #ffffff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(44, 82, 238, 0.2);">Ver Convite Agora</a>
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
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const statusLabel = data.status === 'accepted' ? 'aceitou' : 'recusou';
    const content = `
      <h2 style="color: #2C52EE; text-transform: uppercase; font-weight: 900;">Status de Equipe</h2>
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
    const db = getAdminDb();
    const emailSettingsSnap = await db.collection('settings').doc('email').get();
    const smtpUser = emailSettingsSnap.data()?.smtpUser;

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 48px;">💰</span>
      </div>
      <h2 style="color: #10b981; text-transform: uppercase; font-weight: 900;">Repasse Processado</h2>
      <p>Olá, <strong>${data.userName}</strong>. O repasse para a marca <strong>${data.orgName}</strong> no valor de <strong>${data.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> foi concluído.</p>
      <p style="color: #64748b;">O comprovante da transferência bancária já está disponível para visualização e prestação de contas.</p>
      <div style="text-align: center; margin-top: 40px;">
        <a href="${data.proofUrl}" style="background: #10b981; color: #ffffff; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2);">Baixar Comprovante</a>
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
