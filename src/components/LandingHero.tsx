import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Sparkles,
  Users,
  User,
  ArrowRight,
  Film,
  Palette,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { BOOTH_STYLES, THEME_FRAMES } from '../data/boothData';
import { drawVirtualCamFrame } from '../lib/virtualCam';
import { CapturedShot, StripCustomization } from '../types/booth';
import { StripPreviewCanvas } from './StripPreviewCanvas';

interface LandingHeroProps {
  totalStripsCreated: number;
  initialJoinCode?: string;
  joiningError?: string | null;
  onCreateRoom: (mode: 'duo' | 'squad', name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  onStartSolo: (name: string) => void;
}

const DEMO_THEMES = ['cream', 'bows', 'ticket', 'bistro', 'checker', 'starlight'];

function makeStaticAvatarDataUrl(
  pose: 'halfheart-left' | 'halfheart-right' | 'peace' | 'kiss' | 'smile' | 'shocked',
  bgHex: string,
  shirtHex: string,
  skinHex: string,
  hairHex: string,
  label: string
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawVirtualCamFrame(
    ctx,
    480,
    360,
    { bgHex, shirtHex, skinHex, hairHex, pose, label },
    1000
  );
  return canvas.toDataURL('image/png');
}

export function LandingHero({
  totalStripsCreated,
  initialJoinCode = '',
  joiningError,
  onCreateRoom,
  onJoinRoom,
  onStartSolo,
}: LandingHeroProps) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [demoThemeId, setDemoThemeId] = useState('ticket');
  const [demoBackdropId, setDemoBackdropId] = useState('paris');
  const [demoShots, setDemoShots] = useState<CapturedShot[]>([]);

  useEffect(() => {
    if (initialJoinCode) setJoinCode(initialJoinCode);
  }, [initialJoinCode]);

  useEffect(() => {
    // Generate sample dual-person composite shots for the live interactive hero strip
    const poses: Array<{
      p1: 'halfheart-left' | 'peace' | 'kiss' | 'smile';
      p2: 'halfheart-right' | 'peace' | 'kiss' | 'smile' | 'shocked';
      prompt: string;
    }> = [
      { p1: 'halfheart-left', p2: 'halfheart-right', prompt: 'Half heart each' },
      { p1: 'peace', p2: 'peace', prompt: 'Double peace!' },
      { p1: 'kiss', p2: 'smile', prompt: 'Blow a kiss' },
      { p1: 'smile', p2: 'shocked', prompt: 'Silly face' },
    ];

    const generated: CapturedShot[] = poses.map((row, idx) => ({
      shotIndex: idx,
      posePrompt: row.prompt,
      timestamp: Date.now(),
      framesByParticipant: {
        a: makeStaticAvatarDataUrl(row.p1, '#FDE68A', '#FF4D4D', '#F3C6A5', '#27201C', 'AARAV'),
        b: makeStaticAvatarDataUrl(row.p2, '#DBEAFE', '#2563EB', '#E0AC8B', '#18181B', 'MAYA'),
      },
    }));
    setDemoShots(generated);
  }, []);

  const demoCustomization = useMemo<StripCustomization>(
    () => ({
      selectedShotIndices: [0, 1, 2, 3],
      stripFilterId: 'warm-film',
      filterIntensity: 65,
      caption: 'Aarav & Maya',
      showDate: true,
      showRoomCode: true,
      showBrandMark: true,
      stickers: [
        {
          id: 'demo-1',
          stickerId: 'word-xoxo',
          label: 'XOXO',
          kind: 'word',
          x: 0.8,
          y: 0.25,
          scale: 0.9,
          rotation: -8,
          color: '#FFFFFF',
          bgColor: '#FF4D4D',
        },
        {
          id: 'demo-2',
          stickerId: 'bow',
          label: '🎀',
          kind: 'emoji',
          x: 0.16,
          y: 0.56,
          scale: 0.85,
          rotation: 12,
        },
      ],
      doodles: [
        {
          id: 'd1',
          color: '#FF4D4D',
          width: 0.008,
          points: [
            { x: 0.14, y: 0.91 },
            { x: 0.18, y: 0.89 },
            { x: 0.22, y: 0.91 },
          ],
        },
      ],
    }),
    []
  );

  const playerLabel = name.trim() || 'You';

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      {/* Hero Split */}
      <div className="grid items-center gap-10 lg:grid-cols-12">
        {/* Left Launch Pad */}
        <div className="lg:col-span-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-zinc-900 bg-[#FFB800] px-3.5 py-1 font-mono-code text-xs font-bold text-zinc-900 shadow-[2px_2px_0px_#18181B]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{totalStripsCreated.toLocaleString()} STRIPS PRINTED · 100% FREE 300 DPI</span>
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            Step into the booth together,{' '}
            <span className="relative inline-block text-[#FF4D4D]">
              miles apart.
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 260 12"
                fill="none"
              >
                <path
                  d="M2 8.5C70 2 180 2 258 9"
                  stroke="#FFB800"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
            <strong>Photo Lelo</strong> is your live browser photobooth for long-distance couples,
            best friends, and squads. Share a 5-letter room code, strike 6 poses on one synced
            countdown, co-edit with stickers &amp; doodles, and download clean 300 DPI strips free.
          </p>

          {/* Booth Launcher Box */}
          <div className="tactile-card mt-7 rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Your Display Name
              </label>
              <span className="font-mono-code text-[11px] text-zinc-500">
                No account or app download needed
              </span>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="e.g. Aarav, Maya, Bestie..."
              className="mb-4 w-full rounded-xl border-2 border-zinc-900 bg-[#FAF6EF] px-4 py-2.5 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF4D4D]"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onCreateRoom('duo', playerLabel)}
                className="tactile-btn flex items-center justify-between rounded-xl bg-[#FF4D4D] px-4 py-3.5 text-left text-white"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-extrabold">
                    <Users className="h-4 w-4" />
                    Create Duo Room
                  </div>
                  <div className="text-xs text-white/90">For 2 people · Split frame</div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => onCreateRoom('squad', playerLabel)}
                className="tactile-btn flex items-center justify-between rounded-xl bg-[#2563EB] px-4 py-3.5 text-left text-white"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-extrabold">
                    <Users className="h-4 w-4" />
                    Create Squad Room
                  </div>
                  <div className="text-xs text-white/90">Up to 4 friends · 2×2 cam</div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </button>
            </div>

            {/* Join Room + Solo */}
            <div className="mt-4 grid gap-3 border-t-2 border-dashed border-zinc-200 pt-4 sm:grid-cols-12">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (joinCode.trim().length >= 4) {
                    onJoinRoom(joinCode.trim().toUpperCase(), playerLabel);
                  }
                }}
                className="flex gap-2 sm:col-span-7"
              >
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="5-LETTER CODE"
                  className="font-mono-code w-full rounded-xl border-2 border-zinc-900 bg-white px-3.5 py-2.5 text-sm font-bold uppercase tracking-widest text-zinc-900 placeholder:tracking-normal placeholder:font-sans placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <button
                  type="submit"
                  disabled={joinCode.trim().length < 4}
                  className="tactile-btn shrink-0 rounded-xl bg-[#FFB800] px-4 py-2.5 text-sm font-extrabold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Join
                </button>
              </form>

              <button
                type="button"
                onClick={() => onStartSolo(playerLabel)}
                className="tactile-btn flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 sm:col-span-5"
              >
                <User className="h-4 w-4 text-[#10B981]" />
                Shoot Solo Instead
              </button>
            </div>

            {joiningError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {joiningError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" /> Free 300 DPI PNG
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" /> No Watermark Paywall
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" /> Built-in Studio Virtual Cam
              </span>
            </div>
          </div>
        </div>

        {/* Right Interactive Live Strip Demo */}
        <div className="lg:col-span-5">
          <div className="tactile-card relative mx-auto max-w-md rounded-3xl bg-[#EFE7DA] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-900 bg-white px-2.5 py-1 font-mono-code text-[11px] font-bold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF4D4D]" />
                LIVE STRIP PREVIEW
              </span>
              <div className="flex gap-1">
                {(['paris', 'tokyo', 'cinema', 'picnic'] as const).map((bd) => (
                  <button
                    key={bd}
                    type="button"
                    onClick={() => setDemoBackdropId(bd)}
                    className={`rounded-md border px-2 py-0.5 font-mono-code text-[10px] font-bold uppercase ${
                      demoBackdropId === bd
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-400 bg-white/80 text-zinc-700 hover:bg-white'
                    }`}
                  >
                    {bd}
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-auto w-56 rotate-1 rounded-xl border-2 border-zinc-900 bg-white p-1.5 shadow-[6px_6px_0px_#18181B] transition-transform hover:rotate-0 sm:w-64">
              {demoShots.length > 0 && (
                <StripPreviewCanvas
                  layoutId="strip-1x4"
                  themeId={demoThemeId}
                  boothStyle="classic"
                  backdropId={demoBackdropId}
                  softBlend={true}
                  roomCode="PL7K2"
                  participantIds={['a', 'b']}
                  shots={demoShots}
                  customization={demoCustomization}
                  previewScale={0.44}
                />
              )}
            </div>

            {/* Theme quick switcher */}
            <div className="mt-4">
              <p className="mb-1.5 text-center font-mono-code text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                Tap a frame pack to preview
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {DEMO_THEMES.map((tid) => {
                  const frame = THEME_FRAMES.find((f) => f.id === tid);
                  if (!frame) return null;
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => setDemoThemeId(tid)}
                      className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition-all ${
                        demoThemeId === tid
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-900/40 bg-white text-zinc-800 hover:border-zinc-900'
                      }`}
                    >
                      {frame.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section className="mt-20">
        <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono-code text-xs font-bold uppercase tracking-widest text-[#FF4D4D]">
              UNDER 3 MINUTES
            </p>
            <h2 className="font-display text-3xl font-bold text-zinc-900">
              How Photo Lelo works
            </h2>
          </div>
          <p className="max-w-md text-sm text-zinc-600">
            Designed so nobody gets rushed before hitting &ldquo;I&rsquo;m Ready&rdquo; — and both shutters fire on the exact same server tick.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Users,
              step: '01',
              title: 'Open a room or go solo',
              desc: 'Send a 5-letter code or invite link for Duo (2) or Squad (up to 4), or jump straight into Solo mode.',
              bg: 'bg-[#FFF1F2]',
            },
            {
              icon: Film,
              step: '02',
              title: 'Pick your booth vibe & frame',
              desc: 'Choose Classic, Vintage 1930s curtain, Meme Dare, Laundromat, Subway, or Karaoke + 22 theme frames.',
              bg: 'bg-[#EFF6FF]',
            },
            {
              icon: Sparkles,
              step: '03',
              title: 'Set a shared scene & ready up',
              desc: 'Split one Paris, Tokyo, Cinema, or Café backdrop across your screens. Nothing starts until both tap Ready.',
              bg: 'bg-[#FEF3C7]',
            },
            {
              icon: Camera,
              step: '04',
              title: '6 synced poses in real time',
              desc: 'One shared countdown fires both cameras at the same instant with fun long-distance pose prompts.',
              bg: 'bg-[#ECFDF5]',
            },
            {
              icon: Palette,
              step: '05',
              title: 'Pick 4, sticker & doodle live',
              desc: 'Choose your favorite 4 cuts, apply pixel-matched filters, drag stickers, and see your partner’s live cursor.',
              bg: 'bg-[#FDF2F8]',
            },
            {
              icon: Download,
              step: '06',
              title: 'Print-ready HD & video recap',
              desc: 'Download free 300 DPI PNG strips, booth recap WebM videos, and preview magnets, keychains & wallpapers.',
              bg: 'bg-white',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className={`tactile-card-sm rounded-2xl p-5 ${item.bg}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-zinc-900 bg-white">
                    <Icon className="h-5 w-5 text-zinc-900" />
                  </span>
                  <span className="font-mono-code text-xs font-bold text-zinc-500">
                    STEP {item.step}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-zinc-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Booth Vibes Preview */}
      <section className="mt-16">
        <h2 className="font-display mb-6 text-2xl font-bold text-zinc-900 sm:text-3xl">
          6 Signature Booth Rooms
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOOTH_STYLES.map((b) => (
            <div key={b.id} className="tactile-card-sm flex flex-col justify-between rounded-2xl p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-base font-extrabold text-zinc-900">{b.name}</span>
                  <span
                    className="rounded-full border border-zinc-900 px-2.5 py-0.5 font-mono-code text-[10px] font-bold text-white"
                    style={{ backgroundColor: b.accent }}
                  >
                    {b.badge}
                  </span>
                </div>
                <p className="text-xs font-semibold text-zinc-700">{b.tagline}</p>
                <p className="mt-1 text-xs text-zinc-500">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
