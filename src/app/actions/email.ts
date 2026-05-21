
'use server';

import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Ação de servidor para envio de e-mails.
 * Busca as credenciais dinamicamente do Firestore e loga as mensagens enviadas.
 */

interface EmailData {
  to: string;
  userName: string;
  eventTitle: string;
  ticketCode: string;
  eventDate: string;
  eventCity: string;
  voucherUrl: string;
  eventUrl: string;
  eventImage?: string;
}

interface WelcomeEmailData {
  to: string;
  userName: string;
  siteName: string;
}

/**
 * Helper para registrar o envio de e-mail no Firestore para auditoria.
 */
async function logEmail(data: {
  sender: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  content: string;
  type: string;
}) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app, 'eventosviby');
    await addDoc(collection(db, 'sent_emails'), {
      ...data,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error('Erro ao logar e-mail no Firestore:', e);
  }
}

/**
 * Helper para obter as credenciais de e-mail do Firestore.
 */
async function getEmailConfig() {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
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

/**
 * Envia o e-mail de confirmação de ingresso com QR Code.
 */
export async function sendTicketEmail(data: EmailData) {
  try {
    if (!data?.to || typeof data.to !== 'string') {
      return { success: false, error: 'E-mail do destinatário inválido.' };
    }
    if (!data?.ticketCode || typeof data.ticketCode !== 'string') {
      return { success: false, error: 'Código do ingresso inválido.' };
    }

    const { smtpUser, smtpPass } = await getEmailConfig();

    if (!smtpUser || !smtpPass) {
      return { success: false, error: 'SMTP não configurado.' };
    }

    const qrCodeBuffer = await QRCode.toBuffer(data.ticketCode, {
      margin: 1,
      width: 400,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Poppins', sans-serif, Arial; background-color: #f8fafc; color: #1e293b; padding: 20px; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          .header { background: #000; color: white; padding: 40px 20px; text-align: center; }
          .content { padding: 40px; }
          .event-card { background: #f1f5f9; border-radius: 24px; padding: 25px; margin: 20px 0; border: 1px dashed #cbd5e1; }
          .qr-container { text-align: center; margin: 30px 0; padding: 20px; background: #fff; border-radius: 24px; border: 1px solid #f1f5f9; }
          .qr-image { width: 200px; height: 200px; }
          .ticket-code { font-family: monospace; font-size: 20px; font-weight: bold; color: #2563eb; letter-spacing: 2px; margin-top: 10px; }
          .button { display: inline-block; padding: 18px 36px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 16px; font-weight: bold; margin-top: 10px; font-size: 16px; }
          .footer { padding: 30px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
          .label { font-size: 10px; text-transform: uppercase; font-weight: 900; color: #64748b; letter-spacing: 1px; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 28px; text-transform: uppercase; font-style: italic; letter-spacing: -1px;">Viby Club</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7; font-weight: bold; text-transform: uppercase;">Seu ingresso chegou!</p>
          </div>
          <div class="content">
            <h2 style="margin-top:0; font-size: 24px; letter-spacing: -0.5px;">Olá, ${data.userName}! 👋</h2>
            <p style="line-height: 1.6; color: #475569;">Prepare-se para uma experiência incrível. Seu acesso para <strong>${data.eventTitle}</strong> está garantido.</p>
            
            <div class="event-card">
              <div class="label">Evento</div>
              <p style="margin:0 0 20px 0; font-size: 20px; font-weight: 800; color: #0f172a;">${data.eventTitle}</p>
              <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                  <div class="label">Data</div>
                  <p style="margin:0; font-weight: bold; font-size: 14px;">📅 ${data.eventDate}</p>
                </div>
                <div style="flex: 1;">
                  <div class="label">Local</div>
                  <p style="margin:0; font-weight: bold; font-size: 14px;">📍 ${data.eventCity}</p>
                </div>
              </div>
            </div>

            <div class="qr-container">
              <div class="label">Apresente este QR Code na entrada</div>
              <img src="cid:ticket-qrcode" alt="Ticket QR Code" class="qr-image" />
              <div class="ticket-code">${data.ticketCode}</div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.voucherUrl}" class="button">Ver Voucher Completo</a>
            </div>
          </div>
          <div class="footer">
            <p><strong>Viby Club</strong> - A maior vitrine de eventos do Brasil</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `Confirmado! Seu ingresso para ${data.eventTitle} chegou! 🎟️`;

    await transporter.sendMail({
      from: `"Viby Club" <${smtpUser}>`,
      to: data.to,
      subject: subject,
      html: htmlContent,
      attachments: [{ filename: 'qrcode.png', content: qrCodeBuffer, cid: 'ticket-qrcode' }]
    });

    await logEmail({
      sender: "Viby System",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: subject,
      content: htmlContent,
      type: "ticket_confirmation"
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erro no envio de e-mail de ticket:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envia o e-mail de boas-vindas ao criar conta.
 */
export async function sendWelcomeEmail(data: WelcomeEmailData) {
  try {
    if (!data?.to || typeof data.to !== 'string') return { success: false };

    const { smtpUser, smtpPass } = await getEmailConfig();
    if (!smtpUser || !smtpPass) return { success: false };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Poppins', sans-serif, Arial; background-color: #f8fafc; color: #1e293b; padding: 20px; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          .header { background: #000; color: white; padding: 50px 20px; text-align: center; }
          .content { padding: 40px; }
          .list { list-style: none; padding: 0; margin: 25px 0; }
          .list li { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 500; display: flex; align-items: center; }
          .list li::before { content: "•"; color: #0095f6; font-weight: bold; display: inline-block; width: 1em; margin-right: 10px; font-size: 20px; }
          .button { display: inline-block; padding: 18px 36px; background: #0095f6; color: white !important; text-decoration: none; border-radius: 16px; font-weight: bold; margin-top: 30px; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(0, 149, 246, 0.3); }
          .footer { padding: 30px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
          .signature { margin-top: 40px; border-top: 1px dashed #e2e8f0; pt: 20px; font-weight: bold; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 32px; text-transform: uppercase; font-style: italic; letter-spacing: -1px;">Viby.Club</h1>
          </div>
          <div class="content">
            <h2 style="margin-top:0; font-size: 22px; letter-spacing: -0.5px;">Olá, ${data.userName}! 👋</h2>
            <p style="line-height: 1.6; color: #475569; font-size: 15px;">A <strong>VIBY.CLUB</strong> nasceu para conectar pessoas através de experiências reais.</p>
            
            <p style="line-height: 1.6; color: #475569; font-size: 15px; margin-top: 20px;">Seu perfil já está ativo e você já pode:</p>
            
            <ul class="list">
              <li>Explorar eventos</li>
              <li>Criar sua comunidade</li>
              <li>Publicar experiências</li>
              <li>Comprar ingressos</li>
              <li>Vender ingressos</li>
              <li>Descobrir o que está acontecendo perto de você</li>
            </ul>

            <p style="font-weight: 700; font-size: 18px; margin: 30px 0 10px 0; color: #0095f6; font-style: italic;">Welcome to the club.</p>

            <div style="text-align: center;">
              <a href="https://viby.club" class="button">Acessar Viby.Club</a>
            </div>

            <div class="signature">
              <p style="margin: 20px 0 0 0;">Equipe VIBY.CLUB</p>
            </div>
          </div>
          <div class="footer">
            <p>Este é um e-mail automático. Não responda a esta mensagem.</p>
            <p><strong>VIBY.CLUB</strong> - Inteligência em Eventos</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `Olá, ${data.userName}! 👋`;

    await transporter.sendMail({
      from: `"Viby.Club" <${smtpUser}>`,
      to: data.to,
      subject: subject,
      html: htmlContent,
    });

    await logEmail({
      sender: "Viby System",
      recipientName: data.userName,
      recipientEmail: data.to,
      subject: subject,
      content: htmlContent,
      type: "welcome_email"
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erro no envio de e-mail de boas-vindas:', error);
    return { success: false };
  }
}

/**
 * Envia o convite de equipe para o novo colaborador.
 */
export async function sendTeamInvitationEmail(data: { to: string, orgName: string, role: string, inviterName: string }) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    if (!smtpUser || !smtpPass) return { success: false };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
        <div style="background: #000; color: white; padding: 40px; text-align: center;">
          <h1 style="margin:0; font-style: italic;">VIBY.CLUB</h1>
        </div>
        <div style="padding: 40px;">
          <h2>Convite de Colaboração</h2>
          <p>Olá! <strong>${data.inviterName}</strong> convidou você para fazer parte da equipe de <strong>${data.orgName}</strong> como <strong>${data.role}</strong>.</p>
          <p>Você tem <strong>24 horas</strong> para aceitar este convite antes que ele expire.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://viby.club/dashboard/solicitacoes" style="background: #0095f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold;">Ver Solicitação</a>
          </div>
        </div>
      </div>
    `;

    const subject = `Convite: Faça parte da equipe de ${data.orgName} 🤝`;

    await transporter.sendMail({
      from: `"Viby.Club" <${smtpUser}>`,
      to: data.to,
      subject: subject,
      html
    });

    await logEmail({
      sender: data.inviterName,
      recipientName: "Colaborador",
      recipientEmail: data.to,
      subject: subject,
      content: html,
      type: "team_invitation"
    });

    return { success: true };
  } catch (e) { return { success: false }; }
}

/**
 * Notifica o administrador que o convite foi enviado.
 */
export async function sendTeamInvitationNoticeEmail(data: { to: string, inviteeName: string, orgName: string, role: string }) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    if (!smtpUser || !smtpPass) return { success: false };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const html = `
      <div style="font-family: sans-serif; padding: 30px;">
        <h3>Convite Enviado com Sucesso!</h3>
        <p>O convite para <strong>${data.inviteeName}</strong> participar de <strong>${data.orgName}</strong> como <strong>${data.role}</strong> foi enviado.</p>
        <p>Aguarde o aceite do colaborador em até 24 horas.</p>
      </div>
    `;

    const subject = `Convite enviado para ${data.inviteeName}`;

    await transporter.sendMail({
      from: `"Viby.Club" <${smtpUser}>`,
      to: data.to,
      subject: subject,
      html
    });

    await logEmail({
      sender: "Viby System",
      recipientName: "Administrador",
      recipientEmail: data.to,
      subject: subject,
      content: html,
      type: "invitation_notice"
    });

    return { success: true };
  } catch (e) { return { success: false }; }
}

/**
 * Notifica sobre o resultado do convite (Aceito ou Recusado).
 */
export async function sendTeamInvitationStatusEmail(data: { to: string, userName: string, orgName: string, status: 'accepted' | 'declined' }) {
  try {
    const { smtpUser, smtpPass } = await getEmailConfig();
    if (!smtpUser || !smtpPass) return { success: false };

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const isAccepted = data.status === 'accepted';
    const statusText = isAccepted ? 'ACEITOU' : 'RECUSOU';

    const html = `
      <div style="font-family: sans-serif; padding: 30px;">
        <h3>Atualização de Convite</h3>
        <p>O usuário <strong>${data.userName}</strong> ${statusText} seu convite para a equipe de <strong>${data.orgName}</strong>.</p>
        ${isAccepted ? '<p>O novo colaborador já possui acesso às ferramentas de gestão.</p>' : ''}
      </div>
    `;

    const subject = `Resultado do Convite: ${data.orgName}`;

    await transporter.sendMail({
      from: `"Viby.Club" <${smtpUser}>`,
      to: data.to,
      subject: subject,
      html
    });

    await logEmail({
      sender: "Viby System",
      recipientName: "Responsável",
      recipientEmail: data.to,
      subject: subject,
      content: html,
      type: "invitation_result"
    });

    return { success: true };
  } catch (e) { return { success: false }; }
}
