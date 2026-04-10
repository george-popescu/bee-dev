// NavigationSidebar — HIVE intelligence nav tree stub.
//
// Quick 001 scope: renders a static list of 8 section entries (Phases, Notes,
// Seeds, Quick Tasks, Discussions, Forensics, Debug Sessions, Spec History)
// as non-interactive <li> entries inside a <nav> landmark. Clickability, file
// tree scanning, and file-opening behavior are deferred to later quick tasks.
//
// Design notes:
//   - Named function export, no required props, no internal state (pure stub).
//     React 19 ref-as-prop means no forwardRef wrapper is needed.
//   - Wrapped in the hive `Card` primitive to match `ActivityFeed`'s visual
//     weight on the opposite side of the dashboard. The Card adds the corner
//     brackets (`intel-card`) that are the signature of HIVE intel panels.
//   - Section entries are rendered as `<li>` inside a `<nav aria-label=...>`
//     landmark. They carry no onClick, no href, no role="button" — they are
//     pure presentational stubs. No hover affordance either: hover feedback
//     will be added in Quick 4 at the same time as real click handlers, so
//     sighted users only get the clickability cue when clicks actually work.
//     This avoids the UX trap of "visual affordance without function."
//   - Icons come from lucide-react (the dashboard's only icon library). The
//     icon set is deliberately evocative rather than literal: Layers for the
//     phase stack, StickyNote for notes, Sprout for seeds (ideas that grow),
//     Zap for quick tasks (fast bursts), MessagesSquare for discussions, Search
//     for forensics (investigation), Bug for debug sessions, History for the
//     archived spec timeline.

import {
  Bug,
  History,
  Layers,
  MessagesSquare,
  Search,
  Sprout,
  StickyNote,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: NavSection[] = [
  { id: 'phases', label: 'Phases', icon: Layers },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'seeds', label: 'Seeds', icon: Sprout },
  { id: 'quick', label: 'Quick Tasks', icon: Zap },
  { id: 'discussions', label: 'Discussions', icon: MessagesSquare },
  { id: 'forensics', label: 'Forensics', icon: Search },
  { id: 'debug', label: 'Debug Sessions', icon: Bug },
  { id: 'spec-history', label: 'Spec History', icon: History },
];

export function NavigationSidebar() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Navigation</CardTitle>
      </CardHeader>
      <CardContent>
        <nav aria-label="Dashboard navigation">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li
                key={id}
                className="flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-hive-muted"
              >
                <Icon
                  className="h-3.5 w-3.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{label}</span>
              </li>
            ))}
          </ul>
        </nav>
      </CardContent>
    </Card>
  );
}
