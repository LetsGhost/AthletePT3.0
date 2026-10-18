import { sexes, sexLabels, type AthleteProfile } from "@athletept/shared";

export interface Question {
  label: string;
  hint?: string;
  /** Anzahl Schreiblinien. */
  lines?: number;
  /** Ankreuzfelder statt Schreiblinien. */
  options?: readonly string[];
}

export interface QuestionSection {
  title: string;
  description?: string;
  questions: Question[];
}

/**
 * Jede Anamnese-Frage, wie sie der Athlet auf dem Papier-Fragebogen liest. Ohne die
 * internen Notizen des Coaches. Kommt ein Feld zur Anamnese dazu, meldet TypeScript
 * hier einen Fehler, damit der Fragebogen nicht veraltet.
 */
const profileQuestions = {
  birthDate: { label: "Geburtsdatum" },
  sex: { label: "Geschlecht", options: sexes.map((value) => sexLabels[value]) },
  heightCm: { label: "Größe in cm" },
  goal: {
    label: "Was möchtest du mit dem Training erreichen?",
    hint: "z. B. Fett abbauen, Kraft aufbauen",
  },
  focus: { label: "Worauf soll der Fokus liegen?", hint: "z. B. Oberkörper, Beine" },
  trainingsPerWeek: { label: "Wie oft pro Woche kannst du trainieren?" },
  trainingLocation: { label: "Wo trainierst du?", hint: "z. B. Fitnessstudio, zu Hause" },
  trainingTimes: { label: "Wann trainierst du meistens?", hint: "z. B. abends unter der Woche" },
  otherSports: { label: "Welche anderen Sportarten machst du?", lines: 2 },
  cardio: { label: "Machst du Cardio? Wenn ja, was und wie oft?", lines: 2 },
  physicalIssues: { label: "Hast du körperliche Beschwerden oder Schmerzen?", lines: 3 },
  conditions: {
    label: "Hast du Vorerkrankungen, Verletzungen oder sonstige Besonderheiten?",
    hint: "z. B. Operationen, Medikamente, Schwangerschaft",
    lines: 3,
  },
} satisfies Record<Exclude<keyof AthleteProfile, "coachNotes">, Question>;

const q = profileQuestions;

export const questionnaireSections: QuestionSection[] = [
  {
    title: "Kontakt",
    questions: [
      { label: "Name" },
      { label: "E-Mail", hint: "An diese Adresse geht die Einladung zur App." },
    ],
  },
  { title: "Körperdaten", questions: [q.birthDate, q.sex, q.heightCm] },
  { title: "Ziele", questions: [q.goal, q.focus, q.trainingsPerWeek] },
  {
    title: "Alltag und Sport",
    questions: [q.trainingLocation, q.trainingTimes, q.otherSports, q.cardio],
  },
  {
    title: "Gesundheit",
    description:
      "Freiwillig. Hilft deinem Coach, das Training sicher zu planen. Wird vertraulich behandelt.",
    questions: [q.physicalIssues, q.conditions],
  },
];
