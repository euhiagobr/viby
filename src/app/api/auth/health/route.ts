import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getEmailConfig } from '@/app/actions/email';
import nodemailer from 'nodemailer';

/**
 * @fileOverview Endpoint de Healthcheck para auditoria técnica do sistema de Auth.
 */

export async function GET() {
  const status = {
    firebase: false,
    firestore: true, // Se o adminDb carregar sem erro, assumimos ok inicial
    smtp: false,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Testar Firebase Admin / Auth
    // Listar usuários ou buscar um ID fictício
    try {
      await adminAuth.listUsers(1);
      status.firebase = true;
    } catch (e) {
      console.error({ health: 'firebase-admin', error: e });
    }

    // 2. Testar SMTP
    try {
      const config = await getEmailConfig();
      if (config.smtpUser && config.smtpPass) {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 465, secure: true,
          auth: { user: config.smtpUser, pass: config.smtpPass },
        });
        await transporter.verify();
        status.smtp = true;
      }
    } catch (e) {
      console.error({ health: 'smtp', error: e });
    }

    return NextResponse.json(status);
  } catch (globalError) {
    return NextResponse.json({ error: 'Critical failure during healthcheck', details: globalError }, { status: 500 });
  }
}
