import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepsWheelField } from "./reps-wheel";

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <RepsWheelField aria-label="Wdh" value={value} fallback={10} onValueChange={setValue} />;
}

function hold(input: HTMLElement, y = 100) {
  fireEvent.pointerDown(input, { button: 0, clientX: 10, clientY: y });
  act(() => vi.advanceTimersByTime(450));
}

describe("RepsWheelField", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("öffnet beim Gedrückthalten mit der Vorgabe und übernimmt den Wert sofort", () => {
    render(<Harness initial="" />);
    const input = screen.getByRole("textbox", { name: "Wdh" });
    hold(input);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-valuenow", "10");
    expect(input).toHaveValue("10");
  });

  it("öffnet nicht bei kurzem Tippen oder Wischen", () => {
    render(<Harness initial="8" />);
    const input = screen.getByRole("textbox", { name: "Wdh" });
    fireEvent.pointerDown(input, { button: 0, clientX: 10, clientY: 100 });
    fireEvent.pointerUp(input);
    fireEvent.pointerDown(input, { button: 0, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(input, { clientX: 10, clientY: 140 });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("ändert den Wert durch Ziehen nach oben", () => {
    render(<Harness initial="8" />);
    const input = screen.getByRole("textbox", { name: "Wdh" });
    hold(input, 200);
    fireEvent.pointerMove(window, { clientY: 200 - 2 * 44 });
    fireEvent.pointerUp(window);
    expect(input).toHaveValue("10");
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-valuenow", "10");
  });

  it("Pfeiltasten ändern, Escape stellt den alten Wert wieder her, Enter übernimmt", () => {
    render(<Harness initial="8" />);
    const input = screen.getByRole("textbox", { name: "Wdh" });
    hold(input);
    fireEvent.pointerUp(window);
    fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "ArrowDown" });
    expect(input).toHaveValue("9");
    fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "Escape" });
    expect(input).toHaveValue("8");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    hold(input);
    fireEvent.pointerUp(window);
    fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "Enter" });
    expect(input).toHaveValue("7");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
