
'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export type CurrencyCode = 'BRL' | 'USD' | 'EUR';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (amountInBRL: number) => string;
  rates: Record<string, number>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const DEFAULT_CURRENCY: CurrencyCode = 'BRL';

/**
 * Detecta a moeda inicial baseada na prioridade:
 * 1. Escolha salva no LocalStorage
 * 2. Região do Navegador (inferida)
 * 3. Fallback: BRL
 */
function detectInitialCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  
  const saved = localStorage.getItem('viby_currency') as CurrencyCode;
  if (['BRL', 'USD', 'EUR'].includes(saved)) return saved;
  
  // Detecção simples por localidade do navegador
  const locale = navigator.language.toLowerCase();
  if (locale.includes('br')) return 'BRL';
  if (locale.includes('us')) return 'USD';
  if (locale.includes('en')) return 'USD';
  if (locale.includes('eu') || locale.includes('fr') || locale.includes('de') || locale.includes('it') || locale.includes('es')) return 'EUR';
  
  return DEFAULT_CURRENCY;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({ BRL: 1, USD: 0.18, EUR: 0.16 });
  const [loading, setLoading] = useState(true);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user, profile, isInitialized } = useUser(auth);

  // Carregar cotações (Cache em SessionStorage para evitar chamadas excessivas)
  const fetchRates = useCallback(async () => {
    try {
      const cached = sessionStorage.getItem('viby_rates');
      const cachedTime = sessionStorage.getItem('viby_rates_time');
      
      // Cache de 1 hora
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < 3600000) {
        setRates(JSON.parse(cached));
        return;
      }

      // API pública gratuita de câmbio (Open Exchange Rates ou similar)
      const response = await fetch('https://open.er-api.com/v6/latest/BRL');
      const data = await response.json();
      
      if (data && data.rates) {
        const newRates = {
          BRL: 1,
          USD: data.rates.USD,
          EUR: data.rates.EUR
        };
        setRates(newRates);
        sessionStorage.setItem('viby_rates', JSON.stringify(newRates));
        sessionStorage.setItem('viby_rates_time', Date.now().toString());
      }
    } catch (e) {
      console.warn("[Currency] Falha ao atualizar cotações, usando fallback estático.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = detectInitialCurrency();
    setCurrencyState(initial);
    fetchRates();
  }, [fetchRates]);

  // Sincronizar com perfil do usuário logado
  useEffect(() => {
    if (isInitialized && profile?.preferredCurrency && profile.preferredCurrency !== currency) {
      setCurrencyState(profile.preferredCurrency as CurrencyCode);
      localStorage.setItem('viby_currency', profile.preferredCurrency);
    }
  }, [profile?.preferredCurrency, isInitialized, currency]);

  const setCurrency = useCallback(async (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem('viby_currency', code);
    
    if (db && user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredCurrency: code,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("[Currency] Falha ao sincronizar preferência no perfil.");
      }
    }
  }, [db, user]);

  const formatPrice = useCallback((amountInBRL: number): string => {
    const rate = rates[currency] || 1;
    const converted = amountInBRL * rate;

    const formatters: Record<CurrencyCode, Intl.NumberFormat> = {
      BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    };

    const formatter = formatters[currency] || formatters.BRL;
    return formatter.format(converted);
  }, [currency, rates]);

  const value = React.useMemo(() => ({
    currency,
    setCurrency,
    formatPrice,
    rates,
    loading
  }), [currency, setCurrency, formatPrice, rates, loading]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};
