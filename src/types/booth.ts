export type SessionMode = 'solo' | 'duo' | 'squad';

export type WorkflowStep = 'landing' | 'setup' | 'prep' | 'capture' | 'customize' | 'export';

export type BoothStyleId =
  | 'classic'
  | 'vintage'
  | 'meme'
  | 'laundromat'
  | 'subway'
  | 'karaoke';

export type LayoutId = 'strip-1x4' | 'grid-2x2' | 'strip-1x3' | 'polaroid-2';

export type ThemeCategory =
  | 'all'
  | 'minimal'
  | 'patterns'
  | 'coquette'
  | 'travel'
  | 'food'
  | 'cozy';

export type FaceFilterId =
  | 'natural'
  | 'peach'
  | 'seoul'
  | 'tungsten'
  | 'bw'
  | 'ccd';

export type FacePropId =
  | 'none'
  | 'bow'
  | 'catears'
  | 'heartshades'
  | 'starhalo'
  | 'blush';

export interface Participant {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
  faceFilter?: FaceFilterId;
  faceProp?: FacePropId;
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
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  scale: number;
  rotation: number; // degrees
  color?: string;
  bgColor?: string;
}

export interface DoodleStroke {
  id: string;
  color: string;
  width: number; // normalized relative to width ~ 0.004 - 0.015
  points: Array<{ x: number; y: number }>; // normalized 0..1
}

export interface StripCustomization {
  selectedShotIndices: number[];
  stripFilterId: string;
  filterIntensity: number; // 0..100
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
  mode: 'duo' | 'squad';
  maxParticipants: number;
  phase: Exclude<WorkflowStep, 'landing'>;
  participants: Participant[];
  config: RoomConfig;
  capture: CaptureSessionState;
  customization: StripCustomization;
  createdAt: number;
}

export interface BoothStyleMeta {
  id: BoothStyleId;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  accent: string;
  curtainColor?: string;
}

export interface StripLayoutMeta {
  id: LayoutId;
  name: string;
  slotCount: number;
  width: number;  // 300 DPI canvas px
  height: number; // 300 DPI canvas px
  cols: number;
  rows: number;
  description: string;
}

export interface ThemeFrameMeta {
  id: string;
  name: string;
  category: Exclude<ThemeCategory, 'all'>;
  bgColor: string;
  secondaryColor: string;
  textColor: string;
  accentColor: string;
  pattern:
    | 'solid'
    | 'hearts'
    | 'gingham'
    | 'checker'
    | 'dots'
    | 'stars'
    | 'bows'
    | 'xoxo'
    | 'lace'
    | 'ticket'
    | 'postcard'
    | 'bistro'
    | 'sushi'
    | 'bakery'
    | 'typewriter'
    | 'knit'
    | 'pumpkin';
  badgeText?: string;
}

export interface SharedBackdropMeta {
  id: string;
  name: string;
  tag: string;
  description: string;
  skyTop: string;
  skyBottom: string;
  accent: string;
}

export interface StripFilterMeta {
  id: string;
  name: string;
  previewGradient: string;
  description: string;
}

export interface StickerTemplate {
  id: string;
  label: string;
  kind: 'emoji' | 'word' | 'badge';
  color?: string;
  bgColor?: string;
}
