// HIVE INTELLIGENCE SYSTEMS — Command Center App
// Layout zones:
//   Zone 1: System Status — Config + Phases + Requirements (overview strip)
//   Zone 2: Analytics — Health Trend + Velocity + Code Quality (charts)
//   Zone 3: Intelligence Data — Notes, Seeds, Discussions, Forensics, Debug, Quick Tasks
import { MissionControlLayout, SectionDivider } from '@/components/MissionControlLayout';
import { NavigationSidebar } from '@/components/NavigationSidebar';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshot } from '@/hooks/useSnapshot';
import { useActivityFeed } from '@/hooks/useActivityFeed';

import { PhasesPanel } from '@/components/panels/PhasesPanel';
import { HealthTrendChart } from '@/components/panels/HealthTrendChart';
import { VelocityChart } from '@/components/panels/VelocityChart';
import { CodeQualityChart } from '@/components/panels/CodeQualityChart';
import { RequirementsCoveragePanel } from '@/components/panels/RequirementsCoveragePanel';
import { NotesPanel } from '@/components/panels/NotesPanel';
import { SeedsPanel } from '@/components/panels/SeedsPanel';
import { DiscussionsPanel } from '@/components/panels/DiscussionsPanel';
import { ForensicsPanel } from '@/components/panels/ForensicsPanel';
import { DebugSessionsPanel } from '@/components/panels/DebugSessionsPanel';
import { QuickTasksPanel } from '@/components/panels/QuickTasksPanel';
import { ConfigSummaryPanel } from '@/components/panels/ConfigSummaryPanel';
import { ArchivedSpecsPanel } from '@/components/panels/ArchivedSpecsPanel';

function SkeletonGrid() {
  return (
    <div className="space-y-5">
      {/* Zone 1 skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      {/* Zone 2 skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      {/* Zone 3 skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}

export default function App() {
  const { snapshot, connectionStatus, lastUpdated } = useSnapshot();
  const events = useActivityFeed(snapshot, connectionStatus);

  const flatMetrics = snapshot?.phaseMetrics?.flatMap((p) => p.phases ?? []) ?? [];

  return (
    <MissionControlLayout
      headerRight={
        <ConnectionStatus status={connectionStatus} lastUpdated={lastUpdated} />
      }
      feed={<ActivityFeed events={events} />}
      leftSidebar={<NavigationSidebar />}
    >
      {snapshot === null ? (
        <SkeletonGrid />
      ) : (
        <>
          {/* ════════════════════════════════════════════════════════════
              ZONE 1: SYSTEM STATUS — overview at a glance
              Config (left) | Phases (center) | Requirements (right)
              ════════════════════════════════════════════════════════════ */}
          <SectionDivider label="System Status" />
          {/* Zone 1: bump to xl:grid-cols-4 so the 4-up layout only fires at
              1280px+. At lg: (1024px) with both sidebars open the main area
              is ~384px wide — too narrow for 4 panels. xl: keeps the 2-up
              stack for that band and promotes to 4-up only when there is room. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <ConfigSummaryPanel config={snapshot.config} />
            <PhasesPanel phases={snapshot.state?.phases ?? null} />
            <RequirementsCoveragePanel requirements={snapshot.requirements} />
            <ArchivedSpecsPanel
              archivedSpecs={snapshot.archivedSpecs}
              currentSpecName={snapshot.state?.currentSpec?.name}
            />
          </div>

          {/* ════════════════════════════════════════════════════════════
              ZONE 2: ANALYTICS — charts and trends
              Health Trend | Velocity | Code Quality
              ════════════════════════════════════════════════════════════ */}
          <SectionDivider label="Analytics" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HealthTrendChart healthHistory={snapshot.healthHistory} />
            <VelocityChart
              phaseMetrics={flatMetrics}
              phases={snapshot.state?.phases ?? null}
            />
            <CodeQualityChart phaseMetrics={flatMetrics} />
          </div>

          {/* ════════════════════════════════════════════════════════════
              ZONE 3: INTELLIGENCE DATA — detailed feeds
              6 panels in a responsive 2x3 or 3x2 grid
              ════════════════════════════════════════════════════════════ */}
          <SectionDivider label="Intelligence Data" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ForensicsPanel forensics={snapshot.forensics} />
            <DebugSessionsPanel debugSessions={snapshot.debugSessions} />
            <NotesPanel notes={snapshot.notes} />
            <SeedsPanel seeds={snapshot.seeds} />
            <DiscussionsPanel discussions={snapshot.discussions} />
            <QuickTasksPanel quickTasks={snapshot.quickTasks} />
          </div>
        </>
      )}
    </MissionControlLayout>
  );
}
