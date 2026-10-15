import type { AthleteSummary, UserStatus } from "@athletept/shared";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/input-classes";
import { Progress } from "@/components/ui/progress";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useAthletes } from "@/features/athletes/api";
import { StatusBadge } from "@/features/users/status-badge";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const filters: { value: UserStatus | "current"; label: string }[] = [
  { value: "current", label: "Aktuell" },
  { value: "invited", label: "Eingeladen" },
  { value: "disabled", label: "Archiviert" },
];

function AthleteItem({ athlete }: { athlete: AthleteSummary }) {
  return (
    <li>
      <Link
        to={`/coach/athletes/${athlete.id}`}
        className="bg-surface hover:bg-inset flex items-center gap-4 rounded-card p-4 transition-colors"
      >
        <span
          aria-hidden="true"
          className="bg-primary text-on-primary flex size-11 shrink-0 items-center justify-center rounded-full font-semibold"
        >
          {initials(athlete.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{athlete.name}</span>
            {athlete.status !== "active" && (
              <StatusBadge status={athlete.status} disabledLabel="Archiviert" />
            )}
          </span>
          <span className="text-muted block truncate text-sm">
            {[athlete.focus, athlete.goal].filter(Boolean).join(" · ") || athlete.email}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-muted size-5 shrink-0" />
      </Link>
    </li>
  );
}

export default function AthletesPage() {
  const athletes = useAthletes();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("current");

  const quota = athletes.data?.quota;
  const quotaFull = quota ? quota.used >= quota.limit : false;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (athletes.data?.items ?? []).filter((a) => {
      const matchesFilter = filter === "current" ? a.status !== "disabled" : a.status === filter;
      const matchesSearch =
        !term || a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [athletes.data, search, filter]);

  return (
    <>
      <PageHeader
        title="Athleten"
        actions={
          quotaFull ? (
            <Button disabled aria-describedby="quota-hint">
              <UserPlus aria-hidden="true" className="size-5" /> Athlet einladen
            </Button>
          ) : (
            <Button asChild>
              <Link to="/coach/athletes/new">
                <UserPlus aria-hidden="true" className="size-5" /> Athlet einladen
              </Link>
            </Button>
          )
        }
      />

      <QueryState query={athletes} loading={<SkeletonList rows={4} />}>
        {(data) => (
          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <p className="mb-2 text-sm">
                <strong>{data.quota.used}</strong> von {data.quota.limit} Plätzen belegt
              </p>
              <Progress value={data.quota.used} max={data.quota.limit} label="Belegte Plätze" />
              {quotaFull && (
                <p id="quota-hint" className="text-muted mt-2 text-sm">
                  Dein Kontingent ist voll. Archiviere einen Athleten, um wieder jemanden
                  einzuladen.
                </p>
              )}
            </Card>

            {data.items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Users}
                  title="Noch keine Athleten"
                  description="Lade deinen ersten Athleten ein. Er bekommt eine Mail und legt dort sein Passwort fest."
                />
              </Card>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search
                      aria-hidden="true"
                      className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                    />
                    <input
                      type="search"
                      aria-label="Athleten suchen"
                      placeholder="Name oder E-Mail suchen"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={cn(inputClasses, "pl-10")}
                    />
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Status filtern"
                    className="bg-surface flex gap-1 rounded-card p-1"
                  >
                    {filters.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        role="radio"
                        aria-checked={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm",
                          filter === f.value ? "bg-bg font-medium" : "text-muted hover:text-text",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visible.length === 0 ? (
                  <p className="text-muted py-6 text-center">Keine Athleten gefunden.</p>
                ) : (
                  <ul className="flex flex-col gap-2" aria-label="Athleten">
                    {visible.map((athlete) => (
                      <AthleteItem key={athlete.id} athlete={athlete} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
