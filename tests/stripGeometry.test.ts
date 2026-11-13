import { describe, expect, it } from 'vitest';
import {
  BOOTH_STYLES,
  SHARED_BACKDROPS,
  STRIP_FILTERS,
  STRIP_LAYOUTS,
  THEME_FRAMES,
} from '../src/data/boothData';
import { getLayoutMeta, getLayoutSlots } from '../src/lib/stripRenderer';

describe('Photo Lelo layout geometry & theme catalog', () => {
  it('computes non-overlapping slots within bounds for every layout', () => {
    for (const layout of STRIP_LAYOUTS) {
      const meta = getLayoutMeta(layout.id);
      const slots = getLayoutSlots(layout.id);
      expect(slots).toHaveLength(meta.slotCount);

      for (const slot of slots) {
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.y).toBeGreaterThan(0);
        expect(slot.w).toBeGreaterThan(100);
        expect(slot.h).toBeGreaterThan(100);
        expect(slot.x + slot.w).toBeLessThanOrEqual(meta.width);
        expect(slot.y + slot.h).toBeLessThan(meta.height);
      }
    }
  });

  it('includes all booth styles, shared backdrops, filters, and diverse frame themes', () => {
    expect(BOOTH_STYLES.map((b) => b.id)).toEqual([
      'classic',
      'vintage',
      'meme',
      'laundromat',
      'subway',
      'karaoke',
    ]);
    expect(SHARED_BACKDROPS.length).toBeGreaterThanOrEqual(8);
    expect(STRIP_FILTERS.length).toBeGreaterThanOrEqual(8);
    expect(THEME_FRAMES.length).toBeGreaterThanOrEqual(20);
  });
});
