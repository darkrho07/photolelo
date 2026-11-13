import {
  DoodleStroke,
  LayoutId,
  Participant,
  PlacedSticker,
  RoomConfig,
  RoomMode,
  RoomPhase,
  RoomState,
  StripCustomization,
} from './types.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PARTICIPANT_COLORS = ['#FF4D4D', '#2563EB', '#10B981', '#D97706'];

const DEFAULT_POSES = [
  'Make half a heart each — meet in the middle!',
  'Point at each other and pull your silliest face',
  'Rest your chin in your hand & give a cozy smile',
  'Blow a kiss right toward the center seam',
  'Double peace signs & big celebratory grin',
  'Squish your own cheeks like a tiny dumpling',
  'Virtual high-five across the frame',
  'Cover one eye & wink at the camera',
];

const MEME_POSES = [
  'POV: You just spotted snacks across the room',
  'Dramatic telenovela gasp of pure betrayal',
  'Suspicious side-eye at your partner',
  'Pretend you just won an Oscar for nothing',
  'Holding back laughter while trying to look serious',
  'Shocked cat meme energy — wide eyes!',
];

const DEFAULT_CONFIG: RoomConfig = {
  boothStyle: 'classic',
  layoutId: 'strip-1x4',
  themeId: 'cream',
  backdropId: 'none',
  softBlend: true,
  countdownSeconds: 3,
  soundEnabled: true,
};

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
  const count = slotCountForLayout(layoutId);
  return Array.from({ length: count }, (_, i) => i);
}

export function generateRoomCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  return `PL${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

export function pickSessionPoses(boothStyle: RoomConfig['boothStyle']): string[] {
  const pool = boothStyle === 'meme' ? [...MEME_POSES] : [...DEFAULT_POSES];
  const result: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (pool.length === 0) break;
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

export interface RoomBroadcaster {
  broadcastRoomState: (room: RoomState) => void;
  broadcastEvent: (roomCode: string, payload: Record<string, unknown>, excludeParticipantId?: string) => void;
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private timers = new Map<string, NodeJS.Timeout>();
  private totalStripsCreated = 1428; // seed counter incremented on completed sessions
  private broadcaster?: RoomBroadcaster;

  constructor(broadcaster?: RoomBroadcaster) {
    this.broadcaster = broadcaster;
  }

  setBroadcaster(broadcaster: RoomBroadcaster) {
    this.broadcaster = broadcaster;
  }

  getStats() {
    return {
      activeRooms: this.rooms.size,
      totalStripsCreated: this.totalStripsCreated,
    };
  }

  createRoom(mode: RoomMode = 'duo', hostName = 'You'): RoomState {
    const existing = new Set(this.rooms.keys());
    const code = generateRoomCode(existing);
    const now = Date.now();
    const cleanName = hostName.trim().slice(0, 24) || 'Player 1';

    const room: RoomState = {
      code,
      mode,
      maxParticipants: mode === 'squad' ? 4 : 2,
      phase: 'setup',
      participants: [],
      config: { ...DEFAULT_CONFIG },
      capture: {
        active: false,
        totalShots: 6,
        currentShot: 0,
        stage: 'idle',
        countdownRemaining: DEFAULT_CONFIG.countdownSeconds,
        posePrompts: pickSessionPoses(DEFAULT_CONFIG.boothStyle),
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
      createdAt: now,
      lastActivityAt: now,
    };

    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  joinRoom(
    code: string,
    participantId: string,
    name?: string
  ): { room: RoomState; participant: Participant } | { error: string } {
    const room = this.getRoom(code);
    if (!room) {
      return { error: `Room "${code.toUpperCase()}" not found. Double-check the 5-letter code.` };
    }

    room.lastActivityAt = Date.now();

    const existing = room.participants.find((p) => p.id === participantId);
    if (existing) {
      existing.connected = true;
      if (name && name.trim()) {
        existing.name = name.trim().slice(0, 24);
      }
      return { room, participant: existing };
    }

    // Reclaim disconnected non-host slot if room is at capacity
    if (room.participants.length >= room.maxParticipants) {
      const disconnectedSlot = room.participants.find((p) => !p.connected);
      if (disconnectedSlot) {
        disconnectedSlot.id = participantId;
        disconnectedSlot.name = (name?.trim() || disconnectedSlot.name).slice(0, 24);
        disconnectedSlot.connected = true;
        disconnectedSlot.ready = false;
        this.refreshDefaultCaption(room);
        return { room, participant: disconnectedSlot };
      }
      return {
        error:
          room.mode === 'duo'
            ? `Room ${room.code} already has 2 people inside.`
            : `Squad room ${room.code} is full (4/4).`,
      };
    }

    const index = room.participants.length;
    const isHost = index === 0;
    const defaultLabel = isHost ? 'Player 1' : `Player ${index + 1}`;
    const participant: Participant = {
      id: participantId,
      name: (name?.trim() || defaultLabel).slice(0, 24),
      color: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
      ready: false,
      isHost,
      connected: true,
      faceFilter: 'natural',
      faceProp: 'none',
      cursor: null,
    };

    room.participants.push(participant);
    this.refreshDefaultCaption(room);
    return { room, participant };
  }

  disconnectParticipant(code: string, participantId: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;

    const participant = room.participants.find((p) => p.id === participantId);
    if (!participant) return room;

    participant.connected = false;
    participant.cursor = null;
    participant.ready = false;

    if (participant.isHost) {
      const nextHost = room.participants.find((p) => p.connected);
      if (nextHost) {
        participant.isHost = false;
        nextHost.isHost = true;
      }
    }

    return room;
  }

  updateParticipant(
    code: string,
    participantId: string,
    patch: Partial<Pick<Participant, 'name' | 'ready' | 'faceFilter' | 'faceProp'>>
  ): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    const participant = room.participants.find((p) => p.id === participantId);
    if (!participant) return room;

    room.lastActivityAt = Date.now();
    if (patch.name !== undefined) {
      participant.name = patch.name.trim().slice(0, 24) || participant.name;
      this.refreshDefaultCaption(room);
    }
    if (patch.faceFilter !== undefined) participant.faceFilter = patch.faceFilter;
    if (patch.faceProp !== undefined) participant.faceProp = patch.faceProp;
    if (patch.ready !== undefined) {
      participant.ready = patch.ready;
      this.maybeAutoStartCapture(room);
    }

    return room;
  }

  updateConfig(code: string, patch: Partial<RoomConfig>): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();

    const prevStyle = room.config.boothStyle;
    const prevLayout = room.config.layoutId;
    room.config = { ...room.config, ...patch };

    if (patch.boothStyle && patch.boothStyle !== prevStyle && !room.capture.active) {
      room.capture.posePrompts = pickSessionPoses(patch.boothStyle);
    }
    if (patch.layoutId && patch.layoutId !== prevLayout) {
      room.customization.selectedShotIndices = defaultSelectedShots(patch.layoutId);
    }

    return room;
  }

  setPhase(code: string, phase: RoomPhase): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    room.phase = phase;

    if (phase === 'prep') {
      room.participants.forEach((p) => {
        p.ready = false;
      });
    }

    if (phase === 'export') {
      this.totalStripsCreated += 1;
    }

    return room;
  }

  private maybeAutoStartCapture(room: RoomState) {
    if (room.phase !== 'prep' || room.capture.active) return;
    const connected = room.participants.filter((p) => p.connected);
    if (connected.length < 2) return; // Wait for partner unless host explicitly triggers solo-while-waiting
    if (connected.every((p) => p.ready)) {
      this.startCaptureSession(room.code);
    }
  }

  startCaptureSession(code: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room || room.capture.active) return room;

    this.clearRoomTimer(code);
    room.lastActivityAt = Date.now();
    room.phase = 'capture';

    const posePrompts = pickSessionPoses(room.config.boothStyle);
    room.capture = {
      active: true,
      totalShots: 6,
      currentShot: 0,
      stage: 'curtain',
      countdownRemaining: room.config.countdownSeconds,
      posePrompts,
      shots: Array.from({ length: 6 }, (_, i) => ({
        shotIndex: i,
        framesByParticipant: {},
        posePrompt: posePrompts[i] || DEFAULT_POSES[i % DEFAULT_POSES.length],
        memeCaption: room.config.boothStyle === 'meme' ? posePrompts[i] : undefined,
        timestamp: 0,
      })),
    };

    this.broadcaster?.broadcastRoomState(room);

    // Curtain entrance for 1100ms, then begin shot 0 countdown
    const timer = setTimeout(() => {
      this.runShotCountdown(code, 0);
    }, 1100);
    this.timers.set(code, timer);

    return room;
  }

  private runShotCountdown(code: string, shotIndex: number) {
    const room = this.getRoom(code);
    if (!room || !room.capture.active) return;

    if (shotIndex >= room.capture.totalShots) {
      room.capture.active = false;
      room.capture.stage = 'done';
      room.phase = 'customize';
      room.customization.selectedShotIndices = defaultSelectedShots(room.config.layoutId);
      room.participants.forEach((p) => {
        p.ready = false;
      });
      this.broadcaster?.broadcastRoomState(room);
      return;
    }

    room.capture.currentShot = shotIndex;
    room.capture.stage = 'countdown';
    room.capture.countdownRemaining = room.config.countdownSeconds;
    this.broadcaster?.broadcastRoomState(room);

    const tick = () => {
      const latest = this.getRoom(code);
      if (!latest || !latest.capture.active) return;

      if (latest.capture.countdownRemaining > 1) {
        latest.capture.countdownRemaining -= 1;
        this.broadcaster?.broadcastRoomState(latest);
        const nextTimer = setTimeout(tick, 1000);
        this.timers.set(code, nextTimer);
      } else {
        latest.capture.countdownRemaining = 0;
        latest.capture.stage = 'snapping';
        const shot = latest.capture.shots[shotIndex];
        if (shot) shot.timestamp = Date.now();

        this.broadcaster?.broadcastEvent(code, {
          type: 'snap-trigger',
          shotIndex,
          posePrompt: latest.capture.posePrompts[shotIndex],
          timestamp: Date.now(),
        });
        this.broadcaster?.broadcastRoomState(latest);

        const nextShotTimer = setTimeout(() => {
          this.runShotCountdown(code, shotIndex + 1);
        }, 1250);
        this.timers.set(code, nextShotTimer);
      }
    };

    const timer = setTimeout(tick, 1000);
    this.timers.set(code, timer);
  }

  recordShotFrame(code: string, participantId: string, shotIndex: number, imageData: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    const shot = room.capture.shots[shotIndex];
    if (!shot) return room;

    room.lastActivityAt = Date.now();
    shot.framesByParticipant[participantId] = imageData;
    return room;
  }

  updateCustomization(code: string, patch: Partial<StripCustomization>): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    room.customization = { ...room.customization, ...patch };
    return room;
  }

  upsertSticker(code: string, sticker: PlacedSticker): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    const idx = room.customization.stickers.findIndex((s) => s.id === sticker.id);
    if (idx >= 0) {
      room.customization.stickers[idx] = sticker;
    } else {
      room.customization.stickers.push(sticker);
    }
    return room;
  }

  removeSticker(code: string, stickerId: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    room.customization.stickers = room.customization.stickers.filter((s) => s.id !== stickerId);
    return room;
  }

  addDoodle(code: string, stroke: DoodleStroke): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    room.customization.doodles.push(stroke);
    return room;
  }

  undoDoodle(code: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    room.customization.doodles.pop();
    return room;
  }

  clearDoodles(code: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    room.lastActivityAt = Date.now();
    room.customization.doodles = [];
    return room;
  }

  resetForRetake(code: string, targetPhase: RoomPhase = 'prep'): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    this.clearRoomTimer(code);
    room.lastActivityAt = Date.now();
    room.phase = targetPhase;
    room.participants.forEach((p) => {
      p.ready = false;
    });
    room.capture = {
      active: false,
      totalShots: 6,
      currentShot: 0,
      stage: 'idle',
      countdownRemaining: room.config.countdownSeconds,
      posePrompts: pickSessionPoses(room.config.boothStyle),
      shots: [],
    };
    room.customization.stickers = [];
    room.customization.doodles = [];
    room.customization.selectedShotIndices = defaultSelectedShots(room.config.layoutId);
    return room;
  }

  cleanupStaleRooms(maxIdleMs = 1000 * 60 * 90) {
    const cutoff = Date.now() - maxIdleMs;
    for (const [code, room] of this.rooms.entries()) {
      const anyConnected = room.participants.some((p) => p.connected);
      if (!anyConnected && room.lastActivityAt < cutoff) {
        this.clearRoomTimer(code);
        this.rooms.delete(code);
      }
    }
  }

  clearAllTimers() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private clearRoomTimer(code: string) {
    const existing = this.timers.get(code);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(code);
    }
  }

  private refreshDefaultCaption(room: RoomState) {
    const names = room.participants.map((p) => p.name).filter(Boolean);
    if (names.length > 0 && (room.customization.caption === '' || room.customization.caption.includes(' & ') || room.participants.length <= 2)) {
      // Only overwrite if user hasn't written a completely custom note
      const prevJoined = room.participants
        .slice(0, -1)
        .map((p) => p.name)
        .join(' & ');
      if (
        room.customization.caption === 'You' ||
        room.customization.caption === 'Player 1' ||
        room.customization.caption === prevJoined ||
        room.customization.caption.startsWith('Player ')
      ) {
        room.customization.caption = names.join(' & ');
      }
    }
  }
}
