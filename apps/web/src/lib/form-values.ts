/**
 * Umwandlungen für `register(name, { setValueAs })`: Formularfelder liefern immer Text,
 * die Schemas erwarten Zahlen bzw. „nicht gesetzt“.
 */

/** Leer → undefined, sonst Zahl. Akzeptiert Komma als Dezimaltrenner. Ungültig → NaN (zod meldet den Fehler). */
export const numberInput = {
  setValueAs: (value: unknown) => {
    if (typeof value === "number") return value;
    const text = String(value ?? "").trim();
    return text === "" ? undefined : Number(text.replace(",", "."));
  },
};

/** Leerer Text → undefined (z. B. für optionale Selects und Datumsfelder). */
export const optionalText = {
  setValueAs: (value: unknown) => {
    const text = String(value ?? "").trim();
    return text === "" ? undefined : text;
  },
};
