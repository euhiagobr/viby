import { PlaceHolderImages } from "./placeholder-images";

/**
 * @fileOverview Configurações mestre para as páginas temáticas da Viby.
 * Define metadados, tags de filtro e identidade visual.
 */

export interface ThematicConfig {
  slug: string;
  title: string;
  description: string;
  intro: string;
  tags: string[];
  heroBg: string;
  heroHint: string;
  themeColor: string; // Tailwind class
  accentColor: string; // Tailwind class for text/borders
  iconName: 'beer' | 'ghost' | 'flame' | 'gift' | 'sparkles' | 'music';
}

const getImg = (id: string) => PlaceHolderImages.find(img => img.id === id);

export const THEMATIC_PAGES_CONFIG: Record<string, ThematicConfig> = {
  oktoberfest: {
    slug: "oktoberfest",
    title: "OKTOBERFEST 2026",
    description: "Descubra festas de Oktoberfest, eventos temáticos, celebrações alemãs, festivais de cerveja, música e gastronomia em um só lugar.",
    intro: "Encontre festas, bailes, festivais cervejeiros e celebrações alemãs em todo o Brasil.",
    tags: ["oktober", "oktoberfest", "cerveja", "chopp", "chope", "alemã", "alemao", "germânica"],
    heroBg: getImg('oktoberfest-bg')?.imageUrl || "",
    heroHint: "beer festival crowd celebration tent",
    themeColor: "bg-[#0057B8]", // Azul Bávaro
    accentColor: "text-[#facc15]", // Dourado Cerveja
    iconName: 'beer',
  },
  halloween: {
    slug: "halloween",
    title: "Halloween: festas, rolês temáticos e eventos de Dia das Bruxas",
    description: "Encontre festas de Halloween, eventos temáticos, fantasias, baladas, rolês de terror e celebrações de Dia das Bruxas.",
    intro: "Doces ou travessuras? Prepare sua fantasia e encontre os eventos mais assustadores da temporada.",
    tags: ["halloween", "diadasbruxas", "dia-das-bruxas", "dia das bruxas"],
    heroBg: getImg('halloween-bg')?.imageUrl || "",
    heroHint: "halloween party",
    themeColor: "bg-[#4c1d95]",
    accentColor: "text-[#f97316]", // Laranja abóbora
    iconName: 'ghost',
  },
  "semana-farroupilha": {
    slug: "semana-farroupilha",
    title: "Semana Farroupilha: eventos gaúchos, CTGs e celebrações tradicionalistas",
    description: "Descubra eventos da Semana Farroupilha, fandangos, programações em CTGs, celebrações tradicionalistas, música gaúcha e experiências culturais.",
    intro: "Celebre o orgulho gaúcho! Encontre a programação completa de CTGs e eventos tradicionalistas.",
    tags: ["ctg", "semanafarroupilha", "semana-farroupilha", "semana farroupilha"],
    heroBg: getImg('semana-farroupilha-bg')?.imageUrl || "",
    heroHint: "gaucho landscape",
    themeColor: "bg-[#166534]",
    accentColor: "text-[#991b1b]", // Vermelho Farroupilha
    iconName: 'flame',
  },
  natal: {
    slug: "natal",
    title: "Natal: eventos natalinos, feiras, shows e celebrações",
    description: "Encontre eventos de Natal, feiras natalinas, shows, programações em família, apresentações especiais e experiências temáticas.",
    intro: "A magia do Natal está no ar. Descubra feiras, corais e eventos especiais para toda a família.",
    tags: ["natal", "natalino", "papai-noel", "papainoel"],
    heroBg: getImg('natal-bg')?.imageUrl || "",
    heroHint: "christmas lights",
    themeColor: "bg-[#991b1b]",
    accentColor: "text-[#166534]", // Verde Natal
    iconName: 'gift',
  },
  "ano-novo": {
    slug: "ano-novo",
    title: "Ano Novo: festas de Réveillon, virada e eventos para celebrar",
    description: "Descubra festas de Ano Novo, Réveillon, eventos de virada, celebrações, shows e experiências para começar o ano.",
    intro: "Comece o ano com o pé direito. Encontre as melhores festas de virada e Réveillon.",
    tags: ["anonovo", "ano novo", "ano-novo", "reveillon", "réveillon", "virada", "viradadoano", "virada-do-ano"],
    heroBg: getImg('ano-novo-bg')?.imageUrl || "",
    heroHint: "fireworks party",
    themeColor: "bg-[#0f172a]",
    accentColor: "text-[#facc15]", // Dourado virada
    iconName: 'sparkles',
  },
  carnaval: {
    slug: "carnaval",
    title: "Carnaval: blocos de rua, festas e eventos carnavalescos",
    description: "Encontre blocos de rua, festas de Carnaval, desfiles, ensaios, eventos temáticos e rolês carnavalescos.",
    intro: "Abram alas! Encontre os blocos de rua mais animados e a programação completa de Carnaval.",
    tags: ["carnaval", "bloco", "blocos", "blocoderua", "bloco-de-rua", "bloco de rua"],
    heroBg: getImg('carnaval-bg')?.imageUrl || "",
    heroHint: "carnival parade",
    themeColor: "bg-[#e11d48]",
    accentColor: "text-[#facc15]", // Amarelo vibrante
    iconName: 'music',
  }
};