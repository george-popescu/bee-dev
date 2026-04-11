// TabContentRenderer — pure switch from a Tab to its content component.
//
// Extracted from App.tsx so both the main pane and the secondary (split)
// pane render exactly the same way. Overview, file, phase, and roadmap
// tabs all flow through here.

import type { ReactNode } from 'react';
import type { Tab } from '@/hooks/useTabs';
import type { Snapshot } from '@/types/snapshot';
import { FileViewer } from '@/components/FileViewer';
import { PhaseDetailView } from '@/components/PhaseDetailView';
import { RoadmapView } from '@/components/RoadmapView';
import { LiveActivityPanel } from '@/components/LiveActivityPanel';
import type { LiveEvent } from '@/hooks/useLiveEvents';
import type { ConnectionStatusValue } from '@/hooks/useSnapshot';

export interface TabContentRendererProps {
  tab: Tab;
  snapshot: Snapshot | null;
  /** Rendered when the tab is the Overview tab. Let the parent pass the
   *  Overview zones so App.tsx stays the single place with the dashboard
   *  grid composition. */
  overviewContent: ReactNode;
  /** Optional click-through so the secondary pane's roadmap can open a
   *  phase tab in the main pane (or nowhere). */
  onOpenPhase?: (phaseNumber: number, label: string) => void;
  /** Live event stream from `useLiveEvents` — hoisted at the App root so
   *  both the main and split panes see the same buffer without each
   *  spawning its own polling loop. */
  liveEvents: LiveEvent[];
  /** Connection status of the live events poller — drives the panel's
   *  header badge. */
  liveConnectionStatus: ConnectionStatusValue;
}

export function TabContentRenderer({
  tab,
  snapshot,
  overviewContent,
  onOpenPhase,
  liveEvents,
  liveConnectionStatus,
}: TabContentRendererProps) {
  if (tab.kind === 'overview') {
    return <>{overviewContent}</>;
  }
  if (tab.kind === 'file') {
    return <FileViewer relativePath={tab.relativePath} label={tab.label} />;
  }
  if (tab.kind === 'phase') {
    return (
      <PhaseDetailView phaseNumber={tab.phaseNumber} snapshot={snapshot} />
    );
  }
  if (tab.kind === 'roadmap') {
    return <RoadmapView snapshot={snapshot} onOpenPhase={onOpenPhase} />;
  }
  if (tab.kind === 'live_activity') {
    return (
      <LiveActivityPanel
        events={liveEvents}
        connectionStatus={liveConnectionStatus}
      />
    );
  }
  return null;
}
