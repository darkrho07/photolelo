import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Film,
  KeyRound,
  Magnet,
  RotateCcw,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { getLayoutMeta, renderStripToCanvas } from '../lib/stripRenderer';
import { exportBoothRecapVideo } from '../lib/videoExporter';
import {
  CapturedShot,
  Participant,
  RoomConfig,
  StripCustomization,
} from '../types/booth';
import { StripPreviewCanvas } from './StripPreviewCanvas';

interface ExportGalleryProps {
  roomCode: string | null;
  participants: Participant[];
  config: RoomConfig;
  shots: CapturedShot[];
  customization: StripCustomization;
  onBackToStudio: () => void;
  onRetake: () => void;
}

type KeepsakeTab = 'magnet' | 'keychain' | 'wallpaper';

export function ExportGallery({
  roomCode,
  participants,
  config,
  shots,
  customization,
  onBackToStudio,
  onRetake,
}: ExportGalleryProps) {
  const [keepsakeTab, setKeepsakeTab] = useState<KeepsakeTab>('magnet');
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [copiedImg, setCopiedImg] = useState(false);

  const layout = getLayoutMeta(config.layoutId);
  const participantIds = useMemo(() => participants.map((p) => p.id), [participants]);

  const buildFullResCanvas = () =>
    renderStripToCanvas({
      layoutId: config.layoutId,
      themeId: config.themeId,
      boothStyle: config.boothStyle,
      backdropId: config.backdropId,
      softBlend: config.softBlend,
      roomCode: roomCode || 'SOLO',
      participantIds,
      shots,
      customization,
      targetScale: 1,
    });

  const handleDownloadPng = async () => {
    setDownloadingPng(true);
    try {
      const canvas = await buildFullResCanvas();
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-lelo-${roomCode || 'solo'}-${Date.now()}.png`;
      a.click();
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleDownloadWallpaper = async () => {
    const stripCanvas = await buildFullResCanvas();
    const wp = document.createElement('canvas');
    wp.width = 1080;
    wp.height = 1920;
    const ctx = wp.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#FAF6EF');
    grad.addColorStop(1, '#F3E8D8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, wp.width, wp.height);

    // Subtle polka texture
    ctx.fillStyle = 'rgba(24, 24, 27, 0.04)';
    for (let y = 40; y < wp.height; y += 64) {
      for (let x = 40; x < wp.width; x += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const scale = Math.min(820 / stripCanvas.width, 1340 / stripCanvas.height);
    const dw = stripCanvas.width * scale;
    const dh = stripCanvas.height * scale;
    const dx = (wp.width - dw) / 2;
    const dy = (wp.height - dh) / 2 + 60;

    ctx.save();
    ctx.shadowColor = 'rgba(24, 24, 27, 0.28)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(stripCanvas, dx, dy, dw, dh);
    ctx.restore();

    const a = document.createElement('a');
    a.href = wp.toDataURL('image/png');
    a.download = `photo-lelo-wallpaper-${Date.now()}.png`;
    a.click();
  };

  const handleCopyPng = async () => {
    try {
      const canvas = await buildFullResCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 2000);
      }, 'image/png');
    } catch {
      setCopiedImg(false);
    }
  };

  const handleGenerateRecapVideo = async () => {
    setRenderingVideo(true);
    setVideoError(null);
    try {
      const blob = await exportBoothRecapVideo({
        layoutId: config.layoutId,
        themeId: config.themeId,
        boothStyle: config.boothStyle,
        backdropId: config.backdropId,
        softBlend: config.softBlend,
        roomCode: roomCode || 'SOLO',
        participantIds,
        shots,
        customization,
      });
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Unable to generate video.');
    } finally {
      setRenderingVideo(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* Left: Warm Paper Chute Ejection */}
        <div className="lg:col-span-5">
          <div className="tactile-card overflow-hidden rounded-3xl bg-[#EFE7DA] p-6">
            {/* Booth Dispenser Slot */}
            <div className="mx-auto mb-3 h-5 w-72 rounded-full border-2 border-zinc-900 bg-zinc-900 shadow-inner" />

            <div className="animate-strip-eject mx-auto w-60 rounded-xl border-2 border-zinc-900 bg-white p-1.5 shadow-[8px_8px_0px_#18181B] sm:w-68">
              <StripPreviewCanvas
                layoutId={config.layoutId}
                themeId={config.themeId}
                boothStyle={config.boothStyle}
                backdropId={config.backdropId}
                softBlend={config.softBlend}
                roomCode={roomCode || 'SOLO'}
                participantIds={participantIds}
                shots={shots}
                customization={customization}
                previewScale={0.55}
              />
            </div>

            <div className="mt-5 text-center font-mono-code text-xs font-bold text-zinc-600">
              PRINT-READY 300 DPI · {layout.width}×{layout.height} PX · ZERO WATERMARK PAYWALL
            </div>
          </div>
        </div>

        {/* Right: Downloads, Video Recap & Keepsakes */}
        <div className="space-y-6 lg:col-span-7">
          <div className="tactile-card rounded-3xl p-6">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-zinc-900 bg-[#FFB800] px-3 py-0.5 font-mono-code text-[11px] font-bold">
              <Sparkles className="h-3.5 w-3.5" /> FRESH OUT OF THE BOOTH
            </div>
            <h1 className="font-display mt-2 text-3xl font-bold text-zinc-900">
              Your Photo Lelo strip is ready!
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Download crisp 300 DPI print quality free, save an animated booth recap clip, or turn it into your phone lockscreen.
            </p>

            {/* Primary Download Buttons */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={downloadingPng}
                className="tactile-btn flex items-center justify-center gap-2 rounded-xl bg-[#FF4D4D] px-5 py-3.5 text-sm font-extrabold text-white"
              >
                <Download className="h-4 w-4" />
                {downloadingPng ? 'Rendering 300 DPI...' : 'Download HD Strip (PNG)'}
              </button>

              <button
                type="button"
                onClick={handleDownloadWallpaper}
                className="tactile-btn flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold text-white"
              >
                <Smartphone className="h-4 w-4" />
                Download Lockscreen (1080×1920)
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleGenerateRecapVideo}
                disabled={renderingVideo}
                className="tactile-btn inline-flex items-center gap-2 rounded-xl bg-[#FFB800] px-4 py-2.5 text-xs font-extrabold text-zinc-900"
              >
                <Film className="h-4 w-4" />
                {renderingVideo ? 'Compiling Booth Video (~4s)...' : 'Generate Booth Recap Video (WebM)'}
              </button>

              <button
                type="button"
                onClick={handleCopyPng}
                className="tactile-btn inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-zinc-900"
              >
                {copiedImg ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />}
                {copiedImg ? 'Copied PNG!' : 'Copy Image'}
              </button>
            </div>

            {videoError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {videoError}
              </p>
            )}

            {videoUrl && (
              <div className="mt-4 rounded-2xl border-2 border-zinc-900 bg-zinc-900 p-3 text-white">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono-code text-xs font-bold text-[#FFB800]">
                    BOOTH SESSION VIDEO RECAP
                  </span>
                  <a
                    href={videoUrl}
                    download={`photo-lelo-recap-${roomCode || 'solo'}.webm`}
                    className="rounded-lg bg-[#10B981] px-3 py-1 text-xs font-extrabold text-white hover:opacity-90"
                  >
                    Download .WebM
                  </a>
                </div>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="mx-auto max-h-72 rounded-xl"
                />
              </div>
            )}
          </div>

          {/* Interactive Keepsake Previews */}
          <div className="tactile-card rounded-3xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-zinc-900">
                Keepsake Previewer
              </h2>
              <div className="flex gap-1.5">
                {[
                  { id: 'magnet', label: 'Fridge Magnet', icon: Magnet },
                  { id: 'keychain', label: 'Keychain', icon: KeyRound },
                  { id: 'wallpaper', label: 'Lockscreen', icon: Smartphone },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setKeepsakeTab(t.id as KeepsakeTab)}
                      className={`inline-flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-xs font-bold ${
                        keepsakeTab === t.id
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {keepsakeTab === 'magnet' && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-zinc-900 bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] p-6">
                <div className="relative -rotate-2 rounded-xl border-4 border-white bg-white p-1 shadow-xl">
                  <div className="mx-auto mb-1 h-2.5 w-8 rounded-full bg-zinc-300" />
                  <div className="w-28">
                    <StripPreviewCanvas
                      layoutId={config.layoutId}
                      themeId={config.themeId}
                      boothStyle={config.boothStyle}
                      backdropId={config.backdropId}
                      softBlend={config.softBlend}
                      roomCode={roomCode || 'SOLO'}
                      participantIds={participantIds}
                      shots={shots}
                      customization={customization}
                      previewScale={0.28}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold text-zinc-700">
                  Die-cut vinyl fridge magnet mockup — print 300 DPI at any local print shop!
                </p>
              </div>
            )}

            {keepsakeTab === 'keychain' && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-zinc-900 bg-gradient-to-br from-[#FCE7F3] to-[#FBCFE8] p-6">
                <div className="flex flex-col items-center">
                  <div className="h-7 w-7 rounded-full border-4 border-zinc-400" />
                  <div className="h-3 w-1.5 bg-zinc-400" />
                  <div className="rounded-2xl border-4 border-white/80 bg-white/60 p-2 shadow-2xl backdrop-blur">
                    <div className="w-24">
                      <StripPreviewCanvas
                        layoutId={config.layoutId}
                        themeId={config.themeId}
                        boothStyle={config.boothStyle}
                        backdropId={config.backdropId}
                        softBlend={config.softBlend}
                        roomCode={roomCode || 'SOLO'}
                        participantIds={participantIds}
                        shots={shots}
                        customization={customization}
                        previewScale={0.25}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold text-zinc-700">
                  Clear acrylic 5×15 cm strip keychain preview
                </p>
              </div>
            )}

            {keepsakeTab === 'wallpaper' && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-zinc-900 bg-zinc-900 p-6">
                <div className="relative flex w-48 flex-col items-center rounded-[28px] border-4 border-zinc-700 bg-[#FAF6EF] p-3 shadow-2xl">
                  <div className="mb-1 h-1.5 w-12 rounded-full bg-zinc-900" />
                  <div className="font-display text-2xl font-bold text-zinc-900">11:11</div>
                  <div className="mb-2 font-mono-code text-[9px] text-zinc-500">PHOTO LELO</div>
                  <div className="w-28 rounded-lg border border-zinc-900 bg-white p-0.5 shadow">
                    <StripPreviewCanvas
                      layoutId={config.layoutId}
                      themeId={config.themeId}
                      boothStyle={config.boothStyle}
                      backdropId={config.backdropId}
                      softBlend={config.softBlend}
                      roomCode={roomCode || 'SOLO'}
                      participantIds={participantIds}
                      shots={shots}
                      customization={customization}
                      previewScale={0.24}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation back / retake */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onBackToStudio}
              className="tactile-btn rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-zinc-900"
            >
              ← Keep Editing Stickers &amp; Doodles
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="tactile-btn inline-flex items-center gap-1.5 rounded-xl bg-[#10B981] px-5 py-3 text-xs font-extrabold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Take Another Strip in This Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
