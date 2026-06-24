import { 
  Beer, 
  Ghost, 
  Flame, 
  Gift, 
  Sparkles, 
  Music
} from "lucide-react";

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
  themeColor: string; // Tailwind class
  accentColor: string; // Tailwind class for text/borders
  icon: any;
}

export const THEMATIC_PAGES_CONFIG: Record<string, ThematicConfig> = {
  oktoberfest: {
    slug: "oktoberfest",
    title: "Oktoberfest: encontre festas, eventos e celebrações cervejeiras",
    description: "Descubra festas de Oktoberfest, eventos temáticos, celebrações alemãs, festivais de cerveja, música e gastronomia em um só lugar.",
    intro: "Procurando o melhor da cultura alemã? Explore a agenda completa de Oktoberfest e festivais de cerveja.",
    tags: ["oktober", "oktoberfest", "cerveja", "chopp"],
    heroBg: "https://picsum.photos/seed/oktoberfest/1920/1080",
    themeColor: "bg-[#78350f]",
    accentColor: "text-[#78350f]",
    icon: Beer,
  },
  halloween: {
    slug: "halloween",
    title: "Halloween: festas, rolês temáticos e eventos de Dia das Bruxas",
    description: "Encontre festas de Halloween, eventos temáticos, fantasias, baladas, rolês de terror e celebrações de Dia das Bruxas.",
    intro: "Doces ou travessuras? Prepare sua fantasia e encontre os eventos mais assustadores da temporada.",
    tags: ["halloween", "diadasbruxas", "dia-das-bruxas", "dia das bruxas"],
    heroBg: "https://picsum.photos/seed/halloween/1920/1080",
    themeColor: "bg-[#4c1d95]",
    accentColor: "text-[#4c1d95]",
    icon: Ghost,
  },
  "semana-farroupilha": {
    slug: "semana-farroupilha",
    title: "Semana Farroupilha: eventos gaúchos, CTGs e celebrações tradicionalistas",
    description: "Descubra eventos da Semana Farroupilha, fandangos, programações em CTGs, celebrações tradicionalistas, música gaúcha e experiências culturais.",
    intro: "Celebre o orgulho gaúcho! Encontre a programação completa de CTGs e eventos tradicionalistas.",
    tags: ["ctg", "semanafarroupilha", "semana-farroupilha", "semana farroupilha"],
    heroBg: "https://picsum.photos/seed/gaucho/1920/1080",
    themeColor: "bg-[#166534]",
    accentColor: "text-[#166534]",
    icon: Flame,
  },
  natal: {
    slug: "natal",
    title: "Natal: eventos natalinos, feiras, shows e celebrações",
    description: "Encontre eventos de Natal, feiras natalinas, shows, programações em família, apresentações especiais e experiências temáticas.",
    intro: "A magia do Natal está no ar. Descubra feiras, corais e eventos especiais para toda a família.",
    tags: ["natal", "natalino", "papai-noel", "papainoel"],
    heroBg: "https://picsum.photos/seed/christmas/1920/1080",
    themeColor: "bg-[#991b1b]",
    accentColor: "text-[#991b1b]",
    icon: Gift,
  },
  "ano-novo": {
    slug: "ano-novo",
    title: "Ano Novo: festas de Réveillon, virada e eventos para celebrar",
    description: "Descubra festas de Ano Novo, Réveillon, eventos de virada, celebrações, shows e experiências para começar o ano.",
    intro: "Comece o ano com o pé direito. Encontre as melhores festas de virada e Réveillon.",
    tags: ["anonovo", "ano novo", "ano-novo", "reveillon", "réveillon", "virada", "viradadoano", "virada-do-ano"],
    heroBg: "https://picsum.photos/seed/newyear/1920/1080",
    themeColor: "bg-[#1e293b]",
    accentColor: "text-[#1e293b]",
    icon: Sparkles,
  },
  carnaval: {
    slug: "carnaval",
    title: "Carnaval: blocos de rua, festas e eventos carnavalescos",
    description: "Encontre blocos de rua, festas de Carnaval, desfiles, ensaios, eventos temáticos e rolês carnavalescos.",
    intro: "Abram alas! Encontre os blocos de rua mais animados e a programação completa de Carnaval.",
    tags: ["carnaval", "bloco", "blocos", "blocoderua", "bloco-de-rua", "bloco de rua"],
    heroBg: "https://picsum.photos/seed/carnival/1920/1080",
    themeColor: "bg-[#e11d48]",
    accentColor: "text-[#e11d48]",
    icon: Music,
  }
};