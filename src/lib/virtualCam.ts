export type VirtualPoseId = 'smile' | 'halfheart-left' | 'halfheart-right' | 'peace' | 'kiss' | 'shocked';

export interface VirtualCamConfig {
  bgHex: string;
  shirtHex: string;
  skinHex: string;
  hairHex: string;
  pose: VirtualPoseId;
  label: string;
}

export const VIRTUAL_AVATAR_PRESETS: Array<{ name: string; skinHex: string; hairHex: string; shirtHex: string; bgHex: string }> = [
  { name: 'Sunny Coral', skinHex: '#F3C6A5', hairHex: '#27201C', shirtHex: '#FF4D4D', bgHex: '#FDE68A' },
  { name: 'Cobalt Chill', skinHex: '#E0AC8B', hairHex: '#18181B', shirtHex: '#2563EB', bgHex: '#DBEAFE' },
  { name: 'Matcha Mint', skinHex: '#C68B59', hairHex: '#1F1B18', shirtHex: '#10B981', bgHex: '#D1FAE5' },
  { name: 'Berry Pop', skinHex: '#FAD6BF', hairHex: '#5C3A21', shirtHex: '#EC4899', bgHex: '#FCE7F3' },
];

export function drawVirtualCamFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: VirtualCamConfig,
  timeMs: number
) {
  const bob = Math.sin(timeMs / 450) * (h * 0.012);
  const blink = (timeMs % 4200) > 4050;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, config.bgHex);
  grad.addColorStop(1, '#FAF6EF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Studio soft dots
  ctx.fillStyle = 'rgba(24,24,27,0.06)';
  for (let y = 24; y < h; y += 36) {
    for (let x = 24; x < w; x += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const cx = w / 2;
  const cy = h * 0.5 + bob;
  const headR = Math.min(w, h) * 0.21;

  // Shoulders / Shirt
  ctx.fillStyle = config.shirtHex;
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.94 + bob * 0.5, w * 0.34, h * 0.28, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.stroke();

  // Hair back
  ctx.fillStyle = config.hairHex;
  ctx.beginPath();
  ctx.arc(cx, cy - headR * 0.14, headR * 1.12, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();

  // Head
  ctx.fillStyle = config.skinHex;
  ctx.beginPath();
  ctx.arc(cx, cy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.stroke();

  // Hair bangs
  ctx.fillStyle = config.hairHex;
  ctx.beginPath();
  ctx.arc(cx, cy - headR * 0.28, headR * 0.98, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  // Rosy cheeks
  ctx.fillStyle = 'rgba(251, 113, 133, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - headR * 0.52, cy + headR * 0.18, headR * 0.18, headR * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + headR * 0.52, cy + headR * 0.18, headR * 0.18, headR * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#18181B';
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = Math.max(2, headR * 0.08);
  [-1, 1].forEach((dir) => {
    const ex = cx + dir * headR * 0.36;
    const ey = cy - headR * 0.02;
    if (blink || (config.pose === 'kiss' && dir === 1)) {
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ex, ey, headR * (config.pose === 'shocked' ? 0.14 : 0.1), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - headR * 0.03, ey - headR * 0.03, headR * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#18181B';
    }
  });

  // Mouth based on pose
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = Math.max(2, headR * 0.08);
  if (config.pose === 'shocked') {
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.ellipse(cx, cy + headR * 0.36, headR * 0.15, headR * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (config.pose === 'kiss') {
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.34, headR * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.22, headR * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Expressive hand/pose icons
  ctx.font = `${Math.round(headR * 0.72)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (config.pose === 'peace') {
    ctx.fillText('✌️', cx + headR * 1.05, cy + headR * 0.25);
  } else if (config.pose === 'halfheart-left') {
    ctx.fillText('🫶', cx + headR * 1.02, cy + headR * 0.2);
  } else if (config.pose === 'halfheart-right') {
    ctx.fillText('🫶', cx - headR * 1.02, cy + headR * 0.2);
  } else if (config.pose === 'kiss') {
    ctx.fillText('💋', cx + headR * 0.85, cy - headR * 0.45);
  }

  // Subtle badge
  ctx.fillStyle = 'rgba(24, 24, 27, 0.65)';
  ctx.beginPath();
  ctx.roundRect(12, h - 34, Math.min(w - 24, 150), 24, 99);
  ctx.fill();
  ctx.fillStyle = '#FAF6EF';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`STUDIO CAM · ${config.label.slice(0, 10).toUpperCase()}`, 22, h - 22);
}
