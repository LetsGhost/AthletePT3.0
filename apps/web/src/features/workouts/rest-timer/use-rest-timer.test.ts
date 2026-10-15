import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REST_FINISHED_MS, useRestTimer } from "./use-rest-timer";

describe("Pausen-Timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rechnet vom Endzeitpunkt, auch wenn der Browser im Hintergrund nicht getickt hat", () => {
    const { result } = renderHook(() => useRestTimer("log"));
    act(() => result.current.start("ex", "Bankdrücken", 90));
    expect(result.current.remaining).toBe(90);

    // Bildschirm gesperrt: Die Uhr läuft weiter, Intervalle nicht.
    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.remaining).toBe(30);
  });

  it("meldet kurz das Ende und verschwindet dann", () => {
    const { result } = renderHook(() => useRestTimer("log"));
    act(() => result.current.start("ex", "Bankdrücken", 60));

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.finished).toBe(true);
    expect(result.current.timer).not.toBeNull();

    act(() => vi.advanceTimersByTime(REST_FINISHED_MS));
    expect(result.current.timer).toBeNull();
    expect(localStorage.getItem("athletept.rest.log")).toBeNull();
  });

  it("verlängert, verkürzt höchstens bis 1 Sekunde und übersteht ein Neuladen", () => {
    const first = renderHook(() => useRestTimer("log"));
    act(() => first.result.current.start("ex", "Bankdrücken", 60));
    act(() => first.result.current.adjust(15));
    expect(first.result.current.remaining).toBe(75);
    act(() => first.result.current.adjust(-300));
    expect(first.result.current.remaining).toBe(1);
    act(() => first.result.current.adjust(30));
    first.unmount();

    const second = renderHook(() => useRestTimer("log"));
    expect(second.result.current.timer?.exerciseName).toBe("Bankdrücken");
    expect(second.result.current.remaining).toBe(31);
  });

  it("verwirft beim Laden einen längst abgelaufenen Timer", () => {
    localStorage.setItem(
      "athletept.rest.log",
      JSON.stringify({
        exerciseId: "ex",
        exerciseName: "x",
        endsAt: Date.now() - 60_000,
        total: 90,
      }),
    );
    const { result } = renderHook(() => useRestTimer("log"));
    expect(result.current.timer).toBeNull();
  });
});
