import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Eraser,
  Film,
  Image as ImageIcon,
  MousePointer2,
  Paintbrush,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  DOODLE_COLORS,
  STICKER_PALETTE,
  STRIP_FILTERS,
  STRIP_LAYOUTS,
  THEME_FRAMES,
} from '../data/boothData';
import { getLayoutMeta } from '../lib/stripRenderer';
import {
  CapturedShot,
  DoodleStroke,
  Participant,
  PlacedSticker,
  RoomConfig,
  SessionMode,
  StickerTemplate,
  StripCustomization,
} from '../types/booth';
import { StripPreviewCanvas } from './StripPreviewCanvas';

interface CustomizeStudioProps {
  mode: SessionMode;
  roomCode: string | null;
  participants: Participant[];
  selfId: string;
  config: RoomConfig;
  shots: CapturedShot[];
  customization: StripCustomization;
  remoteCursors: Record<string, { x: number; y: number } | null>;
  onUpdateConfig: (patch: Partial<RoomConfig>) => void;
  onUpdateCustomization: (patch: Partial<StripCustomization>) => void;
  onUpsertSticker: (sticker: PlacedSticker) => void;
  onRemoveSticker: (id: string) => void;
  onAddDoodle: (stroke: DoodleStroke) => void;
  onUndoDoodle: () => void;
  onClearDoodles: () => void;
  onCursorMove: (cursor: { x: number; y: number } | null) => void;
  onRetake: () => void;
  onFinish: () => void;
}

type StudioTab = 'picks' | 'filters' | 'stickers' | 'doodle' | 'frame';

export function CustomizeStudio({
  mode,
  roomCode,
  participants,
  selfId,
  config,
  shots,
  customization,
  remoteCursors,
  onUpdateConfig,
  onUpdateCustomization,
  onUpsertSticker,
  onRemoveSticker,
  onAddDoodle,
  onUndoDoodle,
  onClearDoodles,
  onCursorMove,
  onRetake,
  onFinish,
}: CustomizeStudioProps) {
  const [tab, setTab] = useState<StudioTab>('picks');
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [doodleColor, setDoodleColor] = useState(DOODLE_COLORS[0].hex);
  const [doodleWidth, setDoodleWidth] = useState(0.008);
  const [liveStroke, setLiveStroke] = useState<DoodleStroke | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingStickerRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const lastCursorSentRef = useRef(0);

  const layout = getLayoutMeta(config.layoutId);
  const slotCount = layout.slotCount;
  const participantIds = useMemo(() => participants.map((p) => p.id), [participants]);

  const selectedSticker = customization.stickers.find((s) => s.id === selectedStickerId) || null;

  const getNormalizedCoords = (clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = getNormalizedCoords(e.clientX, e.clientY);

    if (tab === 'doodle') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setLiveStroke({
        id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        color: doodleColor,
        width: doodleWidth,
        points: [pt],
      });
      return;
    }

    // Check if user tapped an existing sticker
    const hit = [...customization.stickers]
      .reverse()
      .find((s) => Math.hypot(s.x - pt.x, s.y - pt.y) < 0.08 * s.scale);

    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedStickerId(hit.id);
      draggingStickerRef.current = {
        id: hit.id,
        offsetX: hit.x - pt.x,
        offsetY: hit.y - pt.y,
      };
    } else {
      setSelectedStickerId(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = getNormalizedCoords(e.clientX, e.clientY);

    // Emit collaborative cursor throttled to ~50ms
    const now = performance.now();
    if (mode !== 'solo' && now - lastCursorSentRef.current > 50) {
      lastCursorSentRef.current = now;
      onCursorMove(pt);
    }

    if (liveStroke && tab === 'doodle') {
      setLiveStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, pt] } : null
      );
      return;
    }

    if (draggingStickerRef.current) {
      const drag = draggingStickerRef.current;
      const target = customization.stickers.find((s) => s.id === drag.id);
      if (target) {
        onUpsertSticker({
          ...target,
          x: Math.max(0.05, Math.min(0.95, pt.x + drag.offsetX)),
          y: Math.max(0.04, Math.min(0.96, pt.y + drag.offsetY)),
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (liveStroke) {
      if (liveStroke.points.length >= 1) {
        onAddDoodle(liveStroke);
      }
      setLiveStroke(null);
    }
    draggingStickerRef.current = null;
  };

  const handleAssignShotToSlot = (shotIdx: number) => {
    const next = [...customization.selectedShotIndices];
    while (next.length < slotCount) {
      next.push(next.length % Math.max(1, shots.length));
    }
    next[activeSlotIdx] = shotIdx;
    onUpdateCustomization({ selectedShotIndices: next.slice(0, slotCount) });
    setActiveSlotIdx((i) => (i + 1) % slotCount);
  };

  const handleAddSticker = (tpl: StickerTemplate) => {
    const id = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSticker: PlacedSticker = {
      id,
      stickerId: tpl.id,
      label: tpl.label,
      kind: tpl.kind,
      x: 0.25 + Math.random() * 0.5,
      y: 0.2 + Math.random() * 0.55,
      scale: 1,
      rotation: Math.round((Math.random() - 0.5) * 16),
      color: tpl.color,
      bgColor: tpl.bgColor,
    };
    onUpsertSticker(newSticker);
    setSelectedStickerId(id);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* Left: Interactive Strip Canvas */}
        <div className="lg:col-span-6">
          <div className="tactile-card flex flex-col items-center rounded-3xl bg-[#EFE7DA] p-5 sm:p-6">
            <div className="mb-3 flex w-full items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-mono-code text-xs font-bold uppercase text-zinc-700">
                {tab === 'doodle' ? (
                  <>
                    <Paintbrush className="h-3.5 w-3.5 text-[#FF4D4D]" /> Draw directly on strip
                  </>
                ) : (
                  <>
                    <MousePointer2 className="h-3.5 w-3.5 text-[#2563EB]" /> Tap &amp; drag stickers
                  </>
                )}
              </span>

              {mode !== 'solo' && (
                <span className="rounded-full border border-zinc-900 bg-white px-2.5 py-0.5 font-mono-code text-[10px] font-bold text-zinc-800">
                  LIVE CO-EDITING ON
                </span>
              )}
            </div>

            {/* Interactive Strip Wrapper */}
            <div
              ref={stageRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                handlePointerUp();
                if (mode !== 'solo') onCursorMove(null);
              }}
              className={`relative select-none overflow-hidden rounded-xl border-2 border-zinc-900 bg-white shadow-[8px_8px_0px_#18181B] ${
                tab === 'doodle' ? 'cursor-crosshair' : 'cursor-grab'
              }`}
              style={{
                width: config.layoutId === 'grid-2x2' ? 'min(100%, 420px)' : 'min(100%, 280px)',
                touchAction: 'none',
              }}
            >
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

              {/* Live SVG Overlay for Active Drawing Stroke + Selected Sticker Box */}
              <svg
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {liveStroke && liveStroke.points.length > 0 && (
                  <polyline
                    fill="none"
                    stroke={liveStroke.color}
                    strokeWidth={Math.max(3, liveStroke.width * layout.width)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={liveStroke.points
                      .map((p) => `${p.x * layout.width},${p.y * layout.height}`)
                      .join(' ')}
                  />
                )}
                {selectedSticker && (
                  <circle
                    cx={selectedSticker.x * layout.width}
                    cy={selectedSticker.y * layout.height}
                    r={38 * selectedSticker.scale}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3"
                    strokeDasharray="8 6"
                  />
                )}
              </svg>

              {/* Live Partner Cursors */}
              {participants
                .filter((p) => p.id !== selfId && p.connected)
                .map((p) => {
                  const cursor = remoteCursors[p.id];
                  if (!cursor) return null;
                  return (
                    <div
                      key={p.id}
                      className="pointer-events-none absolute z-30 -translate-x-1 -translate-y-1 transition-all duration-75"
                      style={{
                        left: `${cursor.x * 100}%`,
                        top: `${cursor.y * 100}%`,
                      }}
                    >
                      <div
                        className="h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: p.color }}
                      />
                      <span
                        className="mt-0.5 inline-block rounded-md px-1.5 py-0.5 font-mono-code text-[10px] font-bold text-white shadow"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.name}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Selected Sticker Quick Controls */}
            {selectedSticker && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-zinc-900 bg-white px-3 py-2">
                <span className="font-mono-code text-[11px] font-bold text-zinc-600">
                  Sticker:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpsertSticker({
                      ...selectedSticker,
                      scale: Math.max(0.5, Number((selectedSticker.scale - 0.15).toFixed(2))),
                    })
                  }
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-bold hover:border-zinc-900"
                >
                  − Size
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpsertSticker({
                      ...selectedSticker,
                      scale: Math.min(2.2, Number((selectedSticker.scale + 0.15).toFixed(2))),
                    })
                  }
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-bold hover:border-zinc-900"
                >
                  + Size
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpsertSticker({
                      ...selectedSticker,
                      rotation: selectedSticker.rotation - 15,
                    })
                  }
                  className="rounded-md border border-zinc-300 p-1 hover:border-zinc-900"
                  title="Rotate left"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpsertSticker({
                      ...selectedSticker,
                      rotation: selectedSticker.rotation + 15,
                    })
                  }
                  className="rounded-md border border-zinc-300 p-1 hover:border-zinc-900"
                  title="Rotate right"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveSticker(selectedSticker.id);
                    setSelectedStickerId(null);
                  }}
                  className="rounded-md border border-red-300 bg-red-50 p-1 text-red-600 hover:border-red-600"
                  title="Delete sticker"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Studio Tools */}
        <div className="space-y-4 lg:col-span-6">
          {/* Tabs */}
          <div className="grid grid-cols-5 gap-1.5 rounded-2xl border-2 border-zinc-900 bg-white p-1.5 shadow-[3px_3px_0px_#18181B]">
            {[
              { id: 'picks', label: 'Pick Shots', icon: ImageIcon },
              { id: 'filters', label: 'Filter', icon: SlidersHorizontal },
              { id: 'stickers', label: 'Stickers', icon: Sticker },
              { id: 'doodle', label: 'Doodle', icon: Paintbrush },
              { id: 'frame', label: 'Frame', icon: Film },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as StudioTab)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-extrabold transition-colors sm:flex-row sm:text-xs ${
                    active
                      ? 'bg-[#FF4D4D] text-white'
                      : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Panel Body */}
          <div className="tactile-card rounded-2xl p-5">
            {tab === 'picks' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-zinc-900">
                      Choose your {slotCount} favorite shots
                    </h3>
                    <p className="text-xs text-zinc-600">
                      Pick a slot below, then tap any of your 6 captured cuts to place it.
                    </p>
                  </div>
                </div>

                {/* Slot selector pills */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {Array.from({ length: slotCount }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSlotIdx(idx)}
                      className={`rounded-xl border-2 px-3 py-1.5 font-mono-code text-xs font-bold ${
                        activeSlotIdx === idx
                          ? 'border-zinc-900 bg-[#FFB800] text-zinc-900'
                          : 'border-zinc-300 bg-white text-zinc-700'
                      }`}
                    >
                      Box #{idx + 1}: Cut {(customization.selectedShotIndices[idx] ?? idx) + 1}
                    </button>
                  ))}
                </div>

                {/* 6 Captured Cuts */}
                <div className="grid grid-cols-3 gap-2.5">
                  {shots.map((shot, sIdx) => {
                    const thumb = Object.values(shot.framesByParticipant)[0];
                    const usedInSlots = customization.selectedShotIndices
                      .map((v, slotI) => (v === sIdx ? slotI + 1 : null))
                      .filter(Boolean);
                    return (
                      <button
                        key={shot.shotIndex}
                        type="button"
                        onClick={() => handleAssignShotToSlot(sIdx)}
                        className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                          usedInSlots.length > 0
                            ? 'border-zinc-900 ring-2 ring-[#FF4D4D]/40'
                            : 'border-zinc-300 hover:border-zinc-900'
                        }`}
                      >
                        <div className="aspect-[4/3] bg-zinc-100">
                          {thumb ? (
                            <img src={thumb} alt={`Cut ${sIdx + 1}`} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <span className="absolute left-1.5 top-1.5 rounded bg-zinc-900/80 px-1.5 py-0.5 font-mono-code text-[10px] font-bold text-white">
                          Cut {sIdx + 1}
                        </span>
                        {usedInSlots.length > 0 && (
                          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#FF4D4D] px-2 py-0.5 font-mono-code text-[10px] font-bold text-white">
                            Slot {usedInSlots.join(',')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'filters' && (
              <div>
                <h3 className="font-display text-xl font-bold text-zinc-900">
                  Strip-Wide Color Filter
                </h3>
                <p className="mb-4 text-xs text-zinc-600">
                  Applied consistently across every box on your strip using pixel math.
                </p>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {STRIP_FILTERS.map((f) => {
                    const active = customization.stripFilterId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onUpdateCustomization({ stripFilterId: f.id })}
                        className={`rounded-xl border-2 p-2.5 text-left ${
                          active
                            ? 'border-zinc-900 bg-[#FFF1F2] shadow-[2.5px_2.5px_0px_#18181B]'
                            : 'border-zinc-200 bg-white hover:border-zinc-900'
                        }`}
                      >
                        <div
                          className="mb-2 h-8 w-full rounded-lg border border-zinc-900/20"
                          style={{ background: f.previewGradient }}
                        />
                        <div className="text-xs font-extrabold text-zinc-900">{f.name}</div>
                        <div className="truncate text-[10px] text-zinc-500">{f.description}</div>
                      </button>
                    );
                  })}
                </div>

                {customization.stripFilterId !== 'original' && (
                  <div className="mt-4 rounded-xl border border-zinc-200 bg-[#FAF6EF] p-3">
                    <div className="mb-1 flex justify-between text-xs font-bold">
                      <span>Filter Intensity</span>
                      <span className="font-mono-code">{customization.filterIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      value={customization.filterIntensity}
                      onChange={(e) =>
                        onUpdateCustomization({ filterIntensity: Number(e.target.value) })
                      }
                      className="w-full accent-[#FF4D4D]"
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'stickers' && (
              <div>
                <h3 className="font-display text-xl font-bold text-zinc-900">
                  Tap Stickers to Add
                </h3>
                <p className="mb-3 text-xs text-zinc-600">
                  Drag them anywhere on the strip — everyone in your room sees changes live.
                </p>

                <div className="flex flex-wrap gap-2">
                  {STICKER_PALETTE.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleAddSticker(tpl)}
                      className="tactile-btn rounded-xl bg-white px-3 py-2 text-sm font-bold text-zinc-900 hover:bg-[#FAF6EF]"
                    >
                      {tpl.kind === 'emoji' ? (
                        <span className="text-xl">{tpl.label}</span>
                      ) : (
                        <span
                          className="rounded-md px-2 py-0.5 font-mono-code text-xs font-extrabold"
                          style={{
                            color: tpl.color,
                            backgroundColor: tpl.bgColor,
                          }}
                        >
                          {tpl.label}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {customization.stickers.length > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-xs">
                    <span className="font-bold text-zinc-600">
                      {customization.stickers.length} sticker(s) on strip
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCustomization({ stickers: [] });
                        setSelectedStickerId(null);
                      }}
                      className="font-bold text-red-600 hover:underline"
                    >
                      Remove all stickers
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === 'doodle' && (
              <div>
                <h3 className="font-display text-xl font-bold text-zinc-900">
                  Crayon &amp; Marker Doodles
                </h3>
                <p className="mb-4 text-xs text-zinc-600">
                  Draw hearts, arrows, signatures, or date notes directly onto the strip frame.
                </p>

                <div className="mb-4">
                  <div className="mb-1.5 text-xs font-bold text-zinc-700">Ink Color</div>
                  <div className="flex flex-wrap gap-2">
                    {DOODLE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDoodleColor(c.hex)}
                        title={c.label}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${
                          doodleColor === c.hex
                            ? 'scale-110 border-zinc-900 ring-2 ring-zinc-900 ring-offset-2'
                            : 'border-zinc-900/40'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 text-xs font-bold text-zinc-700">Brush Size</div>
                  <div className="flex gap-2">
                    {[
                      { label: 'Fine', val: 0.005 },
                      { label: 'Medium', val: 0.009 },
                      { label: 'Chunky', val: 0.015 },
                    ].map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setDoodleWidth(b.val)}
                        className={`rounded-xl border-2 px-3 py-1.5 text-xs font-bold ${
                          doodleWidth === b.val
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-300 bg-white text-zinc-800'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onUndoDoodle}
                    disabled={customization.doodles.length === 0}
                    className="tactile-btn inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-zinc-900 disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Undo Stroke
                  </button>
                  <button
                    type="button"
                    onClick={onClearDoodles}
                    disabled={customization.doodles.length === 0}
                    className="tactile-btn inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-red-600 disabled:opacity-40"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Clear Doodles
                  </button>
                </div>
              </div>
            )}

            {tab === 'frame' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-zinc-600">
                    Strip Caption
                  </label>
                  <input
                    type="text"
                    value={customization.caption}
                    maxLength={40}
                    onChange={(e) => onUpdateCustomization({ caption: e.target.value })}
                    placeholder="Write a cute memory or your names..."
                    className="w-full rounded-xl border-2 border-zinc-900 bg-[#FAF6EF] px-3.5 py-2 text-sm font-bold text-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={customization.showDate}
                      onChange={(e) => onUpdateCustomization({ showDate: e.target.checked })}
                      className="h-4 w-4 accent-[#FF4D4D]"
                    />
                    Show Date Stamp
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={customization.showRoomCode}
                      onChange={(e) => onUpdateCustomization({ showRoomCode: e.target.checked })}
                      className="h-4 w-4 accent-[#FF4D4D]"
                    />
                    Show Room Code
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={customization.showBrandMark}
                      onChange={(e) => onUpdateCustomization({ showBrandMark: e.target.checked })}
                      className="h-4 w-4 accent-[#FF4D4D]"
                    />
                    Photo Lelo Stamp
                  </label>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-bold text-zinc-700">Switch Layout</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STRIP_LAYOUTS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onUpdateConfig({ layoutId: l.id })}
                        className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${
                          config.layoutId === l.id
                            ? 'border-zinc-900 bg-[#FFB800] text-zinc-900'
                            : 'border-zinc-200 bg-white text-zinc-800'
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-bold text-zinc-700">Switch Frame Theme</div>
                  <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                    {THEME_FRAMES.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => onUpdateConfig({ themeId: frame.id })}
                        className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left text-xs font-bold ${
                          config.themeId === frame.id
                            ? 'border-zinc-900 bg-[#ECFDF5]'
                            : 'border-zinc-200 bg-white'
                        }`}
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded border border-zinc-900"
                          style={{ backgroundColor: frame.bgColor }}
                        />
                        <span className="truncate">{frame.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetake}
              className="tactile-btn rounded-xl bg-white px-5 py-3.5 text-sm font-extrabold text-zinc-900 sm:w-40"
            >
              Retake Photos
            </button>
            <button
              type="button"
              onClick={onFinish}
              className="tactile-btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-6 py-3.5 text-base font-extrabold text-white"
            >
              <Sparkles className="h-5 w-5" />
              Print &amp; Keep Strip
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
