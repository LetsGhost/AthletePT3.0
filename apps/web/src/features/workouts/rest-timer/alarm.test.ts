import { describe, expect, it, vi } from "vitest";

import { playAlarm } from "./alarm";
import { setRestSettings } from "./rest-settings";

describe("playAlarm", () => {
  it("vibriert nur, wenn Vibration eingeschaltet ist", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });

    setRestSettings({ vibrate: false });
    playAlarm();
    expect(vibrate).not.toHaveBeenCalled();

    setRestSettings({ vibrate: true });
    playAlarm();
    expect(vibrate).toHaveBeenCalledOnce();
  });
});
