import { useEffect, useRef } from 'preact/hooks';

/**
 * Guarda el borrador de un formulario poco después de cada cambio (y al cerrarlo, si quedaba algo pendiente),
 * para que no se pierda lo escrito. No guarda el estado inicial: solo lo que el usuario cambia.
 */
export function useDraftSaver<T>(draft: T, onDraft?: (d: T) => void, delayMs = 1200) {
  const first = useRef(true);
  const latest = useRef(draft);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef(false);
  const save = useRef(onDraft);
  save.current = onDraft;

  useEffect(() => {
    latest.current = draft;
    if (first.current) {
      first.current = false;
      return;
    }
    if (!save.current) return;
    pending.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pending.current = false;
      save.current?.(latest.current);
    }, delayMs);
  }, [draft]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pending.current) save.current?.(latest.current);
    },
    [],
  );
}
