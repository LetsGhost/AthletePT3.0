import { useEffect, useState } from "react";

/** Liefert `value` erst, wenn er sich `delay` ms lang nicht geändert hat (z. B. für Suchfelder). */
export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
