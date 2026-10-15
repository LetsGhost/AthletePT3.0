import { PageHeader } from "@/components/layout/page-header";
import { MyWeightAnalysisCard } from "@/features/stats/progress-card";
import { MyStreakCard } from "@/features/stats/streak-card";

export default function AthleteProgressPage() {
  return (
    <>
      <PageHeader
        title="Entwicklung"
        description="Wie regelmäßig du trainierst und wie sich deine Werte entwickeln."
      />
      <div className="flex flex-col gap-4">
        <MyStreakCard />
        <MyWeightAnalysisCard />
      </div>
    </>
  );
}
