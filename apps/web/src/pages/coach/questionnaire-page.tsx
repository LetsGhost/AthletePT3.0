import { Printer } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { questionnaireSections, type Question } from "@/features/athletes/questionnaire";

function QuestionBlock({ question }: { question: Question }) {
  return (
    <div className="break-inside-avoid">
      <p className="font-medium">{question.label}</p>
      {question.hint && <p className="text-muted text-sm">{question.hint}</p>}
      {question.options ? (
        <div className="mt-2 flex flex-wrap gap-6">
          {question.options.map((option) => (
            <span key={option} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="border-text size-4 rounded-sm border" />
              {option}
            </span>
          ))}
        </div>
      ) : (
        Array.from({ length: question.lines ?? 1 }, (_, index) => (
          <div key={index} aria-hidden="true" className="border-border-strong h-9 border-b" />
        ))
      )}
    </div>
  );
}

/**
 * Leerer Anamnese-Fragebogen zum Ausdrucken oder Speichern als PDF. Läuft ohne App-Rahmen
 * und immer hell, damit der Ausdruck nur den Bogen zeigt.
 */
export default function QuestionnairePage() {
  return (
    <div data-theme="light" className="bg-surface text-text min-h-dvh">
      {/* Der Tab-Titel wird beim Speichern als PDF zum Dateinamen. */}
      <title>Fragebogen AthletePT</title>
      <div className="bg-inset border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 print:hidden">
        <p className="text-muted text-sm">
          Im Druckdialog „Als PDF speichern“ wählen und die Datei an den Athleten schicken.
        </p>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-4" /> Drucken oder als PDF speichern
        </Button>
      </div>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 print:max-w-none print:p-0">
        <header className="flex flex-col gap-4">
          <Logo />
          <div>
            <h1 className="text-2xl font-medium">Fragebogen für dein Training</h1>
            <p className="text-muted mt-1">
              Damit dein Coach deinen Plan auf dich abstimmen kann. Beantworte, was du weißt, und
              schick den Bogen zurück. Alles andere besprecht ihr im Erstgespräch.
            </p>
          </div>
        </header>

        {questionnaireSections.map((section) => (
          <section key={section.title} className="flex flex-col gap-5">
            <div className="border-border border-b pb-2">
              <h2 className="text-lg font-medium">{section.title}</h2>
              {section.description && <p className="text-muted text-sm">{section.description}</p>}
            </div>
            {section.questions.map((question) => (
              <QuestionBlock key={question.label} question={question} />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
