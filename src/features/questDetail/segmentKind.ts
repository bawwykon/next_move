import type { QuestSegmentKind } from '@/data/repositories/quests';

const KIND_LABELS: Record<QuestSegmentKind, string> = {
  warmup: 'Warm-up',
  work: 'Work',
  rest: 'Rest',
  cooldown: 'Cooldown',
};

/** FR-TIMER-1 — friendly, capitalized segment kind label (§7.5 tone). */
export function segmentKindLabel(kind: QuestSegmentKind): string {
  return KIND_LABELS[kind];
}
