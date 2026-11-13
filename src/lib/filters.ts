import { FaceFilterId } from '../types/booth';

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function applyStripFilterToImageData(
  imageData: ImageData,
  filterId: string,
  intensityPct = 100
): ImageData {
  if (!filterId || filterId === 'original' || intensityPct <= 0) {
    return imageData;
  }

  const t = Math.max(0, Math.min(1, intensityPct / 100));
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i];
    const g0 = data[i + 1];
    const b0 = data[i + 2];

    let r = r0;
    let g = g0;
    let b = b0;

    switch (filterId) {
      case 'warm-film': {
        r = r0 * 1.09 + 10;
        g = g0 * 1.03 + 4;
        b = b0 * 0.89 - 4;
        // subtle lift in shadows
        r = r * 0.94 + 12;
        g = g * 0.95 + 10;
        b = b * 0.95 + 8;
        break;
      }
      case 'bw-classic': {
        const lum = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
        const c = (lum - 128) * 1.18 + 128;
        r = c;
        g = c;
        b = c;
        break;
      }
      case 'soft-rose': {
        r = r0 * 1.06 + 14;
        g = g0 * 0.97 + 6;
        b = b0 * 1.02 + 12;
        break;
      }
      case 'retro-ccd': {
        r = (r0 - 128) * 1.18 + 128 - 4;
        g = (g0 - 128) * 1.15 + 128 + 4;
        b = (b0 - 128) * 1.2 + 128 + 14;
        break;
      }
      case 'cool-seoul': {
        r = r0 * 0.97 + 6;
        g = g0 * 1.03 + 8;
        b = b0 * 1.09 + 12;
        break;
      }
      case 'sepia-1930': {
        const sr = r0 * 0.393 + g0 * 0.769 + b0 * 0.189;
        const sg = r0 * 0.349 + g0 * 0.686 + b0 * 0.168;
        const sb = r0 * 0.272 + g0 * 0.534 + b0 * 0.131;
        r = (sr - 128) * 1.08 + 128;
        g = (sg - 128) * 1.06 + 128;
        b = (sb - 128) * 1.04 + 124;
        break;
      }
      case 'vivid-pop': {
        const avg = (r0 + g0 + b0) / 3;
        r = avg + (r0 - avg) * 1.32;
        g = avg + (g0 - avg) * 1.32;
        b = avg + (b0 - avg) * 1.32;
        r = (r - 128) * 1.1 + 128;
        g = (g - 128) * 1.1 + 128;
        b = (b - 128) * 1.1 + 128;
        break;
      }
    }

    data[i] = clamp(r0 + (r - r0) * t);
    data[i + 1] = clamp(g0 + (g - g0) * t);
    data[i + 2] = clamp(b0 + (b - b0) * t);
  }

  return imageData;
}

export function applyFaceFilterToCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  faceFilter: FaceFilterId = 'natural'
) {
  if (faceFilter === 'natural') return;
  const map: Record<Exclude<FaceFilterId, 'natural'>, string> = {
    peach: 'soft-rose',
    seoul: 'cool-seoul',
    tungsten: 'sepia-1930',
    bw: 'bw-classic',
    ccd: 'retro-ccd',
  };
  const imgData = ctx.getImageData(0, 0, w, h);
  applyStripFilterToImageData(imgData, map[faceFilter], 85);
  ctx.putImageData(imgData, 0, 0);
}
