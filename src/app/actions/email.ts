'use server';

import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * @fileOverview Ação de servidor para envio de e-mails de confirmação de ingresso.
 * Busca as credenciais dinamicamente do Firestore e inclui QR Code gerado.
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

/**
 * Helper para obter as credenciais de e-mail do Firestore.
 */
async function getEmailConfig() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app, 'eventosviby');
  
  const emailDoc = await getDoc(doc(db, 'settings', 'email'));
  if (!emailDoc.exists()) {
    throw new Error('Configuração de e-mail não encontrada no painel administrativo.');
  }

  const data = emailDoc.data();
  return {
    smtpUser: data.smtpUser as string,
    smtpPass: data.smtpPass as string,
  };
}

export async function sendTicketEmail(data: EmailData) {
  try {
    // Validação básica de entrada
    if (!data.to || typeof data.to !== 'string') {
      return { success: false, error: 'E-mail do destinatário inválido ou ausente.' };
    }

    const { smtpUser, smtpPass } = await getEmailConfig();

    if (!smtpUser || !smtpPass) {
      console.warn('Configurações de e-mail incompletas no banco de dados.');
      return { success: false, error: 'Credenciais de e-mail (SMTP) não configuradas no sistema.' };
    }

    // Gerar QR Code como Data URI para embutir no e-mail
    const qrCodeDataUri = await QRCode.toDataURL(data.ticketCode, {
      margin: 1,
      width: 250,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
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
          .event-link { margin-top: 15px; padding-top: 15px; border-top: 1px solid #cbd5e1; text-align: center; }
          .event-link a { color: #2563eb; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase; }
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
            <p style="line-height: 1.6; color: #475569;">Prepare-se para uma experiência incrível. Seu acesso para o evento <strong>${data.eventTitle}</strong> já está garantido e confirmado.</p>
            
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

              <div class="event-link">
                <a href="${data.eventUrl}">Acessar página do evento na Viby →</a>
              </div>
            </div>

            <div class="qr-container">
              <div class="label">Apresente este QR Code na entrada</div>
              <img src="${qrCodeDataUri}" alt="Ticket QR Code" class="qr-image" />
              <div class="ticket-code">${data.ticketCode}</div>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 15px;">Dica: Salve este e-mail ou tire um print do QR Code.</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.voucherUrl}" class="button">Ver Voucher Completo</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin-bottom: 10px;">Este é um e-mail automático enviado por Viby Club.</p>
            <p><strong>Viby Club</strong> - A maior vitrine de eventos do Brasil</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Viby Club" <${smtpUser}>`,
      to: data.to,
      subject: `Confirmado! Seu ingresso para ${data.eventTitle} chegou! 🎟️`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao enviar e-mail:', error);
    return { success: false, error: error.message || 'Erro desconhecido no servidor de e-mail.' };
  }
}
