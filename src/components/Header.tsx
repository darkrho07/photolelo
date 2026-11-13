import { Check, Copy, Volume2, VolumeX, Users } from 'lucide-react';
import { useState } from 'react';
import { Participant, WorkflowStep } from '../types/booth';

interface HeaderProps {
  step: WorkflowStep;
  roomCode: string | null;
  mode: 'solo' | 'duo' | 'squad';
  participants: Participant[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onGoHome: () => void;
}

const STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'setup', label: '1. Frame' },
  { id: 'prep', label: '2. Scene' },
  { id: 'capture', label: '3. Shoot' },
  { id: 'customize', label: '4. Style' },
  { id: 'export', label: '5. Keep' },
];

export function Header({
  step,
  roomCode,
  mode,
  participants,
  soundEnabled,
  onToggleSound,
  onGoHome,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const activeIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-zinc-900 bg-[#FAF6EF]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={onGoHome}
          className="group flex items-center gap-2.5 text-left focus:outline-none"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-zinc-900 bg-[#FF4D4D] text-white shadow-[2.5px_2.5px_0px_#18181B] transition-transform group-hover:-rotate-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="4" y="3" width="16" height="18" rx="2.5" />
              <line x1="4" y1="9" x2="20" y2="9" />
              <line x1="4" y1="15" x2="20" y2="15" />
              <circle cx="12" cy="6" r="1.2" fill="currentColor" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
              <circle cx="12" cy="18" r="1.2" fill="currentColor" />
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xl font-bold tracking-tight text-zinc-900">
                Photo Lelo
              </span>
              <span className="hidden rounded-md border border-zinc-900 bg-[#FFB800] px-1.5 py-0.5 font-mono-code text-[10px] font-bold uppercase text-zinc-900 sm:inline-block">
                Free HD
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-zinc-600 sm:block">
              Same second, same strip — from anywhere
            </p>
          </div>
        </button>

        {/* Stepper (visible inside booth) */}
        {step !== 'landing' && (
          <nav className="order-3 flex w-full items-center justify-center gap-1 overflow-x-auto pt-1 lg:order-2 lg:w-auto lg:pt-0">
            {STEPS.map((s, idx) => {
              const isActive = s.id === step;
              const isPast = activeIdx > idx;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 rounded-full border-2 px-3 py-1 font-mono-code text-xs font-bold transition-colors ${
                    isActive
                      ? 'border-zinc-900 bg-[#FF4D4D] text-white shadow-[2px_2px_0px_#18181B]'
                      : isPast
                        ? 'border-zinc-900 bg-[#10B981]/20 text-zinc-900'
                        : 'border-zinc-300 bg-white/70 text-zinc-400'
                  }`}
                >
                  <span>{s.label}</span>
                </div>
              );
            })}
          </nav>
        )}

        {/* Room Pill & Audio */}
        <div className="order-2 flex items-center gap-2 lg:order-3">
          {roomCode && mode !== 'solo' && (
            <div className="flex items-center gap-1.5 rounded-xl border-2 border-zinc-900 bg-white px-2.5 py-1.5 shadow-[2px_2px_0px_#18181B]">
              <span className="inline-flex items-center gap-1 font-mono-code text-xs font-bold text-zinc-900">
                <Users className="h-3.5 w-3.5 text-[#2563EB]" />
                {participants.filter((p) => p.connected).length}/{mode === 'squad' ? 4 : 2}
              </span>
              <span className="h-3.5 w-[1.5px] bg-zinc-200" />
              <span className="font-mono-code text-xs font-bold tracking-wider text-[#FF4D4D]">
                {roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyInvite}
                title="Copy invite link"
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-zinc-900 bg-[#FAF6EF] px-1.5 py-0.5 text-[11px] font-bold text-zinc-900 hover:bg-[#FFB800]"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Invite'}</span>
              </button>
            </div>
          )}

          {mode === 'solo' && step !== 'landing' && (
            <span className="rounded-xl border-2 border-zinc-900 bg-[#FFB800]/30 px-2.5 py-1 font-mono-code text-xs font-bold text-zinc-900">
              SOLO BOOTH
            </span>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute booth sounds' : 'Unmute booth sounds'}
            className="tactile-btn flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-900"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-zinc-400" />}
          </button>
        </div>
      </div>
    </header>
  );
}
