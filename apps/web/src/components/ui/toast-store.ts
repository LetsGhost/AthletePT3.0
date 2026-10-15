import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  variant: "success" | "error";
}

export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let nextId = 1;

export function dismissToast(id: number) {
  useToasts.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
}

/** Kurze Rückmeldung nach einer Aktion, z. B. „Gespeichert“. */
export function toast(message: string, variant: Toast["variant"] = "success") {
  const id = nextId++;
  useToasts.setState((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
  setTimeout(() => dismissToast(id), variant === "error" ? 8000 : 4000);
}
