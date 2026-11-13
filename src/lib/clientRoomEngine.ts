import {
  BoothStyleId,
  DoodleStroke,
  LayoutId,
  Participant,
  PlacedSticker,
  RoomConfig,
  RoomState,
  StripCustomization,
} from '../types/booth';
import { POSE_DECK } from '../data/boothData';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PARTICIPANT_COLORS = ['#FF4D4D', '#2563EB', '#10B981', '#D97706'];

const MEME_POSES = [
  'POV: You just spotted snacks across the room',
  'Dramatic telenovela gasp of pure betrayal',
  'Suspicious side-eye at your partner',
  'Pretend you just won an Oscar for nothing',
  'Holding back laughter while trying to look serious',
  'Shocked cat meme energy — wide eyes!',
];

export function generateClientRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function slotCountForLayout(layoutId: LayoutId): number {
  switch (layoutId) {
    case 'strip-1x3':
      return 3;
    case 'polaroid-2':
      return 2;
    case 'strip-1x4':
    case 'grid-2x2':
    default:
      return 4;
  }
}

function defaultSelectedShots(layoutId: LayoutId): number[] {
  return Array.from({ length: slotCountForLayout(layoutId) }, (_, i) => i);
}

export function pickClientSessionPoses(boothStyle: BoothStyleId): string[] {
  const pool = boothStyle === 'meme' ? [...MEME_POSES] : [...POSE_DECK];
  const result: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (pool.length === 0) break;
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

export interface ClientRoomCallbacks {
  onRoomState: (room: RoomState) => void;
  onSnapTrigger: (shotIndex: number, posePrompt: string) => void;
}

export class ClientRoomEngine {
  public room: RoomState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: ClientRoomCallbacks;

  constructor(
    code: string,
    mode: 'duo' | 'squad',
    hostId: string,
    hostName: string,
    callbacks: ClientRoomCallbacks
  ) {
    const cleanName = hostName.trim().slice(0, 24) || 'Player 1';
    this.callbacks = callbacks;

    const defaultConfig: RoomConfig = {
      boothStyle: 'classic',
      layoutId: 'strip-1x4',
      themeId: 'cream',
      backdropId: 'none',
      softBlend: true,
      countdownSeconds: 3,
      soundEnabled: true,
    };

    this.room = {
      code: code.toUpperCase(),
      mode,
      maxParticipants: mode === 'squad' ? 4 : 2,
      phase: 'setup',
      participants: [
        {
          id: hostId,
          name: cleanName,
          color: PARTICIPANT_COLORS[0],
          ready: false,
          isHost: true,
          connected: true,
          faceFilter: 'natural',
          faceProp: 'none',
          cursor: null,
        },
      ],
      config: defaultConfig,
      capture: {
        active: false,
        totalShots: 6,
        currentShot: 0,
        stage: 'idle',
        countdownRemaining: defaultConfig.countdownSeconds,
        posePrompts: pickClientSessionPoses(defaultConfig.boothStyle),
        shots: [],
      },
      customization: {
        selectedShotIndices: [0, 1, 2, 3],
        stripFilterId: 'original',
        filterIntensity: 100,
        caption: cleanName,
        showDate: true,
        showRoomCode: true,
        showBrandMark: true,
        stickers: [],
        doodles: [],
      },
      createdAt: Date.now(),
    };
  }

  joinParticipant(participantId: string, name?: string): { ok: true; participant: Participant } | { ok: false; error: string } {
    const existing = this.room.participants.find((p) => p.id === participantId);
    if (existing) {
      existing.connected = true;
      if (name && name.trim()) existing.name = name.trim().slice(0, 24);
      this.emitState();
      return { ok: true, participant: existing };
    }

    if (this.room.participants.length >= this.room.maxParticipants) {
      const disconnectedSlot = this.room.participants.find((p) => !p.connected);
      if (disconnectedSlot) {
        disconnectedSlot.id = participantId;
        disconnectedSlot.name = (name?.trim() || disconnectedSlot.name).slice(0, 24);
        disconnectedSlot.connected = true;
        disconnectedSlot.ready = false;
        this.refreshCaption();
        this.emitState();
        return { ok: true, participant: disconnectedSlot };
      }
      return {
        ok: false,
        error:
          this.room.mode === 'duo'
            ? `Room ${this.room.code} already has 2 people inside.`
            : `Squad room ${this.room.code} is full (4/4).`,
      };
    }

    const idx = this.room.participants.length;
    const participant: Participant = {
      id: participantId,
      name: (name?.trim() || `Player ${idx + 1}`).slice(0, 24),
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
      ready: false,
      isHost: false,
      connected: true,
      faceFilter: 'natural',
      faceProp: 'none',
      cursor: null,
    };

    this.room.participants.push(participant);
    this.refreshCaption();
    this.emitState();
    return { ok: true, participant };
  }

  disconnectParticipant(participantId: string) {
    const p = this.room.participants.find((x) => x.id === participantId);
    if (!p) return;
    p.connected = false;
    p.ready = false;
    p.cursor = null;
    this.emitState();
  }

  updateParticipant(
    participantId: string,
    patch: Partial<Pick<Participant, 'name' | 'ready' | 'faceFilter' | 'faceProp'>>
  ) {
    const p = this.room.participants.find((x) => x.id === participantId);
    if (!p) return;
    if (patch.name !== undefined) {
      p.name = patch.name.trim().slice(0, 24) || p.name;
      this.refreshCaption();
    }
    if (patch.faceFilter !== undefined) p.faceFilter = patch.faceFilter;
    if (patch.faceProp !== undefined) p.faceProp = patch.faceProp;
    if (patch.ready !== undefined) {
      p.ready = patch.ready;
      this.maybeAutoStartCapture();
    }
    this.emitState();
  }

  updateConfig(patch: Partial<RoomConfig>) {
    const prevStyle = this.room.config.boothStyle;
    const prevLayout = this.room.config.layoutId;
    this.room.config = { ...this.room.config, ...patch };
    if (patch.boothStyle && patch.boothStyle !== prevStyle && !this.room.capture.active) {
      this.room.capture.posePrompts = pickClientSessionPoses(patch.boothStyle);
    }
    if (patch.layoutId && patch.layoutId !== prevLayout) {
      this.room.customization.selectedShotIndices = defaultSelectedShots(patch.layoutId);
    }
    this.emitState();
  }

  setPhase(phase: RoomState['phase']) {
    this.room.phase = phase;
    if (phase === 'prep') {
      this.room.participants.forEach((p) => {
        p.ready = false;
      });
    }
    this.emitState();
  }

  private maybeAutoStartCapture() {
    if (this.room.phase !== 'prep' || this.room.capture.active) return;
    const connected = this.room.participants.filter((p) => p.connected);
    if (connected.length >= 2 && connected.every((p) => p.ready)) {
      this.startCapture();
    }
  }

  startCapture() {
    if (this.room.capture.active) return;
    this.clearTimer();
    this.room.phase = 'capture';

    const posePrompts = pickClientSessionPoses(this.room.config.boothStyle);
    this.room.capture = {
      active: true,
      totalShots: 6,
      currentShot: 0,
      stage: 'curtain',
      countdownRemaining: this.room.config.countdownSeconds,
      posePrompts,
      shots: Array.from({ length: 6 }, (_, i) => ({
        shotIndex: i,
        framesByParticipant: {},
        posePrompt: posePrompts[i] || POSE_DECK[i % POSE_DECK.length],
        memeCaption: this.room.config.boothStyle === 'meme' ? posePrompts[i] : undefined,
        timestamp: 0,
      })),
    };
    this.emitState();

    this.timer = setTimeout(() => this.runShotCountdown(0), 1100);
  }

  private runShotCountdown(shotIndex: number) {
    if (!this.room.capture.active) return;

    if (shotIndex >= this.room.capture.totalShots) {
      this.room.capture.active = false;
      this.room.capture.stage = 'done';
      this.room.phase = 'customize';
      this.room.customization.selectedShotIndices = defaultSelectedShots(this.room.config.layoutId);
      this.room.participants.forEach((p) => {
        p.ready = false;
      });
      this.emitState();
      return;
    }

    this.room.capture.currentShot = shotIndex;
    this.room.capture.stage = 'countdown';
    this.room.capture.countdownRemaining = this.room.config.countdownSeconds;
    this.emitState();

    const tick = () => {
      if (!this.room.capture.active) return;
      if (this.room.capture.countdownRemaining > 1) {
        this.room.capture.countdownRemaining -= 1;
        this.emitState();
        this.timer = setTimeout(tick, 1000);
      } else {
        this.room.capture.countdownRemaining = 0;
        this.room.capture.stage = 'snapping';
        const shot = this.room.capture.shots[shotIndex];
        if (shot) shot.timestamp = Date.now();
        this.callbacks.onSnapTrigger(shotIndex, this.room.capture.posePrompts[shotIndex] || '');
        this.emitState();
        this.timer = setTimeout(() => this.runShotCountdown(shotIndex + 1), 1250);
      }
    };

    this.timer = setTimeout(tick, 1000);
  }

  recordShotFrame(participantId: string, shotIndex: number, imageData: string) {
    const shot = this.room.capture.shots[shotIndex];
    if (!shot) return;
    shot.framesByParticipant[participantId] = imageData;
    this.emitState();
  }

  updateCustomization(patch: Partial<StripCustomization>) {
    this.room.customization = { ...this.room.customization, ...patch };
    this.emitState();
  }

  upsertSticker(sticker: PlacedSticker) {
    const idx = this.room.customization.stickers.findIndex((s) => s.id === sticker.id);
    if (idx >= 0) {
      this.room.customization.stickers[idx] = sticker;
    } else {
      this.room.customization.stickers.push(sticker);
    }
    this.emitState();
  }

  removeSticker(stickerId: string) {
    this.room.customization.stickers = this.room.customization.stickers.filter(
      (s) => s.id !== stickerId
    );
    this.emitState();
  }

  addDoodle(stroke: DoodleStroke) {
    if (!this.room.customization.doodles.some((d) => d.id === stroke.id)) {
      this.room.customization.doodles.push(stroke);
      this.emitState();
    }
  }

  undoDoodle() {
    this.room.customization.doodles.pop();
    this.emitState();
  }

  clearDoodles() {
    this.room.customization.doodles = [];
    this.emitState();
  }

  resetForRetake(targetPhase: 'setup' | 'prep' = 'prep') {
    this.clearTimer();
    this.room.phase = targetPhase;
    this.room.participants.forEach((p) => {
      p.ready = false;
    });
    this.room.capture = {
      active: false,
      totalShots: 6,
      currentShot: 0,
      stage: 'idle',
      countdownRemaining: this.room.config.countdownSeconds,
      posePrompts: pickClientSessionPoses(this.room.config.boothStyle),
      shots: [],
    };
    this.room.customization.stickers = [];
    this.room.customization.doodles = [];
    this.room.customization.selectedShotIndices = defaultSelectedShots(this.room.config.layoutId);
    this.emitState();
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emitState() {
    // Emit a cloned snapshot so React detects deep changes cleanly
    this.callbacks.onRoomState(structuredClone(this.room));
  }

  private refreshCaption() {
    const names = this.room.participants.map((p) => p.name).filter(Boolean);
    if (names.length > 0 && this.room.participants.length <= 2) {
      const prev = this.room.participants
        .slice(0, -1)
        .map((p) => p.name)
        .join(' & ');
      if (
        this.room.customization.caption === '' ||
        this.room.customization.caption === 'You' ||
        this.room.customization.caption === 'Player 1' ||
        this.room.customization.caption === prev ||
        this.room.customization.caption.startsWith('Player ')
      ) {
        this.room.customization.caption = names.join(' & ');
      }
    }
  }
}
