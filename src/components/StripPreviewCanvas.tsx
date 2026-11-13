import { useEffect, useRef } from 'react';
import {
  BoothStyleId,
  CapturedShot,
  LayoutId,
  StripCustomization,
} from '../types/booth';
import { getLayoutMeta, renderStripToCanvas } from '../lib/stripRenderer';

interface StripPreviewCanvasProps {
  layoutId: LayoutId;
  themeId: string;
  boothStyle: BoothStyleId;
  backdropId: string;
  softBlend: boolean;
  roomCode: string;
  participantIds: string[];
  shots: CapturedShot[];
  customization: StripCustomization;
  previewScale?: number;
  className?: string;
}

export function StripPreviewCanvas({
  layoutId,
  themeId,
  boothStyle,
  backdropId,
  softBlend,
  roomCode,
  participantIds,
  shots,
  customization,
  previewScale = 0.55,
  className = '',
}: StripPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layout = getLayoutMeta(layoutId);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderStripToCanvas(
      {
        layoutId,
        themeId,
        boothStyle,
        backdropId,
        softBlend,
        roomCode,
        participantIds,
        shots,
        customization,
        targetScale: previewScale,
      },
      canvas
    ).then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [
    layoutId,
    themeId,
    boothStyle,
    backdropId,
    softBlend,
    roomCode,
    participantIds,
    shots,
    customization,
    previewScale,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(layout.width * previewScale)}
      height={Math.round(layout.height * previewScale)}
      className={`block h-auto w-full select-none rounded-lg ${className}`}
    />
  );
}
