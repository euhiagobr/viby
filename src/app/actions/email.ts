
'use server';

import nodemailer from 'nodemailer';

/**
 * @fileOverview Serviço de e-mail utilizando Nodemailer com variáveis de ambiente.
 */

async function getTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("Configurações SMTP ausentes no ambiente (.env).");
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

export async function sendPasswordResetLinkEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const smtpUser = process.env.SMTP_USER;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
        <h1 style="color: #2C52EE;">Viby.Club</h1>
        <h2 style="color: #0f172a;">Recuperação de Acesso</h2>
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

    return { success: true };
  } catch (e: any) { 
    return { success: false, error: e.message }; 
  }
}

export async function sendPayoutConfirmedEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const smtpUser = process.env.SMTP_USER;
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
    const smtpUser = process.env.SMTP_USER;
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
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function sendWelcomeEmail(data: any) {
  try {
    const transporter = await getTransporter();
    const smtpUser = process.env.SMTP_USER;
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 40px;">
        <h1 style="color: #2C52EE;">Bem-vindo à ${data.siteName}!</h1>
        <p>Olá, ${data.userName}. Sua conta foi criada com sucesso. Explore as melhores experiências agora!</p>
      </div>
    `;
    await transporter.sendMail({ 
      from: `"${data.siteName}" <${smtpUser}>`, 
      to: data.to, 
      subject: `✨ Bem-vindo à ${data.siteName}`, 
      html: htmlContent 
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}
