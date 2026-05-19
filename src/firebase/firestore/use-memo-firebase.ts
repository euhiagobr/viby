'use client';

import { useMemo, useRef } from 'react';

/**
 * Hook para estabilizar referências e consultas do Firestore.
 * Garante que a instância da query só mude quando as dependências realmente mudarem.
 */
export function useMemoFirebase<T>(factory: () => T, dependencies: any[]): T {
  const dependenciesRef = useRef(dependencies);
  const valueRef = useRef<T>(null);

  const dependenciesChanged =
    dependencies.length !== dependenciesRef.current.length ||
    dependencies.some((dep, i) => dep !== dependenciesRef.current[i]);

  if (valueRef.current === null || dependenciesChanged) {
    valueRef.current = factory();
    dependenciesRef.current = dependencies;
  }

  return valueRef.current!;
}
