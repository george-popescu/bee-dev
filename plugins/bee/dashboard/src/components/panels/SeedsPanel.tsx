// SeedsPanel — T3.12 list widget rendering `.bee/seeds/seed-*.md`
// entries. Each seed shows its id + title with a truncated idea
// snippet so long ideas don't blow up the Card. The panel is wrapped
// in a Card with a fixed-height ScrollArea so long lists scroll
// internally instead of stretching the dashboard grid row.
//
// Empty-state rule: `seeds` may be `null | undefined | []`. In every
// case the panel renders a muted "No seeds yet" message inside the
// Card rather than crashing.

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SeedEntry } from '@/types/snapshot';

/** Truncate long idea blurbs so they fit on a single line. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

export interface SeedsPanelProps {
  seeds: SeedEntry[] | null | undefined;
}

export function SeedsPanel({ seeds }: SeedsPanelProps) {
  if (!seeds || seeds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seeds</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-hive-muted">No seeds yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seeds</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80 pr-4">
          <ul className="flex flex-col gap-3">
            {seeds.map((seed) => (
              <li key={seed.filePath} className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-hive-text">
                  {seed.id ? `${seed.id} — ` : ''}{seed.title || 'Untitled'}
                </span>
                <span className="text-xs text-hive-muted">
                  {truncate(seed.idea || '', 80)}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
