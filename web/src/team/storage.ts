import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook generico per stato persistente in localStorage, nello stesso stile
 * del progetto (vedi AppStateContext per `rv-custom-configs` e I18nContext
 * per `rv-lang`). Tutte le chiavi del modulo Squadra usano il prefisso `rv-`.
 *
 * - Tenta il parse sicuro: se lo storage è corrotuto o illeggibile (modalità
 *   privata, ecc.) cade silenziosamente sul default.
 * - Scrive ad ogni cambiamento, ma solo se il valore è effettivamente
 *   cambiato (JSON stringificato), per evitare loop inutili.
 * - Esporta `reset` per ripristinare il default (usato dal pulsante "reset"
 *   delle regole).
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  serialize: (value: T) => string = JSON.stringify,
  deserialize: (raw: string) => T = JSON.parse,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return defaultValue;
      return deserialize(raw);
    } catch {
      return defaultValue;
    }
  });

  // useRef per confrontare senza re-render extra: tiene l'ultima stringa
  // serializzata scritta, così non scriviamo due volte lo stesso contenuto.
  const lastWrittenRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const serialized = serialize(value);
      if (serialized === lastWrittenRef.current) return;
      lastWrittenRef.current = serialized;
      localStorage.setItem(key, serialized);
    } catch {
      // storage pieno o non disponibile: lo stato resta solo in memoria.
    }
  }, [key, value, serialize]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  }, []);

  const reset = useCallback(() => {
    setValue(defaultValue);
    // Forza anche la scrittura, ignorando il confronto con lastWritten.
    lastWrittenRef.current = null;
  }, [defaultValue]);

  return [value, set, reset];
}
