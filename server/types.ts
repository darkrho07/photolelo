export type RoomMode = 'duo' | 'squad';
export type RoomPhase = 'setup' | 'prep' | 'capture' | 'customize' | 'export';
export type BoothStyleId = 'classic' | 'vintage' | 'meme' | 'laundromat' | 'subway' | 'karaoke';
export type LayoutId = 'strip-1x4' | 'grid-2x2' | 'strip-1x3' | 'polaroid-2';

export interface Participant {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
  faceFilter?: string;
  faceProp?: string;
  cursor?: { x: number; y: number } | null;
}

export interface RoomConfig {
  boothStyle: BoothStyleId;
  layoutId: LayoutId;
  themeId: string;
  backdropId: string;
  softBlend: boolean;
  countdownSeconds: 3 | 5;
  soundEnabled: boolean;
}

export interface CapturedShot {
  shotIndex: number;
  framesByParticipant: Record<string, string>;
  posePrompt: string;
  memeCaption?: string;
  timestamp: number;
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  label: string;
  kind: 'emoji' | 'word' | 'badge';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color?: string;
  bgColor?: string;
}

export interface DoodleStroke {
  id: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export interface StripCustomization {
  selectedShotIndices: number[];
  stripFilterId: string;
  filterIntensity: number;
  caption: string;
  showDate: boolean;
  showRoomCode: boolean;
  showBrandMark: boolean;
  stickers: PlacedSticker[];
  doodles: DoodleStroke[];
}

export interface CaptureSessionState {
  active: boolean;
  totalShots: number;
  currentShot: number;
  stage: 'idle' | 'curtain' | 'countdown' | 'snapping' | 'done';
  countdownRemaining: number;
  posePrompts: string[];
  shots: CapturedShot[];
}

export interface RoomState {
  code: string;
  mode: RoomMode;
  maxParticipants: number;
  phase: RoomPhase;
  participants: Participant[];
  config: RoomConfig;
  capture: CaptureSessionState;
  customization: StripCustomization;
  createdAt: number;
  lastActivityAt: number;
}
