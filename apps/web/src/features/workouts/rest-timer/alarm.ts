import { readRestSettings } from "./rest-settings";

let context: AudioContext | null = null;

/**
 * Browser spielen Ton erst nach einer Nutzeraktion ab. Deshalb beim Abhaken eines Satzes
 * aufrufen, damit der Piepton am Pausenende später erlaubt ist.
 */
export function unlockAlarm() {
  if (typeof AudioContext === "undefined") return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

/** Drei kurze Pieptöne und, wo möglich (Android), Vibration, je nach Einstellung. */
export function playAlarm() {
  const { sound, vibrate } = readRestSettings();
  if (vibrate && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  if (!sound || !context || context.state !== "running") return;
  const start = context.currentTime;
  for (let i = 0; i < 3; i++) {
    const at = start + i * 0.25;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.16);
  }
}
