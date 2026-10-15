import { CalendarDays, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryState, SkeletonList } from "@/components/ui/query-state";
import { useSession } from "@/features/auth/session";
import { useMyWeek } from "@/features/workouts/api";
import { formatWeekdayDate } from "@/features/workouts/format";
import { NewRecordsAlert } from "@/features/workouts/new-records";
import { WeekNavigation, WeekOverview } from "@/features/workouts/week-overview";

function WeekCard() {
  const [selected, setSelected] = useState<string | null>(null);
  const week = useMyWeek(selected);

  return (
    <Card>
      <CardHeader title="Trainingswoche" icon={CalendarDays} iconClassName="text-module-week" />
      <CardBody>
        <QueryState query={week} loading={<SkeletonList rows={4} className="h-12" />}>
          {(data) => (
            <div className="flex flex-col gap-4">
              {data.inProgress && (
                <Alert variant="info" title="Training läuft">
                  <p>
                    {data.inProgress.dayName}, begonnen am {formatWeekdayDate(data.inProgress.date)}
                    .
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to={`/workouts/${data.inProgress.id}`}>
                      <Play aria-hidden="true" className="size-4" /> Fortsetzen
                    </Link>
                  </Button>
                </Alert>
              )}
              <WeekNavigation
                week={data}
                selected={selected}
                onChange={setSelected}
                loading={week.isFetching}
              />
              {data.plan === null && data.otherLogs.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Noch kein Trainingsplan"
                  description="Sobald dein Coach einen Plan freigibt, siehst du hier deine Woche."
                />
              ) : (
                <WeekOverview
                  week={data}
                  dayHref={(day) => {
                    const running = day.logs.find((l) => l.status === "in_progress");
                    return running ? `/workouts/${running.id}` : `/plan/${day.dayId}`;
                  }}
                  logHref={(log) => `/workouts/${log.id}`}
                />
              )}
            </div>
          )}
        </QueryState>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const name = useSession((state) => state.user?.name ?? "");
  const firstName = name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hallo ${firstName}!`}
        description="Hier siehst du deine Woche auf einen Blick."
      />
      <NewRecordsAlert />
      <WeekCard />
    </>
  );
}
