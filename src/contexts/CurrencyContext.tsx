'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';

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

function detectInitialCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  
  const saved = localStorage.getItem('viby_currency') as CurrencyCode;
  if (['BRL', 'USD', 'EUR'].includes(saved)) return saved;
  
  const locale = navigator.language.toLowerCase();
  if (locale.includes('br')) return 'BRL';
  if (locale.includes('us') || locale.includes('en')) return 'USD';
  if (locale.includes('eu') || ['fr', 'de', 'it', 'es'].some(l => locale.includes(l))) return 'EUR';
  
  return DEFAULT_CURRENCY;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({ BRL: 1, USD: 0.18, EUR: 0.16 });
  const [loading, setLoading] = useState(true);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user, profile, isInitialized } = useUser(auth);

  const fetchAndSyncRates = useCallback(async () => {
    if (!db) return;
    
    try {
      const ratesRef = doc(db, 'settings', 'currency_rates');
      const ratesSnap = await getDoc(ratesRef);
      const today = new Date().toISOString().slice(0, 10);

      if (ratesSnap.exists()) {
        const data = ratesSnap.data();
        if (data.date === today) {
          setRates({ BRL: 1, USD: data.USD, EUR: data.EUR });
          setLoading(false);
          return;
        }
      }

      // Se não existe ou está vencida, busca na API externa
      const response = await fetch('https://open.er-api.com/v6/latest/BRL');
      const apiData = await response.json();
      
      if (apiData && apiData.rates) {
        const newRates = {
          BRL: 1,
          USD: apiData.rates.USD,
          EUR: apiData.rates.EUR,
          date: today,
          provider: 'open.er-api.com',
          lastUpdated: serverTimestamp()
        };

        // Persiste no Firestore para outros usuários aproveitarem o cache
        await setDoc(ratesRef, newRates, { merge: true });
        
        setRates({ BRL: 1, USD: apiData.rates.USD, EUR: apiData.rates.EUR });
      }
    } catch (e) {
      console.warn("[Currency] Erro ao sincronizar cotações. Usando fallback.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    const initial = detectInitialCurrency();
    setCurrencyState(initial);
  }, []);

  useEffect(() => {
    if (isInitialized && db) {
      fetchAndSyncRates();
    }
  }, [isInitialized, db, fetchAndSyncRates]);

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
        console.warn("[Currency] Falha ao sincronizar preferência.");
      }
    }
  }, [db, user]);

  const formatPrice = useCallback((amountInBRL: number): string => {
    const rate = rates[currency] || rates['BRL'] || 1;
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
