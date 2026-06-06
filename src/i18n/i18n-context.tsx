'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

/**
 * Detecta o idioma baseado na prioridade:
 * 1. Escolha salva no LocalStorage
 * 2. Idioma do Navegador (mapeado para pt-BR ou en-US)
 * 3. Fallback: pt-BR
 */
function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'pt-BR';
  
  const saved = localStorage.getItem('viby_lang') as Language;
  if (saved === 'pt-BR' || saved === 'en-US') return saved;
  
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('pt')) return 'pt-BR';
  if (browserLang.startsWith('en')) return 'en-US';
  
  return 'pt-BR';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('pt-BR');
  const [isMounted, setIsMounted] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user, profile } = useUser(auth);

  useEffect(() => {
    const initialLang = detectInitialLanguage();
    setLanguageState(initialLang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = initialLang.split('-')[0];
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && profile?.language && profile.language !== language) {
      const profileLang = profile.language as Language;
      setLanguageState(profileLang);
      localStorage.setItem('viby_lang', profileLang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = profileLang.split('-')[0];
      }
    }
  }, [profile?.language, isMounted, language]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('viby_lang', lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang.split('-')[0];
    }
    
    if (db && user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          language: lang,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("[I18n] Falha ao sincronizar preferência de idioma.");
      }
    }
  }, [db, user]);

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
      <div style={{ visibility: isMounted ? 'visible' : 'hidden', display: 'contents' }}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
};
