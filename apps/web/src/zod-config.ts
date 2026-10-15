import { z } from "zod";

// Strenge CSP (script-src 'self', ohne eval): zod soll nicht per `new Function` testen, ob eval
// erlaubt ist. Der Browser meldet den Versuch sonst als CSP-Verstoß. zod prüft schon beim Anlegen
// von Schemas, deshalb muss dieses Modul in main.tsx vor allen anderen geladen werden.
z.config({ jitless: true });
