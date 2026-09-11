import type { TFunction } from 'i18next';

import type { QuestSegmentKind } from '@/data/repositories/quests';

/** FR-TIMER-1 — friendly, capitalized segment kind label (§7.5 tone). */
export function segmentKindLabel(kind: QuestSegmentKind, t: TFunction): string {
  return t(`quest.segmentKind.${kind}`);
}
