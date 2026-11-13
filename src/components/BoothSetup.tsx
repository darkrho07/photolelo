import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Sparkles, Users } from 'lucide-react';
import {
  BOOTH_STYLES,
  STRIP_LAYOUTS,
  THEME_CATEGORIES,
  THEME_FRAMES,
} from '../data/boothData';
import {
  Participant,
  RoomConfig,
  SessionMode,
  StripCustomization,
  ThemeCategory,
} from '../types/booth';
import { StripPreviewCanvas } from './StripPreviewCanvas';

interface BoothSetupProps {
  mode: SessionMode;
  roomCode: string | null;
  participants: Participant[];
  selfName: string;
  config: RoomConfig;
  customization: StripCustomization;
  onUpdateSelfName: (name: string) => void;
  onUpdateConfig: (patch: Partial<RoomConfig>) => void;
  onContinue: () => void;
}

export function BoothSetup({
  mode,
  roomCode,
  participants,
  selfName,
  config,
  customization,
  onUpdateSelfName,
  onUpdateConfig,
  onContinue,
}: BoothSetupProps) {
  const [category, setCategory] = useState<ThemeCategory>('all');
  const [copied, setCopied] = useState(false);

  const filteredFrames = useMemo(
    () =>
      category === 'all'
        ? THEME_FRAMES
        : THEME_FRAMES.filter((f) => f.category === category),
    [category]
  );

  const handleCopyLink = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Invite banner for multiplayer */}
      {mode !== 'solo' && roomCode && (
        <div className="tactile-card-sm mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl bg-[#EFF6FF] p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-zinc-900 bg-[#2563EB] text-white">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-zinc-900">
                  Room Code: <span className="font-mono-code text-[#FF4D4D]">{roomCode}</span>
                </span>
                <span className="rounded-full border border-zinc-900 bg-white px-2 py-0.5 font-mono-code text-[11px] font-bold">
                  {participants.filter((p) => p.connected).length} / {mode === 'squad' ? 4 : 2} joined
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                Connected:{' '}
                {participants
                  .filter((p) => p.connected)
                  .map((p) => p.name)
                  .join(', ') || selfName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="tactile-btn inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold text-zinc-900"
          >
            {copied ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Invite Link Copied!' : 'Copy Invite Link'}
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Configuration */}
        <div className="space-y-7 lg:col-span-8">
          {/* Name & Booth Style */}
          <section className="tactile-card rounded-2xl p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold text-zinc-900">
                  1. Choose your booth vibe
                </h2>
                <p className="text-xs text-zinc-600">
                  Each booth brings its own entrance curtain, lighting, and special frame touches.
                </p>
              </div>
              <div className="w-full sm:w-56">
                <label className="mb-1 block font-mono-code text-[10px] font-bold uppercase text-zinc-500">
                  Your Name
                </label>
                <input
                  type="text"
                  value={selfName}
                  maxLength={24}
                  onChange={(e) => onUpdateSelfName(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-900 bg-[#FAF6EF] px-3 py-1.5 text-sm font-bold text-zinc-900 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {BOOTH_STYLES.map((style) => {
                const selected = config.boothStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => onUpdateConfig({ boothStyle: style.id })}
                    className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                      selected
                        ? 'border-zinc-900 bg-[#FFF1F2] shadow-[3px_3px_0px_#18181B]'
                        : 'border-zinc-200 bg-white hover:border-zinc-900'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-1">
                      <span className="text-sm font-extrabold text-zinc-900">{style.name}</span>
                      <span
                        className="rounded-md border border-zinc-900 px-1.5 py-0.5 font-mono-code text-[9px] font-bold text-white"
                        style={{ backgroundColor: style.accent }}
                      >
                        {style.badge}
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-zinc-600">{style.tagline}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Strip Layout */}
          <section className="tactile-card rounded-2xl p-5">
            <h2 className="font-display text-2xl font-bold text-zinc-900">
              2. Pick your strip layout
            </h2>
            <p className="mb-4 text-xs text-zinc-600">
              You’ll still shoot 6 poses and choose your favorites afterward.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STRIP_LAYOUTS.map((layout) => {
                const selected = config.layoutId === layout.id;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => onUpdateConfig({ layoutId: layout.id })}
                    className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                      selected
                        ? 'border-zinc-900 bg-[#FEF3C7] shadow-[3px_3px_0px_#18181B]'
                        : 'border-zinc-200 bg-white hover:border-zinc-900'
                    }`}
                  >
                    {/* Tiny grid icon */}
                    <div className="mb-2.5 flex h-12 items-center justify-center rounded-lg border border-zinc-900/20 bg-white p-1.5">
                      <div
                        className="grid h-full gap-0.5"
                        style={{
                          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                          width: layout.cols === 2 ? '36px' : '20px',
                        }}
                      >
                        {Array.from({ length: layout.slotCount }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`rounded-[2px] ${selected ? 'bg-[#FF4D4D]' : 'bg-zinc-800'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-zinc-900">{layout.name}</div>
                    <p className="mt-0.5 text-[11px] text-zinc-600">{layout.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Theme Packs */}
          <section className="tactile-card rounded-2xl p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold text-zinc-900">
                  3. Open a theme pack
                </h2>
                <p className="text-xs text-zinc-600">
                  All {THEME_FRAMES.length} frame designs are unlocked free at 300 DPI.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {THEME_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors ${
                      category === cat.id
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {filteredFrames.map((frame) => {
                const selected = config.themeId === frame.id;
                return (
                  <button
                    key={frame.id}
                    type="button"
                    onClick={() => onUpdateConfig({ themeId: frame.id })}
                    className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all ${
                      selected
                        ? 'border-zinc-900 bg-[#ECFDF5] shadow-[3px_3px_0px_#18181B]'
                        : 'border-zinc-200 bg-white hover:border-zinc-900'
                    }`}
                  >
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg border-2 border-zinc-900"
                      style={{
                        background: `linear-gradient(135deg, ${frame.bgColor} 55%, ${frame.secondaryColor} 55%)`,
                      }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-zinc-900">
                        {frame.name}
                      </div>
                      <div className="font-mono-code text-[10px] uppercase text-zinc-500">
                        {frame.category}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Live Empty Frame Preview + Continue */}
        <div className="lg:col-span-4">
          <div className="tactile-card sticky top-24 rounded-3xl bg-[#EFE7DA] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 font-mono-code text-xs font-bold uppercase text-zinc-700">
                <Sparkles className="h-3.5 w-3.5 text-[#FF4D4D]" />
                Frame Preview
              </span>
              <span className="font-mono-code text-[11px] font-bold text-zinc-500">
                {config.layoutId.toUpperCase()}
              </span>
            </div>

            <div className="mx-auto w-48 rounded-xl border-2 border-zinc-900 bg-white p-1.5 shadow-[5px_5px_0px_#18181B] sm:w-56">
              <StripPreviewCanvas
                layoutId={config.layoutId}
                themeId={config.themeId}
                boothStyle={config.boothStyle}
                backdropId={config.backdropId}
                softBlend={config.softBlend}
                roomCode={roomCode || 'SOLO'}
                participantIds={participants.map((p) => p.id)}
                shots={[]}
                customization={customization}
                previewScale={0.4}
              />
            </div>

            <button
              type="button"
              onClick={onContinue}
              className="tactile-btn mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4D4D] px-5 py-3.5 text-sm font-extrabold text-white"
            >
              Next: Set Scene &amp; Camera
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
