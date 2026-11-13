import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DoodleStroke,
  FaceFilterId,
  FacePropId,
  Participant,
  PlacedSticker,
  RoomConfig,
  RoomState,
  StripCustomization,
} from '../types/booth';

export interface RemoteFrameState {
  frame: string;
  faceFilter?: FaceFilterId;
  faceProp?: FacePropId;
  updatedAt: number;
}

export interface UseRoomSocketOptions {
  roomCode: string | null;
  participantId: string;
  participantName: string;
  onSnapTrigger?: (shotIndex: number, posePrompt: string) => void;
}

export function useRoomSocket({
  roomCode,
  participantId,
  participantName,
  onSnapTrigger,
}: UseRoomSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onSnapRef = useRef(onSnapTrigger);
  onSnapRef.current = onSnapTrigger;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [remoteFrames, setRemoteFrames] = useState<Record<string, RemoteFrameState>>({});
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number } | null>>({});

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      setConnected(false);
      setJoinError(null);
      setRemoteFrames({});
      setRemoteCursors({});
      return;
    }

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setJoinError(null);
        ws.send(
          JSON.stringify({
            type: 'join-room',
            code: roomCode,
            participantId,
            name: participantName,
          })
        );
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20_000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'joined' || msg.type === 'room-state') {
            setRoom(msg.room);
          } else if (msg.type === 'join-error') {
            setJoinError(msg.error || 'Unable to join room');
          } else if (msg.type === 'preview-frame') {
            setRemoteFrames((prev) => ({
              ...prev,
              [msg.participantId]: {
                frame: msg.frame,
                faceFilter: msg.faceFilter,
                faceProp: msg.faceProp,
                updatedAt: Date.now(),
              },
            }));
          } else if (msg.type === 'cursor-move') {
            setRemoteCursors((prev) => ({
              ...prev,
              [msg.participantId]: msg.cursor,
            }));
          } else if (msg.type === 'snap-trigger') {
            onSnapRef.current?.(msg.shotIndex, msg.posePrompt);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (!closed) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomCode, participantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const updateParticipant = useCallback(
    (patch: Partial<Pick<Participant, 'name' | 'ready' | 'faceFilter' | 'faceProp'>>) => {
      send({ type: 'update-participant', patch });
    },
    [send]
  );

  const updateConfig = useCallback(
    (patch: Partial<RoomConfig>) => {
      send({ type: 'update-config', patch });
    },
    [send]
  );

  const setPhase = useCallback(
    (phase: RoomState['phase']) => {
      send({ type: 'set-phase', phase });
    },
    [send]
  );

  const startCapture = useCallback(() => {
    send({ type: 'start-capture' });
  }, [send]);

  const sendPreviewFrame = useCallback(
    (frame: string, faceFilter: FaceFilterId, faceProp: FacePropId) => {
      send({ type: 'preview-frame', frame, faceFilter, faceProp });
    },
    [send]
  );

  const sendShotFrame = useCallback(
    (shotIndex: number, imageData: string) => {
      send({ type: 'shot-frame', shotIndex, imageData });
    },
    [send]
  );

  const sendCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      send({ type: 'cursor-move', cursor });
    },
    [send]
  );

  const updateCustomization = useCallback(
    (patch: Partial<StripCustomization>) => {
      send({ type: 'update-customization', patch });
    },
    [send]
  );

  const upsertSticker = useCallback(
    (sticker: PlacedSticker) => {
      send({ type: 'upsert-sticker', sticker });
    },
    [send]
  );

  const removeSticker = useCallback(
    (stickerId: string) => {
      send({ type: 'remove-sticker', stickerId });
    },
    [send]
  );

  const addDoodle = useCallback(
    (stroke: DoodleStroke) => {
      send({ type: 'add-doodle', stroke });
    },
    [send]
  );

  const undoDoodle = useCallback(() => {
    send({ type: 'undo-doodle' });
  }, [send]);

  const clearDoodles = useCallback(() => {
    send({ type: 'clear-doodles' });
  }, [send]);

  const resetRetake = useCallback(
    (targetPhase: 'setup' | 'prep' = 'prep') => {
      send({ type: 'reset-retake', targetPhase });
    },
    [send]
  );

  return {
    room,
    connected,
    joinError,
    remoteFrames,
    remoteCursors,
    updateParticipant,
    updateConfig,
    setPhase,
    startCapture,
    sendPreviewFrame,
    sendShotFrame,
    sendCursor,
    updateCustomization,
    upsertSticker,
    removeSticker,
    addDoodle,
    undoDoodle,
    clearDoodles,
    resetRetake,
  };
}
