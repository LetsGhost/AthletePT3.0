import type {
  ActivityResponse,
  AthletePermissions,
  AuthResponse,
  ChallengeDetail,
  Exercise,
  ExerciseStatsDetail,
  ExerciseLogResponse,
  ExerciseStatsListResponse,
  ExerciseStatsSummary,
  Plan,
  PlanExerciseInfo,
  PlanListResponse,
  Problem,
  User,
  WeekView,
  WorkoutLog,
  WorkoutLogListResponse,
  WorkoutLogSummary,
} from "@athletept/shared";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** MSW-Handler-URLs. jsdom löst relative Pfade gegen http://localhost:3000 auf. */
export const apiUrl = (path: string) => `http://localhost:3000/api/v1${path}`;

/** Standard-Antworten, die Tests bei Bedarf mit `server.use` überschreiben. */
export const server = setupServer(
  http.get(apiUrl("/me/challenges"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/me/notifications"), () => HttpResponse.json({ items: [], unreadCount: 0 })),
  http.get(apiUrl("/coach/challenges/duels"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/coach/challenges"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/athletes/:id/challenges"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/athletes/:id/plans"), () =>
    HttpResponse.json({ items: [] } satisfies PlanListResponse),
  ),
  http.get(apiUrl("/athletes/:id/week"), () => HttpResponse.json(buildWeekView())),
  // Vorschläge im Plan-Editor fragen den Katalog ab; Tests mit Übungen setzen eigene Antworten.
  http.get(apiUrl("/exercises"), () => HttpResponse.json({ items: [], total: 0 })),
  http.get(apiUrl("/exercises/notices"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/exercises/athlete-exercises"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/exercises/submissions"), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl("/me/week"), () => HttpResponse.json(buildWeekView())),
  http.get(apiUrl("/me/permissions"), () =>
    HttpResponse.json({ ownPlan: false, ownWeek: false } satisfies AthletePermissions),
  ),
  http.get(apiUrl("/athletes/:id/exercise-stats"), () =>
    HttpResponse.json({ items: [], records: [] } satisfies ExerciseStatsListResponse),
  ),
  http.get(apiUrl("/athletes/:id/activity"), () => HttpResponse.json(buildActivity())),
  http.get(apiUrl("/me/activity"), () => HttpResponse.json(buildActivity())),
  http.get(apiUrl("/athletes/:id/exercises/:exerciseId/log"), () =>
    HttpResponse.json({ items: [] } satisfies ExerciseLogResponse),
  ),
  http.get(apiUrl("/athletes/:id/workout-logs"), () =>
    HttpResponse.json({ items: [], total: 0 } satisfies WorkoutLogListResponse),
  ),
);

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "6acd3920c0072ec254663bd8",
    email: "max@example.com",
    name: "Max Muster",
    role: "athlete",
    status: "active",
    coachId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "6acd3920c0072ec254663c01",
    name: "Bankdrücken",
    aliases: [],
    category: "compound",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    description: null,
    executionNotes: null,
    videoUrl: null,
    scope: "global",
    submitted: false,
    archived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    lastWriteVia: null,
    ...overrides,
  };
}

export function authResponse(user = buildUser(), accessToken = "access-1"): AuthResponse {
  return { accessToken, expiresIn: 900, user };
}

export function problem(status: number, code: string, detail = code) {
  const body: Problem = { type: "about:blank", title: "Error", status, code, detail };
  return HttpResponse.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export function buildPlanExerciseInfo(overrides: Partial<PlanExerciseInfo> = {}): PlanExerciseInfo {
  const { id, name, category, equipment, primaryMuscles, secondaryMuscles } = buildExercise();
  return {
    id,
    name,
    category,
    equipment,
    primaryMuscles,
    secondaryMuscles,
    description: null,
    executionNotes: null,
    videoUrl: null,
    archived: false,
    selectable: true,
    ...overrides,
  };
}

/** Entwurf mit einem Tag und Bankdrücken (1 Aufwärmsatz, 3 Arbeitssätze). */
export function buildPlan(overrides: Partial<Plan> = {}): Plan {
  const info = buildPlanExerciseInfo();
  return {
    id: "6acd3920c0072ec254663d01",
    athleteId: "6acd3920c0072ec254663bd9",
    status: "draft",
    createdBy: "coach",
    name: "Block 1",
    notes: null,
    type: "UPPER",
    revision: 3,
    days: [
      {
        id: "6acd3920c0072ec254663d11",
        name: "Oberkörper A",
        weekday: 1,
        type: "UPPER",
        warmup: [
          { id: "6acd3920c0072ec254663d31", exerciseId: null, name: "Rudern", details: "5 min" },
        ],
        exercises: [
          {
            id: "6acd3920c0072ec254663d21",
            exerciseId: info.id,
            exerciseName: info.name,
            restSeconds: 120,
            notes: null,
            sets: [
              {
                kind: "warmup",
                repsMin: 10,
                repsMax: 10,
                durationSeconds: null,
                weightKg: 40,
                rir: null,
              },
              ...Array.from({ length: 3 }, () => ({
                kind: "working" as const,
                repsMin: 6,
                repsMax: 8,
                durationSeconds: null,
                weightKg: 80,
                rir: 2,
              })),
            ],
          },
        ],
      },
    ],
    exercises: [info],
    activatedAt: null,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    lastWriteVia: null,
    ...overrides,
  };
}

/**
 * Laufendes Training zu `buildPlan` (Oberkörper A, Bankdrücken mit 1 Aufwärm- und 3 Arbeitssätzen),
 * vorbefüllt mit den Vorgaben.
 */
export function buildWorkoutLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  const [day] = buildPlan().days;
  const entry = day!.exercises[0]!;
  return {
    id: "6acd3920c0072ec254663e01",
    athleteId: "6acd3920c0072ec254663bd8",
    planId: "6acd3920c0072ec254663d01",
    planRevision: 3,
    dayId: day!.id,
    dayName: day!.name,
    dayType: day!.type,
    date: "2026-10-13",
    status: "in_progress",
    exercises: [
      {
        id: "6acd3920c0072ec254663e11",
        custom: false,
        planExerciseId: entry.id,
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        restSeconds: entry.restSeconds,
        planNotes: "Schulterblätter zusammen",
        targets: entry.sets,
        skipped: false,
        notes: null,
        sets: entry.sets.map((set) => ({
          kind: set.kind,
          weightKg: set.weightKg,
          reps: set.repsMax,
          durationSeconds: null,
          done: false,
        })),
        previous: {
          date: "2026-10-06",
          sets: [{ kind: "working", weightKg: 77.5, reps: 8, durationSeconds: null, done: true }],
        },
      },
    ],
    rating: null,
    notes: null,
    revision: 0,
    startedAt: "2026-10-13T16:00:00.000Z",
    completedAt: null,
    editableUntil: null,
    editable: true,
    createdAt: "2026-10-13T16:00:00.000Z",
    updatedAt: "2026-10-13T16:00:00.000Z",
    lastWriteVia: null,
    ...overrides,
  };
}

export function buildWorkoutSummary(overrides: Partial<WorkoutLogSummary> = {}): WorkoutLogSummary {
  return {
    id: "6acd3920c0072ec254663e01",
    planId: "6acd3920c0072ec254663d01",
    dayId: "6acd3920c0072ec254663d11",
    dayName: "Oberkörper A",
    dayType: "UPPER",
    date: "2026-10-12",
    status: "completed",
    rating: 8,
    notes: null,
    exerciseCount: 1,
    doneSetCount: 4,
    completedAt: "2026-10-12T18:00:00.000Z",
    lastWriteVia: null,
    ...overrides,
  };
}

/** KW 42/2026 (Mo 12.10. bis So 18.10.), heute Dienstag, ohne Plan und Protokolle. */
export function buildWeekView(overrides: Partial<WeekView> = {}): WeekView {
  return {
    week: "2026-W42",
    startDate: "2026-10-12",
    endDate: "2026-10-18",
    today: "2026-10-13",
    plan: null,
    days: [],
    otherLogs: [],
    activities: [null, null, null, null, null, null, null],
    completedCount: 0,
    plannedCount: 0,
    inProgress: null,
    ...overrides,
  };
}

/** Bankdrücken: zwei Einheiten, geschätztes Maximum von 100 auf 105 kg. */
export function buildExerciseStatsSummary(
  overrides: Partial<ExerciseStatsSummary> = {},
): ExerciseStatsSummary {
  return {
    exerciseId: "6acd3920c0072ec254663c01",
    exerciseName: "Bankdrücken",
    metric: "estimated1rm",
    sessionCount: 2,
    lastDate: "2026-10-12",
    best: {
      estimated1rm: { value: 105, date: "2026-10-12", logId: "6acd3920c0072ec254663e02" },
      topWeightKg: { value: 82.5, date: "2026-10-12", logId: "6acd3920c0072ec254663e02" },
      maxReps: { value: 8, date: "2026-10-05", logId: "6acd3920c0072ec254663e01" },
      maxDurationSeconds: null,
    },
    change: { from: 100, to: 105, fromDate: "2026-10-05", percent: 5 },
    ...overrides,
  };
}

export function buildExerciseStatsDetail(
  overrides: Partial<ExerciseStatsDetail> = {},
): ExerciseStatsDetail {
  return {
    ...buildExerciseStatsSummary(),
    sessions: [
      {
        date: "2026-10-05",
        logId: "6acd3920c0072ec254663e01",
        topWeightKg: 80,
        estimated1rm: 100,
        volumeKg: 1920,
        maxReps: 8,
        maxDurationSeconds: null,
        setCount: 3,
      },
      {
        date: "2026-10-12",
        logId: "6acd3920c0072ec254663e02",
        topWeightKg: 82.5,
        estimated1rm: 105,
        volumeKg: 1980,
        maxReps: 8,
        maxDurationSeconds: null,
        setCount: 3,
      },
    ],
    ...overrides,
  };
}

/** Oktober 2026, heute Do., 15.10. (KW 42): zwei Wochen erfüllt, KW 40 verpasst. */
export function buildActivity(overrides: Partial<ActivityResponse> = {}): ActivityResponse {
  const week = (
    number: number,
    startDate: string,
    status: ActivityResponse["weeks"][number]["status"],
    completedCount = 0,
  ) => ({
    week: `2026-W${number}`,
    startDate,
    status,
    completedCount,
    plannedCount: 2,
  });
  return {
    month: "2026-10",
    today: "2026-10-15",
    streakWeeks: 2,
    weeks: [
      week(40, "2026-09-28", "missed"),
      week(41, "2026-10-05", "fulfilled", 2),
      week(42, "2026-10-12", "fulfilled", 2),
      week(43, "2026-10-19", "upcoming"),
      week(44, "2026-10-26", "upcoming"),
    ],
    days: [
      {
        date: "2026-10-05",
        workouts: [{ id: "6acd3920c0072ec254663e01", dayName: "Tag A", durationMinutes: 50 }],
      },
      {
        date: "2026-10-07",
        workouts: [{ id: "6acd3920c0072ec254663e05", dayName: "Tag B", durationMinutes: 70 }],
      },
      {
        date: "2026-10-12",
        workouts: [{ id: "6acd3920c0072ec254663e02", dayName: "Tag A", durationMinutes: 65 }],
      },
      {
        date: "2026-10-14",
        workouts: [{ id: "6acd3920c0072ec254663e06", dayName: "Tag B", durationMinutes: null }],
      },
    ],
    workoutCount: 4,
    totalMinutes: 185,
    averageMinutes: 62,
    ...overrides,
  };
}

/** Laufende Coach-Challenge (Rangliste, Volumen), heute Do., 15.10.: Max auf Platz 2 von 3. */
export function buildChallenge(overrides: Partial<ChallengeDetail> = {}): ChallengeDetail {
  const standings = [
    {
      athleteId: "6acd3920c0072ec254663a02",
      name: "Lena S.",
      score: 36_800,
      rank: 1,
      achieved: null,
      isMe: false,
    },
    {
      athleteId: "6acd3920c0072ec254663a01",
      name: "Max Muster",
      score: 31_400,
      rank: 2,
      achieved: null,
      isMe: true,
    },
    {
      athleteId: "6acd3920c0072ec254663a03",
      name: "Tim K.",
      score: 0,
      rank: 3,
      achieved: null,
      isMe: false,
    },
  ];
  return {
    id: "6acd3920c0072ec254663c99",
    kind: "coach",
    metric: "volume",
    scoring: "ranking",
    title: "Team-Volumen Oktober",
    description: null,
    exerciseId: null,
    exerciseName: null,
    manualMode: null,
    dailyTarget: null,
    goalValue: null,
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    status: "running",
    endedEarly: false,
    today: "2026-10-15",
    prize: "Gratis-Session",
    ownerName: "Clara Coach",
    participantCount: 3,
    teamScore: 68_200,
    achievedCount: 0,
    leader: standings[0]!,
    me: standings[1]!,
    todayValue: null,
    duel: null,
    standings,
    entries: [],
    daily: [],
    ...overrides,
  };
}
