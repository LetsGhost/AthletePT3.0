import {
  equipmentLabels,
  equipmentTypes,
  exerciseCategoryLabels,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from "@athletept/shared";
import {
  Archive,
  ArchiveRestore,
  Dumbbell,
  Eye,
  Globe,
  Pencil,
  Plus,
  Search,
  Undo2,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/input-classes";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "@/components/ui/toast-store";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/http";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import {
  useAdoptExercise,
  useArchiveExercise,
  useAthleteExercises,
  useExerciseCatalog,
  useExerciseSubmissions,
  usePublishExercise,
  useRestoreExercise,
  useSubmitExercise,
  useWithdrawExercise,
  type ExerciseFilters,
} from "./api";
import { ExerciseDetailsDialog } from "./exercise-details-dialog";
import { ExerciseFormDialog } from "./exercise-form-dialog";
import { ExerciseNotices } from "./exercise-notices";
import { muscleGroupsByRegion, muscleSummary, scopeLabel } from "./labels";
import { OwnedExerciseList } from "./owned-exercise-list";

type Mode = "athlete" | "coach" | "sysadmin";
/** Katalog oder die Liste zu prüfender Übungen (Coach: von Athleten, Sysadmin: Vorschläge). */
type View = "catalog" | "inbox";
type ScopeFilter = "all" | "global" | "own";
type StatusFilter = "active" | "archived";

const scopeOptions = [
  { value: "all", label: "Alle" },
  { value: "global", label: "Katalog" },
  { value: "own", label: "Eigene" },
] as const;

const statusOptions = [
  { value: "active", label: "Aktiv" },
  { value: "archived", label: "Archiviert" },
] as const;

const titles: Record<Mode, string> = {
  athlete: "Meine Übungen",
  coach: "Übungen",
  sysadmin: "Übungskatalog",
};

const descriptions: Record<Mode, string> = {
  athlete:
    "Übungen, die im Katalog fehlen. Nur du siehst sie, dein Coach kann sie prüfen und übernehmen.",
  coach: "Der Katalog steht allen Coaches zur Verfügung. Eigene Übungen siehst nur du.",
  sysadmin: "Globale Übungen, die alle Coaches in ihren Plänen verwenden können.",
};

const formCatalog = { athlete: "private", coach: "own", sysadmin: "global" } as const;

const muscleOptions = muscleGroupsByRegion.flatMap((group) => group.options);

interface ExerciseRowProps {
  exercise: Exercise;
  mode: Mode;
  onEdit: () => void;
  onShow: () => void;
}

function ExerciseRow({ exercise, mode, onEdit, onShow }: ExerciseRowProps) {
  const archive = useArchiveExercise();
  const restore = useRestoreExercise();
  const submit = useSubmitExercise();
  const withdraw = useWithdrawExercise();
  const editable =
    mode === "sysadmin" ||
    (mode === "coach" && exercise.scope === "own") ||
    (mode === "athlete" && exercise.scope === "private");
  const label = mode === "sysadmin" ? null : scopeLabel(exercise.scope, mode);

  const run = async (action: typeof archive, message: string) => {
    try {
      await action.mutateAsync(exercise.id);
      toast(message);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{exercise.name}</p>
            {label && <Badge tone="success">{label}</Badge>}
            {exercise.submitted && <Badge tone="warning">Vorgeschlagen</Badge>}
          </div>
          <p className="text-muted text-sm">
            {exerciseCategoryLabels[exercise.category]} · {equipmentLabels[exercise.equipment]}
          </p>
          <p className="text-sm">{muscleSummary(exercise)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exercise.archived ? (
            <Button
              variant="secondary"
              size="sm"
              loading={restore.isPending}
              aria-label={`${exercise.name} wiederherstellen`}
              onClick={() => void run(restore, `„${exercise.name}“ wiederhergestellt.`)}
            >
              <ArchiveRestore aria-hidden="true" className="size-4" /> Wiederherstellen
            </Button>
          ) : editable ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${exercise.name} bearbeiten`}
                onClick={onEdit}
              >
                <Pencil aria-hidden="true" className="size-4" /> Bearbeiten
              </Button>
              {mode === "coach" &&
                (exercise.submitted ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={withdraw.isPending}
                    aria-label={`Vorschlag für ${exercise.name} zurückziehen`}
                    onClick={() =>
                      void run(withdraw, `Vorschlag für „${exercise.name}“ zurückgezogen.`)
                    }
                  >
                    <Undo2 aria-hidden="true" className="size-4" /> Zurückziehen
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={submit.isPending}
                    aria-label={`${exercise.name} für den globalen Katalog vorschlagen`}
                    onClick={() =>
                      void run(
                        submit,
                        `„${exercise.name}“ vorgeschlagen. Der Sysadmin prüft die Übung.`,
                      )
                    }
                  >
                    <Globe aria-hidden="true" className="size-4" /> Vorschlagen
                  </Button>
                ))}
              <Button
                variant="ghost"
                size="sm"
                loading={archive.isPending}
                aria-label={`${exercise.name} archivieren`}
                onClick={() =>
                  void run(
                    archive,
                    `„${exercise.name}“ archiviert. Bestehende Pläne behalten die Übung.`,
                  )
                }
              >
                <Archive aria-hidden="true" className="size-4" /> Archivieren
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${exercise.name} ansehen`}
              onClick={onShow}
            >
              <Eye aria-hidden="true" className="size-4" /> Details
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

/** Umschalter Katalog / zu prüfende Übungen, mit Anzahl der offenen. */
function ViewSwitch({
  mode,
  view,
  onChange,
}: {
  mode: "coach" | "sysadmin";
  view: View;
  onChange: (view: View) => void;
}) {
  const athleteExercises = useAthleteExercises({ enabled: mode === "coach" });
  const submissions = useExerciseSubmissions({ enabled: mode === "sysadmin" });
  const count = (mode === "coach" ? athleteExercises : submissions).data?.items.length ?? 0;
  const inboxLabel = mode === "coach" ? "Von Athleten" : "Vorschläge";
  return (
    <SegmentedControl
      label="Ansicht"
      className="mb-4"
      options={[
        { value: "catalog", label: "Alle Übungen" },
        { value: "inbox", label: count > 0 ? `${inboxLabel} (${count})` : inboxLabel },
      ]}
      value={view}
      onChange={onChange}
    />
  );
}

function CoachInbox() {
  return (
    <OwnedExerciseList
      query={useAthleteExercises()}
      take={useAdoptExercise()}
      ownerLabel={(x) => `von ${x.owner.name}`}
      intro="Übungen, die deine Athleten für ihre Pläne angelegt haben. Übernimmst du eine, steht sie in deinem Katalog und gehört dir. Der Athlet kann sie weiter verwenden, aber nicht mehr ändern."
      takenMessage={(name) => `„${name}“ ist jetzt in deinem Katalog.`}
      emptyTitle="Keine neuen Übungen"
      emptyDescription="Legen deine Athleten mit eigenem Trainingsplan Übungen an, findest du sie hier."
    />
  );
}

function SysadminInbox() {
  return (
    <OwnedExerciseList
      query={useExerciseSubmissions()}
      take={usePublishExercise()}
      ownerLabel={(x) => `von Coach ${x.owner.name}`}
      intro="Übungen, die Coaches für den globalen Katalog vorgeschlagen haben. Übernimmst du eine, sehen sie alle Coaches, ändern kannst nur noch du."
      takenMessage={(name) => `„${name}“ ist jetzt im globalen Katalog.`}
      emptyTitle="Keine Vorschläge"
      emptyDescription="Schlagen Coaches eigene Übungen vor, findest du sie hier."
    />
  );
}

/**
 * Übungsliste mit Suche und Filtern. Coaches sehen Katalog und eigene Übungen (globale nur
 * lesend) und prüfen die Übungen ihrer Athleten, der Sysadmin pflegt den globalen Katalog und
 * prüft Vorschläge. Athleten mit eigenem Trainingsplan pflegen hier ihre privaten Übungen.
 */
export function ExerciseCatalog({ mode }: { mode: Mode }) {
  const [view, setView] = useState<View>("catalog");
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "">("");
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [showing, setShowing] = useState<Exercise | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const archived = status === "archived";
  // Archivierte Katalog-Übungen gehen Coaches nichts an, sie sehen nur eigene archivierte.
  const effectiveScope =
    mode === "athlete" ? "private" : mode === "coach" ? (archived ? "own" : scope) : "all";
  const filters: ExerciseFilters = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(muscle && { muscle }),
    ...(equipment && { equipment }),
    ...(effectiveScope !== "all" && { scope: effectiveScope }),
    ...(archived && { archived: "true" }),
  };
  const filtered = Boolean(debouncedSearch || muscle || equipment);
  const catalog = useExerciseCatalog(filters);

  const resetFilters = () => {
    setSearch("");
    setMuscle("");
    setEquipment("");
  };

  return (
    <>
      <PageHeader
        title={titles[mode]}
        description={descriptions[mode]}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" className="size-5" />
            {mode === "coach" ? "Eigene Übung" : "Neue Übung"}
          </Button>
        }
      />
      {mode !== "sysadmin" && <ExerciseNotices />}
      {mode !== "athlete" && <ViewSwitch mode={mode} view={view} onChange={setView} />}

      {view === "inbox" && mode === "coach" ? (
        <CoachInbox />
      ) : view === "inbox" && mode === "sysadmin" ? (
        <SysadminInbox />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <input
                type="search"
                aria-label="Übungen suchen"
                placeholder="Name oder Synonym suchen"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn(inputClasses, "pl-10")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Muskelgruppe"
                placeholder="Alle Muskelgruppen"
                options={muscleOptions}
                value={muscle}
                onChange={(event) => setMuscle(event.target.value as MuscleGroup | "")}
              />
              <SelectField
                label="Equipment"
                placeholder="Jedes Equipment"
                options={equipmentTypes.map((value) => ({ value, label: equipmentLabels[value] }))}
                value={equipment}
                onChange={(event) => setEquipment(event.target.value as Equipment | "")}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              {mode === "coach" && !archived ? (
                <SegmentedControl
                  label="Herkunft filtern"
                  options={scopeOptions}
                  value={scope}
                  onChange={setScope}
                />
              ) : (
                <span />
              )}
              <SegmentedControl
                label="Status filtern"
                options={statusOptions}
                value={status}
                onChange={setStatus}
              />
            </div>
          </div>

          <QueryState query={catalog} loading={<SkeletonList rows={5} />}>
            {(data) => {
              const items = data.pages.flatMap((page) => page.items);
              const total = data.pages[0]?.total ?? 0;
              if (total === 0) {
                return (
                  <Card>
                    {filtered ? (
                      <EmptyState
                        icon={Search}
                        title="Keine Übungen gefunden"
                        description="Versuche einen anderen Suchbegriff oder weniger Filter."
                        action={
                          <Button variant="secondary" onClick={resetFilters}>
                            Filter zurücksetzen
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Dumbbell}
                        title={
                          archived
                            ? "Keine archivierten Übungen"
                            : effectiveScope === "own"
                              ? "Noch keine eigenen Übungen"
                              : "Noch keine Übungen"
                        }
                        description={
                          archived
                            ? undefined
                            : "Lege eine Übung an. Sie steht danach in der Übungsauswahl der Pläne bereit."
                        }
                      />
                    )}
                  </Card>
                );
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-muted text-sm" aria-live="polite">
                    {total === 1 ? "1 Übung" : `${total} Übungen`}
                  </p>
                  <ul className="flex flex-col gap-2" aria-label="Übungen">
                    {items.map((exercise) => (
                      <ExerciseRow
                        key={exercise.id}
                        exercise={exercise}
                        mode={mode}
                        onEdit={() => setEditing(exercise)}
                        onShow={() => setShowing(exercise)}
                      />
                    ))}
                  </ul>
                  {catalog.hasNextPage && (
                    <Button
                      variant="secondary"
                      className="self-center"
                      loading={catalog.isFetchingNextPage}
                      onClick={() => void catalog.fetchNextPage()}
                    >
                      Mehr laden ({items.length} von {total})
                    </Button>
                  )}
                </div>
              );
            }}
          </QueryState>
        </>
      )}

      {editing && (
        <ExerciseFormDialog
          key={editing === "new" ? "new" : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          exercise={editing === "new" ? undefined : editing}
          catalog={formCatalog[mode]}
        />
      )}
      {showing && (
        <ExerciseDetailsDialog
          exercise={showing}
          onOpenChange={(open) => !open && setShowing(null)}
        />
      )}
    </>
  );
}
