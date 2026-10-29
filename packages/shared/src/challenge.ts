import { z } from "zod";

import { isoDateSchema, objectIdSchema } from "./common";
import { emailSchema } from "./user";

/**
 * Challenges: zeitlich begrenzte Ziele oder Wettbewerbe. Gewertet wird automatisch aus
 * erledigten Trainings (Kennzahlen je Übung, nur Arbeitssätze) oder bei einer freien Vorgabe aus
 * den Einträgen der Athleten. Bisher legt nur der Coach Challenges an, Duelle und
 * System-Challenges folgen.
 */
export const challengeKinds = ["coach", "duel", "system"] as const;
export const challengeKindSchema = z.enum(challengeKinds);
export type ChallengeKind = z.infer<typeof challengeKindSchema>;
export const challengeKindLabels: Record<ChallengeKind, string> = {
  coach: "Coach",
  duel: "Duell",
  system: "System",
};

export const challengeMetrics = [
  "workouts",
  "training_days",
  "volume",
  "sets",
  "e1rm",
  "manual",
] as const;
export const challengeMetricSchema = z.enum(challengeMetrics);
export type ChallengeMetric = z.infer<typeof challengeMetricSchema>;
export const challengeMetricLabels: Record<ChallengeMetric, string> = {
  workouts: "Erledigte Trainings",
  training_days: "Trainingstage",
  volume: "Bewegte kg",
  sets: "Arbeitssätze",
  e1rm: "Bestes e1RM",
  manual: "Freie Vorgabe",
};

/** Oberbegriff einer Metrik, z. B. für Icon und Kennzeichnung. */
export const challengeMetricGroups = ["consistency", "volume", "performance", "manual"] as const;
export type ChallengeMetricGroup = (typeof challengeMetricGroups)[number];
export const challengeMetricGroup: Record<ChallengeMetric, ChallengeMetricGroup> = {
  workouts: "consistency",
  training_days: "consistency",
  volume: "volume",
  sets: "volume",
  e1rm: "performance",
  manual: "manual",
};
export const challengeMetricGroupLabels: Record<ChallengeMetricGroup, string> = {
  consistency: "Konstanz",
  volume: "Volumen",
  performance: "Leistung",
  manual: "Freie Vorgabe",
};

/** Metriken, die nur aus Trainingsdaten kommen (zählen auch in Duellen und global). */
export function isAutomaticMetric(metric: ChallengeMetric) {
  return metric !== "manual";
}

export const challengeScorings = ["goal", "team_goal", "ranking"] as const;
export const challengeScoringSchema = z.enum(challengeScorings);
export type ChallengeScoring = z.infer<typeof challengeScoringSchema>;
export const challengeScoringLabels: Record<ChallengeScoring, string> = {
  goal: "Ziel je Athlet",
  team_goal: "Team-Ziel",
  ranking: "Rangliste",
};

/** Freie Vorgabe: eine Menge je Tag (z. B. 100 Klimmzüge) oder einfach abhaken. */
export const manualModes = ["quantity", "check"] as const;
export const manualModeSchema = z.enum(manualModes);
export type ManualMode = z.infer<typeof manualModeSchema>;
export const manualModeLabels: Record<ManualMode, string> = {
  quantity: "Menge (Zahl)",
  check: "Abhaken",
};

export const challengeStatuses = ["planned", "running", "finished"] as const;
export const challengeStatusSchema = z.enum(challengeStatuses);
export type ChallengeStatus = z.infer<typeof challengeStatusSchema>;
export const challengeStatusLabels: Record<ChallengeStatus, string> = {
  planned: "Geplant",
  running: "Läuft",
  finished: "Beendet",
};

/** Längste erlaubte Laufzeit in Tagen. */
export const MAX_CHALLENGE_DAYS = 92;
/** So viele Teilnehmer darf eine Coach-Challenge haben. */
export const MAX_CHALLENGE_PARTICIPANTS = 100;
/** Höchster Tageswert einer freien Vorgabe. */
export const MAX_MANUAL_VALUE = 10_000;

function utcDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

/** Anzahl Kalendertage von `start` bis `end`, beide eingeschlossen. */
export function daysInPeriod(start: string, end: string) {
  return Math.round((utcDay(end) - utcDay(start)) / 86_400_000) + 1;
}

/** Status einer Challenge an einem Kalendertag. */
export function challengeStatusOn(
  challenge: { startDate: string; endDate: string; endedEarly: boolean },
  today: string,
): ChallengeStatus {
  if (today < challenge.startDate) return "planned";
  if (challenge.endedEarly || today > challenge.endDate) return "finished";
  return "running";
}

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .nullish()
    .transform((value) => value || null);

const titleSchema = z
  .string()
  .trim()
  .min(3, "Mindestens 3 Zeichen")
  .max(60, "Höchstens 60 Zeichen");
const descriptionSchema = nullableText(500);
const prizeSchema = nullableText(120);
const goalValueSchema = z
  .number({ error: "Bitte eine Zahl angeben" })
  .positive("Muss größer als 0 sein")
  .max(100_000_000, "Zu groß");
const participantIdsSchema = z
  .array(objectIdSchema)
  .min(1, "Mindestens ein Athlet")
  .max(MAX_CHALLENGE_PARTICIPANTS, `Höchstens ${MAX_CHALLENGE_PARTICIPANTS} Athleten`);

/**
 * Neue Coach-Challenge. `exerciseId` ist bei `e1rm` Pflicht und bei `volume`/`sets` optional
 * (nur diese Übung), `manualMode` und bei Menge `dailyTarget` nur bei `manual`. `goalValue` ist
 * bei `goal` und `team_goal` Pflicht, bei `manual` zählt er Tage mit erreichtem Tagesziel.
 */
export const createCoachChallengeRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    metric: challengeMetricSchema,
    exerciseId: objectIdSchema.nullish().transform((value) => value ?? null),
    manualMode: manualModeSchema.nullish().transform((value) => value ?? null),
    dailyTarget: z
      .number({ error: "Bitte eine Zahl angeben" })
      .int("Bitte eine ganze Zahl")
      .min(1, "Mindestens 1")
      .max(MAX_MANUAL_VALUE, `Höchstens ${MAX_MANUAL_VALUE}`)
      .nullish()
      .transform((value) => value ?? null),
    scoring: challengeScoringSchema,
    goalValue: goalValueSchema.nullish().transform((value) => value ?? null),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    participantIds: participantIdsSchema,
    prize: prizeSchema,
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (value.endDate < value.startDate) issue("endDate", "Das Ende liegt vor dem Start");
    else if (daysInPeriod(value.startDate, value.endDate) > MAX_CHALLENGE_DAYS) {
      issue("endDate", `Höchstens ${MAX_CHALLENGE_DAYS} Tage`);
    }
    if (value.metric === "e1rm" && !value.exerciseId)
      issue("exerciseId", "Bitte eine Übung wählen");
    if (!["e1rm", "volume", "sets"].includes(value.metric) && value.exerciseId) {
      issue("exerciseId", "Nur bei Leistung oder Volumen");
    }
    if (value.metric === "manual") {
      if (!value.manualMode) issue("manualMode", "Bitte wählen");
      if (value.manualMode === "quantity" && !value.dailyTarget) {
        issue("dailyTarget", "Bitte ein Tagesziel angeben");
      }
    } else if (value.manualMode || value.dailyTarget) {
      issue("manualMode", "Nur bei einer freien Vorgabe");
    }
    if (value.scoring !== "ranking" && value.goalValue === null) {
      issue("goalValue", "Bitte ein Ziel angeben");
    }
    if (
      value.metric === "manual" &&
      value.goalValue !== null &&
      value.goalValue > daysInPeriod(value.startDate, value.endDate) &&
      value.scoring === "goal"
    ) {
      issue("goalValue", "Mehr Tage, als die Challenge dauert");
    }
    if (new Set(value.participantIds).size !== value.participantIds.length) {
      issue("participantIds", "Athleten doppelt ausgewählt");
    }
  });

/**
 * Änderungen an einer Coach-Challenge. Titel, Beschreibung und Preis gehen bis zum Ende,
 * Zeitraum, Ziel und Teilnehmer nur vor dem Start (sonst 409 `challenge_started`).
 */
export const updateCoachChallengeRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    prize: prizeSchema.optional(),
    goalValue: goalValueSchema.nullable().optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    participantIds: participantIdsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), "Keine Änderung angegeben");

/** Tageswert einer freien Vorgabe. Beim Abhaken 1 (erledigt) oder 0. */
export const challengeEntryRequestSchema = z.object({
  value: z
    .number({ error: "Bitte eine Zahl angeben" })
    .int("Bitte eine ganze Zahl")
    .min(0, "Nicht negativ")
    .max(MAX_MANUAL_VALUE, `Höchstens ${MAX_MANUAL_VALUE}`),
});

/** Stand eines Teilnehmers. `rank` ist geteilt, wenn Wert und Zeitpunkt gleich sind. */
// ---------------------------------------------------------------------------------------------
// System-Challenges: Vorlagen des Sysadmins, aus denen Runden entstehen (wöchentlich, monatlich
// oder einmalig). Teilnahme per Opt-in mit Spitznamen.

export const badgeTiers = ["bronze", "silver", "gold"] as const;
export const badgeTierSchema = z.enum(badgeTiers);
export type BadgeTier = z.infer<typeof badgeTierSchema>;
export const badgeTierLabels: Record<BadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silber",
  gold: "Gold",
};

/** Höchste erreichte Stufe, `null` unter Bronze. `thresholds` aufsteigend: Bronze, Silber, Gold. */
export function tierFor(value: number, thresholds: readonly number[]): BadgeTier | null {
  let tier: BadgeTier | null = null;
  thresholds.forEach((threshold, index) => {
    if (value >= threshold) tier = badgeTiers[index] ?? tier;
  });
  return tier;
}

/** Metriken für System-Challenges: nur Trainingsdaten, keine Übungsauswahl. */
export const systemMetrics = ["workouts", "training_days", "volume", "sets"] as const;
export const systemMetricSchema = z.enum(systemMetrics);
export type SystemMetric = z.infer<typeof systemMetricSchema>;

export const systemRhythms = ["weekly", "monthly", "once"] as const;
export const systemRhythmSchema = z.enum(systemRhythms);
export type SystemRhythm = z.infer<typeof systemRhythmSchema>;
export const systemRhythmLabels: Record<SystemRhythm, string> = {
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  once: "Einmalig",
};

export const systemTemplateStatuses = ["draft", "active", "paused"] as const;
export const systemTemplateStatusSchema = z.enum(systemTemplateStatuses);
export type SystemTemplateStatus = z.infer<typeof systemTemplateStatusSchema>;
export const systemTemplateStatusLabels: Record<SystemTemplateStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  paused: "Pausiert",
};

const tierValuesSchema = z
  .array(z.number({ error: "Bitte eine Zahl angeben" }).positive("Muss größer als 0 sein"))
  .length(3, "Bronze, Silber und Gold angeben")
  .refine((values) => values[0]! < values[1]! && values[1]! < values[2]!, {
    error: "Bronze < Silber < Gold",
  });

export const createSystemTemplateRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    metric: systemMetricSchema,
    /** Schwellen für Bronze, Silber, Gold (bei Volumen in kg). */
    tiers: tierValuesSchema,
    rhythm: systemRhythmSchema,
    /** Nur bei `once`. */
    startDate: isoDateSchema.nullish().transform((value) => value ?? null),
    endDate: isoDateSchema.nullish().transform((value) => value ?? null),
    status: z.enum(["draft", "active"]),
  })
  .superRefine((value, ctx) => {
    if (value.rhythm !== "once") return;
    if (!value.startDate || !value.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Bitte Start und Ende angeben",
      });
    } else if (value.endDate < value.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Das Ende liegt vor dem Start" });
    } else if (daysInPeriod(value.startDate, value.endDate) > MAX_CHALLENGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Höchstens ${MAX_CHALLENGE_DAYS} Tage`,
      });
    }
  });

/** Änderungen wirken ab der nächsten Runde, laufende Runden behalten ihre Stufen. */
export const updateSystemTemplateRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    tiers: tierValuesSchema.optional(),
    status: systemTemplateStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), "Keine Änderung angegeben");

export const systemTemplateSchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  description: z.string().nullable(),
  metric: systemMetricSchema,
  tiers: z.array(z.number()),
  rhythm: systemRhythmSchema,
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  status: systemTemplateStatusSchema,
  /** Laufende Runde, sonst die nächste geplante. */
  currentRound: z
    .object({
      id: objectIdSchema,
      startDate: isoDateSchema,
      endDate: isoDateSchema,
      status: challengeStatusSchema,
      participantCount: z.number().int(),
    })
    .nullable(),
  /** Start der nächsten Runde (wiederkehrend und aktiv), sonst `null`. */
  nextRoundStart: isoDateSchema.nullable(),
  roundCount: z.number().int(),
});

export const systemTemplateListResponseSchema = z.object({
  items: z.array(systemTemplateSchema),
  /** Athleten in laufenden Runden, je Athlet einmal. */
  activeParticipants: z.number().int(),
});

export const challengeStandingSchema = z.object({
  athleteId: objectIdSchema,
  name: z.string(),
  score: z.number(),
  rank: z.number().int(),
  /** Ziel erreicht bzw. bei der Rangliste nach dem Ende Platz 1. `null` = noch offen. */
  achieved: z.boolean().nullable(),
  isMe: z.boolean(),
  /** System-Challenges: erreichte Abzeichen-Stufe. */
  tier: badgeTierSchema.nullable(),
});

export const challengeEntrySchema = z.object({
  date: isoDateSchema,
  value: z.number().int(),
});

// ---------------------------------------------------------------------------------------------
// Duelle: ein Athlet fordert einen anderen per E-Mail heraus, auch über Coach-Grenzen hinweg.

/** Laufzeiten in Tagen, die ein Herausforderer wählen kann. */
export const DUEL_DURATIONS = [7, 14, 28] as const;
/** So lange kann eine Einladung angenommen werden. */
export const DUEL_INVITE_DAYS = 3;
/** Offene Duelle (eingeladen oder laufend) je Athlet. */
export const MAX_OPEN_DUELS = 3;

/** Nur automatische Metriken: Duelle laufen über Coach-Grenzen, manuelle Werte wären unfair. */
export const duelMetrics = ["training_days", "workouts", "volume", "sets", "e1rm"] as const;
export const duelMetricSchema = z.enum(duelMetrics);
export type DuelMetric = z.infer<typeof duelMetricSchema>;
export const duelMetricLabels: Record<DuelMetric, string> = {
  training_days: "Meiste Trainingstage",
  workouts: "Meiste erledigte Trainings",
  volume: "Meistes Volumen",
  sets: "Meiste Sätze",
  e1rm: "Höchstes e1RM",
};

export const duelStates = ["pending", "declined", "expired", "active", "finished"] as const;
export const duelStateSchema = z.enum(duelStates);
export type DuelState = z.infer<typeof duelStateSchema>;

export const createDuelRequestSchema = z
  .object({
    metric: duelMetricSchema,
    exerciseId: objectIdSchema.nullish().transform((value) => value ?? null),
    durationDays: z
      .number({ error: "Bitte eine Laufzeit wählen" })
      .refine((days) => (DUEL_DURATIONS as readonly number[]).includes(days), {
        error: "Bitte 1, 2 oder 4 Wochen wählen",
      }),
    email: emailSchema,
  })
  .superRefine((value, ctx) => {
    if (value.metric === "e1rm" && !value.exerciseId) {
      ctx.addIssue({ code: "custom", path: ["exerciseId"], message: "Bitte eine Übung wählen" });
    }
  });

/** Duell aus Sicht des Betrachters. */
export const duelInfoSchema = z.object({
  state: duelStateSchema,
  /** `null` aus Sicht eines Coaches. */
  iAmChallenger: z.boolean().nullable(),
  durationDays: z.number().int(),
  /** Bis dahin kann die Einladung angenommen werden (ISO-Zeitpunkt). */
  expiresAt: z.string(),
  /** Eingegebene Adresse, nur für den Herausforderer, solange niemand angenommen hat. */
  invitedEmail: z.string().nullable(),
  /** Gegner aus Sicht des Betrachters (Herausforderer bzw. Eingeladener). `null`, solange unbekannt. */
  opponentName: z.string().nullable(),
  /** Wer aufgegeben hat. */
  gaveUpName: z.string().nullable(),
});

export const challengeSummarySchema = z.object({
  id: objectIdSchema,
  kind: challengeKindSchema,
  metric: challengeMetricSchema,
  scoring: challengeScoringSchema,
  title: z.string(),
  description: z.string().nullable(),
  exerciseId: objectIdSchema.nullable(),
  exerciseName: z.string().nullable(),
  manualMode: manualModeSchema.nullable(),
  dailyTarget: z.number().int().nullable(),
  goalValue: z.number().nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  status: challengeStatusSchema,
  endedEarly: z.boolean(),
  /** Heutiger Kalendertag, damit Countdown und Status zusammenpassen. */
  today: isoDateSchema,
  prize: z.string().nullable(),
  /** Coach, der die Challenge angelegt hat. */
  ownerName: z.string().nullable(),
  participantCount: z.number().int(),
  /** Summe aller Teilnehmer (Team-Ziel). */
  teamScore: z.number(),
  /** Teilnehmer mit erreichtem Ziel. */
  achievedCount: z.number().int(),
  leader: challengeStandingSchema.nullable(),
  /** Stand des angemeldeten Athleten bzw. des Athleten, für den der Coach die Liste abruft. */
  me: challengeStandingSchema.nullable(),
  /** Freie Vorgabe: heutiger Eintrag dieses Athleten, `null` ohne Eintrag. */
  todayValue: z.number().int().nullable(),
  /** Nur bei Duellen. */
  duel: duelInfoSchema.nullable(),
  /** System-Challenges: Schwellen für Bronze, Silber, Gold. */
  tiers: z.array(z.number()).nullable(),
  /** System-Challenges: ob der Betrachter dabei ist. */
  joined: z.boolean(),
});

/** Wert eines Teilnehmers an einem Tag, nur Tage mit Wert. */
export const challengeDailyValueSchema = z.object({
  athleteId: objectIdSchema,
  date: isoDateSchema,
  value: z.number(),
});

export const challengeDetailSchema = challengeSummarySchema.extend({
  standings: z.array(challengeStandingSchema),
  /** Freie Vorgabe: eigene Einträge im Zeitraum, älteste zuerst. Leer für Coaches. */
  entries: z.array(challengeEntrySchema),
  /** Duelle: Verlauf pro Tag beider Teilnehmer. Sonst leer. */
  daily: z.array(challengeDailyValueSchema),
});

/** Duelle der eigenen Athleten für den Coach, je Athlet aus dessen Sicht. */
export const teamDuelListResponseSchema = z.object({
  items: z.array(
    z.object({
      athleteId: objectIdSchema,
      athleteName: z.string(),
      challenge: challengeSummarySchema,
    }),
  ),
});

export const challengeListResponseSchema = z.object({
  items: z.array(challengeSummarySchema),
});

/** Wirkung eines abgeschlossenen Trainings auf eine laufende Challenge. */
export const challengeWorkoutUpdateSchema = z.object({
  id: objectIdSchema,
  kind: challengeKindSchema,
  metric: challengeMetricSchema,
  scoring: challengeScoringSchema,
  title: z.string(),
  goalValue: z.number().nullable(),
  /** Zuwachs durch dieses Training, 0 bei einer freien Vorgabe. */
  gained: z.number(),
  score: z.number(),
  teamScore: z.number(),
  rank: z.number().int(),
  previousRank: z.number().int(),
  participantCount: z.number().int(),
  /** Freie Vorgabe, für heute noch nichts eingetragen. */
  entryPending: z.boolean(),
});

export type CreateCoachChallengeRequest = z.input<typeof createCoachChallengeRequestSchema>;
export type UpdateCoachChallengeRequest = z.input<typeof updateCoachChallengeRequestSchema>;
export type ChallengeEntryRequest = z.input<typeof challengeEntryRequestSchema>;
export type ChallengeStanding = z.infer<typeof challengeStandingSchema>;
export type ChallengeEntry = z.infer<typeof challengeEntrySchema>;
export type ChallengeSummary = z.infer<typeof challengeSummarySchema>;
export type ChallengeDetail = z.infer<typeof challengeDetailSchema>;
export type ChallengeListResponse = z.infer<typeof challengeListResponseSchema>;
export type ChallengeWorkoutUpdate = z.infer<typeof challengeWorkoutUpdateSchema>;
export type CreateDuelRequest = z.input<typeof createDuelRequestSchema>;
export type DuelInfo = z.infer<typeof duelInfoSchema>;
export type ChallengeDailyValue = z.infer<typeof challengeDailyValueSchema>;
export type TeamDuelListResponse = z.infer<typeof teamDuelListResponseSchema>;
export type CreateSystemTemplateRequest = z.input<typeof createSystemTemplateRequestSchema>;
export type UpdateSystemTemplateRequest = z.input<typeof updateSystemTemplateRequestSchema>;
export type SystemTemplate = z.infer<typeof systemTemplateSchema>;
export type SystemTemplateListResponse = z.infer<typeof systemTemplateListResponseSchema>;
