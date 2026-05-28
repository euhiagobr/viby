'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./apps";

/**
 * @fileOverview Gerenciamento da instância do Firestore para o banco de dados 'eventosviby'.
 * Implementa um Singleton robusto para evitar o erro 'INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)'
 * que ocorre quando múltiplas instâncias tentam acessar o mesmo banco simultaneamente no Next.js.
 */

const DATABASE_NAME = "eventosviby";

function getDbInstance(): Firestore {
  // Verificação de ambiente de execução (apenas no navegador)
  if (typeof window !== "undefined") {
    // @ts-ignore - Usamos globalThis para persistir a instância entre hot-reloads e re-renders no desenvolvimento
    if (!globalThis.__VIBY_FIRESTORE_INSTANCE__) {
      try {
        // @ts-ignore
        globalThis.__VIBY_FIRESTORE_INSTANCE__ = getFirestore(app, DATABASE_NAME);
      } catch (e) {
        console.error("[Firestore] Erro ao inicializar instância:", e);
        // Fallback para getFirestore padrão se a inicialização nomeada falhar
        return getFirestore(app, DATABASE_NAME);
      }
    }
    // @ts-ignore
    return globalThis.__VIBY_FIRESTORE_INSTANCE__;
  }
  
  // No servidor (SSR/Pre-rendering), criamos uma instância por ciclo de vida da requisição
  return getFirestore(app, DATABASE_NAME);
}

/**
 * Instância exportada do Firestore conectada ao banco 'eventosviby'.
 * SEMPRE utilize esta instância para queries neste banco para evitar erros de asserção interna.
 */
export const db = getDbInstance();
