/**
 * PH4-01 — pure journal display derivation: completion rows in, grouped dated
 * entries out. Nothing here fetches, reads state, or renders. Entry feel:
 * "Aug 22 — First Steps · 8 min · +50 XP · Strength up".
 */
import type { JournalRow } from '@/data/repositories/journal';
import { formatDuration } from '@/features/questBoard/format';

const TRACK_LABELS: Record<string, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  mobility: 'Mobility',
  discipline: 'Discipline',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar-day label on plain YYYY-MM-DD keys — Today / Yesterday / "Aug 22". */
export function journalDayLabel(dayKey: string | null, todayKey: string): string {
  if (!dayKey) {
    return '—';
  }
  if (dayKey === todayKey) {
    return 'Today';
  }
  const yesterday = new Date(`${todayKey}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dayKey === yesterday.toISOString().slice(0, 10)) {
    return 'Yesterday';
  }
  const parts = dayKey.split('-');
  const month = Number(parts[1]);
  return `${MONTHS[month - 1] ?? ''} ${Number(parts[2])}`;
}

export interface JournalEntry {
  key: string;
  title: string;
  metaLine: string;
}

export interface JournalSection {
  key: string;
  dayLabel: string;
  entries: JournalEntry[];
}

/**
 * Group completions into per-day sections (rows arrive completed_at DESC, so
 * groups come newest-first and stay in-session order inside each day).
 * Mastery tracks render as a compact "Strength up" suffix when present.
 */
export function journalSections(rows: readonly JournalRow[], todayKey: string): JournalSection[] {
  const sections = new Map<string, JournalSection>();
  rows.forEach((row, index) => {
    const groupKey = row.dayKey ?? `undated-${row.completedAt}-${index}`;
    let section = sections.get(groupKey);
    if (!section) {
      section = { key: groupKey, dayLabel: journalDayLabel(row.dayKey, todayKey), entries: [] };
      sections.set(groupKey, section);
    }
    const title = row.questTitle ?? 'A quest completed';
    const metaParts: string[] = [];
    if (row.durationSec !== null) {
      metaParts.push(formatDuration(row.durationSec));
    }
    metaParts.push(`+${row.xp} XP`);
    const masteredSuffix = row.masteredTracks
      .map((track) => `${TRACK_LABELS[track] ?? track} up`)
      .join(' · ');
    section.entries.push({
      key: `${groupKey}-${index}`,
      title,
      metaLine: masteredSuffix
        ? `${metaParts.join(' · ')} · ${masteredSuffix}`
        : metaParts.join(' · '),
    });
  });
  return [...sections.values()];
}
