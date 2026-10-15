/**
 * Demo-Modus für lokale Tests ohne Docker und ohne externe Dienste:
 *   - startet eine In-Memory-MongoDB (Replica Set, Daten gehen beim Beenden verloren)
 *   - legt Demo-Konten an (Sysadmin, Coach, Athlet)
 *   - startet die API; Mails erscheinen mit Link im Log
 *
 *   npm run dev:demo   (im Repo-Root, startet zusätzlich die Web-App)
 */
import {
  PRIVACY_POLICY_VERSION,
  addDays,
  createPlanRequestSchema,
  exerciseSearchKey,
  isoWeekOf,
  isoWeekStart,
  todayIsoDate,
  type CreatePlanRequest,
} from "@athletept/shared";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const DEMO_PASSWORD = "demo-passwort";

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = new URL(replSet.getUri());
uri.pathname = "/athletept-demo";

Object.assign(process.env, {
  NODE_ENV: "development",
  MONGO_URI: uri.toString(),
  JWT_SECRET: process.env.JWT_SECRET ?? "demo-secret-only-for-local-development-0123456789",
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  MAIL_TRANSPORT: process.env.MAIL_TRANSPORT ?? "console",
});

// Erst nach dem Setzen der Umgebung importieren (env wird beim Import geprüft).
const { connectDatabase, disconnectDatabase } = await import("../src/lib/db");
const { hashPassword } = await import("../src/lib/password");
const { UserModel } = await import("../src/modules/users/user.model");
const { AthleteProfileModel } = await import("../src/modules/athletes/athlete-profile.model");
const { ExerciseModel } = await import("../src/modules/exercises/exercise.model");
const { seedGlobalExercises } = await import("../src/modules/exercises/exercise-seed");
const planService = await import("../src/modules/plans/plan.service");
const templateService = await import("../src/modules/plans/plan-template.service");
const workoutService = await import("../src/modules/workouts/workout.service");
const weekService = await import("../src/modules/workouts/week.service");
const { WorkoutLogModel } = await import("../src/modules/workouts/workout-log.model");

await connectDatabase();
const passwordHash = await hashPassword(DEMO_PASSWORD);

await UserModel.create({
  email: "admin@demo.local",
  name: "Sam Sysadmin",
  role: "sysadmin",
  status: "active",
  passwordHash,
});
const coach = await UserModel.create({
  email: "coach@demo.local",
  name: "Clara Coach",
  role: "coach",
  status: "active",
  athleteQuota: 5,
  passwordHash,
});
const athlete = await UserModel.create({
  email: "athlet@demo.local",
  name: "Max Muster",
  role: "athlete",
  status: "active",
  coachId: coach._id,
  passwordHash,
  healthDataConsent: { grantedAt: new Date(), privacyPolicyVersion: PRIVACY_POLICY_VERSION },
});
// Globaler Katalog kommt beim Start der API (seedGlobalExercises), hier nur eigene Übungen.
const ownExercises = [
  {
    name: "Pause-Kniebeuge",
    aliases: ["Pause Squat"],
    category: "compound",
    equipment: "barbell",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["adductors"],
    executionNotes: "2 Sekunden Pause in der tiefsten Position, Spannung halten.",
  },
  {
    name: "Copenhagen Plank",
    aliases: ["Adduktoren-Plank"],
    category: "isolation",
    equipment: "bodyweight",
    primaryMuscles: ["adductors"],
    secondaryMuscles: ["obliques"],
  },
] as const;
await ExerciseModel.insertMany(
  ownExercises.map((x) => ({
    ...x,
    ownerCoachId: coach._id,
    searchKey: exerciseSearchKey(x.name),
    aliasKeys: x.aliases.map(exerciseSearchKey),
  })),
);
// Zweiter Coach, damit sich das Sperren mit Übergabe der Athleten ausprobieren lässt.
const secondCoach = await UserModel.create({
  email: "coach2@demo.local",
  name: "Ben Berger",
  role: "coach",
  status: "active",
  athleteQuota: 3,
  passwordHash,
});
const secondAthlete = await UserModel.create({
  email: "athletin@demo.local",
  name: "Lea Lang",
  role: "athlete",
  status: "active",
  coachId: secondCoach._id,
  passwordHash,
  healthDataConsent: { grantedAt: new Date(), privacyPolicyVersion: PRIVACY_POLICY_VERSION },
});
await AthleteProfileModel.create({
  athleteId: athlete._id,
  birthDate: "1995-04-12",
  sex: "male",
  heightCm: 182,
  goal: "Fett abbauen, Kraft halten",
  focus: "Oberkörper",
  trainingsPerWeek: 4,
});

// Trainingspläne: Startübungen schon hier anlegen (sonst erst beim Start der API), damit sie
// sich über ihren seedKey finden lassen.
await seedGlobalExercises();
const catalog = await ExerciseModel.find({
  $or: [{ seedKey: { $ne: null } }, { ownerCoachId: coach._id }],
});
const exerciseId = (key: string) => {
  const found = catalog.find((x) => x.seedKey === key || x.name === key);
  if (!found) throw new Error(`Demo-Übung fehlt: ${key}`);
  return found._id.toString();
};
/** Wiederholungen (fest, Bereich oder Sekunden), Gewicht, RIR. */
type DemoTarget = [reps: number | [number, number] | `${number}s`, weightKg?: number, rir?: number];
/** Übung mit gleichen Arbeitssätzen, z. B. `ex("back-squat", 4, [[6, 8], 100, 2], 150)`. */
const ex = (key: string, count: number, [reps, weightKg, rir]: DemoTarget, restSeconds = 90) => ({
  exerciseId: exerciseId(key),
  restSeconds,
  sets: Array.from({ length: count }, () => ({
    kind: "working" as "working" | "warmup",
    ...(typeof reps === "string"
      ? { durationSeconds: Number.parseInt(reps, 10) }
      : Array.isArray(reps)
        ? { repsMin: reps[0], repsMax: reps[1] }
        : { repsMin: reps }),
    weightKg: weightKg ?? null,
    rir: rir ?? null,
  })),
});
const withWarmup = (entry: ReturnType<typeof ex>, reps: number, weightKg: number) => ({
  ...entry,
  sets: [{ kind: "warmup" as const, repsMin: reps, weightKg }, ...entry.sets],
});
const plan = (body: CreatePlanRequest) => createPlanRequestSchema.parse(body);

const upperLower = plan({
  name: "Ober-/Unterkörper Block 1",
  notes: "4 Einheiten pro Woche. Gewichte sind Richtwerte, die RIR-Angabe ist wichtiger.",
  days: [
    {
      name: "Oberkörper A",
      weekday: 1,
      warmup: [
        { exerciseId: exerciseId("rowing-machine"), details: "5 min locker" },
        { name: "Schulter-Mobilisation mit Band", details: "2 × 15 Dislocates" },
      ],
      exercises: [
        withWarmup(ex("bench-press", 3, [[6, 8], 80, 2], 150), 10, 40),
        ex("barbell-row", 3, [[8, 10], 70, 2], 120),
        ex("overhead-press", 3, [[8, 10], 45, 2], 120),
        ex("lat-pulldown", 3, [[10, 12], 60, 1]),
        ex("triceps-pushdown", 2, [[12, 15], 25, 1], 60),
      ],
    },
    {
      name: "Unterkörper A",
      weekday: 2,
      warmup: [
        { exerciseId: exerciseId("rowing-machine"), details: "5 min locker" },
        { exerciseId: exerciseId("hip-90-90"), details: "2 × 8 pro Seite" },
      ],
      exercises: [
        withWarmup(ex("back-squat", 4, [[5, 6], 100, 2], 180), 8, 60),
        ex("romanian-deadlift", 3, [[8, 10], 80, 2], 150),
        ex("Pause-Kniebeuge", 2, [5, 70, 3], 150),
        ex("standing-calf-raise", 3, [[10, 15], 60, 1], 60),
        ex("plank", 3, ["45s"], 60),
      ],
    },
    {
      name: "Oberkörper B",
      weekday: 4,
      warmup: [{ exerciseId: exerciseId("thoracic-rotation"), details: "2 × 10 pro Seite" }],
      exercises: [
        ex("incline-dumbbell-press", 3, [[8, 10], 26, 2], 120),
        ex("seated-cable-row", 3, [[10, 12], 65, 2]),
        ex("lateral-raise", 3, [[12, 15], 10, 1], 60),
        ex("face-pull", 3, [15, 20, 2], 60),
        ex("dumbbell-curl", 3, [[10, 12], 14, 1], 60),
      ],
    },
    {
      name: "Unterkörper B",
      weekday: 5,
      warmup: [{ exerciseId: exerciseId("hip-90-90"), details: "2 × 8 pro Seite" }],
      exercises: [
        ex("hip-thrust", 3, [[8, 10], 100, 2], 120),
        ex("bulgarian-split-squat", 3, [[8, 10], 20, 2], 120),
        ex("lying-leg-curl", 3, [[10, 12], 40, 1]),
        ex("Copenhagen Plank", 2, ["20s"], 60),
      ],
    },
  ],
});
const maxPlan = await planService.createPlan(coach.id, athlete.id, upperLower);
await planService.activatePlan(coach.id, athlete.id, maxPlan.id);
await planService.createPlan(coach.id, athlete.id, plan({ name: "Block 2 (Entwurf)", days: [] }));

const fullBody = plan({
  name: "Ganzkörper 3× pro Woche",
  days: (["Ganzkörper A", "Ganzkörper B", "Ganzkörper C"] as const).map((name, i) => ({
    name,
    weekday: [1, 3, 5][i],
    warmup: [{ name: "Locker einfahren", details: "5 min Fahrradergometer" }],
    exercises: [
      ex(["back-squat", "deadlift", "front-squat"][i]!, 3, [[6, 8], undefined, 2], 150),
      ex(["bench-press", "overhead-press", "dumbbell-bench-press"][i]!, 3, [[8, 10], undefined, 2]),
      ex(["lat-pulldown", "seated-cable-row", "one-arm-dumbbell-row"][i]!, 3, [[10, 12]]),
      ex("plank", 2, ["30s"], 60),
    ],
  })),
});
const leaPlan = await planService.createPlan(secondCoach.id, secondAthlete.id, fullBody);
await planService.activatePlan(secondCoach.id, secondAthlete.id, leaPlan.id);
await templateService.createTemplate(coach.id, { ...fullBody, name: "Ganzkörper Einsteiger" });

// Trainingsprotokolle für Max: sechs Wochen mit steigenden Gewichten (für den Fortschritt), in der
// Vorwoche einmal abgesagt, diese Woche alles vor heute.
const today = todayIsoDate();
const monday = isoWeekStart(isoWeekOf(today));
/** `weeksAgo`: je Woche zurück 2,5 % weniger Gewicht als im Plan (auf 0,5 kg gerundet). */
const logWorkout = async (
  dayId: string,
  date: string,
  rating: number,
  { notes, weeksAgo = 0 }: { notes?: string; weeksAgo?: number } = {},
) => {
  // Nachtragen geht nur 14 Tage zurück: ältere Trainings heute anlegen und dann zurückdatieren.
  const log = await workoutService.startWorkout(athlete.id, {
    dayId,
    date: date < addDays(today, -14) ? today : date,
  });
  await workoutService.completeMyWorkout(athlete.id, log.id, {
    revision: log.revision,
    rating,
    notes: notes ?? null,
    exercises: log.exercises.map((x) => ({
      id: x.id,
      skipped: false,
      notes: null,
      sets: x.sets.map((set) => ({
        ...set,
        weightKg:
          set.weightKg !== null && set.kind === "working"
            ? Math.round(set.weightKg * (1 - 0.025 * weeksAgo) * 2) / 2
            : set.weightKg,
        done: true,
      })),
    })),
  });
  // Abgeschlossen am Trainingstag um 19 Uhr (ältere Protokolle sind damit schreibgeschützt).
  await WorkoutLogModel.updateOne(
    { _id: log.id },
    { date, completedAt: new Date(`${date}T17:00:00Z`) },
  );
};
for (let weeksAgo = 6; weeksAgo >= 2; weeksAgo -= 1) {
  for (const day of maxPlan.days) {
    await logWorkout(day.id, addDays(monday, day.weekday! - 1 - 7 * weeksAgo), 7, { weeksAgo });
  }
}
for (const [i, day] of maxPlan.days.entries()) {
  const date = addDays(monday, day.weekday! - 8);
  if (i === 1) {
    await workoutService.skipWorkout(athlete.id, { dayId: day.id, date, notes: "Erkältet" });
  } else {
    await logWorkout(day.id, date, 7 + (i % 2), {
      notes: i === 0 ? "Bankdrücken lief richtig gut." : undefined,
      weeksAgo: 1,
    });
  }
}
for (const day of maxPlan.days.filter((d) => addDays(monday, d.weekday! - 1) < today)) {
  await logWorkout(day.id, addDays(monday, day.weekday! - 1), 8);
}
await weekService.updateWeeklyActivities(coach.id, athlete.id, [
  null,
  null,
  "Laufen 30 min",
  null,
  null,
  "Fußball",
  null,
]);

console.log(`
┌─────────────────────────────────────────────────────────┐
│  AthletePT Demo-Modus (Daten nur im Speicher)            │
│                                                          │
│  Web-App:   http://localhost:5173                        │
│  Passwort für alle Konten: ${DEMO_PASSWORD}                 │
│    Sysadmin  admin@demo.local                            │
│    Coach     coach@demo.local, coach2@demo.local         │
│    Athlet    athlet@demo.local, athletin@demo.local      │
│                                                          │
│  Mails (Einladungen, Passwort-Reset) erscheinen im Log.  │
└─────────────────────────────────────────────────────────┘
`);

const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

// Der Server baut seine eigene Verbindung auf.
await disconnectDatabase();
await import("../src/server");
