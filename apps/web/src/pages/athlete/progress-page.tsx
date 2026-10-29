import { PageHeader } from "@/components/layout/page-header";
import { MyBadgesCard } from "@/features/challenges/badges-card";
import { MyChallengesCard } from "@/features/challenges/challenges-card";
import { MyWeightAnalysisCard } from "@/features/stats/progress-card";
import { MyStreakCard } from "@/features/stats/streak-card";

export default function AthleteProgressPage() {
  return (
    <>
      <PageHeader title="Fortschritt" description="Streak, Challenges und Kraftentwicklung." />
      <div className="flex flex-col gap-4">
        <MyStreakCard />
        <MyChallengesCard />
        <MyBadgesCard />
        <MyWeightAnalysisCard />
      </div>
    </>
  );
}
