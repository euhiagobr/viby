
'use server';

import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { decryptCPF, encryptCPF, hashCPF as hashCPFLegacy, maskCPF } from '@/lib/crypto-utils';
import { validateCPF, validateUsername, isReservedUsername } from '@/lib/utils';
import { recordAuditLog } from './audit';
import { hashDocument, maskDocument, normalizeDocument, isValidDocumentFormat, isSupportedCountry, isSupportedDocumentType, hashCPF } from '@/lib/identity-utils';
import { getInitialIdentityFields } from '@/lib/identity-service';

/**
 * Gera um código de afiliado único e garante que não exista na coleção principal.
 */
async function generateUniqueAffiliateCode(db: admin.firestore.Firestore): Promise<string> {
  let code = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const doc = await db.collection("affiliateCodes").doc(code).get();
    if (!doc.exists) {
      isUnique = true;
    }
    attempts++;
  }
  return code;
}

/**
 * Normaliza CPF removendo pontuação
 * @param cpf CPF com ou sem formatação
 * @returns CPF com 11 dígitos, sem formatação
 */
function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Verifica se um CPF já existe no banco
 * Busca em AMBAS as coleções (users legacy + user_identities)
 * @param db Instância do Firestore
 * @param cpf CPF normalizado (11 dígitos)
 * @returns true se CPF já existe
 */
async function cpfExists(db: admin.firestore.Firestore, cpf: string): Promise<boolean> {
  const cleanCPF = normalizeCPF(cpf);
  const cpfHashNew = hashCPF(cleanCPF);
  const cpfHashLegacy = hashCPFLegacy(cleanCPF);

  // Verificar em /users (legacy) com hash NOVO
  const usersQueryNew = db.collection("users").where("cpfHash", "==", cpfHashNew).limit(1);
  const usersSnapNew = await usersQueryNew.get();
  if (!usersSnapNew.empty) {
    return true;
  }

  // Verificar em /users (legacy) com hash LEGADO (compatibilidade com contas antigas)
  const usersQueryLegacy = db.collection("users").where("cpfHash", "==", cpfHashLegacy).limit(1);
  const usersSnapLegacy = await usersQueryLegacy.get();
  if (!usersSnapLegacy.empty) {
    return true;
  }

  // Verificar em /user_identities (BR:CPF modern)
  const identityHash = hashDocument(cleanCPF, "BR", "CPF");
  const identitiesQuery = db.collection("user_identities").where("documentHash", "==", identityHash).limit(1);
  const identitiesSnap = await identitiesQuery.get();

  return !identitiesSnap.empty;
}

/**
 * Verifica se um documento internacional já existe
 */
async function documentExists(
  db: admin.firestore.Firestore,
  documentValue: string,
  country: string,
  documentType: string
): Promise<boolean> {
  const docHash = hashDocument(documentValue, country, documentType);

  const query = db.collection("user_identities").where("documentHash", "==", docHash).limit(1);
  const snap = await query.get();

  return !snap.empty;
}

/**
 * Cria um novo usuário com validação FORTE de CPF duplicado
 *
 * IMPORTANTE:
 * - Valida duplicação de CPF ANTES de criar no Firebase Auth
 * - Se houver duplicação, retorna erro SEM criar usuário
 * - Usa Admin SDK para criar no Auth + Firestore (atomicidade)
 *
 * Fluxo seguro:
 * 1. Validar dados
 * 2. Validar duplicação (CPF/email/username/documento)
 * 3. Criar no Firebase Auth
 * 4. Salvar no Firestore (transação)
 * 5. Se erro em qualquer passo, tudo é revertido
 */
export async function createUserWithValidation(params: {
  email: string;
  password: string;
  name: string;
  username: string;
  gender: string;
  cpf?: string;
  referredBy?: string;
  // Fase 3: Suporte a documentos internacionais
  country?: string;
  documentType?: string;
  documentValue?: string;
}) {
  try {
    const { email, password, name, username, cpf, gender, referredBy, country, documentType, documentValue } = params;

    const db = getAdminDb();
    const authAdmin = admin.auth();

    // ========================================================================
    // VALIDAÇÃO: CPF OU DOCUMENTO INTERNACIONAL
    // ========================================================================

    let isCPFSignup = false;
    let isInternationalSignup = false;

    if (cpf) {
      // CPF (Brasil)
      const cleanCPF = normalizeCPF(cpf);
      if (!validateCPF(cleanCPF)) {
        return { success: false, error: "CPF informado é inválido." };
      }
      isCPFSignup = true;
    } else if (country && documentType && documentValue) {
      // Documento Internacional
      if (!isSupportedCountry(country)) {
        return { success: false, error: "País não suportado." };
      }
      if (!isSupportedDocumentType(country, documentType)) {
        return { success: false, error: "Tipo de documento não suportado." };
      }
      if (!isValidDocumentFormat(documentValue, country, documentType)) {
        return { success: false, error: "Formato de documento inválido." };
      }
      isInternationalSignup = true;
    } else {
      return { success: false, error: "Informe CPF ou documento internacional." };
    }

    // Validação de username
    const normalizedUsername = username.toLowerCase().trim();
    if (!validateUsername(normalizedUsername)) {
      // Verificar se é um nome reservado para dar mensagem mais específica
      if (isReservedUsername(normalizedUsername)) {
        return {
          success: false,
          error: "Este @username é reservado pelo sistema e não pode ser usado."
        };
      }
      return {
        success: false,
        error: "Username inválido (mínimo 5 caracteres, apenas letras minúsculas, números, ponto e underline)."
      };
    }

    // ========================================================================
    // VALIDAÇÕES CRÍTICAS ANTES DE CRIAR USUÁRIO
    // ========================================================================

    // 1. VALIDAÇÃO CRÍTICA: CPF já existe?
    if (isCPFSignup && cpf) {
      const cleanCPF = normalizeCPF(cpf);
      const cpfAlreadyExists = await cpfExists(db, cleanCPF);
      if (cpfAlreadyExists) {
        return {
          success: false,
          error: "Este CPF já está cadastrado. Faça login ou recupere sua senha.",
          code: "CPF_ALREADY_EXISTS"
        };
      }
    }

    // 2. VALIDAÇÃO CRÍTICA: Documento já existe?
    if (isInternationalSignup && documentValue) {
      const docAlreadyExists = await documentExists(db, documentValue, country!, documentType!);
      if (docAlreadyExists) {
        return {
          success: false,
          error: "Este documento já está associado a outra conta.",
          code: "DOCUMENT_ALREADY_EXISTS"
        };
      }
    }

    // 3. VALIDAÇÃO CRÍTICA: Email já existe?
    const normalizedEmail = email.toLowerCase().trim();
    try {
      await authAdmin.getUserByEmail(normalizedEmail);
      // Se chegou aqui, email já existe
      return {
        success: false,
        error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha.",
        code: "EMAIL_ALREADY_EXISTS"
      };
    } catch (error: any) {
      // auth/user-not-found é esperado (usuário não existe)
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // 4. VALIDAÇÃO CRÍTICA: Username já existe?
    const usernameRef = db.collection("usernames").doc(normalizedUsername);
    const usernameSnap = await usernameRef.get();
    if (usernameSnap.exists) {
      return {
        success: false,
        error: "Este @username já está sendo usado.",
        code: "USERNAME_ALREADY_EXISTS"
      };
    }

    // ========================================================================
    // TODAS AS VALIDAÇÕES PASSARAM - CRIAR USUÁRIO
    // ========================================================================

    // Criar usuário no Firebase Auth (Admin SDK)
    let userRecord;
    try {
      userRecord = await authAdmin.createUser({
        email: normalizedEmail,
        password,
        displayName: name
      });
    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        return {
          success: false,
          error: "Este e-mail já está cadastrado.",
          code: "EMAIL_ALREADY_EXISTS"
        };
      }
      if (error.code === "auth/weak-password") {
        return {
          success: false,
          error: "A senha deve ter no mínimo 6 caracteres.",
          code: "WEAK_PASSWORD"
        };
      }
      throw error;
    }

    const uid = userRecord.uid;

    // Agora chamar finalizeUserRegistration com o UID já criado
    const finalizeParams: any = {
      uid,
      email: normalizedEmail,
      name,
      username: normalizedUsername,
      gender,
      referredBy: referredBy || undefined
    };

    if (isCPFSignup && cpf) {
      finalizeParams.cpf = cpf;
    } else if (isInternationalSignup) {
      finalizeParams.country = country;
      finalizeParams.documentType = documentType;
      finalizeParams.documentValue = documentValue;
    }

    const finalizeResult = await finalizeUserRegistration(finalizeParams);

    return {
      success: true,
      uid,
      message: "Usuário criado com sucesso."
    };
  } catch (error: any) {
    console.error("[createUserWithValidation] Erro:", error);

    return {
      success: false,
      error: error.message || "Erro ao processar cadastro. Tente novamente."
    };
  }
}

/**
 * Finaliza o registro do usuário de forma atômica no Firestore.
export async function finalizeUserRegistration(params: {
  uid: string;
  email: string;
  name: string;
  username: string;
  cpf?: string;
  gender: string;
  referredBy?: string;
  // Phase 3: Novos campos para identidades internacionais
  country?: string;
  documentType?: string;
  documentValue?: string;
}) {
  const db = getAdminDb();
  const { uid, email, name, username, cpf, gender, referredBy, country, documentType, documentValue } = params;
  
  // Validação: é CPF ou documento internacional?
  let isCPFSignup = false;
  let isInternationalSignup = false;

  if (cpf) {
    // CPF (Phase 1/2)
    const cleanCPF = cpf.replace(/\D/g, "");
    if (!validateCPF(cleanCPF)) throw new Error("CPF informado é inválido.");
    isCPFSignup = true;
  } else if (country && documentType && documentValue) {
    // Documento internacional (Phase 3)
    if (!isSupportedCountry(country)) throw new Error("País não suportado.");
    if (!isSupportedDocumentType(country, documentType)) throw new Error("Tipo de documento não suportado.");
    if (!isValidDocumentFormat(documentValue, country, documentType)) throw new Error("Formato de documento inválido.");
    isInternationalSignup = true;
  } else {
    throw new Error("Informe CPF ou documento internacional.");
  }

  const normalizedUsername = username.toLowerCase().trim();
  if (!validateUsername(normalizedUsername)) {
    if (isReservedUsername(normalizedUsername)) {
      throw new Error("Este @username é reservado pelo sistema e não pode ser usado.");
    }
    throw new Error("Username inválido (mínimo 5 caracteres).");
  }

  try {
    const newAffiliateCode = await generateUniqueAffiliateCode(db);

    return await db.runTransaction(async (transaction) => {
      // 1. Verificar unicidade do Username
      const usernameRef = db.collection("usernames").doc(normalizedUsername);
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists && usernameSnap.data()?.uid !== uid) {
        throw new Error("Este @username já está sendo usado.");
      }

      // 2. Preparar dados comuns
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 365);

      const userRef = db.collection("users").doc(uid);

      // FLUXO CPF (Phase 1/2)
      if (isCPFSignup) {
        const cleanCPF = cpf!.replace(/\D/g, "");
        const cpfEncrypted = encryptCPF(cleanCPF);
        const cpfHashNew = hashCPF(cleanCPF);
        const cpfHashLegacy = hashCPFLegacy(cleanCPF);
        const cpfMasked = maskCPF(cleanCPF);

        // Verificar unicidade do CPF via Hash (novo e legado)
        const duplicateQueryNew = db.collection("users").where("cpfHash", "==", cpfHashNew).limit(1);
        const duplicateSnapNew = await transaction.get(duplicateQueryNew);
        if (!duplicateSnapNew.empty && duplicateSnapNew.docs[0].id !== uid) {
          throw new Error("Este CPF já possui uma conta vinculada.");
        }

        const duplicateQueryLegacy = db.collection("users").where("cpfHash", "==", cpfHashLegacy).limit(1);
        const duplicateSnapLegacy = await transaction.get(duplicateQueryLegacy);
        if (!duplicateSnapLegacy.empty && duplicateSnapLegacy.docs[0].id !== uid) {
          throw new Error("Este CPF já possui uma conta vinculada.");
        }

        // Verificar unicidade de identidade BR:CPF
        const cpfDocHash = hashDocument(cleanCPF, 'BR', 'CPF');
        const duplicateIdentityQuery = db
          .collection("user_identities")
          .where("documentHash", "==", cpfDocHash)
          .limit(1);
        const duplicateIdentitySnap = await transaction.get(duplicateIdentityQuery);
        if (!duplicateIdentitySnap.empty) {
          throw new Error("Este CPF já possui uma identidade registrada.");
        }

        // Criar /users com CPF
        const userData = {
          uid,
          email: email.toLowerCase().trim(),
          name,
          username: normalizedUsername,
          gender,
          cpfHash: cpfHashNew,
          cpfMasked,
          cpf: cpfMasked,
          affiliateCode: newAffiliateCode,
          referredBy: referredBy || null,
          affiliateExpireAt: referredBy ? admin.firestore.Timestamp.fromDate(expireAt) : null,
          profileComplete: true,
          needsCPFUpdate: false,
          plan: "free",
          role: "user",
          status: "Ativo",
          walletBalance: 0,
          totalXp: 50,
          level: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...getInitialIdentityFields(),
        };
        transaction.set(userRef, userData, { merge: true });

        // Salvar dados sensíveis
        const sensitiveRef = userRef.collection("private").doc("sensitive");
        transaction.set(sensitiveRef, {
          cpfEncrypted,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Criar identidade BR:CPF
        const cpfMaskedForIdentity = maskDocument(cleanCPF, 'BR', 'CPF');
        const identityRef = db.collection("user_identities").doc();
        transaction.set(identityRef, {
          userId: uid,
          country: 'BR',
          documentType: 'CPF',
          documentHash: cpfDocHash,
          documentMasked: cpfMaskedForIdentity,
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          expiresAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedAt: null,
        });
      }
      // FLUXO DOCUMENTO INTERNACIONAL (Phase 3)
      else if (isInternationalSignup) {
        const normalizedDoc = normalizeDocument(documentValue!, country!, documentType!);
        const docHash = hashDocument(documentValue!, country!, documentType!);
        const docMasked = maskDocument(documentValue!, country!, documentType!);

        // Verificar unicidade de identidade
        const duplicateIdentityQuery = db
          .collection("user_identities")
          .where("documentHash", "==", docHash)
          .limit(1);
        const duplicateIdentitySnap = await transaction.get(duplicateIdentityQuery);
        if (!duplicateIdentitySnap.empty) {
          throw new Error("Este documento já está associado a outra conta.");
        }

        // Criar /users sem CPF
        const userData = {
          uid,
          email: email.toLowerCase().trim(),
          name,
          username: normalizedUsername,
          gender,
          country: country,
          affiliateCode: newAffiliateCode,
          referredBy: referredBy || null,
          affiliateExpireAt: referredBy ? admin.firestore.Timestamp.fromDate(expireAt) : null,
          profileComplete: true,
          plan: "free",
          role: "user",
          status: "Ativo",
          walletBalance: 0,
          totalXp: 50,
          level: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...getInitialIdentityFields(),
        };
        transaction.set(userRef, userData, { merge: true });

        // Criar identidade internacional
        const identityRef = db.collection("user_identities").doc();
        transaction.set(identityRef, {
          userId: uid,
          country: country,
          documentType: documentType,
          documentHash: docHash,
          documentMasked: docMasked,
          verificationStatus: 'pending',
          verificationLevel: 'self',
          isActive: false,
          expiresAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedAt: null,
        });
      }

      // Estruturas comuns (Phase 1/2/3)
      // 3. Criar registro oficial na coleção de Afiliados
      const affCodeRef = db.collection("affiliateCodes").doc(newAffiliateCode);
      transaction.set(affCodeRef, {
        code: newAffiliateCode,
        userId: uid,
        userName: name,
        active: true,
        commissionType: "fixed",
        commissionValue: 0.50,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Inicializar estatísticas de afiliado
      const statsRef = db.collection("affiliate_stats").doc(uid);
      transaction.set(statsRef, {
        userId: uid,
        userName: name,
        totalTicketsSold: 0,
        totalUsersReferred: 0,
        totalOrgsLinked: 0,
        currentLevel: 0,
        balances: {
          BRL: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
          USD: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 },
          EUR: { available: 0, pending: 0, totalEarned: 0, totalWithdrawn: 0 }
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Atualizar Índice de Username
      transaction.set(usernameRef, {
        uid,
        type: 'user',
        email: email.toLowerCase().trim(),
        username: normalizedUsername
      });

      return { success: true };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Atualiza o CPF de um usuário seguindo o novo padrão.
 */
export async function updateUserCPF(userId: string, cpf: string) {
  try {
    const db = getAdminDb();
    const cleanCPF = cpf.replace(/\D/g, "");
    
    if (!validateCPF(cleanCPF)) throw new Error("CPF informado é inválido.");

    const cpfEncrypted = encryptCPF(cleanCPF);
    const cpfHash = hashCPF(cleanCPF);
    const cpfMasked = maskCPF(cleanCPF);

    await db.runTransaction(async (transaction) => {
      transaction.set(db.collection("users").doc(userId), { 
        cpfHash,
        cpfMasked,
        cpf: cpfMasked, 
        needsCPFUpdate: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });

      const sensitiveRef = db.collection("users").doc(userId).collection("private").doc("sensitive");
      transaction.set(sensitiveRef, {
        cpfEncrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getUserCPF(userId: string, requestingUid: string) {
  try {
    const db = getAdminDb();
    if (requestingUid !== userId) {
      const requesterSnap = await db.collection("users").doc(requestingUid).get();
      if (!requesterSnap.exists || requesterSnap.data()?.role !== 'admin') {
        throw new Error("Acesso negado.");
      }
    }

    const sensitiveRef = db.collection("users").doc(userId).collection("private").doc("sensitive");
    const sensitiveDoc = await sensitiveRef.get();
    
    if (sensitiveDoc.exists) {
      const encryptedCpf = sensitiveDoc.data()?.cpfEncrypted;
      return { success: true, cpf: decryptCPF(encryptedCpf) };
    }
    return { success: false, error: "Dados não encontrados." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
