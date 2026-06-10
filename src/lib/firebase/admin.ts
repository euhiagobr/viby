import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização robusta do Firebase Admin SDK.
 * Resolve o erro de credenciais: Failed to parse private key: Too few bytes to read ASN.1 value.
 */

const getPrivateKey = () => {
  // Prioridade 1: Variável de ambiente (Mais segura para produção)
  let key = process.env.FIREBASE_PRIVATE_KEY;

  if (!key) {
    // Fallback: Chave hardcoded (Apenas se a env não estiver definida)
    key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCrUnnL+bjctODk
J96Srd5A2UaADZIfz+zG7jhjKpXP4SNymOUL+puDs3MQkQwjDeQ9UNasIZmXnWg7
iQE/FEUvgfJ9OvbaInh9Ec50UTz201wfaB2yiw9rQ0FZV+WWqiWRTHRM5l48h07W
vvIUH03KYPMzCeezVXhyhx+PYwrS+hRR8F2kssQEJN07WZjgGZuD1lEuis+NRTDq
qRl1Jf0ampStKlGtIaSCPvWBHhNdGczFd5Xewm9LtsBZk71/WLVYlcMHCcJLjPXY
1+Hp+U2K9T2d72XQLUqx1yZdLJF6mOz6p1IfUpIdOhqR6d3RTyJey0DPEsFL6Amv
bqOyHxU7AgMBAAECggEAFHT1MSuA7O22Otgd5hLXypOHLQwxyhWoVrqkRgcUO23N
L0Zddzg18JxxXWWMdvUWL1IjSAt9DRMRGqbJ3M/dUQZpv5VWW4apL3n8VnxK1Mg5
JFDo1uRu82Zk+7eYpQxtDvP7oSES2JRpkA/d1RRF1CgOciY5IftPNhG3bYYsiTN8
SlPxeuaGcRi3L95H+qF/QJ8qR1uVQR9QrGA4wyLJlQqI8VCvfPZo7ShqySgEHShL
adsrykyLo5xnS6jdpq0jiE80sgXy0y4T8+CNA5CJq/5TFulRVKqx34qc88T3QYM1
I0wDRLzVBZ1p3wRCZG/1JDeM8NFLpDB+DxvgOJzPbQKBgQDV4DRiPhfZpCgRpf2J
gMdi7KUkaBhagFHgIr3gy5GG77LCzP4U//9t1hJ4WcLtuXmd1gxNolntmCn5AidZ
C6Z3PfHePge9dvc1ITKcYGIqxo/dYuSGJ10nTZpyB1rMMqZG2qYhNnC5/9rzqndr
V+Sd9JdI39Np4X052SKKsjjApwKBgQDNEK6PNK8fDmDbVQ/oadKw6D4dyqfCo/Q4
y68v+0v6QRTd736yr4ZrOYSSbncoSIV8m9EZLbFHrcIa1z8S7ajIE0FoyxSa6oGY
zuvSblaZvtGGNA+ohW63SCcpqpELx4xdc6HHoRbIWTkn1rW1kDjrwFTfiNijeahJ
9Bn4PMMlTQKBgQCZQr/nAp3urS61buBfT3QR1IiGrT1+ZOPHHL46P0Y6jrvn0iPl
AomUuMmlipUf60BWNZO9cjDFDLxPHxb5PVr9qdsPqh27zGtbnD17R6oxAvcG6x3d
cInVZ0vcmJ6dI1J6Bab0t+FRuCG7aJWIy4QdGK/sXdBO2HH3KT0SbKI0kwKBgQCg
VgzGd+D9HVbp54Z6qFNOcyguTwgAjgUka03c7FWppD1Wki20NL2bFOvtOmX8n0eP
+JzzXOCiNN/x8J6mhCBV34hjEXZY8kbGXfPRIuifaa2Vixs7HqlEsSu9zll+plW/
s+uolPGlUO35kk2dWtjGrCkwZmVM3JCS0kOD7q5+eQKBgExGGVtgipTHrHpgNMUq
zFltkagZ08iVgtIoFFnidwgi4+C4zzh6RtJKqeRYpHIG6taxTUXpq2CR6ICFX2qN
6Z9lnrIRojeg7YsMDNoc8c9i+kaPF7h1cPFh1cPDhtJi3woX0gDxjBe+VAXS2tlw
LXyeUurlZvKsRVIwXDdHEr32hZyDR
-----END PRIVATE KEY-----`;
  }

  // 1. Limpeza de espaços e aspas (alguns gerenciadores de segredo adicionam aspas)
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.substring(1, key.length - 1);
  }

  // 2. Correção de quebras de linha escapadas (\n literal -> newline real)
  return key.replace(/\\n/g, '\n');
};

export const getAdminApp = () => {
  // Garantir singleton para evitar conflitos de instância
  if (admin.apps.length > 0) return admin.apps[0]!;

  try {
    const privateKey = getPrivateKey();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@vibyeventos.iam.gserviceaccount.com";
    const projectId = process.env.FIREBASE_PROJECT_ID || "vibyeventos";

    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId
    });
  } catch (e: any) {
    console.error("[Admin SDK] Erro fatal de inicialização:", e.message || e);
    throw e;
  }
};

export const getAdminAuth = () => {
  return getAdminApp().auth();
};

export const getAdminDb = () => {
  return getAdminApp().firestore();
};