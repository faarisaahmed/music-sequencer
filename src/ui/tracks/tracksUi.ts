// UI-only state for the tracks area.
import { create } from 'zustand';

export const HEADER_W = 236;
export const RULER_H = 36;
export const AUTOMATION_H = 70;

export interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const useTracksUi = create<{
  showMaster: boolean;
  showArrangement: boolean;
  renamingRegionId: string | null;
  renamingTrackId: string | null;
  marquee: Marquee | null;
  dropIndicator: number | null; // y (content px) for track reorder
  snapLine: number | null; // beat of current snap guide during drags
}>(() => ({
  showMaster: false,
  showArrangement: true,
  renamingRegionId: null,
  renamingTrackId: null,
  marquee: null,
  dropIndicator: null,
  snapLine: null,
}));

/** Read a CSS-resolvable track colour; returns hex as given. */
export function regionColor(trackColor: string, regionColor?: string): string {
  return regionColor ?? trackColor;
}
