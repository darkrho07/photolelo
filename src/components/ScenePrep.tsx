import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FlipHorizontal2,
  ImagePlus,
  RefreshCw,
  Shuffle,
  Sparkles,
  SwitchCamera,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  FACE_FILTERS,
  FACE_PROPS,
  POSE_DECK,
  SHARED_BACKDROPS,
} from '../data/boothData';
import { applyFaceFilterToCanvas } from '../lib/filters';
import {
  drawBoothStyleOverlay,
  drawFaceProp,
  drawSharedBackdropBackground,
  drawSharedBackdropForeground,
} from '../lib/scenes';
import { VIRTUAL_AVATAR_PRESETS, VirtualPoseId } from '../lib/virtualCam';
import {
  FaceFilterId,
  FacePropId,
  Participant,
  RoomConfig,
  SessionMode,
} from '../types/booth';
import { CameraSourceMode } from '../hooks/useCamera';
import { RemoteFrameState } from '../hooks/useRoomSocket';

interface ScenePrepProps {
  mode: SessionMode;
  roomCode: string | null;
  participants: Participant[];
  selfId: string;
  config: RoomConfig;
  faceFilter: FaceFilterId;
  faceProp: FacePropId;
  remoteFrames: Record<string, RemoteFrameState>;
  camera: {
    attachVideoElement: (el: HTMLVideoElement | null) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    virtualCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    sourceMode: CameraSourceMode;
    setSourceMode: (m: CameraSourceMode) => void;
    mirrored: boolean;
    setMirrored: (v: boolean) => void;
    toggleFacingMode: () => void;
    cameraError: string | null;
    virtualConfig: { pose: VirtualPoseId; bgHex: string };
    setVirtualPose: (p: VirtualPoseId) => void;
    setVirtualPreset: (idx: number) => void;
    uploadedImage: HTMLImageElement | null;
    handleUploadFile: (f: File) => void;
    retryWebcam: () => void;
  };
  onUpdateConfig: (patch: Partial<RoomConfig>) => void;
  onUpdateFaceStyle: (faceFilter: FaceFilterId, faceProp: FacePropId) => void;
  onToggleReady: (ready: boolean) => void;
  onForceStart: () => void;
  onBack: () => void;
}

const VIRTUAL_POSES: Array<{ id: VirtualPoseId; label: string }> = [
  { id: 'smile', label: 'Smile' },
  { id: 'halfheart-left', label: 'Half ♥ L' },
  { id: 'halfheart-right', label: 'Half ♥ R' },
  { id: 'peace', label: 'Peace ✌️' },
  { id: 'kiss', label: 'Kiss 💋' },
  { id: 'shocked', label: 'Shocked 😮' },
];

export function ScenePrep({
  mode,
  roomCode,
  participants,
  selfId,
  config,
  faceFilter,
  faceProp,
  remoteFrames,
  camera,
  onUpdateConfig,
  onUpdateFaceStyle,
  onToggleReady,
  onForceStart,
  onBack,
}: ScenePrepProps) {
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const remoteImgCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [poseIdx, setPoseIdx] = useState(0);

  const connectedPeers = participants.filter((p) => p.connected);
  const selfParticipant = participants.find((p) => p.id === selfId);
  const isReady = Boolean(selfParticipant?.ready);
  const otherConnectedCount = connectedPeers.filter((p) => p.id !== selfId).length;

  // Keep decoded HTMLImageElements for remote peers
  useEffect(() => {
    for (const [pid, state] of Object.entries(remoteFrames)) {
      if (!state?.frame) continue;
      let img = remoteImgCacheRef.current[pid];
      if (!img) {
        img = new Image();
        remoteImgCacheRef.current[pid] = img;
      }
      if (img.src !== state.frame) {
        img.src = state.frame;
      }
    }
  }, [remoteFrames]);

  // Live composite viewfinder loop
  useEffect(() => {
    let rafId = 0;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 360;
    tempCanvas.height = 270;

    const renderFrame = () => {
      const canvas = compositeCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const W = canvas.width;
          const H = canvas.height;

          // 1. Backdrop
          if (config.backdropId !== 'none') {
            drawSharedBackdropBackground(ctx, config.backdropId, 0, 0, W, H);
          } else {
            ctx.fillStyle = '#18181B';
            ctx.fillRect(0, 0, W, H);
          }

          // Helper to paint self onto tempCanvas with filter + prop
          const paintSelfTemp = (): HTMLCanvasElement | null => {
            const tctx = tempCanvas.getContext('2d');
            if (!tctx) return null;
            const tw = tempCanvas.width;
            const th = tempCanvas.height;
            tctx.clearRect(0, 0, tw, th);

            if (camera.sourceMode === 'webcam' && camera.videoRef.current && camera.videoRef.current.readyState >= 2) {
              const video = camera.videoRef.current;
              const vw = video.videoWidth || 640;
              const vh = video.videoHeight || 480;
              const targetRatio = tw / th;
              const srcRatio = vw / vh;
              let sx = 0, sy = 0, sw = vw, sh = vh;
              if (srcRatio > targetRatio) {
                sw = vh * targetRatio;
                sx = (vw - sw) / 2;
              } else {
                sh = vw / targetRatio;
                sy = (vh - sh) / 2;
              }
              tctx.save();
              if (camera.mirrored) {
                tctx.translate(tw, 0);
                tctx.scale(-1, 1);
              }
              tctx.drawImage(video, sx, sy, sw, sh, 0, 0, tw, th);
              tctx.restore();
            } else if (camera.sourceMode === 'uploaded' && camera.uploadedImage) {
              const img = camera.uploadedImage;
              tctx.drawImage(img, 0, 0, tw, th);
            } else if (camera.virtualCanvasRef.current) {
              tctx.drawImage(camera.virtualCanvasRef.current, 0, 0, tw, th);
            } else {
              return null;
            }

            if (faceFilter !== 'natural') {
              applyFaceFilterToCanvas(tctx, tw, th, faceFilter);
            }
            if (faceProp !== 'none') {
              drawFaceProp(tctx, faceProp, 0, 0, tw, th);
            }
            return tempCanvas;
          };

          const slots =
            mode === 'solo' || connectedPeers.length <= 1
              ? [{ pid: selfId, x: 0, y: 0, w: W, h: H, name: selfParticipant?.name || 'You' }]
              : connectedPeers.length === 2
                ? connectedPeers.map((p, idx) => ({
                    pid: p.id,
                    x: idx === 0 ? 0 : W / 2,
                    y: 0,
                    w: W / 2,
                    h: H,
                    name: p.name,
                  }))
                : connectedPeers.slice(0, 4).map((p, idx) => ({
                    pid: p.id,
                    x: (idx % 2) * (W / 2),
                    y: Math.floor(idx / 2) * (H / 2),
                    w: W / 2,
                    h: H / 2,
                    name: p.name,
                  }));

          const selfTemp = paintSelfTemp();

          slots.forEach((slot) => {
            ctx.save();
            if (config.backdropId !== 'none' && config.softBlend) {
              const padX = slot.w * 0.07;
              const padTop = slot.h * 0.12;
              ctx.beginPath();
              ctx.roundRect(slot.x + padX, slot.y + padTop, slot.w - padX * 2, slot.h - padTop + 4, [
                (slot.w - padX * 2) * 0.45,
                (slot.w - padX * 2) * 0.45,
                0,
                0,
              ]);
              ctx.clip();
            } else {
              ctx.beginPath();
              ctx.rect(slot.x, slot.y, slot.w, slot.h);
              ctx.clip();
            }

            if (slot.pid === selfId && selfTemp) {
              drawCover(ctx, selfTemp, slot.x, slot.y, slot.w, slot.h);
            } else {
              const remoteImg = remoteImgCacheRef.current[slot.pid];
              if (remoteImg && remoteImg.complete && remoteImg.naturalWidth > 0) {
                drawCover(ctx, remoteImg, slot.x, slot.y, slot.w, slot.h);
              } else {
                ctx.fillStyle = '#27272A';
                ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
                ctx.fillStyle = '#E4E4E7';
                ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${slot.name} camera connecting...`, slot.x + slot.w / 2, slot.y + slot.h / 2);
              }
            }
            ctx.restore();
          });

          // Foreground props & booth style overlay
          drawSharedBackdropForeground(ctx, config.backdropId, 0, 0, W, H);
          drawBoothStyleOverlay(ctx, config.boothStyle, 0, 0, W, H);
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [
    mode,
    config.backdropId,
    config.softBlend,
    config.boothStyle,
    connectedPeers,
    selfId,
    selfParticipant?.name,
    faceFilter,
    faceProp,
    camera.sourceMode,
    camera.mirrored,
    camera.uploadedImage,
    camera.videoRef,
    camera.virtualCanvasRef,
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Hidden video element to feed webcam frames */}
      <video
        ref={camera.attachVideoElement}
        playsInline
        muted
        autoPlay
        className="pointer-events-none fixed h-1 w-1 opacity-0"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) camera.handleUploadFile(f);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Live Viewfinder + Controls */}
        <div className="space-y-4 lg:col-span-7">
          <div className="tactile-card overflow-hidden rounded-3xl bg-zinc-900 p-3 sm:p-4">
            {/* Top Status Strip */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 font-mono-code text-[11px] font-bold">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#10B981]" />
                  LIVE VIEWFINDER
                </span>
                {mode !== 'solo' && (
                  <span className="font-mono-code text-[11px] text-zinc-300">
                    {connectedPeers.map((p) => `${p.name}${p.ready ? ' ✓' : ''}`).join('  ·  ')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => camera.setMirrored(!camera.mirrored)}
                  title="Mirror camera"
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                    camera.mirrored
                      ? 'border-white bg-white text-zinc-900'
                      : 'border-zinc-600 bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <FlipHorizontal2 className="inline h-3.5 w-3.5" /> Mirror
                </button>
                {camera.sourceMode === 'webcam' && (
                  <button
                    type="button"
                    onClick={camera.toggleFacingMode}
                    title="Switch front/back camera"
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700"
                  >
                    <SwitchCamera className="inline h-3.5 w-3.5" /> Flip
                  </button>
                )}
              </div>
            </div>

            {/* Live Composite Canvas */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-zinc-700 bg-black">
              <canvas
                ref={compositeCanvasRef}
                width={640}
                height={440}
                className="block aspect-[16/11] w-full object-cover"
              />
            </div>

            {/* Pose Prompt Inspiration Strip */}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-800/90 px-4 py-2.5 text-white">
              <div>
                <div className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[#FFB800]">
                  Pose Idea
                </div>
                <div className="text-sm font-bold">{POSE_DECK[poseIdx]}</div>
              </div>
              <button
                type="button"
                onClick={() => setPoseIdx((i) => (i + 1) % POSE_DECK.length)}
                className="shrink-0 rounded-xl border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-zinc-600"
              >
                <Shuffle className="mr-1 inline h-3.5 w-3.5" /> Next
              </button>
            </div>
          </div>

          {/* Camera Source Switcher + Virtual Cam Controls */}
          <div className="tactile-card-sm rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-600">
                Camera Source
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    camera.setSourceMode('webcam');
                    camera.retryWebcam();
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1 text-xs font-bold ${
                    camera.sourceMode === 'webcam'
                      ? 'border-zinc-900 bg-[#FF4D4D] text-white'
                      : 'border-zinc-300 bg-white text-zinc-800'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" /> Webcam
                </button>
                <button
                  type="button"
                  onClick={() => camera.setSourceMode('virtual')}
                  className={`inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1 text-xs font-bold ${
                    camera.sourceMode === 'virtual'
                      ? 'border-zinc-900 bg-[#2563EB] text-white'
                      : 'border-zinc-300 bg-white text-zinc-800'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Virtual Studio Cam
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1 text-xs font-bold ${
                    camera.sourceMode === 'uploaded'
                      ? 'border-zinc-900 bg-[#10B981] text-white'
                      : 'border-zinc-300 bg-white text-zinc-800'
                  }`}
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Upload Photo
                </button>
              </div>
            </div>

            {camera.cameraError && (
              <p className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                <span>{camera.cameraError}</span>
                <button
                  type="button"
                  onClick={camera.retryWebcam}
                  className="ml-2 inline-flex items-center gap-1 font-bold underline"
                >
                  <RefreshCw className="h-3 w-3" /> Retry Cam
                </button>
              </p>
            )}

            {camera.sourceMode === 'virtual' && (
              <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-zinc-600">Virtual Pose:</span>
                  <div className="flex flex-wrap gap-1">
                    {VIRTUAL_POSES.map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => camera.setVirtualPose(vp.id)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          camera.virtualConfig.pose === vp.id
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-300 bg-white text-zinc-700'
                        }`}
                      >
                        {vp.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-zinc-600">Avatar Vibe:</span>
                  <div className="flex gap-1.5">
                    {VIRTUAL_AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => camera.setVirtualPreset(idx)}
                        className="rounded-full border-2 border-zinc-900 px-2.5 py-0.5 text-[10px] font-bold text-zinc-900"
                        style={{ backgroundColor: preset.bgHex }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Shared Scene + Face Filters + Ready Check */}
        <div className="space-y-5 lg:col-span-5">
          {/* Shared Backdrops */}
          <section className="tactile-card rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-zinc-900">
                  Shared Scene Backdrop
                </h2>
                <p className="text-xs text-zinc-600">
                  Splits continuously across everyone in the frame.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-zinc-700">
                <input
                  type="checkbox"
                  checked={config.softBlend}
                  onChange={(e) => onUpdateConfig({ softBlend: e.target.checked })}
                  className="h-4 w-4 accent-[#FF4D4D]"
                />
                Soft Blend
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SHARED_BACKDROPS.map((bd) => {
                const selected = config.backdropId === bd.id;
                return (
                  <button
                    key={bd.id}
                    type="button"
                    onClick={() => onUpdateConfig({ backdropId: bd.id })}
                    className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all ${
                      selected
                        ? 'border-zinc-900 bg-[#FFF1F2] shadow-[2.5px_2.5px_0px_#18181B]'
                        : 'border-zinc-200 bg-white hover:border-zinc-900'
                    }`}
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-lg border-2 border-zinc-900"
                      style={{
                        background: `linear-gradient(180deg, ${bd.skyTop}, ${bd.skyBottom})`,
                      }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-zinc-900">{bd.name}</div>
                      <div className="font-mono-code text-[10px] text-zinc-500">{bd.tag}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Face Look & Cute Props */}
          <section className="tactile-card rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-extrabold text-zinc-900">Camera Look (Just for You)</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FACE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onUpdateFaceStyle(f.id, faceProp)}
                  className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${
                    faceFilter === f.id
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>

            <h3 className="mt-4 text-sm font-extrabold text-zinc-900">Cute AR-Lite Props</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FACE_PROPS.map((prop) => (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => onUpdateFaceStyle(faceFilter, prop.id)}
                  className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${
                    faceProp === prop.id
                      ? 'border-zinc-900 bg-[#FFB800] text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900'
                  }`}
                >
                  {prop.emoji} {prop.name}
                </button>
              ))}
            </div>
          </section>

          {/* Ready Gate & Timer */}
          <section className="tactile-card rounded-2xl bg-[#FEF9EE] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">
                Countdown Timer
              </span>
              <div className="flex gap-1.5">
                {([3, 5] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onUpdateConfig({ countdownSeconds: sec })}
                    className={`rounded-lg border-2 px-3 py-1 font-mono-code text-xs font-bold ${
                      config.countdownSeconds === sec
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 bg-white text-zinc-700'
                    }`}
                  >
                    {sec}s / shot
                  </button>
                ))}
              </div>
            </div>

            {mode === 'solo' ? (
              <button
                type="button"
                onClick={onForceStart}
                className="tactile-btn flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4D4D] px-5 py-3.5 text-base font-extrabold text-white"
              >
                <Camera className="h-5 w-5" />
                Enter Booth &amp; Shoot (6 Shots)
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-300 bg-white p-3 text-xs">
                  <div className="mb-1.5 flex items-center justify-between font-bold text-zinc-700">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[#2563EB]" /> Ready Status
                    </span>
                    <span className="font-mono-code text-[#FF4D4D]">CODE {roomCode}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {connectedPeers.map((p) => (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-bold ${
                          p.ready
                            ? 'border-[#10B981] bg-[#ECFDF5] text-[#065F46]'
                            : 'border-zinc-300 bg-zinc-50 text-zinc-600'
                        }`}
                      >
                        {p.ready ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleReady(!isReady)}
                  className={`tactile-btn flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-extrabold ${
                    isReady
                      ? 'bg-[#10B981] text-white'
                      : 'bg-[#FF4D4D] text-white'
                  }`}
                >
                  <UserCheck className="h-5 w-5" />
                  {isReady
                    ? otherConnectedCount === 0
                      ? 'Ready! Waiting for Partner to Join...'
                      : 'Ready! Waiting for Partner...'
                    : "I'm Ready! (Nothing Starts Until Both Tap)"}
                </button>

                {otherConnectedCount === 0 && (
                  <button
                    type="button"
                    onClick={onForceStart}
                    className="w-full rounded-xl border-2 border-dashed border-zinc-400 bg-white/70 px-4 py-2 text-xs font-bold text-zinc-700 hover:border-zinc-900 hover:text-zinc-900"
                  >
                    Partner not here yet? Start practicing now anyway →
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onBack}
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Frame &amp; Booth Vibe
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function drawCover(
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
  let sx = 0, sy = 0, cw = sw, ch = sh;
  if (srcRatio > targetRatio) {
    cw = sh * targetRatio;
    sx = (sw - cw) / 2;
  } else {
    ch = sw / targetRatio;
    sy = (sh - ch) / 2;
  }
  ctx.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
}
