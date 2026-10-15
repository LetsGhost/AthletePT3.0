import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Verbindet Klassen und löst Tailwind-Konflikte auf (spätere Klasse gewinnt). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
