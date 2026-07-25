import * as fs from 'fs-extra';
import { format } from 'date-fns';
import { parseProgressContent } from './ProgressTracker';

/** Markers delimiting the region of task.md this writer owns. */
export const SNAPSHOT_BEGIN = '<!-- claude-task:snapshots -->';
export const SNAPSHOT_END = '<!-- /claude-task:snapshots -->';

/** How many snapshot lines are kept; older ones are dropped. */
export const MAX_SNAPSHOTS = 10;

export interface SnapshotResult {
  /** False when nothing changed, there is no task, or the block is unusable. */
  written: boolean;
  line?: string;
}

const METRICS = /— (\d+\/\d+ subtasks \(\d+%\))\s*$/;

export function formatSnapshotLine(
  completed: number,
  total: number,
  percentage: number,
  date: Date = new Date()
): string {
  return `- ${format(date, 'yyyy-MM-dd HH:mm')} — ${completed}/${total} subtasks (${percentage}%)`;
}

/**
 * Records subtask progress into a managed block at the end of task.md:
 *
 *     <!-- claude-task:snapshots -->
 *     - 2026-07-26 14:03 — 3/5 subtasks (60%)
 *     <!-- /claude-task:snapshots -->
 *
 * Built for a Stop hook, which fires once per assistant turn — so a line is
 * only appended when the numbers actually changed, and the block is capped.
 * Everything outside the two markers is left byte-identical: user notes are
 * never parsed or rewritten.
 */
export class SnapshotWriter {
  private taskFile: string;

  constructor(taskFile: string) {
    this.taskFile = taskFile;
  }

  async write(now: Date = new Date()): Promise<SnapshotResult> {
    if (!await fs.pathExists(this.taskFile)) {
      return { written: false };
    }

    const content = await fs.readFile(this.taskFile, 'utf8');
    const progress = parseProgressContent(content);
    if (progress.total === 0) {
      return { written: false };
    }

    const begin = content.indexOf(SNAPSHOT_BEGIN);
    const end = content.indexOf(SNAPSHOT_END);
    if (begin !== -1 && end < begin) {
      // Half-written or hand-edited block: leave the file alone rather than
      // risk mangling it. A Stop hook must never damage the user's task file.
      return { written: false };
    }

    const entries = begin === -1
      ? []
      : this.parseEntries(content.slice(begin + SNAPSHOT_BEGIN.length, end));

    const line = formatSnapshotLine(progress.completed, progress.total, progress.percentage, now);
    if (entries.length > 0 && this.metrics(entries[entries.length - 1]) === this.metrics(line)) {
      return { written: false };
    }

    const kept = [...entries, line].slice(-MAX_SNAPSHOTS);
    const block = [SNAPSHOT_BEGIN, ...kept, SNAPSHOT_END].join('\n');

    const updated = begin === -1
      ? `${content.replace(/\s*$/, '')}\n\n${block}\n`
      : `${content.slice(0, begin)}${block}${content.slice(end + SNAPSHOT_END.length)}`;

    await fs.writeFile(this.taskFile, updated);
    return { written: true, line };
  }

  private parseEntries(region: string): string[] {
    return region
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('- '));
  }

  /** The comparable part of a line: its counts, without the timestamp. */
  private metrics(line: string): string | null {
    const match = line.match(METRICS);
    return match ? match[1] : null;
  }
}
