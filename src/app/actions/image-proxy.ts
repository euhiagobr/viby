'use server';

/**
 * @fileOverview Server Action para atuar como proxy de imagens.
 * Resolve erros de CORS ao buscar ativos do Firebase Storage para renderização em Canvas/PNG.
 */

export async function fetchImageAsBase64(url: string): Promise<{ success: boolean; data?: string; error?: string }> {
  if (!url) return { success: false, error: "URL ausente" };
  
  try {
    // Remove parâmetros de cache anteriores para evitar conflitos de URL
    const cleanUrl = url.split('&v_cache=')[0].split('?v_cache=')[0];
    
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
