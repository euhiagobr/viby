import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  console.log('[CITY COVER API] START');
  try {
    const input = await req.json();
    console.log('[CITY COVER API] INPUT', input);

    const { city, state, country, topCategories = [] } = input;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY missing");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION,
      project: process.env.OPENAI_PROJECT_ID,
    });

    const categoriesText = topCategories.length > 0 
      ? `Incorporar sutilmente a energia das seguintes categorias populares: ${topCategories.join(", ")}.` 
      : "manter foco geral em turismo e vida urbana.";

    const promptText = `Crie uma imagem fotorealista premium em formato de banner horizontal representando a cidade de ${city}, ${state}, ${country}.

A imagem deve ser usada como capa oficial de uma plataforma de eventos e experiências chamada Viby.

FOCO PRINCIPAL
Representar visualmente o que fazer na cidade através de:
* cultura local
* turismo urbano
* vida noturna (se aplicável)
* eventos e experiências
* arquitetura e pontos icônicos reais da cidade

COMPOSIÇÃO VISUAL
* Estilo fotorealista ultra detalhado
* Iluminação cinematográfica natural (golden hour ou blue hour)
* Profundidade de campo suave
* Atmosfera vibrante e moderna
* Sensação de cidade viva e ativa
* Estética de capa de portal global de eventos e turismo

ELEMENTOS DA CIDADE
Incluir referências visuais reais e reconhecíveis de ${city} quando possível, como:
* skyline
* pontos turísticos
* áreas culturais
* regiões urbanas icônicas
* paisagens naturais próximas

CATEGORIAS DE EVENTOS (INFLUÊNCIA VISUAL)
${categoriesText}

IDENTIDADE VIBY
Integrar de forma extremamente sutil:
* sensação de plataforma moderna de eventos
* lifestyle urbano contemporâneo
* não incluir logos visíveis
* não incluir textos
* não incluir marcas d’água

RESTRIÇÕES ABSOLUTAS
* NÃO adicionar texto
* NÃO adicionar logotipos
* NÃO adicionar QR codes
* NÃO adicionar preços
* NÃO adicionar datas
* NÃO adicionar banners promocionais
* NÃO adicionar elementos políticos
* NÃO adicionar conteúdo ofensivo
* NÃO estilizar como propaganda explícita

FORMATO OBRIGATÓRIO
* 1536x1024 (horizontal)
* estilo editorial premium
* qualidade publicitária global`;

    console.log('[CITY COVER API] OPENAI CALLED');
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptText,
      size: "1536x1024"
    });

    const url = response.data[0]?.url;
    if (!url) throw new Error("No URL returned from OpenAI");

    console.log('[CITY COVER API] SUCCESS');
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[CITY COVER API ERROR]', error);
    return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  }
}
