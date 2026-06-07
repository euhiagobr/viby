'use server';

/**
 * @fileOverview Server Action para atuar como proxy de imagens.
 * Resolve erros de CORS ao buscar ativos do Firebase Storage para renderização em Canvas/PNG.
 * Atualizado para garantir que apenas o buffer da imagem seja retornado.
 */

export async function fetchImageAsBase64(url: string): Promise<{ success: boolean; data?: string; error?: string }> {
  if (!url) return { success: false, error: "URL ausente" };
  
  try {
    // Preserva parâmetros essenciais do Firebase (token e alt=media)
    // Remove apenas parâmetros de cache-busting agressivo que podem quebrar a assinatura da URL
    const cleanUrl = url.replace(/[&?]cache_v=[^&]+/, '').replace(/[&?]v_cache=[^&]+/, '');
    
    const response = await fetch(cleanUrl, {
      cache: 'no-cache',
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar imagem: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    
    // Validação de segurança: se o conteúdo não for imagem, aborta
    if (!contentType.startsWith('image/')) {
      throw new Error("O link fornecido não retornou uma imagem válida.");
    }

    const base64 = buffer.toString('base64');

    return {
      success: true,
      data: `data:${contentType};base64,${base64}`
    };
  } catch (error: any) {
    console.error("[Image Proxy Error]", error.message, url);
    return {
      success: false,
      error: error.message
    };
  }
}
