/**
 * JSON-Einträge unter `prefix + id` im localStorage. Speicher voll, gesperrt oder Eintrag kaputt:
 * Lesen liefert `null`, Schreiben und Löschen tun nichts.
 */
export function jsonStore<T>(prefix: string) {
  return {
    read(id: string): T | null {
      try {
        const raw = localStorage.getItem(prefix + id);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    write(id: string, value: T) {
      try {
        localStorage.setItem(prefix + id, JSON.stringify(value));
      } catch {
        // ignorieren
      }
    },
    remove(id: string) {
      try {
        localStorage.removeItem(prefix + id);
      } catch {
        // ignorieren
      }
    },
  };
}
