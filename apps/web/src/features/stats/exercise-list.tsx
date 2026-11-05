import {
  bodyGroupLabels,
  bodyGroups,
  type BodyGroup,
  type ExerciseStatsListResponse,
} from "@athletept/shared";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { inputClasses } from "@/components/ui/input-classes";
import { cn } from "@/lib/cn";

import { ChangeBadge, Sparkline } from "./change";
import { mainCurrent, sessionsText } from "./format";

const sorts = {
  recent: "Zuletzt trainiert",
  change: "Größte Steigerung",
  name: "A–Z",
} as const;
type Sort = keyof typeof sorts;

interface ExerciseStatsListProps {
  data: ExerciseStatsListResponse;
  href: (exerciseId: string) => string;
}

/** Alle trainierten Übungen mit Suche, Filter nach Körperbereich und Sortierung. */
export function ExerciseStatsList({ data, href }: ExerciseStatsListProps) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<BodyGroup | null>(null);
  const [sort, setSort] = useState<Sort>("recent");

  const groups = bodyGroups.filter((g) => data.items.some((item) => item.bodyGroup === g));
  const query = search.trim().toLocaleLowerCase("de");
  const items = data.items
    .filter(
      (item) =>
        (!group || item.bodyGroup === group) &&
        (!query || item.exerciseName.toLocaleLowerCase("de").includes(query)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.exerciseName.localeCompare(b.exerciseName, "de")
        : sort === "change"
          ? (b.change?.percent ?? -Infinity) - (a.change?.percent ?? -Infinity)
          : 0,
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Übung suchen"
          placeholder="Übung suchen"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={cn(inputClasses, "pl-10")}
        />
      </div>
      {groups.length > 1 && (
        <div
          role="group"
          aria-label="Körperbereich"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]"
        >
          {[null, ...groups].map((g) => (
            <button
              key={g ?? "all"}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={cn(
                "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium whitespace-nowrap",
                group === g
                  ? "bg-text text-bg"
                  : "border-border-strong text-text hover:bg-inset border",
              )}
            >
              {g ? bodyGroupLabels[g] : "Alle"}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-muted text-xs" aria-live="polite">
          {items.length === 1 ? "1 Übung" : `${items.length} Übungen`}
        </span>
        <label className="text-muted inline-flex items-center gap-1.5 text-xs">
          Sortieren
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="border-border-strong bg-inset text-text h-9 rounded-lg border px-2 text-sm"
          >
            {Object.entries(sorts).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {items.length === 0 ? (
        <div className="bg-surface flex flex-col items-center gap-1.5 rounded-tile px-4 py-7 text-center">
          <p className="text-sm font-medium">Keine Übung gefunden</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setGroup(null);
            }}
            className="text-accent min-h-9 px-3 text-sm font-medium"
          >
            Suche zurücksetzen
          </button>
        </div>
      ) : (
        <ul
          aria-label="Übungen"
          className="bg-surface divide-border divide-y overflow-hidden rounded-tile"
        >
          {items.map((item) => (
            <li key={item.exerciseId}>
              <Link
                to={href(item.exerciseId)}
                className="hover:bg-inset flex items-center gap-3 py-3 pr-3 pl-3.5 transition-colors"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold">{item.exerciseName}</span>
                  <span className="text-muted truncate text-xs">{sessionsText(item)}</span>
                </span>
                <Sparkline summary={item} />
                <span className="flex w-20 shrink-0 flex-col items-end">
                  <span className="font-semibold tabular-nums">{mainCurrent(item)}</span>
                  <ChangeBadge summary={item} className="text-xs" />
                </span>
                <ChevronRight aria-hidden="true" className="text-muted size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
