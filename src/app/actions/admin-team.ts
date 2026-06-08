
'use server';

import { getAdminDb } from '@/lib/firebase/admin';
import { AdminRole, AdminPermission, SystemAdmin } from '@/types/admin';
import { getDefaultPermissionsForRole } from '@/lib/admin/permissions';
import * as admin from 'firebase-admin';

export async function createAdminAction(params: {
  uid: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string;
  cargo: AdminRole;
  executorUid: string;
}) {
  const db = getAdminDb();
  
  try {
    const executorSnap = await db.collection('system_admins').doc(params.executorUid).get();
    if (!executorSnap.exists || executorSnap.data()?.cargo !== 'super_admin') {
      throw new Error("Ação permitida apenas para Super Administradores.");
    }

    const adminRef = db.collection('system_admins').doc(params.uid);
    const existing = await adminRef.get();
    if (existing.exists) throw new Error("Este usuário já é um administrador.");

    const defaultPerms = getDefaultPermissionsForRole(params.cargo);

    const adminData: Partial<SystemAdmin> = {
      uid: params.uid,
      nome: params.nome,
      sobrenome: params.sobrenome,
      email: params.email,
      telefone: params.telefone || "",
      cargo: params.cargo,
      status: 'Ativo',
      permissions: defaultPerms,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: params.executorUid
    };

    await adminRef.set(adminData);
    
    // Sincroniza role no documento de usuário comum também
    await db.collection('users').doc(params.uid).update({ role: 'admin' });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateAdminAction(params: {
  uid: string;
  data: Partial<SystemAdmin>;
  executorUid: string;
}) {
  const db = getAdminDb();
  
  try {
    const executorSnap = await db.collection('system_admins').doc(params.executorUid).get();
    if (!executorSnap.exists || executorSnap.data()?.cargo !== 'super_admin') {
      throw new Error("Apenas Super Admins podem editar a equipe.");
    }

    if (params.uid === params.executorUid) {
      throw new Error("Você não pode editar suas próprias permissões ou cargo.");
    }

    const adminRef = db.collection('system_admins').doc(params.uid);
    await adminRef.update({
      ...params.data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteAdminAction(uid: string, executorUid: string) {
  const db = getAdminDb();
  try {
    const executorSnap = await db.collection('system_admins').doc(executorUid).get();
    if (!executorSnap.exists || executorSnap.data()?.cargo !== 'super_admin') {
      throw new Error("Apenas Super Admins podem remover membros da equipe.");
    }

    if (uid === executorUid) throw new Error("Você não pode remover a si mesmo.");

    await db.collection('system_admins').doc(uid).delete();
    await db.collection('users').doc(uid).update({ role: 'user' });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
