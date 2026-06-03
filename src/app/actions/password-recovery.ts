'use server';

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  getFirestore, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc as firestoreGetDoc,
  writeBatch
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { maskEmail } from '@/lib/crypto-utils';
import { sendPasswordResetLinkEmail } from './email';
import { getAdminAuth } from '@/lib/firebase/admin';

/**
 * @fileOverview Ações de Recuperação de Senha (AUDITORIA ATIVA).
 * Adicionados logs detalhados para rastrear falhas de busca e permissão.
 */

async function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export async function requestPasswordRecovery(identifier: string) {
  const auditId = `RECOVERY-${Date.now()}`;
  console.log(`[${auditId}] --- INÍCIO DA AUDITORIA DE RECUPERAÇÃO ---`);
  console.log(`[${auditId}] Entrada recebida: "${identifier}"`);

  try {
    const db = await getDb();
    const inputClean = identifier.trim().toLowerCase();
    const isEmail = inputClean.includes("@");
    
    console.log(`[${auditId}] Tipo identificado: ${isEmail ? 'E-MAIL' : 'USERNAME'}`);

    let userId = "";
    let targetEmail = "";
    let userName = "";

    if (isEmail) {
      // Busca por E-mail
      const q = query(collection(db, "users"), where("email", "==", inputClean), limit(1));
      const userSnap = await getDocs(q);
      if (!userSnap.empty) {
        const u = userSnap.docs[0];
        userId = u.id;
        targetEmail = u.data().email;
        userName = u.data().name || u.data().displayName || "Usuário";
      }
    } else {
      // Busca por Username (Consultando primeiro o índice de usernames para integridade)
      const cleanUser = inputClean.replace('@', '');
      console.log(`[${auditId}] Consultando índice de usernames para: ${cleanUser}`);
      
      const usernameRef = doc(db, "usernames", cleanUser);
      const usernameSnap = await firestoreGetDoc(usernameRef);
      
      if (usernameSnap.exists()) {
        const indexData = usernameSnap.data();
        if (indexData.type === 'user') {
          userId = indexData.uid;
          console.log(`[${auditId}] UID encontrado via índice: ${userId}`);
          
          const userSnap = await firestoreGetDoc(doc(db, "users", userId));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            targetEmail = uData.email;
            userName = uData.name || uData.displayName || "Usuário";
          }
        }
      }
    }

    if (!userId || !targetEmail) {
      console.log(`[${auditId}] Alvo não localizado. Retornando resposta genérica de segurança.`);
      return { success: true, maskedEmail: "seu e-mail cadastrado" };
    }

    console.log(`[${auditId}] Usuário localizado: ${userName} (${userId})`);
    console.log(`[${auditId}] E-mail de destino: ${targetEmail}`);

    // VERIFICAÇÃO DE RATE LIMIT (Proteção contra brute force/spam)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    console.log(`[${auditId}] Verificando limite de requisições na última hora...`);
    
    // NOTA: Consultas com múltiplos filtros where() exigem índice composto.
    // Se falhar aqui, o erro aparecerá no console abaixo.
    const rateQ = query(
      collection(db, "password_reset_codes"), 
      where("userId", "==", userId)
    );
    
    const rateSnap = await getDocs(rateQ);
    const recentRequests = rateSnap.docs.filter(d => {
      const createdAt = d.data().createdAt?.toDate?.() || new Date(0);
      return createdAt > oneHourAgo && d.data().used === false;
    });

    if (recentRequests.length >= 3) {
      console.warn(`[${auditId}] Limite de requisições atingido para o usuário ${userId}`);
      return { success: false, error: "Muitas solicitações. Tente novamente em uma hora." };
    }

    // Geração do código
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    console.log(`[${auditId}] Gerando código OTP: ${otpCode} (Expira em 15min)`);

    const resetData = {
      email: targetEmail,
      userId: userId,
      code: otpCode,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    };

    console.log(`[${auditId}] Salvando código no Firestore (coleção: password_reset_codes)...`);
    const resetRef = await addDoc(collection(db, "password_reset_codes"), resetData);
    console.log(`[${auditId}] Código salvo com sucesso. ID: ${resetRef.id}`);

    console.log(`[${auditId}] Disparando e-mail via Nodemailer...`);
    const emailRes = await sendPasswordResetLinkEmail({
      to: targetEmail,
      userName: userName,
      otpCode: otpCode
    });

    if (!emailRes.success) {
      console.error(`[${auditId}] Falha no envio do e-mail:`, emailRes.error);
      throw new Error(`Email Service Error: ${emailRes.error}`);
    }

    console.log(`[${auditId}] Fluxo concluído com sucesso.`);
    return { 
      success: true, 
      requestId: resetRef.id,
      maskedEmail: maskEmail(targetEmail) 
    };

  } catch (error: any) {
    console.error(`[${auditId}] --- ERRO NA ETAPA DE SOLICITAÇÃO ---`);
    console.error(`[${auditId}] Arquivo: src/app/actions/password-recovery.ts`);
    console.error(`[${auditId}] Mensagem: ${error.message}`);
    console.error(`[${auditId}] Stack:`, error.stack);
    
    // Tratamento específico de erro de índice
    if (error.message?.includes("FAILED_PRECONDITION") || error.message?.includes("index")) {
      console.error(`[${auditId}] ERRO DE ÍNDICE DETECTADO. Verifique se a coleção password_reset_codes possui os índices necessários.`);
    }

    return { success: false, error: 'Erro ao processar solicitação. Tente novamente mais tarde.' };
  }
}

/**
 * Valida o código informado pelo usuário.
 */
export async function verifyRecoveryCode(requestId: string, code: string) {
  const auditId = `VERIFY-${Date.now()}`;
  console.log(`[${auditId}] Validando código ${code} para requisição ${requestId}`);

  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) {
      console.warn(`[${auditId}] Requisição ${requestId} não existe no Firestore.`);
      return { success: false, error: "Solicitação inválida." };
    }

    const data = resetSnap.data();
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (data.used) return { success: false, error: "Este código já foi utilizado." };
    if (now > expiresAt) return { success: false, error: "Este código expirou." };
    
    if ((data.attempts || 0) >= 10) return { success: false, error: "Limite de tentativas excedido." };

    if (data.code !== code) {
      console.log(`[${auditId}] Tentativa incorreta para a requisição ${requestId}`);
      await updateDoc(resetRef, { attempts: (data.attempts || 0) + 1 });
      return { success: false, error: "Código incorreto." };
    }

    console.log(`[${auditId}] Código validado com sucesso.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[${auditId}] Erro na validação:`, error.message);
    return { success: false, error: "Erro na validação do código." };
  }
}

/**
 * Finaliza a redefinição atualizando a senha no Auth via Admin SDK.
 */
export async function resetPasswordWithCode(requestId: string, code: string, password: string) {
  const auditId = `RESET-${Date.now()}`;
  console.log(`[${auditId}] Finalizando troca de senha para requisição ${requestId}`);

  try {
    const db = await getDb();
    const resetRef = doc(db, "password_reset_codes", requestId);
    const resetSnap = await firestoreGetDoc(resetRef);

    if (!resetSnap.exists()) throw new Error("Sessão expirada.");
    const resetData = resetSnap.data();

    if (resetData.code !== code || resetData.used) {
      return { success: false, error: "Código inválido ou já utilizado." };
    }

    const userId = resetData.userId;
    
    console.log(`[${auditId}] Chamando Admin SDK para atualizar Auth do usuário ${userId}...`);
    const adminAuth = getAdminAuth();
    await adminAuth.updateUser(userId, {
      password: password
    });
    console.log(`[${auditId}] Firebase Auth atualizado.`);

    // Invalidação de todos os códigos do usuário
    const batch = writeBatch(db);
    const allCodesQ = query(collection(db, "password_reset_codes"), where("userId", "==", userId), where("used", "==", false));
    const allCodesSnap = await getDocs(allCodesQ);
    
    allCodesSnap.forEach(d => {
      batch.update(d.ref, { 
        used: true, 
        usedAt: serverTimestamp(),
        usedByRequestId: requestId 
      });
    });

    await batch.commit();
    console.log(`[${auditId}] Códigos invalidados e processo concluído.`);

    return { success: true };
  } catch (error: any) {
    console.error(`[${auditId}] Erro final:`, error.message);
    return { success: false, error: `Falha ao atualizar senha: ${error.message}` };
  }
}