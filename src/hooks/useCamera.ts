import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceFilterId, FacePropId } from '../types/booth';
import { applyFaceFilterToCanvas } from '../lib/filters';
import { drawFaceProp } from '../lib/scenes';
import {
  drawVirtualCamFrame,
  VIRTUAL_AVATAR_PRESETS,
  VirtualCamConfig,
  VirtualPoseId,
} from '../lib/virtualCam';

export type CameraSourceMode = 'webcam' | 'virtual' | 'uploaded';

export interface UseCameraOptions {
  label?: string;
  defaultPresetIndex?: number;
}

export function useCamera(options: UseCameraOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sourceMode, setSourceMode] = useState<CameraSourceMode>('webcam');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mirrored, setMirrored] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const preset =
    VIRTUAL_AVATAR_PRESETS[(options.defaultPresetIndex ?? 0) % VIRTUAL_AVATAR_PRESETS.length];

  const [virtualConfig, setVirtualConfig] = useState<VirtualCamConfig>({
    bgHex: preset.bgHex,
    shirtHex: preset.shirtHex,
    skinHex: preset.skinHex,
    hairHex: preset.hairHex,
    pose: 'smile',
    label: options.label || 'You',
  });

  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setVirtualConfig((prev) => ({ ...prev, label: options.label || prev.label }));
  }, [options.label]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startWebcam = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API unavailable here — switched to Studio Virtual Cam.');
      setSourceMode('virtual');
      setCameraReady(true);
      return;
    }

    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraError(null);
      setCameraReady(true);
      setSourceMode('webcam');
    } catch {
      setCameraError('No webcam active — using interactive Studio Virtual Cam instead.');
      setSourceMode('virtual');
      setCameraReady(true);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (sourceMode === 'webcam') {
      startWebcam();
    } else {
      stopStream();
      setCameraReady(true);
    }
    return () => {
      stopStream();
    };
  }, [sourceMode, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attach stream if video element remounts across steps
  const attachVideoElement = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current && el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch(() => {});
      }
    },
    []
  );

  // Animate Virtual Studio Cam canvas when active
  useEffect(() => {
    if (sourceMode !== 'virtual') return;
    let rafId = 0;
    const canvas = virtualCanvasRef.current || document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    virtualCanvasRef.current = canvas;

    const renderLoop = (t: number) => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawVirtualCamFrame(ctx, canvas.width, canvas.height, virtualConfig, t);
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [sourceMode, virtualConfig]);

  const setVirtualPose = useCallback((pose: VirtualPoseId) => {
    setVirtualConfig((prev) => ({ ...prev, pose }));
  }, []);

  const setVirtualPreset = useCallback((idx: number) => {
    const p = VIRTUAL_AVATAR_PRESETS[idx % VIRTUAL_AVATAR_PRESETS.length];
    setVirtualConfig((prev) => ({
      ...prev,
      bgHex: p.bgHex,
      shirtHex: p.shirtHex,
      skinHex: p.skinHex,
      hairHex: p.hairHex,
    }));
  }, []);

  const handleUploadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setUploadedImage(img);
        setSourceMode('uploaded');
        setCameraError(null);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }, []);

  const captureFrameDataUrl = useCallback(
    (opts: {
      width?: number;
      height?: number;
      quality?: number;
      faceFilter?: FaceFilterId;
      faceProp?: FacePropId;
    } = {}): string | null => {
      const w = opts.width ?? 720;
      const h = opts.height ?? 540;
      const quality = opts.quality ?? 0.9;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      let drew = false;

      if (sourceMode === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        const targetRatio = w / h;
        const srcRatio = vw / vh;

        let sx = 0;
        let sy = 0;
        let sw = vw;
        let sh = vh;
        if (srcRatio > targetRatio) {
          sw = vh * targetRatio;
          sx = (vw - sw) / 2;
        } else {
          sh = vw / targetRatio;
          sy = (vh - sh) / 2;
        }

        ctx.save();
        if (mirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
        ctx.restore();
        drew = true;
      } else if (sourceMode === 'uploaded' && uploadedImage) {
        const iw = uploadedImage.naturalWidth;
        const ih = uploadedImage.naturalHeight;
        const targetRatio = w / h;
        const srcRatio = iw / ih;
        let sx = 0;
        let sy = 0;
        let sw = iw;
        let sh = ih;
        if (srcRatio > targetRatio) {
          sw = ih * targetRatio;
          sx = (iw - sw) / 2;
        } else {
          sh = iw / targetRatio;
          sy = (ih - sh) / 2;
        }
        ctx.drawImage(uploadedImage, sx, sy, sw, sh, 0, 0, w, h);
        drew = true;
      } else {
        // Draw virtual studio cam
        drawVirtualCamFrame(ctx, w, h, virtualConfig, performance.now());
        drew = true;
      }

      if (!drew) return null;

      if (opts.faceFilter && opts.faceFilter !== 'natural') {
        applyFaceFilterToCanvas(ctx, w, h, opts.faceFilter);
      }

      if (opts.faceProp && opts.faceProp !== 'none') {
        drawFaceProp(ctx, opts.faceProp, 0, 0, w, h);
      }

      return canvas.toDataURL('image/jpeg', quality);
    },
    [sourceMode, mirrored, uploadedImage, virtualConfig]
  );

  return {
    videoRef,
    virtualCanvasRef,
    attachVideoElement,
    sourceMode,
    setSourceMode,
    facingMode,
    toggleFacingMode: () => setFacingMode((f) => (f === 'user' ? 'environment' : 'user')),
    mirrored,
    setMirrored,
    cameraError,
    cameraReady,
    virtualConfig,
    setVirtualPose,
    setVirtualPreset,
    uploadedImage,
    handleUploadFile,
    captureFrameDataUrl,
    retryWebcam: startWebcam,
  };
}
