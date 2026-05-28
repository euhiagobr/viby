import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { getEmailConfig } from '@/app/actions/email';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = {
    firebase_auth: false,
    firestore: false,
    smtp: false,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Testar Auth
    const auth = getAdminAuth();
    await auth.listUsers(1);
    status.firebase_auth = true;

    // 2. Testar Firestore
    const db = getAdminDb();
    await db.collection('settings').limit(1).get();
    status.firestore = true;

    // 3. Testar SMTP
    const config = await getEmailConfig();
    if (config.smtpUser && config.smtpPass) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: config.smtpUser, pass: config.smtpPass },
      });
      await transporter.verify();
      status.smtp = true;
    }

    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ 
      error: 'Healthcheck falhou', 
      message: e.message,
      status 
    }, { status: 500 });
  }
}
