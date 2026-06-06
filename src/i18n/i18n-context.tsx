'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';

const translations = {
  'pt-BR': ptBR,
  'en-US': enUS,
};

export type Language = 'pt-BR' | 'en-US';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('pt-BR');

  useEffect(() => {
    const saved = localStorage.getItem('viby_lang') as Language;
    if (saved && (saved === 'pt-BR' || saved === 'en-US')) {
      setLanguageState(saved);
      document.documentElement.lang = saved.split('-')[0];
    } else {
      const browserLang = navigator.language;
      if (browserLang.startsWith('en')) {
        setLanguageState('en-US');
        document.documentElement.lang = 'en';
      }
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('viby_lang', lang);
    document.documentElement.lang = lang.split('-')[0];
  }, []);

  const t = useCallback((path: string) => {
    const keys = path.split('.');
    let result: any = translations[language];
    for (const key of keys) {
      if (result && result[key]) {
        result = result[key];
      } else {
        return path;
      }
    }
    return typeof result === 'string' ? result : path;
  }, [language]);

  const value = React.useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
};
