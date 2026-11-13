import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { applyFaceFilterToCanvas } from '../lib/filters';
import {
  drawBoothStyleOverlay,
  drawFaceProp,
  drawSharedBackdropBackground,
  drawSharedBackdropForeground,
} from '../lib/scenes';
import { playCountdownBeep, playShutterSound } from '../lib/sound';
import {
  CapturedShot,
  CaptureSessionState,
  FaceFilterId,
  FacePropId,
  Participant,
  RoomConfig,
  SessionMode,
} from '../types/booth';
import { CameraSourceMode } from '../hooks/useCamera';
import { RemoteFrameState } from '../hooks/useRoomSocket';
import { VirtualPoseId } from '../lib/virtualCam';

interface CaptureStageProps {
  mode: SessionMode;
  participants: Participant[];
  selfId: string;
  config: RoomConfig;
  capture: CaptureSessionState;
  faceFilter: FaceFilterId;
  faceProp: FacePropId;
  remoteFrames: Record<string, RemoteFrameState>;
  flashKey: number;
  camera: {
    attachVideoElement: (el: HTMLVideoElement | null) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    virtualCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    sourceMode: CameraSourceMode;
    mirrored: boolean;
    uploadedImage: HTMLImageElement | null;
    virtualConfig: { pose: VirtualPoseId };
    setVirtualPose: (p: VirtualPoseId) => void;
  };
}

export function CaptureStage({
  mode,
  participants,
  selfId,
  config,
  capture,
  faceFilter,
  faceProp,
  remoteFrames,
  flashKey,
  camera,
}: CaptureStageProps) {
  const viewfinderRef = useRef<HTMLCanvasElement | null>(null);
  const remoteImgCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const [showFlash, setShowFlash] = useState(false);

  const connectedPeers = participants.filter((p) => p.connected);

  // Trigger flash + shutter sound whenever flashKey increments
  useEffect(() => {
    if (flashKey === 0) return;
    setShowFlash(true);
    playShutterSound(config.soundEnabled);
    const t = setTimeout(() => setShowFlash(false), 550);
    return () => clearTimeout(t);
  }, [flashKey, config.soundEnabled]);

  // Play beep on countdown tick
  useEffect(() => {
    if (capture.stage === 'countdown' && capture.countdownRemaining > 0) {
      playCountdownBeep(capture.countdownRemaining, config.soundEnabled);
    }
  }, [capture.stage, capture.countdownRemaining, capture.currentShot, config.soundEnabled]);

  // Cache remote frames
  useEffect(() => {
    for (const [pid, state] of Object.entries(remoteFrames)) {
      if (!state?.frame) continue;
      let img = remoteImgCacheRef.current[pid];
      if (!img) {
        img = new Image();
        remoteImgCacheRef.current[pid] = img;
      }
      if (img.src !== state.frame) img.src = state.frame;
    }
  }, [remoteFrames]);

  // Live viewfinder render loop during shooting
  useEffect(() => {
    let rafId = 0;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 360;
    tempCanvas.height = 270;

    const loop = () => {
      const canvas = viewfinderRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const W = canvas.width;
          const H = canvas.height;
          if (config.backdropId !== 'none') {
            drawSharedBackdropBackground(ctx, config.backdropId, 0, 0, W, H);
          } else {
            ctx.fillStyle = '#18181B';
            ctx.fillRect(0, 0, W, H);
          }

          const paintSelf = () => {
            const tctx = tempCanvas.getContext('2d');
            if (!tctx) return null;
            const tw = tempCanvas.width;
            const th = tempCanvas.height;
            tctx.clearRect(0, 0, tw, th);

            if (camera.sourceMode === 'webcam' && camera.videoRef.current && camera.videoRef.current.readyState >= 2) {
              const v = camera.videoRef.current;
              const vw = v.videoWidth || 640;
              const vh = v.videoHeight || 480;
              const tr = tw / th;
              const sr = vw / vh;
              let sx = 0, sy = 0, sw = vw, sh = vh;
              if (sr > tr) {
                sw = vh * tr;
                sx = (vw - sw) / 2;
              } else {
                sh = vw / tr;
                sy = (vh - sh) / 2;
              }
              tctx.save();
              if (camera.mirrored) {
                tctx.translate(tw, 0);
                tctx.scale(-1, 1);
              }
              tctx.drawImage(v, sx, sy, sw, sh, 0, 0, tw, th);
              tctx.restore();
            } else if (camera.sourceMode === 'uploaded' && camera.uploadedImage) {
              tctx.drawImage(camera.uploadedImage, 0, 0, tw, th);
            } else if (camera.virtualCanvasRef.current) {
              tctx.drawImage(camera.virtualCanvasRef.current, 0, 0, tw, th);
            } else {
              return null;
            }

            if (faceFilter !== 'natural') applyFaceFilterToCanvas(tctx, tw, th, faceFilter);
            if (faceProp !== 'none') drawFaceProp(tctx, faceProp, 0, 0, tw, th);
            return tempCanvas;
          };

          const selfTemp = paintSelf();
          const slots =
            mode === 'solo' || connectedPeers.length <= 1
              ? [{ pid: selfId, x: 0, y: 0, w: W, h: H }]
              : connectedPeers.length === 2
                ? connectedPeers.map((p, idx) => ({
                    pid: p.id,
                    x: idx === 0 ? 0 : W / 2,
                    y: 0,
                    w: W / 2,
                    h: H,
                  }))
                : connectedPeers.slice(0, 4).map((p, idx) => ({
                    pid: p.id,
                    x: (idx % 2) * (W / 2),
                    y: Math.floor(idx / 2) * (H / 2),
                    w: W / 2,
                    h: H / 2,
                  }));

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
              drawCoverImg(ctx, selfTemp, slot.x, slot.y, slot.w, slot.h);
            } else {
              const rImg = remoteImgCacheRef.current[slot.pid];
              if (rImg && rImg.complete && rImg.naturalWidth > 0) {
                drawCoverImg(ctx, rImg, slot.x, slot.y, slot.w, slot.h);
              }
            }
            ctx.restore();
          });

          drawSharedBackdropForeground(ctx, config.backdropId, 0, 0, W, H);
          const currentPrompt = capture.posePrompts[capture.currentShot];
          drawBoothStyleOverlay(
            ctx,
            config.boothStyle,
            0,
            0,
            W,
            H,
            config.boothStyle === 'meme' ? currentPrompt : undefined
          );
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    mode,
    config.backdropId,
    config.softBlend,
    config.boothStyle,
    connectedPeers,
    selfId,
    faceFilter,
    faceProp,
    capture.currentShot,
    capture.posePrompts,
    camera.sourceMode,
    camera.mirrored,
    camera.uploadedImage,
    camera.videoRef,
    camera.virtualCanvasRef,
  ]);

  const currentPrompt =
    capture.posePrompts[capture.currentShot] || 'Strike your favorite pose!';
  const curtainColor = config.boothStyle === 'vintage' ? '#7F1D1D' : '#18181B';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <video
        ref={camera.attachVideoElement}
        playsInline
        muted
        autoPlay
        className="pointer-events-none fixed h-1 w-1 opacity-0"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Booth Viewfinder */}
        <div className="lg:col-span-8">
          <div className="tactile-card relative overflow-hidden rounded-3xl bg-zinc-900 p-4 text-white">
            {/* Top indicator bar */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 animate-ping rounded-full bg-[#FF4D4D]" />
                <span className="font-mono-code text-xs font-bold tracking-wider">
                  SHOT 0{Math.min(capture.currentShot + 1, capture.totalShots)} / 0{capture.totalShots}
                </span>
              </div>
              <span className="rounded-full bg-zinc-800 px-3 py-1 font-mono-code text-xs font-bold text-[#FFB800]">
                {capture.stage === 'curtain'
                  ? 'ENTERING BOOTH...'
                  : capture.stage === 'snapping'
                    ? 'CHEESE! CAPTURED'
                    : `SNAP IN ${capture.countdownRemaining}`}
              </span>
            </div>

            {/* Canvas + Overlays */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-zinc-700 bg-black">
              <canvas
                ref={viewfinderRef}
                width={720}
                height={500}
                className="block aspect-[16/11] w-full object-cover"
              />

              {/* Giant Countdown Number */}
              {capture.stage === 'countdown' && capture.countdownRemaining > 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-zinc-900/70 font-display text-6xl font-bold text-white shadow-2xl backdrop-blur-sm">
                    {capture.countdownRemaining}
                  </div>
                </div>
              )}

              {/* Shutter Flash */}
              {showFlash && (
                <div className="animate-shutter-flash pointer-events-none absolute inset-0 bg-white" />
              )}

              {/* Sliding Booth Curtains */}
              {capture.stage === 'curtain' && (
                <div className="pointer-events-none absolute inset-0 z-20 flex">
                  <div
                    className="animate-curtain-left h-full w-1/2 border-r-4 border-[#FFB800]"
                    style={{
                      background: `repeating-linear-gradient(90deg, ${curtainColor}, ${curtainColor} 18px, rgba(0,0,0,0.22) 18px, rgba(0,0,0,0.22) 24px)`,
                    }}
                  />
                  <div
                    className="animate-curtain-right h-full w-1/2 border-l-4 border-[#FFB800]"
                    style={{
                      background: `repeating-linear-gradient(90deg, ${curtainColor}, ${curtainColor} 18px, rgba(0,0,0,0.22) 18px, rgba(0,0,0,0.22) 24px)`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Pose Prompt Banner */}
            <div className="mt-4 flex flex-col items-center justify-between gap-2 rounded-2xl border border-zinc-700 bg-zinc-800/90 px-4 py-3 text-center sm:flex-row sm:text-left">
              <div>
                <div className="font-mono-code text-[10px] font-bold uppercase tracking-widest text-[#FFB800]">
                  {config.boothStyle === 'meme' ? 'MEME DARE PROMPT' : 'POSE PROMPT'}
                </div>
                <div className="text-base font-extrabold text-white">{currentPrompt}</div>
              </div>
              {camera.sourceMode === 'virtual' && (
                <div className="flex flex-wrap justify-center gap-1">
                  {(['smile', 'halfheart-left', 'peace', 'kiss', 'shocked'] as const).map((vp) => (
                    <button
                      key={vp}
                      type="button"
                      onClick={() => camera.setVirtualPose(vp)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${
                        camera.virtualConfig.pose === vp
                          ? 'border-white bg-[#FF4D4D] text-white'
                          : 'border-zinc-600 bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      {vp.replace('-left', '')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: 6-Shot Film Progress */}
        <div className="lg:col-span-4">
          <div className="tactile-card rounded-3xl p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-zinc-900">
                Film Roll (6 Shots)
              </h2>
              <Camera className="h-5 w-5 text-[#FF4D4D]" />
            </div>
            <p className="mb-3 text-xs text-zinc-600">
              Both cameras capture simultaneously at 0. After 6 shots, pick your favorite cuts!
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: capture.totalShots }).map((_, idx) => {
                const shot: CapturedShot | undefined = capture.shots[idx];
                const frameUrl = shot ? Object.values(shot.framesByParticipant)[0] : undefined;
                const isCurrent = idx === capture.currentShot;
                return (
                  <div
                    key={idx}
                    className={`relative overflow-hidden rounded-xl border-2 bg-zinc-100 ${
                      isCurrent
                        ? 'border-[#FF4D4D] ring-2 ring-[#FF4D4D]/40'
                        : 'border-zinc-900'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full bg-zinc-200">
                      {frameUrl ? (
                        <img
                          src={frameUrl}
                          alt={`Shot ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center font-mono-code text-xs font-bold text-zinc-400">
                          {isCurrent ? 'READY...' : `CUT 0${idx + 1}`}
                        </div>
                      )}
                    </div>
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-zinc-900/80 px-1.5 py-0.5 font-mono-code text-[10px] font-bold text-white">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function drawCoverImg(
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
  const tr = dw / dh;
  const sr = sw / sh;
  let sx = 0, sy = 0, cw = sw, ch = sh;
  if (sr > tr) {
    cw = sh * tr;
    sx = (sw - cw) / 2;
  } else {
    ch = sw / tr;
    sy = (sh - ch) / 2;
  }
  ctx.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
}
