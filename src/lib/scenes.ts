import { BoothStyleId, FacePropId } from '../types/booth';
import { SHARED_BACKDROPS } from '../data/boothData';

export function drawFaceProp(
  ctx: CanvasRenderingContext2D,
  propId: FacePropId | undefined,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!propId || propId === 'none') return;

  ctx.save();
  const cx = x + w / 2;
  const topY = y + h * 0.16;

  switch (propId) {
    case 'bow': {
      const bx = cx + w * 0.18;
      const by = topY + h * 0.04;
      const s = Math.min(w, h) * 0.09;
      ctx.fillStyle = '#FB7185';
      ctx.strokeStyle = '#FFF1F2';
      ctx.lineWidth = Math.max(1.5, s * 0.14);

      ctx.beginPath();
      ctx.ellipse(bx - s * 0.9, by, s * 0.85, s * 0.52, -0.25, 0, Math.PI * 2);
      ctx.ellipse(bx + s * 0.9, by, s * 0.85, s * 0.52, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(bx, by, s * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = '#E11D48';
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'catears': {
      const s = Math.min(w, h) * 0.11;
      const earY = topY + h * 0.02;
      [-1, 1].forEach((dir) => {
        const ex = cx + dir * w * 0.18;
        ctx.beginPath();
        ctx.moveTo(ex - s * 0.7, earY + s * 0.8);
        ctx.lineTo(ex + dir * s * 0.15, earY - s * 0.7);
        ctx.lineTo(ex + s * 0.7, earY + s * 0.8);
        ctx.closePath();
        ctx.fillStyle = '#18181B';
        ctx.fill();
        ctx.strokeStyle = '#FAF6EF';
        ctx.lineWidth = Math.max(1.5, s * 0.12);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ex - s * 0.35, earY + s * 0.65);
        ctx.lineTo(ex + dir * s * 0.1, earY - s * 0.25);
        ctx.lineTo(ex + s * 0.35, earY + s * 0.65);
        ctx.closePath();
        ctx.fillStyle = '#F9A8D4';
        ctx.fill();
      });
      break;
    }
    case 'heartshades': {
      const eyeY = y + h * 0.42;
      const r = Math.min(w, h) * 0.085;
      ctx.fillStyle = 'rgba(225, 29, 72, 0.86)';
      ctx.strokeStyle = '#FFF1F2';
      ctx.lineWidth = Math.max(2, r * 0.16);
      [-1, 1].forEach((dir) => {
        const hx = cx + dir * r * 1.15;
        ctx.beginPath();
        ctx.moveTo(hx, eyeY + r * 0.55);
        ctx.bezierCurveTo(hx - r * 1.1, eyeY - r * 0.1, hx - r * 0.85, eyeY - r * 0.95, hx, eyeY - r * 0.32);
        ctx.bezierCurveTo(hx + r * 0.85, eyeY - r * 0.95, hx + r * 1.1, eyeY - r * 0.1, hx, eyeY + r * 0.55);
        ctx.fill();
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, eyeY - r * 0.2);
      ctx.lineTo(cx + r * 0.3, eyeY - r * 0.2);
      ctx.stroke();
      break;
    }
    case 'starhalo': {
      const s = Math.min(w, h) * 0.055;
      const points = [-0.24, -0.12, 0, 0.12, 0.24];
      points.forEach((dx, i) => {
        const sx = cx + w * dx;
        const sy = topY - h * 0.02 + Math.abs(i - 2) * h * 0.025;
        drawStar(ctx, sx, sy, s * (i === 2 ? 1.25 : 0.9), '#FACC15', '#FEF9C3');
      });
      break;
    }
    case 'blush': {
      const cheekY = y + h * 0.53;
      const rx = w * 0.08;
      const ry = h * 0.04;
      [-1, 1].forEach((dir) => {
        const gx = cx + dir * w * 0.16;
        const grad = ctx.createRadialGradient(gx, cheekY, 0, gx, cheekY, rx);
        grad.addColorStop(0, 'rgba(251, 113, 133, 0.55)');
        grad.addColorStop(1, 'rgba(251, 113, 133, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(gx, cheekY, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fill: string,
  stroke?: string
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, radius * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSharedBackdropBackground(
  ctx: CanvasRenderingContext2D,
  backdropId: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const meta = SHARED_BACKDROPS.find((b) => b.id === backdropId) || SHARED_BACKDROPS[0];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, meta.skyTop);
  grad.addColorStop(1, meta.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  switch (backdropId) {
    case 'paris': {
      // Soft sun glow + distant Eiffel silhouette in the center background
      const sunGrad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.35, w * 0.02, x + w * 0.5, y + h * 0.35, w * 0.45);
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
      sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(x, y, w, h);

      // Eiffel Tower center silhouette
      ctx.fillStyle = 'rgba(88, 28, 44, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.495, y + h * 0.16);
      ctx.lineTo(x + w * 0.505, y + h * 0.16);
      ctx.lineTo(x + w * 0.56, y + h * 0.72);
      ctx.lineTo(x + w * 0.53, y + h * 0.72);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.55, x + w * 0.47, y + h * 0.72);
      ctx.lineTo(x + w * 0.44, y + h * 0.72);
      ctx.closePath();
      ctx.fill();

      // Warm window curtains framing edges
      ctx.fillStyle = 'rgba(255, 241, 242, 0.18)';
      ctx.fillRect(x, y, w * 0.08, h);
      ctx.fillRect(x + w * 0.92, y, w * 0.08, h);
      break;
    }
    case 'tokyo': {
      // Glowing city bokeh lights & Tokyo Tower spire
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      for (let i = 0; i < 8; i++) {
        const bw = w * 0.14;
        const bh = h * (0.28 + ((i * 19) % 25) / 100);
        ctx.fillRect(x + i * (w / 7.5), y + h - bh, bw, bh);
      }
      const glow = ['rgba(56, 189, 248, 0.45)', 'rgba(251, 146, 60, 0.45)', 'rgba(244, 114, 182, 0.45)'];
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = glow[i % glow.length];
        const bx = x + ((i * 73) % 92 + 4) * (w / 100);
        const by = y + ((i * 41) % 60 + 20) * (h / 100);
        ctx.beginPath();
        ctx.arc(bx, by, w * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'cinema': {
      // Theater screen beam & velvet curtain ridges
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(x + (i * w) / 10, y, w / 20, h);
      }
      const screenGlow = ctx.createRadialGradient(x + w * 0.5, y + h * 0.15, w * 0.05, x + w * 0.5, y + h * 0.2, w * 0.6);
      screenGlow.addColorStop(0, 'rgba(254, 243, 199, 0.25)');
      screenGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = screenGlow;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'cafe': {
      // Hanging pendant lamps
      [0.24, 0.5, 0.76].forEach((px) => {
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.45)';
        ctx.lineWidth = Math.max(1.5, w * 0.004);
        ctx.beginPath();
        ctx.moveTo(x + w * px, y);
        ctx.lineTo(x + w * px, y + h * 0.12);
        ctx.stroke();

        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(x + w * px, y + h * 0.13, w * 0.024, Math.PI, 0);
        ctx.fill();
      });
      break;
    }
    case 'picnic': {
      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      [
        [0.22, 0.18],
        [0.74, 0.22],
      ].forEach(([cxp, cyp]) => {
        const cx = x + w * cxp;
        const cy = y + h * cyp;
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.05, 0, Math.PI * 2);
        ctx.arc(cx - w * 0.04, cy + h * 0.015, w * 0.038, 0, Math.PI * 2);
        ctx.arc(cx + w * 0.04, cy + h * 0.015, w * 0.038, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 'santorini': {
      // Aegean horizon + white cliff arch
      ctx.fillStyle = '#0369A1';
      ctx.fillRect(x, y + h * 0.62, w, h * 0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x + w * 0.12, y + h * 0.75, w * 0.12, Math.PI, 0);
      ctx.arc(x + w * 0.88, y + h * 0.75, w * 0.12, Math.PI, 0);
      ctx.fill();
      break;
    }
    case 'rooftop': {
      // Stars
      ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
      for (let i = 0; i < 22; i++) {
        const sx = x + ((i * 47 + 13) % 94 + 3) * (w / 100);
        const sy = y + ((i * 29 + 7) % 58 + 4) * (h / 100);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, w * 0.004), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }

  ctx.restore();
}

export function drawSharedBackdropForeground(
  ctx: CanvasRenderingContext2D,
  backdropId: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!backdropId || backdropId === 'none') return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  switch (backdropId) {
    case 'paris': {
      // Balcony railing along the bottom edge
      const railY = y + h * 0.84;
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.75)';
      ctx.lineWidth = Math.max(2, w * 0.008);
      ctx.beginPath();
      ctx.moveTo(x, railY);
      ctx.lineTo(x + w, railY);
      ctx.stroke();
      for (let i = 1; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (i * w) / 12, railY);
        ctx.lineTo(x + (i * w) / 12, y + h);
        ctx.stroke();
      }
      break;
    }
    case 'tokyo': {
      // Two iced drinks sitting in the center foreground
      const tableY = y + h * 0.86;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
      ctx.fillRect(x, tableY, w, h * 0.14);
      [-0.045, 0.045].forEach((offset, idx) => {
        const cx = x + w * (0.5 + offset);
        const cy = tableY - h * 0.01;
        const cw = w * 0.055;
        const ch = h * 0.11;
        ctx.fillStyle = idx === 0 ? 'rgba(134, 239, 172, 0.9)' : 'rgba(253, 186, 116, 0.9)';
        ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.5, w * 0.004);
        ctx.strokeRect(cx - cw / 2, cy - ch, cw, ch);
        // Straw
        ctx.beginPath();
        ctx.moveTo(cx + cw * 0.1, cy - ch * 0.7);
        ctx.lineTo(cx + cw * 0.35, cy - ch * 1.28);
        ctx.stroke();
      });
      break;
    }
    case 'cinema': {
      // Velvet chairs silhouette & central striped popcorn bucket!
      ctx.fillStyle = '#7F1D1D';
      ctx.beginPath();
      ctx.roundRect(x + w * 0.04, y + h * 0.78, w * 0.42, h * 0.25, w * 0.04);
      ctx.roundRect(x + w * 0.54, y + h * 0.78, w * 0.42, h * 0.25, w * 0.04);
      ctx.fill();

      // Popcorn tub right in the middle
      const px = x + w * 0.5;
      const py = y + h * 0.96;
      const pw = w * 0.11;
      const ph = h * 0.14;
      ctx.fillStyle = '#FEF3C7';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(px + i * pw * 0.18, py - ph + (Math.abs(i) % 2) * ph * 0.08, pw * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(px - pw * 0.5, py - ph);
      ctx.lineTo(px + pw * 0.5, py - ph);
      ctx.lineTo(px + pw * 0.38, py);
      ctx.lineTo(px - pw * 0.38, py);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(px - pw * 0.14, py - ph, pw * 0.28, ph);
      break;
    }
    case 'cafe': {
      // Bistro table & latte cup
      ctx.fillStyle = '#451A03';
      ctx.fillRect(x, y + h * 0.87, w, h * 0.13);
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.roundRect(x + w * 0.45, y + h * 0.79, w * 0.1, h * 0.09, [0, 0, w * 0.03, w * 0.03]);
      ctx.fill();
      break;
    }
    case 'picnic': {
      // Gingham blanket strip at the bottom
      const by = y + h * 0.86;
      const size = Math.max(8, w * 0.035);
      for (let gx = x; gx < x + w; gx += size) {
        for (let gy = by; gy < y + h; gy += size) {
          const isEven = (Math.floor((gx - x) / size) + Math.floor((gy - by) / size)) % 2 === 0;
          ctx.fillStyle = isEven ? '#EF4444' : '#FFFFFF';
          ctx.fillRect(gx, gy, size, size);
        }
      }
      break;
    }
    case 'santorini': {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y + h * 0.88, w, h * 0.12);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(x, y + h * 0.865, w, h * 0.015);
      break;
    }
    case 'rooftop': {
      // String lights curved across the top
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = Math.max(1.2, w * 0.003);
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.06);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.16, x + w, y + h * 0.06);
      ctx.stroke();
      for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        const lx = x + w * t;
        const ly = y + h * (0.06 + Math.sin(t * Math.PI) * 0.065);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(lx, ly, w * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }

  ctx.restore();
}

export function drawBoothStyleOverlay(
  ctx: CanvasRenderingContext2D,
  boothStyle: BoothStyleId,
  x: number,
  y: number,
  w: number,
  h: number,
  memeCaption?: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  switch (boothStyle) {
    case 'vintage': {
      // Subtle 1930s warm vignette & rounded film corners
      const vig = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.25, x + w / 2, y + h / 2, w * 0.72);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(42, 20, 8, 0.36)');
      ctx.fillStyle = vig;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'laundromat': {
      // Circular washer porthole mask around the frame!
      const cx = x + w / 2;
      const cy = y + h / 2;
      const radius = Math.min(w, h) * 0.45;
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.fill();

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = Math.max(4, w * 0.025);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = Math.max(2, w * 0.008);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.94, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'subway': {
      // Overhead chrome bar + two metro straps
      const barY = y + h * 0.1;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.max(3, w * 0.012);
      ctx.beginPath();
      ctx.moveTo(x, barY);
      ctx.lineTo(x + w, barY);
      ctx.stroke();

      [0.24, 0.76].forEach((px) => {
        const sx = x + w * px;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(2, w * 0.008);
        ctx.beginPath();
        ctx.moveTo(sx, barY);
        ctx.lineTo(sx, barY + h * 0.1);
        ctx.stroke();

        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = Math.max(3, w * 0.01);
        ctx.beginPath();
        ctx.moveTo(sx, barY + h * 0.1);
        ctx.lineTo(sx - w * 0.035, barY + h * 0.18);
        ctx.lineTo(sx + w * 0.035, barY + h * 0.18);
        ctx.closePath();
        ctx.stroke();
      });
      break;
    }
    case 'karaoke': {
      // Neon corner glow + karaoke lyric subtitle bar
      const neonGrad = ctx.createLinearGradient(x, y, x + w, y + h);
      neonGrad.addColorStop(0, 'rgba(236, 72, 153, 0.25)');
      neonGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
      neonGrad.addColorStop(1, 'rgba(56, 189, 248, 0.25)');
      ctx.fillStyle = neonGrad;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = Math.max(3, w * 0.01);
      ctx.strokeRect(x + w * 0.02, y + h * 0.02, w * 0.96, h * 0.96);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
      ctx.fillRect(x + w * 0.1, y + h * 0.85, w * 0.8, h * 0.1);
      ctx.fillStyle = '#38BDF8';
      ctx.font = `700 ${Math.max(10, Math.round(w * 0.042))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪ TONIGHT WE SHINE TOGETHER ♪', x + w / 2, y + h * 0.9);
      break;
    }
    case 'meme': {
      if (memeCaption) {
        const fontSize = Math.max(11, Math.round(w * 0.046));
        ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = Math.max(3, fontSize * 0.22);
        ctx.strokeStyle = '#18181B';
        const text = memeCaption.toUpperCase().slice(0, 40);
        ctx.strokeText(text, x + w / 2, y + h * 0.94, w * 0.9);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x + w / 2, y + h * 0.94, w * 0.9);
      }
      break;
    }
  }

  ctx.restore();
}
