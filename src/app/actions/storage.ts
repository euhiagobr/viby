'use server';

import * as admin from 'firebase-admin';
import { getAdminApp } from '@/lib/firebase/admin';

/**
 * @fileOverview Generic Server Action to upload a file to Firebase Storage.
 */

/**
 * Uploads a file received from a FormData object to Firebase Storage.
 * @param formData The FormData object containing the file.
 * @param pathPrefix The folder/prefix for the file path in the bucket (e.g., 'menu_items/orgId').
 * @param fileName A unique name for the file.
 * @returns An object with the success status and the public URL or an error message.
 */
export async function uploadImageAction(
  formData: FormData, 
  pathPrefix: string, 
  fileName: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, error: 'Nenhum arquivo encontrado no formulário.' };
  }

  try {
    const app = getAdminApp();
    const bucket = admin.storage(app).bucket('vibyeventos.firebasestorage.app');
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length === 0) {
        return { success: false, error: "Arquivo enviado está vazio." };
    }

    // Create a unique path to prevent cache issues and overwrites
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const finalFileName = `${fileName}-${Date.now()}.${fileExtension}`;
    const filePath = `${pathPrefix}/${finalFileName}`;
    const storageFile = bucket.file(filePath);

    // Save the file to the bucket
    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year
      }
    });

    // Make the file publicly accessible
    await storageFile.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return { success: true, publicUrl };

  } catch (e: any) {
    console.error("Error uploading image:", e);
    return { success: false, error: `Falha no servidor ao processar o upload: ${e.message}` };
  }
}
