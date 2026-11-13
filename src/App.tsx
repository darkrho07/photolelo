import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoothSetup } from './components/BoothSetup';
import { CaptureStage } from './components/CaptureStage';
import { CustomizeStudio } from './components/CustomizeStudio';
import { ExportGallery } from './components/ExportGallery';
import { Header } from './components/Header';
import { LandingHero } from './components/LandingHero';
import { ScenePrep } from './components/ScenePrep';
import { POSE_DECK } from './data/boothData';
import { useCamera } from './hooks/useCamera';
import { useRoomSocket } from './hooks/useRoomSocket';
import { playReadyChime } from './lib/sound';
import { getLayoutMeta } from './lib/stripRenderer';
import {
  CaptureSessionState,
  DoodleStroke,
  FaceFilterId,
  FacePropId,
  PlacedSticker,
  RoomConfig,
  SessionMode,
  StripCustomization,
  WorkflowStep,
} from './types/booth';

function getOrCreateParticipantId(): string {
  const key = 'photolelo_pid';
  let existing = sessionStorage.getItem(key);
  if (!existing) {
    existing = `p-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, existing);
  }
  return existing;
}

const DEFAULT_CONFIG: RoomConfig = {
  boothStyle: 'classic',
  layoutId: 'strip-1x4',
  themeId: 'cream',
  backdropId: 'none',
  softBlend: true,
  countdownSeconds: 3,
  soundEnabled: true,
};

const DEFAULT_CUSTOMIZATION: StripCustomization = {
  selectedShotIndices: [0, 1, 2, 3],
  stripFilterId: 'original',
  filterIntensity: 100,
  caption: 'You',
  showDate: true,
  showRoomCode: true,
  showBrandMark: true,
  stickers: [],
  doodles: [],
};

const MEME_PROMPTS = [
  'POV: You spotted snacks across the room',
  'Dramatic telenovela gasp of pure betrayal',
  'Suspicious side-eye at the lens',
  'Pretend you just won an Oscar for nothing',
  'Holding back laughter trying to look serious',
  'Shocked cat meme energy — wide eyes!',
];

function pickSoloPoses(boothStyle: RoomConfig['boothStyle']): string[] {
  const source = boothStyle === 'meme' ? [...MEME_PROMPTS] : [...POSE_DECK];
  const res: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (source.length === 0) break;
    const idx = Math.floor(Math.random() * source.length);
    res.push(source.splice(idx, 1)[0]);
  }
  return res;
}

export function App() {
  const selfId = useMemo(() => getOrCreateParticipantId(), []);
  const [mode, setMode] = useState<SessionMode>('solo');
  const [step, setStep] = useState<WorkflowStep>('landing');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [selfName, setSelfName] = useState('You');
  const [totalStripsCreated, setTotalStripsCreated] = useState(1428);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [initialUrlCode, setInitialUrlCode] = useState('');

  // Personal camera looks
  const [faceFilter, setFaceFilter] = useState<FaceFilterId>('natural');
  const [faceProp, setFaceProp] = useState<FacePropId>('none');
  const [flashKey, setFlashKey] = useState(0);

  // Solo state
  const [soloConfig, setSoloConfig] = useState<RoomConfig>(DEFAULT_CONFIG);
  const [soloCustomization, setSoloCustomization] = useState<StripCustomization>(DEFAULT_CUSTOMIZATION);
  const [soloCapture, setSoloCapture] = useState<CaptureSessionState>({
    active: false,
    totalShots: 6,
    currentShot: 0,
    stage: 'idle',
    countdownRemaining: 3,
    posePrompts: pickSoloPoses('classic'),
    shots: [],
  });
  const soloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const camera = useCamera({
    label: selfName,
    defaultPresetIndex: selfId.charCodeAt(selfId.length - 1) % 4,
  });

  // Fetch initial landing stats + check ?room= query param
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.totalStripsCreated === 'number') {
          setTotalStripsCreated(data.totalStripsCreated);
        }
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      const clean = codeParam.trim().toUpperCase();
      setInitialUrlCode(clean);
      handleJoinRoom(clean, 'Partner');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSnapFromServer = useCallback(
    (shotIndex: number) => {
      setFlashKey((k) => k + 1);
      const dataUrl = camera.captureFrameDataUrl({
        width: 720,
        height: 540,
        quality: 0.9,
        faceFilter,
        faceProp,
      });
      if (dataUrl) {
        socket.sendShotFrame(shotIndex, dataUrl);
      }
    },
    [camera, faceFilter, faceProp] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const socket = useRoomSocket({
    roomCode,
    participantId: selfId,
    participantName: selfName,
    onSnapTrigger: handleSnapFromServer,
  });

  // Sync step with room phase when in multiplayer room
  useEffect(() => {
    if (mode !== 'solo' && socket.room) {
      setStep(socket.room.phase);
      if (socket.room.mode !== mode) {
        setMode(socket.room.mode);
      }
    }
  }, [mode, socket.room?.phase, socket.room?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show join error back on landing
  useEffect(() => {
    if (socket.joinError) {
      setLandingError(socket.joinError);
      setRoomCode(null);
      setMode('solo');
      setStep('landing');
    }
  }, [socket.joinError]);

  // Stream live compressed preview frames in multiplayer prep & capture stages
  useEffect(() => {
    if (mode === 'solo' || !roomCode || (step !== 'prep' && step !== 'capture')) return;

    const interval = setInterval(() => {
      const frame = camera.captureFrameDataUrl({
        width: 240,
        height: 180,
        quality: 0.52,
        faceFilter,
        faceProp,
      });
      if (frame) {
        socket.sendPreviewFrame(frame, faceFilter, faceProp);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [mode, roomCode, step, faceFilter, faceProp, camera.captureFrameDataUrl, socket.sendPreviewFrame]);

  // Cleanup solo timer
  useEffect(() => {
    return () => {
      if (soloTimerRef.current) clearTimeout(soloTimerRef.current);
    };
  }, []);

  const handleCreateRoom = async (roomMode: 'duo' | 'squad', name: string) => {
    setLandingError(null);
    const cleanName = name.trim() || 'Player 1';
    setSelfName(cleanName);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: roomMode, name: cleanName }),
      });
      if (!res.ok) throw new Error('Could not create room');
      const data = await res.json();
      setMode(roomMode);
      setRoomCode(data.code);
      setStep('setup');
      window.history.replaceState(null, '', `/?room=${data.code}`);
    } catch {
      setLandingError('Unable to reach Photo Lelo server. Please make sure the server is running.');
    }
  };

  const handleJoinRoom = async (code: string, name: string) => {
    setLandingError(null);
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim() || 'Partner';
    setSelfName(cleanName);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(cleanCode)}`);
      if (!res.ok) {
        setLandingError(`Room "${cleanCode}" was not found.`);
        return;
      }
      const info = await res.json();
      setMode(info.mode === 'squad' ? 'squad' : 'duo');
      setRoomCode(info.code);
      setStep(info.phase || 'setup');
      window.history.replaceState(null, '', `/?room=${info.code}`);
    } catch {
      setLandingError('Could not connect to room server.');
    }
  };

  const handleStartSolo = (name: string) => {
    setLandingError(null);
    const cleanName = name.trim() || 'You';
    setSelfName(cleanName);
    setMode('solo');
    setRoomCode(null);
    setSoloConfig(DEFAULT_CONFIG);
    setSoloCustomization({ ...DEFAULT_CUSTOMIZATION, caption: cleanName });
    setStep('setup');
    window.history.replaceState(null, '', '/');
  };

  const handleGoHome = () => {
    if (soloTimerRef.current) clearTimeout(soloTimerRef.current);
    setRoomCode(null);
    setMode('solo');
    setStep('landing');
    window.history.replaceState(null, '', '/');
  };

  // Solo 6-shot runner
  const startSoloCapture = () => {
    if (soloTimerRef.current) clearTimeout(soloTimerRef.current);
    const poses = pickSoloPoses(soloConfig.boothStyle);
    const initialShots = Array.from({ length: 6 }, (_, i) => ({
      shotIndex: i,
      framesByParticipant: {},
      posePrompt: poses[i] || POSE_DECK[i],
      memeCaption: soloConfig.boothStyle === 'meme' ? poses[i] : undefined,
      timestamp: 0,
    }));

    setSoloCapture({
      active: true,
      totalShots: 6,
      currentShot: 0,
      stage: 'curtain',
      countdownRemaining: soloConfig.countdownSeconds,
      posePrompts: poses,
      shots: initialShots,
    });
    setStep('capture');

    const runShot = (shotIdx: number) => {
      if (shotIdx >= 6) {
        const slotCount = getLayoutMeta(soloConfig.layoutId).slotCount;
        setSoloCustomization((prev) => ({
          ...prev,
          selectedShotIndices: Array.from({ length: slotCount }, (_, i) => i),
        }));
        setSoloCapture((prev) => ({ ...prev, active: false, stage: 'done' }));
        setStep('customize');
        return;
      }

      setSoloCapture((prev) => ({
        ...prev,
        currentShot: shotIdx,
        stage: 'countdown',
        countdownRemaining: soloConfig.countdownSeconds,
      }));

      let rem = soloConfig.countdownSeconds;
      const tick = () => {
        if (rem > 1) {
          rem -= 1;
          setSoloCapture((prev) => ({ ...prev, countdownRemaining: rem }));
          soloTimerRef.current = setTimeout(tick, 1000);
        } else {
          setFlashKey((k) => k + 1);
          const dataUrl = camera.captureFrameDataUrl({
            width: 720,
            height: 540,
            quality: 0.9,
            faceFilter,
            faceProp,
          });
          setSoloCapture((prev) => {
            const nextShots = [...prev.shots];
            nextShots[shotIdx] = {
              ...nextShots[shotIdx],
              timestamp: Date.now(),
              framesByParticipant: dataUrl ? { [selfId]: dataUrl } : {},
            };
            return {
              ...prev,
              stage: 'snapping',
              countdownRemaining: 0,
              shots: nextShots,
            };
          });
          soloTimerRef.current = setTimeout(() => runShot(shotIdx + 1), 1150);
        }
      };

      soloTimerRef.current = setTimeout(tick, 1000);
    };

    soloTimerRef.current = setTimeout(() => runShot(0), 1100);
  };

  // Unified active state (Solo vs Multiplayer Room)
  const activeConfig = mode === 'solo' ? soloConfig : socket.room?.config || DEFAULT_CONFIG;
  const activeCustomization =
    mode === 'solo' ? soloCustomization : socket.room?.customization || DEFAULT_CUSTOMIZATION;
  const activeCapture = mode === 'solo' ? soloCapture : socket.room?.capture || soloCapture;
  const activeParticipants =
    mode === 'solo'
      ? [{ id: selfId, name: selfName, color: '#FF4D4D', ready: true, isHost: true, connected: true }]
      : socket.room?.participants || [
          { id: selfId, name: selfName, color: '#FF4D4D', ready: false, isHost: true, connected: true },
        ];

  const handleUpdateConfig = (patch: Partial<RoomConfig>) => {
    if (mode === 'solo') {
      setSoloConfig((prev) => {
        const next = { ...prev, ...patch };
        if (patch.layoutId && patch.layoutId !== prev.layoutId) {
          const count = getLayoutMeta(patch.layoutId).slotCount;
          setSoloCustomization((c) => ({
            ...c,
            selectedShotIndices: Array.from({ length: count }, (_, i) => i),
          }));
        }
        return next;
      });
    } else {
      socket.updateConfig(patch);
    }
  };

  const handleUpdateCustomization = (patch: Partial<StripCustomization>) => {
    if (mode === 'solo') {
      setSoloCustomization((prev) => ({ ...prev, ...patch }));
    } else {
      socket.updateCustomization(patch);
    }
  };

  const handleUpsertSticker = (sticker: PlacedSticker) => {
    if (mode === 'solo') {
      setSoloCustomization((prev) => {
        const idx = prev.stickers.findIndex((s) => s.id === sticker.id);
        const next = [...prev.stickers];
        if (idx >= 0) next[idx] = sticker;
        else next.push(sticker);
        return { ...prev, stickers: next };
      });
    } else {
      socket.upsertSticker(sticker);
    }
  };

  const handleRemoveSticker = (id: string) => {
    if (mode === 'solo') {
      setSoloCustomization((prev) => ({
        ...prev,
        stickers: prev.stickers.filter((s) => s.id !== id),
      }));
    } else {
      socket.removeSticker(id);
    }
  };

  const handleAddDoodle = (stroke: DoodleStroke) => {
    if (mode === 'solo') {
      setSoloCustomization((prev) => ({ ...prev, doodles: [...prev.doodles, stroke] }));
    } else {
      socket.addDoodle(stroke);
    }
  };

  const handleUndoDoodle = () => {
    if (mode === 'solo') {
      setSoloCustomization((prev) => ({ ...prev, doodles: prev.doodles.slice(0, -1) }));
    } else {
      socket.undoDoodle();
    }
  };

  const handleClearDoodles = () => {
    if (mode === 'solo') {
      setSoloCustomization((prev) => ({ ...prev, doodles: [] }));
    } else {
      socket.clearDoodles();
    }
  };

  const handleUpdateName = (nextName: string) => {
    setSelfName(nextName);
    if (mode === 'solo') {
      setSoloCustomization((prev) => ({ ...prev, caption: nextName || 'You' }));
    } else {
      socket.updateParticipant({ name: nextName });
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        step={step}
        roomCode={roomCode}
        mode={mode}
        participants={activeParticipants}
        soundEnabled={activeConfig.soundEnabled}
        onToggleSound={() => handleUpdateConfig({ soundEnabled: !activeConfig.soundEnabled })}
        onGoHome={handleGoHome}
      />

      {step === 'landing' && (
        <LandingHero
          totalStripsCreated={totalStripsCreated}
          initialJoinCode={initialUrlCode}
          joiningError={landingError}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onStartSolo={handleStartSolo}
        />
      )}

      {step === 'setup' && (
        <BoothSetup
          mode={mode}
          roomCode={roomCode}
          participants={activeParticipants}
          selfName={selfName}
          config={activeConfig}
          customization={activeCustomization}
          onUpdateSelfName={handleUpdateName}
          onUpdateConfig={handleUpdateConfig}
          onContinue={() => {
            if (mode === 'solo') setStep('prep');
            else socket.setPhase('prep');
          }}
        />
      )}

      {step === 'prep' && (
        <ScenePrep
          mode={mode}
          roomCode={roomCode}
          participants={activeParticipants}
          selfId={selfId}
          config={activeConfig}
          faceFilter={faceFilter}
          faceProp={faceProp}
          remoteFrames={socket.remoteFrames}
          camera={camera}
          onUpdateConfig={handleUpdateConfig}
          onUpdateFaceStyle={(ff, fp) => {
            setFaceFilter(ff);
            setFaceProp(fp);
            if (mode !== 'solo') {
              socket.updateParticipant({ faceFilter: ff, faceProp: fp });
            }
          }}
          onToggleReady={(ready) => {
            if (ready) playReadyChime(activeConfig.soundEnabled);
            socket.updateParticipant({ ready });
          }}
          onForceStart={() => {
            if (mode === 'solo') startSoloCapture();
            else socket.startCapture();
          }}
          onBack={() => {
            if (mode === 'solo') setStep('setup');
            else socket.setPhase('setup');
          }}
        />
      )}

      {step === 'capture' && (
        <CaptureStage
          mode={mode}
          participants={activeParticipants}
          selfId={selfId}
          config={activeConfig}
          capture={activeCapture}
          faceFilter={faceFilter}
          faceProp={faceProp}
          remoteFrames={socket.remoteFrames}
          flashKey={flashKey}
          camera={camera}
        />
      )}

      {step === 'customize' && (
        <CustomizeStudio
          mode={mode}
          roomCode={roomCode}
          participants={activeParticipants}
          selfId={selfId}
          config={activeConfig}
          shots={activeCapture.shots}
          customization={activeCustomization}
          remoteCursors={socket.remoteCursors}
          onUpdateConfig={handleUpdateConfig}
          onUpdateCustomization={handleUpdateCustomization}
          onUpsertSticker={handleUpsertSticker}
          onRemoveSticker={handleRemoveSticker}
          onAddDoodle={handleAddDoodle}
          onUndoDoodle={handleUndoDoodle}
          onClearDoodles={handleClearDoodles}
          onCursorMove={(c) => socket.sendCursor(c)}
          onRetake={() => {
            if (mode === 'solo') {
              setSoloCustomization((prev) => ({ ...prev, stickers: [], doodles: [] }));
              setStep('prep');
            } else {
              socket.resetRetake('prep');
            }
          }}
          onFinish={() => {
            setTotalStripsCreated((n) => n + 1);
            if (mode === 'solo') setStep('export');
            else socket.setPhase('export');
          }}
        />
      )}

      {step === 'export' && (
        <ExportGallery
          roomCode={roomCode}
          participants={activeParticipants}
          config={activeConfig}
          shots={activeCapture.shots}
          customization={activeCustomization}
          onBackToStudio={() => {
            if (mode === 'solo') setStep('customize');
            else socket.setPhase('customize');
          }}
          onRetake={() => {
            if (mode === 'solo') {
              setSoloCustomization((prev) => ({ ...prev, stickers: [], doodles: [] }));
              setStep('prep');
            } else {
              socket.resetRetake('prep');
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
