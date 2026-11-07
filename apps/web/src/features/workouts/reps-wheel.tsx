import { useEffect, useEffectEvent, useRef, useState, type ComponentProps } from "react";

import { cn } from "@/lib/cn";

const ROW = 44;
const CENTER_TOP = 88;
const HOLD_MS = 420;
const MAX = 100;

const clamp = (p: number) => Math.max(0, Math.min(MAX, p));

interface Pick {
  /** Position im Rad, während des Ziehens auch zwischen zwei Zahlen. */
  p: number;
  /** Wert beim Öffnen, für Escape. */
  orig: string;
  dragging: boolean;
}

interface RepsWheelFieldProps extends Omit<ComponentProps<"input">, "value" | "onChange"> {
  value: string;
  /** Startwert im Rad, wenn das Feld leer ist (z. B. die Vorgabe). */
  fallback: number;
  onValueChange: (value: string) => void;
}

/**
 * Wiederholungsfeld: Tippen wie gewohnt, Gedrückthalten öffnet ein Zahlenrad direkt auf dem Feld.
 * Der Wert wird beim Drehen sofort übernommen, Escape stellt den alten Wert wieder her.
 */
export function RepsWheelField({
  value,
  fallback,
  onValueChange,
  className,
  ...inputProps
}: RepsWheelFieldProps) {
  const [pick, setPick] = useState<Pick | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const drag = useRef<{ y: number; p: number } | null>(null);
  const moved = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  function write(p: number) {
    const next = String(Math.round(clamp(p)));
    if (next !== value) onValueChange(next);
  }

  function setP(p: number, dragging = false) {
    setPick((q) => (q ? { ...q, p: clamp(p), dragging } : q));
    write(p);
  }

  function open(y: number) {
    hold.current = null;
    const cur = Number.parseInt(value, 10);
    const p = clamp(Number.isNaN(cur) ? fallback : cur);
    drag.current = { y, p };
    moved.current = true;
    inputRef.current?.blur();
    setPick({ p, orig: value, dragging: true });
    write(p);
  }

  function close(keep: boolean) {
    if (!keep && pick) onValueChange(pick.orig);
    drag.current = null;
    setPick(null);
  }

  function cancelHold() {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  }

  const onDragMove = useEffectEvent((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) moved.current = true;
    setP(d.p - dy / ROW, true);
  });

  const onDragEnd = useEffectEvent(() => {
    if (!drag.current || !pick) return;
    drag.current = null;
    setP(Math.round(pick.p));
  });

  const isOpen = pick !== null;
  useEffect(() => {
    if (!isOpen) return;
    wheelRef.current?.focus({ preventScroll: true });
    // Während des Ziehens darf die Seite nicht mitscrollen.
    const noScroll = (e: TouchEvent) => drag.current && e.preventDefault();
    const end = () => onDragEnd();
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("touchmove", noScroll);
    };
  }, [isOpen]);

  useEffect(() => cancelHold, []);

  const center = pick ? Math.round(pick.p) : 0;

  return (
    <span className="relative block">
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        className={cn(className, "[-webkit-touch-callout:none]", isOpen && "border-accent")}
        onChange={(e) => onValueChange(e.target.value)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          cancelHold();
          const y = e.clientY;
          hold.current = { timer: window.setTimeout(() => open(y), HOLD_MS), x: e.clientX, y };
        }}
        onPointerMove={(e) => {
          const h = hold.current;
          if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) cancelHold();
        }}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
      />
      {pick && (
        <>
          <div
            aria-hidden="true"
            className="bg-overlay fixed inset-0 z-30"
            onClick={() => close(true)}
          />
          <div
            ref={wheelRef}
            tabIndex={0}
            role="spinbutton"
            aria-label={inputProps["aria-label"]}
            aria-valuenow={center}
            aria-valuemin={0}
            aria-valuemax={MAX}
            aria-valuetext={`${center} Wiederholungen`}
            className={cn(
              "animate-wheel-in bg-surface border-border-strong absolute -inset-x-1.5 z-40 h-55",
              "cursor-grab touch-none overflow-hidden rounded-tile border shadow-2xl select-none",
            )}
            style={{ top: -CENTER_TOP }}
            onPointerDown={(e) => {
              moved.current = false;
              drag.current = { y: e.clientY, p: pick.p };
            }}
            onWheel={(e) => setP(center + (e.deltaY > 0 ? 1 : -1))}
            onKeyDown={(e) => {
              const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
              if (step) {
                e.preventDefault();
                setP(center + step);
              } else if (e.key === "Enter") close(true);
              else if (e.key === "Escape") close(false);
            }}
          >
            <span
              aria-hidden="true"
              className="border-accent bg-primary/25 absolute inset-x-1 h-11 rounded-card border-[1.5px]"
              style={{ top: CENTER_TOP }}
            />
            {[-3, -2, -1, 0, 1, 2, 3].map((o) => {
              const n = center + o;
              if (n < 0 || n > MAX) return null;
              const d = n - pick.p;
              const ad = Math.min(Math.abs(d), 3);
              const active = Math.abs(d) < 0.5;
              return (
                <span
                  key={n}
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-0 flex h-11 items-center justify-center tabular-nums",
                    active ? "text-text text-xl font-semibold" : "text-muted text-base",
                    !pick.dragging && "transition-[top,transform,opacity] duration-150 ease-out",
                  )}
                  style={{
                    top: CENTER_TOP + d * ROW,
                    opacity: 1 - ad * 0.27,
                    transform: `perspective(320px) rotateX(${-d * 20}deg) scale(${1 - ad * 0.05})`,
                  }}
                  onClick={() => {
                    if (moved.current) return;
                    if (n === center) close(true);
                    else setP(n);
                  }}
                >
                  {n}
                </span>
              );
            })}
            <span
              aria-hidden="true"
              className="from-surface pointer-events-none absolute inset-x-0 top-0 h-17 bg-linear-to-b to-transparent"
            />
            <span
              aria-hidden="true"
              className="from-surface pointer-events-none absolute inset-x-0 bottom-0 h-17 bg-linear-to-t to-transparent"
            />
          </div>
        </>
      )}
    </span>
  );
}
