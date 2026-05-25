'use server';

import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

async function logEmail(data: {
  sender: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  content: string;
  type: string;
}) {
  try {
    const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
    const db = getFirestore(app, 'eventosviby');
    await addDoc(collection(db, 'sent_emails'), {
      ...data,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error('Erro ao logar e-mail no Firestore:', e);
  }
}

async function getEmailConfig() {
  try {
    const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
    const db = getFirestore(app, 'eventosviby');
    
    const emailDoc = await getDoc(doc(db, 'settings', 'email'));
    if (!emailDoc.exists()) {
      return { smtpUser: null, smtpPass: null };
    }
    const data = emailDoc.data();
    return {
      smtpUser: (data.smtpUser as string) || null,
      smtpPass: (data.smtpPass as string) || null,
    };
  } catch (e) {
    console.error('Erro ao buscar config de e-mail no Firestore:', e);
    return { smtpUser: null, smtpPass: null };
  }
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();

    const htmlContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; padding: 40px;">
        <h1 style="color: #2563eb; font-style: italic; text-transform: uppercase;">Viby.Club</h1>
        <h2 style="font-size: 24px; color: #0f172a;">Redefinição de Senha</h2>
        <p style="color: #475569; line-height: 1.6;">Olá, ${data.userName}. Recebemos uma solicitação para redefinir sua senha.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${data.resetLink}" style="display: inline-block; background: #2563eb; color: white !important; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 16px;">Redefinir Senha Agora</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8;">Se você não solicitou a troca de senha, ignore este e-mail.</p>
      </div>
    `;

    await logEmail({
      sender: "Viby Auth",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: "Redefinição de Senha",
      content: htmlContent,
      type: "password_reset_link"
    });

    if (!smtpUser || !smtpPass) return { success: false, error: "SMTP não configurado no Admin." };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Viby Auth" <${smtpUser}>`,
      to: data.to,
      subject: "🔐 Recuperação de Conta: Redefinir Senha",
      html: htmlContent
    });

    return { success: true };
  } catch (e) { 
    console.error("Erro no envio do e-mail de link:", e);
    return { success: false }; 
  }
}

export async function sendTicketEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const qrCodeBuffer = await QRCode.toBuffer(data.ticketCode, { margin: 1, width: 400 });

    const htmlContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; padding: 40px;">
        <h1 style="color: #2563eb; font-style: italic; text-transform: uppercase;">Viby Club</h1>
        <p>Seu ingresso para <strong>${data.eventTitle}</strong> chegou!</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Detalhes da Reserva</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Data: ${data.eventDate}</p>
          <p style="margin: 2px 0 0 0; font-size: 14px;">Local: ${data.eventCity}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #2563eb; font-weight: bold;">
            Setor: ${data.sectorName || 'Geral'} 
            ${data.seatCode ? `| Lugar: ${data.seatCode}` : ''}
          </p>
          <p style="margin: 2px 0 0 0; font-size: 13px;">Lote: ${data.batchName || 'Único'}</p>
          <p style="margin: 2px 0 0 0; font-size: 13px;">Tipo: ${data.ticketTypeName || 'Acesso'}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <img src="cid:ticket-qrcode" alt="Ticket QR Code" style="width: 200px; height: 200px;" />
          <div style="font-family: monospace; font-size: 20px; font-weight: bold; color: #2563eb; margin-top: 10px;">${data.ticketCode}</div>
        </div>
        <div style="text-align: center;">
          <a href="${data.voucherUrl}" style="display: inline-block; background: #2563eb; color: white !important; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 16px;">Ver Voucher Completo</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">Apresente este QR Code na entrada do evento para validação.</p>
      </div>
    `;

    await logEmail({
      sender: "Viby System",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: `Confirmado! Seu ingresso para ${data.eventTitle} chegou! 🎟️`,
      content: htmlContent,
      type: "ticket_confirmation"
    });

    if (!smtpUser || !smtpPass) return { success: false, error: "SMTP não configurado no Admin." };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Viby Club" <${smtpUser}>`,
      to: data.to,
      subject: `Confirmado! Seu ingresso para ${data.eventTitle} chegou! 🎟️`,
      html: htmlContent,
      attachments: [{ filename: 'qrcode.png', content: qrCodeBuffer, cid: 'ticket-qrcode' }]
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendPayoutConfirmedEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const htmlContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; padding: 40px;">
        <h1 style="color: #2563eb; font-style: italic; text-transform: uppercase;">Viby Club</h1>
        <h2>Sua transferência foi realizada! 💸</h2>
        <p>Olá, ${data.userName}. O seu pedido de saque no valor de <strong>${formatBRL(data.amount)}</strong> para a organização <strong>${data.orgName}</strong> foi processado com sucesso.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${data.proofUrl}" style="display: inline-block; background: #2563eb; color: white !important; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 16px;">Ver Comprovante Bancário</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; line-height: 1.4;">O valor deve estar disponível em sua conta bancária nos próximos minutos, dependendo da sua instituição financeira.</p>
      </div>
    `;

    await logEmail({
      sender: "Viby Finance",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: "✅ Saque Concluído: Sua transferência chegou!",
      content: htmlContent,
      type: "payout_confirmation"
    });

    if (!smtpUser || !smtpPass) return { success: false, error: "SMTP não configurado no Admin." };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Viby Finance" <${smtpUser}>`,
      to: data.to,
      subject: "✅ Saque Concluído: Sua transferência chegou!",
      html: htmlContent
    });

    return { success: true };
  } catch (e) {
    console.error("Erro no envio do e-mail de saque:", e);
    return { success: false };
  }
}

export async function sendCartPendingEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const htmlContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; padding: 40px;">
        <h1 style="color: #2563eb; font-style: italic; text-transform: uppercase;">Viby Club</h1>
        <h2>Olá, ${data.userName}! 👋</h2>
        <p>Recebemos a sua intenção de compra no valor de <strong>${formatBRL(data.totalAmount)}</strong>.</p>
        <p>Se você já concluiu o pagamento na aba aberta pelo Stripe, seu ingresso aparecerá no painel em alguns instantes.</p>
        <div style="margin-top: 30px;">
          <p style="font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Itens no Pedido:</p>
          ${data.items.map((item: any) => `
            <div style="border-bottom: 1px dashed #e2e8f0; padding: 10px 0;">
              <p style="margin: 0; font-weight: bold;">${item.eventTitle}</p>
              <p style="margin: 0; font-size: 12px; color: #2563eb;">${item.ticketTypeName} | ${item.sectorName || 'Geral'} ${item.seatCode ? `| Lugar: ${item.seatCode}` : ''}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    await logEmail({
      sender: "Viby Checkout",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: `🛒 Resumo do seu pedido no ${data.siteName}`,
      content: htmlContent,
      type: "order_summary"
    });

    if (!smtpUser || !smtpPass) return { success: false, error: "SMTP não configurado no Admin." };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Viby Club" <${smtpUser}>`,
      to: data.to,
      subject: `🛒 Resumo do seu pedido no ${data.siteName}`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false };
  }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();

    const htmlContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; padding: 40px;">
        <h1 style="color: #2563eb; font-style: italic; text-transform: uppercase;">Viby Club</h1>
        <h1>Olá, ${data.userName}! 👋</h1>
        <p>Seja muito bem-vindo ao <strong>VIBY.CLUB</strong>!</p>
        <p>Agora você faz parte de uma comunidade exclusiva focada em experiências culturais transformadoras.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="https://viby.club/dashboard" style="display: inline-block; background: #2563eb; color: white !important; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 16px;">Explorar Painel</a>
        </div>
      </div>
    `;

    await logEmail({
      sender: "Viby System",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: `Olá, ${data.userName}! 👋`,
      content: htmlContent,
      type: "welcome_email"
    });

    if (!smtpUser || !smtpPass) return { success: false, error: "SMTP não configurado no Admin." };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Viby.Club" <${smtpUser}>`,
      to: data.to,
      subject: `Olá, ${data.userName}! 👋`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false };
  }
}

export async function sendTeamInvitationEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const htmlContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; padding: 40px;">
        <h1 style="color: #2563eb; font-style: italic; text-transform: uppercase;">Viby Club</h1>
        <h2>Convite para Equipe 🤝</h2>
        <p>Olá! <strong>${data.inviterName}</strong> convidou você para fazer parte da equipe de <strong>${data.orgName}</strong> como <strong>${data.role}</strong>.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="https://viby.club/dashboard/solicitacoes" style="display: inline-block; background: #2563eb; color: white !important; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 16px;">Ver Solicitação</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8;">Você tem 24 horas para aceitar este convite.</p>
      </div>
    `;

    if (!smtpUser || !smtpPass) return { success: false };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Viby.Club" <${smtpUser}>`,
      to: data.to,
      subject: `🤝 Convite para Equipe: ${data.orgName}`,
      html: htmlContent
    });

    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function sendTeamInvitationNoticeEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const html = `<div>Convite enviado para ${data.inviteeName}</div>`;
    if (!smtpUser || !smtpPass) return { success: false };
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({ from: `"Viby.Club" <${smtpUser}>`, to: data.to, subject: `Convite enviado: ${data.inviteeName}`, html });
    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function sendTeamInvitationStatusEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const html = `<div>O convite para ${data.orgName} foi ${data.status}</div>`;
    if (!smtpUser || !smtpPass) return { success: false };
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({ from: `"Viby.Club" <${smtpUser}>`, to: data.to, subject: `Status Convite: ${data.orgName}`, html });
    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function sendPartnerInvitationEmail(data: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    const html = `<div>Convite de parceria para ${data.eventTitle}</div>`;
    if (!smtpUser || !smtpPass) return { success: false };
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({ from: `"Viby.Club" <${smtpUser}>`, to: data.to, subject: `🤝 Parceria: ${data.eventTitle}`, html });
    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function resendLoggedEmail(logData: any) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    if (!smtpUser || !smtpPass) return { success: false, error: "SMTP não configurado no Admin." };
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({ from: `"Viby Club" <${smtpUser}>`, to: logData.recipientEmail, subject: `[REENVIO] ${logData.subject}`, html: logData.content });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
