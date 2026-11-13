import { BoothStyleId, CapturedShot, LayoutId, StripCustomization } from '../types/booth';
import { renderCompositeShotCanvas, renderStripToCanvas } from './stripRenderer';

export interface ExportVideoParams {
  layoutId: LayoutId;
  themeId: string;
  boothStyle: BoothStyleId;
  backdropId: string;
  softBlend: boolean;
  roomCode: string;
  participantIds: string[];
  shots: CapturedShot[];
  customization: StripCustomization;
}

export async function exportBoothRecapVideo(params: ExportVideoParams): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording is not supported in this browser.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const stream = canvas.captureStream(24);
  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  // Pre-render the 6 composite shots + final strip
  const shotCanvases = await Promise.all(
    params.shots.map((shot) =>
      renderCompositeShotCanvas(shot, params.participantIds, 640, 480, {
        backdropId: params.backdropId,
        softBlend: params.softBlend,
        boothStyle: params.boothStyle,
        stripFilterId: params.customization.stripFilterId,
        filterIntensity: params.customization.filterIntensity,
      })
    )
  );

  const finalStrip = await renderStripToCanvas({
    layoutId: params.layoutId,
    themeId: params.themeId,
    boothStyle: params.boothStyle,
    backdropId: params.backdropId,
    softBlend: params.softBlend,
    roomCode: params.roomCode,
    participantIds: params.participantIds,
    shots: params.shots,
    customization: params.customization,
    targetScale: 0.7,
  });

  recorder.start();

  const waitMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Intro frame
  ctx.fillStyle = '#18181B';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FAF6EF';
  ctx.textAlign = 'center';
  ctx.font = '700 44px "Fraunces", Georgia, serif';
  ctx.fillText('Photo Lelo', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#FF4D4D';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText(`BOOTH RECAP · ${params.roomCode || 'SOLO'}`, canvas.width / 2, canvas.height / 2 + 30);
  await waitMs(850);

  // Cycle through each captured shot with a flash effect
  for (let i = 0; i < shotCanvases.length; i++) {
    const sc = shotCanvases[i];
    ctx.fillStyle = '#FAF6EF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sc, 40, 140, 640, 480);

    ctx.fillStyle = '#18181B';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`SHOT 0${i + 1} / 0${shotCanvases.length}`, canvas.width / 2, 92);

    ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#52525B';
    const prompt = params.shots[i]?.posePrompt || '';
    ctx.fillText(prompt.slice(0, 48), canvas.width / 2, 680);

    await waitMs(650);
  }

  // Final strip reveal
  ctx.fillStyle = '#18181B';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min((canvas.width - 100) / finalStrip.width, (canvas.height - 100) / finalStrip.height);
  const dw = finalStrip.width * scale;
  const dh = finalStrip.height * scale;
  ctx.drawImage(finalStrip, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  await waitMs(1700);

  recorder.stop();
  return stopPromise;
}
