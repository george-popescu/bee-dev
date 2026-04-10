// DiscussionsPanel — T3.12 list widget rendering `.bee/discussions/*.md`
// entries. Each discussion shows its title and date. The panel is
// wrapped in a Card with a fixed-height ScrollArea so long lists
// scroll internally instead of stretching the dashboard grid row.
//
// Empty-state rule: `discussions` may be `null | undefined | []`. In
// every case the panel renders a muted "No discussions yet" message
// inside the Card rather than crashing.

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DiscussionEntry } from '@/types/snapshot';

export interface DiscussionsPanelProps {
  discussions: DiscussionEntry[] | null | undefined;
}

export function DiscussionsPanel({ discussions }: DiscussionsPanelProps) {
  if (!discussions || discussions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discussions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-hive-muted">No discussions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discussions</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80 pr-4">
          <ul className="flex flex-col gap-3">
            {discussions.map((discussion) => (
              <li key={discussion.filePath} className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-hive-text">
                  {discussion.title}
                </span>
                <span className="text-xs text-hive-muted">
                  {discussion.date}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
