import type { Exercise, ExerciseListResponse } from "@athletept/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { useSession } from "@/features/auth/session";
import { apiUrl, buildExercise, buildUser, server } from "@/test/server";

import { ExercisePicker } from "./exercise-picker";

const kniebeuge = buildExercise({
  id: "6acd3920c0072ec254663c02",
  name: "Kniebeuge",
  primaryMuscles: ["quads", "glutes"],
  secondaryMuscles: [],
});
const pause = buildExercise({
  id: "6acd3920c0072ec254663c03",
  name: "Pause-Kniebeuge",
  primaryMuscles: ["quads"],
  secondaryMuscles: [],
  scope: "own",
});

/** Antwortet auf die Suche mit allen Übungen, deren Name den Suchbegriff enthält. */
function mockSearch(all: Exercise[]) {
  const searches: string[] = [];
  server.use(
    http.get(apiUrl("/exercises"), ({ request }) => {
      const search = new URL(request.url).searchParams.get("search") ?? "";
      searches.push(search);
      const items = all.filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
      return HttpResponse.json({ items, total: items.length } satisfies ExerciseListResponse);
    }),
  );
  return searches;
}

function renderPicker(props: Partial<Parameters<typeof ExercisePicker>[0]> = {}) {
  const onSelect = vi.fn();
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={queryClient}>
      <ExercisePicker label="Übung hinzufügen" onSelect={onSelect} {...props} />
    </QueryClientProvider>,
  );
  return { onSelect, input: screen.getByRole("combobox", { name: "Übung hinzufügen" }) };
}

beforeEach(() => {
  useSession.setState({
    status: "authenticated",
    user: buildUser({ role: "coach" }),
    accessToken: "token",
  });
});

describe("Übungsauswahl", () => {
  it("schlägt passende Übungen vor und übernimmt sie per Tastatur", async () => {
    const searches = mockSearch([buildExercise(), kniebeuge, pause]);
    const { onSelect, input } = renderPicker();

    await userEvent.type(input, "knie");
    const options = await screen.findAllByRole("option");
    await waitFor(() => expect(searches.at(-1)).toBe("knie"));
    expect(input).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
        "KniebeugeQuadrizeps, Gesäß",
        "Pause-KniebeugeEigeneQuadrizeps",
      ]),
    );
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2 Übungen gefunden.");

    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getAllByRole("option")[1]!.getAttribute("id"),
    );
    await userEvent.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(pause);
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("bietet bereits gewählte Übungen nicht noch einmal an", async () => {
    mockSearch([kniebeuge, pause]);
    const { input } = renderPicker({ excludeIds: [kniebeuge.id] });

    await userEvent.type(input, "knie");

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Pause-KniebeugeEigeneQuadrizeps",
      ]),
    );
  });

  it("übernimmt eine Übung per Klick", async () => {
    mockSearch([buildExercise()]);
    const { onSelect, input } = renderPicker();

    await userEvent.click(input);
    await userEvent.click(await screen.findByRole("option", { name: /Bankdrücken/ }));

    expect(onSelect).toHaveBeenCalledWith(buildExercise());
  });

  it("meldet, wenn nichts passt, und bietet das Anlegen an", async () => {
    mockSearch([buildExercise()]);
    const onCreate = vi.fn();
    const { onSelect, input } = renderPicker({ onCreate });

    await userEvent.type(input, "Zercher Squat");

    const create = await screen.findByRole("option", {
      name: "„Zercher Squat“ als neue Übung anlegen",
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Keine passende Übung gefunden."),
    );
    expect(create).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Zercher Squat");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("schließt mit Escape und leert beim zweiten Escape", async () => {
    mockSearch([buildExercise()]);
    const { input } = renderPicker();

    await userEvent.type(input, "bank");
    await screen.findByRole("option");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("bank");

    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
  });
});
