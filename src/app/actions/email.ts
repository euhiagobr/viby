
'use server';

import nodemailer from 'nodemailer';

/**
 * @fileOverview Ação de servidor para envio de e-mails de confirmação de ingresso.
 */

interface EmailData {
  to: string;
  userName: string;
  eventTitle: string;
  ticketCode: string;
  eventDate: string;
  eventCity: string;
  voucherUrl: string;
  eventImage?: string;
}

export async function sendTicketEmail(data: EmailData) {
  // Verifica se as credenciais existem
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Configurações de e-mail ausentes. Verifique as variáveis de ambiente.');
    return { success: false, error: 'Configurações de e-mail ausentes' };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Poppins', sans-serif, Arial; background-color: #f8fafc; color: #1e293b; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        .header { background: #000; color: white; padding: 40px 20px; text-align: center; }
        .content { padding: 40px; }
        .event-card { background: #f1f5f9; border-radius: 16px; padding: 20px; margin: 20px 0; }
        .ticket-code { font-family: monospace; font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 2px; }
        .button { display: inline-block; padding: 16px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 20px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; font-size: 24px; text-transform: uppercase; font-style: italic;">Viby Club</h1>
        </div>
        <div class="content">
          <h2 style="margin-top:0;">Olá, ${data.userName}! 👋</h2>
          <p>Tudo pronto! Seu ingresso para o evento <strong>${data.eventTitle}</strong> já está disponível.</p>
          
          <div class="event-card">
            <p style="margin:0; font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748b;">Evento</p>
            <p style="margin:5px 0 15px 0; font-size: 18px; font-weight: bold;">${data.eventTitle}</p>
            
            <p style="margin:0; font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748b;">Data e Local</p>
            <p style="margin:5px 0 0 0;">📅 ${data.eventDate}</p>
            <p style="margin:5px 0 0 0;">📍 ${data.eventCity}</p>
          </div>

          <div style="text-align: center;">
            <p style="font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748b;">Seu Código de Acesso</p>
            <p class="ticket-code">${data.ticketCode}</p>
            
            <a href="${data.voucherUrl}" class="button">Ver meu Voucher / QR Code</a>
          </div>
        </div>
        <div class="footer">
          <p>Apresente o QR Code na entrada do evento para validação.</p>
          <p>Viby Club - A maior vitrine de eventos do Brasil</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Viby Club" <${process.env.EMAIL_USER}>`,
      to: data.to,
      subject: `Confirmado! Seu ingresso para ${data.eventTitle} chegou! 🎟️`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return { success: false, error };
  }
}
