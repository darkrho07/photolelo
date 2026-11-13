import {
  BoothStyleId,
  CapturedShot,
  LayoutId,
  StripCustomization,
  ThemeFrameMeta,
} from '../types/booth';
import { STRIP_LAYOUTS, THEME_FRAMES } from '../data/boothData';
import { applyStripFilterToImageData } from './filters';
import {
  drawBoothStyleOverlay,
  drawSharedBackdropBackground,
  drawSharedBackdropForeground,
} from './scenes';

export interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getLayoutMeta(layoutId: LayoutId) {
  return STRIP_LAYOUTS.find((l) => l.id === layoutId) || STRIP_LAYOUTS[0];
}

export function getThemeMeta(themeId: string): ThemeFrameMeta {
  return THEME_FRAMES.find((t) => t.id === themeId) || THEME_FRAMES[0];
}

export function getLayoutSlots(layoutId: LayoutId): SlotRect[] {
  const layout = getLayoutMeta(layoutId);
  const W = layout.width;
  const H = layout.height;

  if (layoutId === 'strip-1x4') {
    const padX = 42;
    const topPad = 52;
    const footerH = 196;
    const gap = 26;
    const slotW = W - padX * 2;
    const availH = H - topPad - footerH - gap * 3;
    const slotH = Math.floor(availH / 4);
    return Array.from({ length: 4 }, (_, i) => ({
      x: padX,
      y: topPad + i * (slotH + gap),
      w: slotW,
      h: slotH,
    }));
  }

  if (layoutId === 'grid-2x2') {
    const padX = 56;
    const topPad = 64;
    const footerH = 210;
    const gap = 30;
    const slotW = Math.floor((W - padX * 2 - gap) / 2);
    const slotH = Math.floor((H - topPad - footerH - gap) / 2);
    return [
      { x: padX, y: topPad, w: slotW, h: slotH },
      { x: padX + slotW + gap, y: topPad, w: slotW, h: slotH },
      { x: padX, y: topPad + slotH + gap, w: slotW, h: slotH },
      { x: padX + slotW + gap, y: topPad + slotH + gap, w: slotW, h: slotH },
    ];
  }

  if (layoutId === 'strip-1x3') {
    const padX = 44;
    const topPad = 56;
    const footerH = 200;
    const gap = 30;
    const slotW = W - padX * 2;
    const slotH = Math.floor((H - topPad - footerH - gap * 2) / 3);
    return Array.from({ length: 3 }, (_, i) => ({
      x: padX,
      y: topPad + i * (slotH + gap),
      w: slotW,
      h: slotH,
    }));
  }

  // polaroid-2
  const padX = 64;
  const topPad = 68;
  const footerH = 240;
  const gap = 42;
  const slotW = W - padX * 2;
  const slotH = Math.floor((H - topPad - footerH - gap) / 2);
  return Array.from({ length: 2 }, (_, i) => ({
    x: padX,
    y: topPad + i * (slotH + gap),
    w: slotW,
    h: slotH,
  }));
}

function drawFramePattern(
  ctx: CanvasRenderingContext2D,
  theme: ThemeFrameMeta,
  W: number,
  H: number
) {
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  switch (theme.pattern) {
    case 'hearts': {
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.28;
      ctx.font = '32px sans-serif';
      for (let y = 28; y < H; y += 72) {
        for (let x = 22; x < W; x += 72) {
          const offset = (Math.floor(y / 72) % 2) * 32;
          ctx.fillText('♥', x + offset, y);
        }
      }
      break;
    }
    case 'gingham': {
      const cell = 36;
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.22;
      for (let x = 0; x < W; x += cell * 2) {
        ctx.fillRect(x, 0, cell, H);
      }
      for (let y = 0; y < H; y += cell * 2) {
        ctx.fillRect(0, y, W, cell);
      }
      break;
    }
    case 'checker': {
      const cell = 34;
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.14;
      for (let y = 0; y < H; y += cell) {
        for (let x = 0; x < W; x += cell) {
          if ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0) {
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }
      break;
    }
    case 'dots': {
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.16;
      for (let y = 20; y < H; y += 44) {
        for (let x = 20; x < W; x += 44) {
          const shift = (Math.floor(y / 44) % 2) * 20;
          ctx.beginPath();
          ctx.arc(x + shift, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'stars': {
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.45;
      ctx.font = '24px sans-serif';
      for (let y = 34; y < H; y += 84) {
        for (let x = 26; x < W; x += 84) {
          const shift = (Math.floor(y / 84) % 2) * 36;
          ctx.fillText('✦', x + shift, y);
        }
      }
      break;
    }
    case 'bows': {
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.32;
      ctx.font = '28px sans-serif';
      for (let y = 36; y < H; y += 78) {
        for (let x = 24; x < W; x += 82) {
          const shift = (Math.floor(y / 78) % 2) * 38;
          ctx.fillText('🎀', x + shift, y);
        }
      }
      break;
    }
    case 'xoxo': {
      ctx.fillStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.22;
      ctx.font = '700 20px "JetBrains Mono", monospace';
      for (let y = 34; y < H; y += 64) {
        for (let x = 18; x < W; x += 96) {
          const shift = (Math.floor(y / 64) % 2) * 44;
          ctx.fillText('XOXO', x + shift, y);
        }
      }
      break;
    }
    case 'lace': {
      ctx.strokeStyle = theme.secondaryColor;
      ctx.lineWidth = 3;
      for (let x = 18; x < W - 18; x += 26) {
        ctx.beginPath();
        ctx.arc(x, 18, 12, 0, Math.PI * 2);
        ctx.arc(x, H - 18, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'ticket': {
      // Boarding pass airline stripes & perforated circles
      ctx.fillStyle = theme.secondaryColor;
      ctx.fillRect(0, 0, W, 22);
      ctx.fillRect(0, H - 22, W, 22);
      ctx.strokeStyle = theme.accentColor;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(28, H - 170);
      ctx.lineTo(W - 28, H - 170);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'postcard': {
      // Airmail red/blue diagonal border dashes
      const stripe = 24;
      for (let i = 0; i < W; i += stripe * 2) {
        ctx.fillStyle = theme.secondaryColor;
        ctx.fillRect(i, 0, stripe, 14);
        ctx.fillRect(i, H - 14, stripe, 14);
        ctx.fillStyle = theme.accentColor;
        ctx.fillRect(i + stripe, 0, stripe, 14);
        ctx.fillRect(i + stripe, H - 14, stripe, 14);
      }
      break;
    }
    case 'bistro': {
      ctx.strokeStyle = theme.secondaryColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, W - 32, H - 32);
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 24, W - 48, H - 48);
      break;
    }
    case 'sushi': {
      ctx.globalAlpha = 0.28;
      ctx.font = '28px sans-serif';
      for (let y = 36; y < H; y += 84) {
        for (let x = 22; x < W; x += 84) {
          ctx.fillText((x + y) % 2 === 0 ? '🍣' : '🍙', x, y);
        }
      }
      break;
    }
    case 'bakery': {
      ctx.globalAlpha = 0.28;
      ctx.font = '28px sans-serif';
      for (let y = 36; y < H; y += 84) {
        for (let x = 22; x < W; x += 84) {
          ctx.fillText((x + y) % 2 === 0 ? '🥐' : '🍓', x, y);
        }
      }
      break;
    }
    case 'typewriter': {
      ctx.strokeStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 2;
      for (let y = 40; y < H; y += 38) {
        ctx.beginPath();
        ctx.moveTo(22, y);
        ctx.lineTo(W - 22, y);
        ctx.stroke();
      }
      break;
    }
    case 'knit': {
      ctx.strokeStyle = theme.secondaryColor;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 3;
      for (let y = 16; y < H; y += 28) {
        for (let x = 16; x < W; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x - 8, y);
          ctx.lineTo(x, y + 10);
          ctx.lineTo(x + 8, y);
          ctx.stroke();
        }
      }
      break;
    }
    case 'pumpkin': {
      ctx.globalAlpha = 0.3;
      ctx.font = '28px sans-serif';
      for (let y = 36; y < H; y += 86) {
        for (let x = 22; x < W; x += 86) {
          ctx.fillText((x + y) % 2 === 0 ? '🎃' : '🍂', x, y);
        }
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

const imageCache = new Map<string, HTMLImageElement>();

export function loadImageCached(src: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(src);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const sw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const sh = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  if (!sw || !sh) return;

  const targetRatio = dw / dh;
  const srcRatio = sw / sh;
  let sx = 0;
  let sy = 0;
  let cropW = sw;
  let cropH = sh;

  if (srcRatio > targetRatio) {
    cropW = sh * targetRatio;
    sx = (sw - cropW) / 2;
  } else {
    cropH = sw / targetRatio;
    sy = (sh - cropH) / 2;
  }

  ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, dw, dh);
}

export async function renderCompositeShotCanvas(
  shot: CapturedShot | undefined,
  participantOrder: string[],
  slotW: number,
  slotH: number,
  options: {
    backdropId: string;
    softBlend: boolean;
    boothStyle: BoothStyleId;
    stripFilterId: string;
    filterIntensity: number;
  }
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(slotW));
  canvas.height = Math.max(1, Math.round(slotH));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const W = canvas.width;
  const H = canvas.height;

  // 1. Background shared backdrop
  if (options.backdropId && options.backdropId !== 'none') {
    drawSharedBackdropBackground(ctx, options.backdropId, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Collect available participant frames in order
  const frameEntries: Array<{ id: string; src: string }> = [];
  if (shot) {
    for (const pid of participantOrder) {
      if (shot.framesByParticipant[pid]) {
        frameEntries.push({ id: pid, src: shot.framesByParticipant[pid] });
      }
    }
    // Include any extra frame keys not yet in participantOrder
    for (const [pid, src] of Object.entries(shot.framesByParticipant)) {
      if (!frameEntries.some((e) => e.id === pid) && src) {
        frameEntries.push({ id: pid, src });
      }
    }
  }

  // Load images concurrently
  const loaded = await Promise.all(
    frameEntries.map(async (entry) => {
      try {
        const img = await loadImageCached(entry.src);
        return img;
      } catch {
        return null;
      }
    })
  );
  const imgs = loaded.filter((im): im is HTMLImageElement => im !== null);

  if (imgs.length === 1) {
    drawParticipantRegion(ctx, imgs[0], 0, 0, W, H, options.backdropId, options.softBlend);
  } else if (imgs.length === 2) {
    const halfW = W / 2;
    drawParticipantRegion(ctx, imgs[0], 0, 0, halfW, H, options.backdropId, options.softBlend);
    drawParticipantRegion(ctx, imgs[1], halfW, 0, W - halfW, H, options.backdropId, options.softBlend);
  } else if (imgs.length >= 3) {
    const halfW = W / 2;
    const halfH = H / 2;
    const regions: SlotRect[] = [
      { x: 0, y: 0, w: halfW, h: halfH },
      { x: halfW, y: 0, w: W - halfW, h: halfH },
      { x: 0, y: halfH, w: halfW, h: H - halfH },
      { x: halfW, y: halfH, w: W - halfW, h: H - halfH },
    ];
    imgs.slice(0, 4).forEach((img, idx) => {
      const r = regions[idx];
      drawParticipantRegion(ctx, img, r.x, r.y, r.w, r.h, options.backdropId, options.softBlend);
    });
  } else {
    // Empty placeholder frame
    ctx.fillStyle = '#27272A';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#71717A';
    ctx.font = `600 ${Math.max(14, Math.round(W * 0.05))}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POSE SLOT', W / 2, H / 2);
  }

  // 3. Foreground shared props across seam
  drawSharedBackdropForeground(ctx, options.backdropId, 0, 0, W, H);

  // 4. Booth style overlay (Laundromat porthole, Subway handles, Karaoke neon, Meme text)
  drawBoothStyleOverlay(ctx, options.boothStyle, 0, 0, W, H, shot?.memeCaption);

  // 5. Strip-wide color filter via deterministic pixel math
  if (options.stripFilterId && options.stripFilterId !== 'original') {
    const imgData = ctx.getImageData(0, 0, W, H);
    applyStripFilterToImageData(imgData, options.stripFilterId, options.filterIntensity);
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

function drawParticipantRegion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  backdropId: string,
  softBlend: boolean
) {
  ctx.save();
  if (backdropId !== 'none' && softBlend) {
    // Feathered rounded arch silhouette so shared sky/scenery surrounds heads & shoulders
    const padX = rw * 0.07;
    const padTop = rh * 0.12;
    ctx.beginPath();
    ctx.roundRect(rx + padX, ry + padTop, rw - padX * 2, rh - padTop + 4, [
      (rw - padX * 2) * 0.45,
      (rw - padX * 2) * 0.45,
      0,
      0,
    ]);
    ctx.clip();
    drawCoverImage(ctx, img, rx, ry, rw, rh);
  } else {
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    drawCoverImage(ctx, img, rx, ry, rw, rh);
  }
  ctx.restore();
}

export interface RenderStripParams {
  layoutId: LayoutId;
  themeId: string;
  boothStyle: BoothStyleId;
  backdropId: string;
  softBlend: boolean;
  roomCode: string;
  participantIds: string[];
  shots: CapturedShot[];
  customization: StripCustomization;
  targetScale?: number; // 1 = full 300 DPI (e.g. 600x1800)
}

export async function renderStripToCanvas(
  params: RenderStripParams,
  existingCanvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const layout = getLayoutMeta(params.layoutId);
  const theme = getThemeMeta(params.themeId);
  const scale = params.targetScale ?? 1;

  const W = Math.round(layout.width * scale);
  const H = Math.round(layout.height * scale);

  const canvas = existingCanvas || document.createElement('canvas');
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.scale(scale, scale);

  const baseW = layout.width;
  const baseH = layout.height;

  // 1. Frame background + pattern
  drawFramePattern(ctx, theme, baseW, baseH);

  // 2. Render each photo slot
  const slots = getLayoutSlots(params.layoutId);
  const selectedIndices = params.customization.selectedShotIndices;

  const slotCanvases = await Promise.all(
    slots.map((slot, slotIdx) => {
      const shotIndex = selectedIndices[slotIdx] ?? slotIdx;
      const shot = params.shots.find((s) => s.shotIndex === shotIndex) || params.shots[slotIdx];
      return renderCompositeShotCanvas(shot, params.participantIds, slot.w, slot.h, {
        backdropId: params.backdropId,
        softBlend: params.softBlend,
        boothStyle: params.boothStyle,
        stripFilterId: params.customization.stripFilterId,
        filterIntensity: params.customization.filterIntensity,
      });
    })
  );

  slots.forEach((slot, idx) => {
    const slotCanvas = slotCanvases[idx];
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, 8);
    ctx.clip();
    ctx.drawImage(slotCanvas, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();

    // Subtle crisp inner frame border
    ctx.strokeStyle =
      theme.bgColor === '#141417' || theme.bgColor === '#0F172A'
        ? 'rgba(255,255,255,0.18)'
        : 'rgba(24,24,27,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, 8);
    ctx.stroke();
  });

  // 3. Footer caption, metadata & Photo Lelo stamp
  const footerCenterY = baseH - (params.layoutId === 'polaroid-2' ? 115 : 95);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (theme.badgeText) {
    ctx.fillStyle = theme.accentColor;
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.fillText(theme.badgeText, baseW / 2, footerCenterY - 46, baseW - 80);
  }

  if (params.customization.caption.trim()) {
    ctx.fillStyle = theme.textColor;
    ctx.font = '700 28px "Fraunces", Georgia, serif';
    ctx.fillText(params.customization.caption.trim(), baseW / 2, footerCenterY - 6, baseW - 84);
  }

  const metaParts: string[] = [];
  if (params.customization.showDate) {
    const d = new Date();
    const formatted = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).toUpperCase();
    metaParts.push(formatted);
  }
  if (params.customization.showRoomCode && params.roomCode) {
    metaParts.push(`ROOM ${params.roomCode}`);
  }
  if (params.customization.showBrandMark) {
    metaParts.push('PHOTO LELO');
  }

  if (metaParts.length > 0) {
    ctx.fillStyle = theme.textColor;
    ctx.globalAlpha = 0.72;
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(metaParts.join(' · '), baseW / 2, footerCenterY + 34, baseW - 80);
    ctx.globalAlpha = 1;
  }

  // 4. Doodles (normalized 0..1)
  for (const stroke of params.customization.doodles) {
    if (stroke.points.length === 0) continue;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(2, stroke.width * baseW);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const p0 = stroke.points[0];
    ctx.moveTo(p0.x * baseW, p0.y * baseH);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineTo(p.x * baseW, p.y * baseH);
    }
    if (stroke.points.length === 1) {
      ctx.lineTo(p0.x * baseW + 0.5, p0.y * baseH + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 5. Stickers (normalized 0..1)
  for (const sticker of params.customization.stickers) {
    ctx.save();
    const sx = sticker.x * baseW;
    const sy = sticker.y * baseH;
    ctx.translate(sx, sy);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.scale(sticker.scale, sticker.scale);

    if (sticker.kind === 'emoji') {
      ctx.font = '56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sticker.label, 0, 0);
    } else {
      ctx.font = '800 24px "JetBrains Mono", monospace';
      const metrics = ctx.measureText(sticker.label);
      const pw = metrics.width + 28;
      const ph = 42;
      ctx.fillStyle = sticker.bgColor || '#FF4D4D';
      ctx.beginPath();
      ctx.roundRect(-pw / 2, -ph / 2, pw, ph, sticker.kind === 'badge' ? 99 : 10);
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = sticker.color || '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sticker.label, 0, 1);
    }
    ctx.restore();
  }

  ctx.restore();
  return canvas;
}
