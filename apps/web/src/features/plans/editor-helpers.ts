import { weekdayLabels, type PlanTypeInput } from "@athletept/shared";

import type { ExerciseInfo } from "./editor-values";

/** Bekannte Übungen nach ID. Wächst, wenn im Editor neue Übungen gewählt oder angelegt werden. */
export type InfoMap = Record<string, ExerciseInfo>;

export const toInfoMap = (infos: readonly ExerciseInfo[]): InfoMap =>
  Object.fromEntries(infos.map((info) => [info.id, info]));

/** Eingaben für `detectPlanType` aus den Übungseinträgen eines Tags. */
export function typeInputs(
  exercises: readonly { exerciseId?: string }[] | undefined,
  infos: InfoMap,
): PlanTypeInput[] {
  return (exercises ?? []).flatMap((entry) => {
    const info = entry.exerciseId ? infos[entry.exerciseId] : undefined;
    return info ? [info] : [];
  });
}

export const workingSets = (sets: readonly { kind?: string }[] | undefined) =>
  (sets ?? []).filter((set) => set.kind === "working").length;

export const shortWeekday = (day: number) =>
  weekdayLabels[day as keyof typeof weekdayLabels].slice(0, 2);

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;
