import * as admin from 'firebase-admin';

/**
 * @fileOverview Inicialização do Firebase Admin SDK.
 * Utiliza credenciais explícitas para evitar falhas de busca de token OAuth2.
 */

const serviceAccount = {
  projectId: "vibyeventos",
  clientEmail: "firebase-adminsdk-fbsvc@vibyeventos.iam.gserviceaccount.com",
  privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCrUnnL+bjctODk\nJ96Srd5A2UaADZIfz+zG7jhjKpXP4SNymOUL+puDs3MQkQwjDeQ9UNasIZmXnWg7\niQE/FEUvgfJ9OvbaInh9Ec50UTz201wfaB2yiw9rQ0FZV+WWqiWRTHRM5l48h07W\nvvIUH03KYPMzCeezVXhyhx+PYwrS+hRR8F2kssQEJN07WZjgGZuD1lEuis+NRTDq\nqRl1Jf0ampStKlGtIaSCPvWBHhNdGczFd5Xewm9LtsBZk71/WLVYlcMHCcJLjPXY\n1+Hp+U2K9T2d72XQLUqx1yZdLJF6mOz6p1IfUpIdOhqR6d3RTyJey0DPEsFL6Amv\nbqOyHxU7AgMBAAECggEAFHT1MSuA7O22Otgd5hLXypOHLQwxyhWoVrqkRgcUO23N\nL0Zddzg18JxxXWWMdvUWL1IjSAt9DRMRGqbJ3M/dUQZpv5VWW4apL3n8VnxK1Mg5\nJFDo1uRu82Zk+7eYpQxtDvP7oSES2JRpkA/d1RRF1CgOciY5IftPNhG3bYYsiTN8\nSlPxeuaGcRi3L95H+qF/QJ8qR1uVQR9QrGA4wyLJlQqI8VCvfPZo7ShqySgEHShL\nadsrykyLo5xnS6jdpq0jiE80sgXy0y4T8+CNA5CJq/5TFulRVKqx34qc88T3QYM1\I0wDRLzVBZ1p3wRCZG/1JDeM8NFLpDB+DxvgOJzPbQKBgQDV4DRiPhfZpCgRpf2J\ngMdi7KUkaBhagFHgIr3gy5GG77LCzP4U//9t1hJ4WcLtuXmd1gxNolntmCn5AidZ\nC6Z3PfHePge9dvc1ITKcYGIqxo/dYuSGJ10nTZpyB1rMMqZG2qYhNnC5/9rzqndr\nV+Sd9JdI39Np4X052SKKsjjApwKBgQDNEK6PNK8fDmDbVQ/oadKw6D4dyqfCo/Q4\ny68v+0v6QRTd736yr4ZrOYSSbncoSIV8m9EZLbFHrcIa1z8S7ajIE0FoyxSa6oGY\nzuvSblaZvtGGNA+ohW63SCcpqpELx4xdc6HHoRbIWTkn1rW1kDjrwFTfiNijeahJ\n9Bn4PMMlTQKBgQCZQr/nAp3urS61buBfT3QR1IiGrT1+ZOPHHL46P0Y6jrvn0iPl\nAomUuMmlipUf60BWNZO9cjDFDLxPHxb5PVr9qdsPqh27zGtbnD17R6oxAvcG6x3d\ncInVZ0vcmJ6dI1J6Bab0t+FRuCG7aJWIy4QdGK/sXdBO2HH3KT0SbKI0kwKBgQCg\nVgzGd+D9HVbp54Z6qFNOcyguTwgAjgUka03c7FWppD1Wki20NL2bFOvtOmX8n0eP\+JzzXOCiNN/x8J6mhCBV34hjEXZY8kbGXfPRIuifaa2Vixs7HqlEsSu9zll+plW/\ns+uolPGlUO35kk2dWtjGrCkwZmVM3JCS0kOD7q5+eQKBgExGGVtgipTHrHpgNMUq\nzFltkagZ08iVgtIoFFnidwgi4+C4zzh6RtJKqeRYpHIG6taxTUXpq2CR6ICFX2qN\n6Z9lnrIRojeg7YsMDNoc8c9i+kaPF7h1cPDhtJi3woX0gDxjBe+VAXS2tlwLXyeU\nurlZvKsRVIwXDdHEr32hZyDR\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
};

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId
    });
  } catch (e) {
    console.error("[Admin SDK] Erro fatal de inicialização:", e);
    throw e;
  }
}

export const getAdminAuth = () => getAdminApp().auth();
export const getAdminDb = () => getAdminApp().firestore();
