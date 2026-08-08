/**
 * S7-01 — code-drawn chapter visuals (Ref 09 §1: "Journey chapter art — soft
 * gradient blobs + icon", zero asset files). Display-only mapping aligned by
 * chapter id; screens consume this, never raw icon/color literals.
 */
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type ChapterIconName = ComponentProps<typeof Ionicons>['name'];

export interface ChapterArt {
  icon: ChapterIconName;
  /** Strong accent for the glyph. */
  iconColor: string;
  /** Soft blob fill behind the glyph. */
  blobColor: string;
}

export const CHAPTER_ART: readonly ChapterArt[] = Object.freeze([
  { icon: 'footsteps', iconColor: '#5EEAD4', blobColor: '#123B36' },
  { icon: 'barbell', iconColor: '#BEF264', blobColor: '#2E3A1A' },
  { icon: 'leaf', iconColor: '#86EFAC', blobColor: '#12351F' },
  { icon: 'compass', iconColor: '#7DD3FC', blobColor: '#12303E' },
  { icon: 'trail-sign', iconColor: '#A5B4FC', blobColor: '#1C2240' },
  { icon: 'shield', iconColor: '#C4B5FD', blobColor: '#2B1B3E' },
  { icon: 'trophy', iconColor: '#FCD34D', blobColor: '#3B2E12' },
]);

export function artForChapterId(id: number): ChapterArt | null {
  return CHAPTER_ART[id - 1] ?? null;
}
