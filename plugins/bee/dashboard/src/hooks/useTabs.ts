/**
 * useTabs — tab-based content state for the dashboard main area.
 *
 * Layout model:
 *   - Tab 0 is always the pinned "Overview" tab (the original Zone 1/2/3
 *     dashboard grid). It cannot be closed. Opening a new tab does NOT
 *     replace it — it's always reachable.
 *   - All other tabs are opened when the user clicks an item in the
 *     NavigationSidebar (file entries → kind: 'file', phase entries →
 *     kind: 'phase', roadmap shortcut → kind: 'roadmap').
 *   - Opening the SAME target twice activates the existing tab instead
 *     of creating a duplicate — tabs are deduplicated by id.
 *   - Closing the active tab activates the tab immediately to its left,
 *     falling back to Overview if no tab is to the left.
 *
 * The hook is deliberately small and self-contained. Persistence across
 * reloads (localStorage) is deferred to Quick 8 polish.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';

export interface OverviewTab {
  id: 'overview';
  kind: 'overview';
  label: 'Overview';
  pinned: true;
}

export interface FileTab {
  id: string; // `file:${relativePath}`
  kind: 'file';
  label: string;
  relativePath: string;
  pinned: false;
}

export interface PhaseTab {
  id: string; // `phase:${phaseNumber}`
  kind: 'phase';
  label: string;
  phaseNumber: number;
  pinned: false;
}

export interface RoadmapTab {
  id: 'roadmap';
  kind: 'roadmap';
  label: 'Roadmap';
  pinned: false;
}

export type Tab =
  | OverviewTab
  | FileTab
  | PhaseTab
  | RoadmapTab;

const OVERVIEW_TAB: OverviewTab = {
  id: 'overview',
  kind: 'overview',
  label: 'Overview',
  pinned: true,
};

// localStorage keys — versioned so we can invalidate old shapes later.
const TABS_STORAGE_KEY = 'bee-hive:v1:tabs';
const ACTIVE_TAB_STORAGE_KEY = 'bee-hive:v1:activeTab';

// Tab validator — accepts only the known tab shapes. Unknown kinds are
// rejected so a future tab kind from another version doesn't silently
// populate the state.
function isTab(value: unknown): value is Tab {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.label !== 'string') return false;
  if (v.kind === 'overview') {
    return v.id === 'overview' && v.pinned === true;
  }
  if (v.kind === 'file') {
    return typeof v.relativePath === 'string' && v.pinned === false;
  }
  if (v.kind === 'phase') {
    return typeof v.phaseNumber === 'number' && v.pinned === false;
  }
  if (v.kind === 'roadmap') {
    return v.id === 'roadmap' && v.pinned === false;
  }
  return false;
}

function isTabArray(value: unknown): value is Tab[] {
  if (!Array.isArray(value)) return false;
  // Require the pinned Overview tab at index 0 — that's the invariant.
  if (value.length === 0) return false;
  if (!isTab(value[0]) || value[0].id !== 'overview') return false;
  return value.every(isTab);
}

function isStringId(value: unknown): value is string {
  return typeof value === 'string';
}

export interface UseTabsResult {
  tabs: Tab[];
  activeTab: Tab;
  activeTabId: string;
  openFileTab: (relativePath: string, label: string) => void;
  openPhaseTab: (phaseNumber: number, label: string) => void;
  openRoadmapTab: () => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
}

export function useTabs(): UseTabsResult {
  const [tabs, setTabs] = useLocalStorageState<Tab[]>(
    TABS_STORAGE_KEY,
    [OVERVIEW_TAB],
    { validate: isTabArray },
  );
  const [activeTabId, setActiveTabId] = useLocalStorageState<string>(
    ACTIVE_TAB_STORAGE_KEY,
    'overview',
    { validate: isStringId },
  );

  // If the hydrated activeTabId doesn't match any tab in the hydrated
  // array (e.g. user closed a tab in another session, or cross-tab
  // localStorage drift), fall back to Overview.
  const resolvedActive = tabs.find((t) => t.id === activeTabId);
  const activeTab = resolvedActive ?? OVERVIEW_TAB;

  // When the activeTabId drifts from any real tab, sync it back to Overview
  // so consumers (TabBar `aria-selected`, active highlight) stay consistent
  // with `activeTab`. Uses a useEffect so React's commit phase handles the
  // update instead of rendering with inconsistent state.
  useEffect(() => {
    if (!resolvedActive && activeTabId !== 'overview') {
      setActiveTabId('overview');
    }
  }, [resolvedActive, activeTabId, setActiveTabId]);

  // Ref mirror of the current tabs array — used by closeTab's
  // setActiveTabId updater to compute the left-neighbor from the pre-close
  // snapshot WITHOUT nesting state reads inside another setter's updater.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const openTab = useCallback((tab: Tab) => {
    setTabs((prev) => {
      if (prev.some((t) => t.id === tab.id)) {
        return prev;
      }
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  }, []);

  const openFileTab = useCallback(
    (relativePath: string, label: string) => {
      openTab({
        id: `file:${relativePath}`,
        kind: 'file',
        label,
        relativePath,
        pinned: false,
      });
    },
    [openTab],
  );

  const openPhaseTab = useCallback(
    (phaseNumber: number, label: string) => {
      openTab({
        id: `phase:${phaseNumber}`,
        kind: 'phase',
        label,
        phaseNumber,
        pinned: false,
      });
    },
    [openTab],
  );

  const openRoadmapTab = useCallback(() => {
    openTab({
      id: 'roadmap',
      kind: 'roadmap',
      label: 'Roadmap',
      pinned: false,
    });
  }, [openTab]);

  const closeTab = useCallback(
    (id: string) => {
      // Pull the closure state into locals so we can compute both next-tabs
      // and next-activeTabId without nesting setters. Nested setState inside
      // a setter's updater is an impurity that React StrictMode double-
      // invokes and the docs explicitly flag as an anti-pattern.
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        if (prev[idx].pinned) return prev; // cannot close pinned tabs
        return prev.slice(0, idx).concat(prev.slice(idx + 1));
      });
      // Active tab activation — compute independently from the most recent
      // activeTabId via the functional updater. This runs AFTER the setTabs
      // queue flushes; React batches these two updates together in event
      // handlers (automatic batching since React 18).
      setActiveTabId((currentActive) => {
        if (currentActive !== id) return currentActive;
        // We need to compute the left neighbor from the *pre-close* tabs
        // snapshot. Since we can't read state inside a setter updater,
        // use the current-render `tabs` closure — it reflects the state
        // at the time closeTab was invoked, which is the correct pre-close
        // snapshot for this event.
        const preCloseTabs = tabsRef.current;
        const idx = preCloseTabs.findIndex((t) => t.id === id);
        if (idx <= 0) return 'overview';
        const leftNeighbor = preCloseTabs[idx - 1];
        return leftNeighbor && leftNeighbor.id !== id
          ? leftNeighbor.id
          : 'overview';
      });
    },
    [],
  );

  const activateTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  return {
    tabs,
    activeTab,
    activeTabId,
    openFileTab,
    openPhaseTab,
    openRoadmapTab,
    closeTab,
    activateTab,
  };
}
