/**
 * @fileOverview Gerenciador de Erros do Sistema.
 * Refatorado para ser seguro no cliente e no servidor (Next.js).
 * Utiliza o Admin SDK apenas no ambiente de servidor para evitar erros de bundling.
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export function generateErrorCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'ERR-VIBY-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getClientContext() {
  if (typeof window === 'undefined') {
    return { 
      device: 'server', 
      os: 'linux', 
      pathname: 'server-action',
      userAgent: 'Server-Side-Action',
      browser: 'Node.js'
    };
  }
  
  const ua = window.navigator.userAgent;
  return {
    pathname: window.location.pathname,
    browser: window.navigator.appName,
    userAgent: ua,
    device: /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop',
    os: window.navigator.platform
  };
}

export async function logSystemError(params: {
  error: any;
  type: string;
  severity?: ErrorSeverity;
  component?: string;
  metadata?: any;
  user?: { uid: string; email: string | null } | null;
  userRole?: string | null;
}) {
  const { error, type, severity = 'error', component, metadata, user, userRole } = params;
  const code = generateErrorCode();
  const context = getClientContext();

  const logData = {
    code,
    message: error?.message || String(error),
    stack: error?.stack || null,
    type,
    severity,
    pathname: context.pathname,
    component: component || 'N/A',
    metadata: metadata || null,
    userId: user?.uid || null,
    userEmail: user?.email || null,
    userRole: userRole || 'guest',
    browser: context.browser,
    os: context.os,
    device: context.device,
    resolved: false,
    status: 'pendente'
  };

  try {
    // Utilizamos importação dinâmica para evitar que o firebase-admin seja incluído no bundle do browser
    if (typeof window === 'undefined') {
      const admin = await import('firebase-admin');
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const db = getAdminDb();
      await db.collection('system_logs').add({
        ...logData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // No cliente, chamamos uma Server Action dedicada para persistir o log
      const { saveSystemErrorAction } = await import('@/app/actions/error-logs');
      await saveSystemErrorAction(logData);
    }
  } catch (e) {
    console.error('[ErrorManager Fallback]', code, logData);
  }

  return code;
}
