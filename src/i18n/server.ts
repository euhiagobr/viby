import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';

const translations = {
  'pt-BR': ptBR,
  'en-US': enUS,
};

export type Language = 'pt-BR' | 'en-US';

export const useTranslation = async (lang: Language = 'pt-BR') => {
  const t = (path: string) => {
    const keys = path.split('.');
    let result: any = translations[lang];
    for (const key of keys) {
      if (result && result[key]) {
        result = result[key];
      } else {
        return path;
      }
    }
    return typeof result === 'string' ? result : path;
  };

  return { t, language: lang };
};
