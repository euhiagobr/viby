/**
 * @fileOverview Configuração mestre de termos e padrões proibidos na Viby.
 * Centraliza as regras de moderação para facilitar atualizações sem alteração de código.
 */

export const FORBIDDEN_WORDS = {
  INSULTS: [
    "idiota", "imbecil", "burro", "estupido", "lixo", "merda", "bosta", 
    "pifio", "ridiculo", "vagabundo", "canalha", "pau no cu", "filho da puta"
  ],
  HATE_SPEECH: [
    "racista", "homofobico", "preconceito", "macaco", "viado", "sapatao",
    "traveco", "preto", "nordestino", "sulista", "comunista", "fascista"
  ],
  SPAM: [
    "ganhe dinheiro", "trabalhe em casa", "compre seguidores", "seguidores gratis",
    "renda extra", "clique aqui", "acesse agora", "promocao imperdivel", "vagas abertas"
  ],
  FRAUD: [
    "golpe", "piramide", "urubu do pix", "investimento garantido", "cartao clonado",
    "venda de notas", "hack", "crack", "serial", "licenca gratis"
  ],
  ADULT: [
    "sexo", "porno", "acompanhante", "novinha", "puta", "prostituta", "erotico",
    "safada", "tesao", "gozar", "punheta", "caralho", "buceta"
  ],
  THREATS: [
    "vou te matar", "vou te pegar", "atentado", "bomba", "arma", "tiro", 
    "morra", "assassinato", "agressao", "bater em voce"
  ]
};

export const SENSITIVE_PATTERNS = {
  EMAIL: /\S+@\S+\.\S+/gi,
  PHONE: /(\(?\d{2}\)?\s?\d{4,5}-?\d{4})|(\d{10,11})/g,
  CPF: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
  CNPJ: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
  PIX_KEY: /(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[0-9]{11}|[0-9]{14}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,
  URL: /(https?:\/\/|www\.)\S+/gi,
  SOCIAL_HANDLE: /@[\w.]+/g
};

export const MODERATION_RULES = {
  MIN_TEXT_LENGTH: 80,
  MAX_UPPERCASE_PERCENT: 40, // Bloqueia se mais de 40% for caps
  MAX_EMOJI_COUNT: 5,
  MAX_REPETITION: 3 // aaaaaa -> a
};
