import Peer, { DataConnection } from 'peerjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientRoomEngine } from '../lib/clientRoomEngine';
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
import { RemoteFrameState } from './useRoomSocket';

export interface UseP2PRoomOptions {
  active: boolean;
  roomCode: string | null;
  isHost: boolean;
  roomMode: 'duo' | 'squad';
  participantId: string;
  participantName: string;
  onSnapTrigger?: (shotIndex: number, posePrompt: string) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useP2PRoom({
  active,
  roomCode,
  isHost,
  roomMode,
  participantId,
  participantName,
  onSnapTrigger,
}: UseP2PRoomOptions) {
  const engineRef = useRef<ClientRoomEngine | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const hostConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const guestConnRef = useRef<DataConnection | null>(null);
  const seenMsgIdsRef = useRef<string[]>([]);
  const onSnapRef = useRef(onSnapTrigger);
  onSnapRef.current = onSnapTrigger;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [remoteFrames, setRemoteFrames] = useState<Record<string, RemoteFrameState>>({});
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number } | null>>({});

  const markSeen = (msgId?: string): boolean => {
    if (!msgId) return false;
    if (seenMsgIdsRef.current.includes(msgId)) return true;
    seenMsgIdsRef.current.push(msgId);
    if (seenMsgIdsRef.current.length > 300) {
      seenMsgIdsRef.current.shift();
    }
    return false;
  };

  useEffect(() => {
    if (!active || !roomCode) {
      engineRef.current?.clearTimer();
      engineRef.current = null;
      setRoom(null);
      setConnected(false);
      setJoinError(null);
      setRemoteFrames({});
      setRemoteCursors({});
      return;
    }

    let disposed = false;
    const code = roomCode.toUpperCase();
    const bc =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`photolelo-p2p-${code}`)
        : null;
    channelRef.current = bc;

    const sendToAllGuests = (payload: Record<string, unknown>, excludePid?: string) => {
      if (bc) {
        try {
          bc.postMessage(payload);
        } catch {
          // ignore
        }
      }
      for (const [pid, conn] of hostConnsRef.current.entries()) {
        if (pid !== excludePid && conn.open) {
          conn.send(payload);
        }
      }
    };

    if (isHost) {
      const engine = new ClientRoomEngine(code, roomMode, participantId, participantName, {
        onRoomState: (nextRoom) => {
          if (disposed) return;
          setRoom(nextRoom);
          sendToAllGuests({ type: 'room-state', room: nextRoom });
        },
        onSnapTrigger: (shotIndex, posePrompt) => {
          if (disposed) return;
          const msgId = `snap-${code}-${shotIndex}-${Date.now()}`;
          sendToAllGuests({ type: 'snap-trigger', msgId, shotIndex, posePrompt });
          onSnapRef.current?.(shotIndex, posePrompt);
        },
      });
      engineRef.current = engine;
      setRoom(structuredClone(engine.room));
      setConnected(true);
      setJoinError(null);

      const handleGuestMessage = (raw: unknown, sourceConn?: DataConnection) => {
        if (!raw || typeof raw !== 'object') return;
        const msg = raw as Record<string, unknown>;
        const type = String(msg.type || '');
        const senderPid = String(msg.participantId || '');
        if (!senderPid || senderPid === participantId) return;

        if (type === 'preview-frame') {
          if (typeof msg.frame === 'string') {
            setRemoteFrames((prev) => ({
              ...prev,
              [senderPid]: {
                frame: msg.frame as string,
                faceFilter: msg.faceFilter as FaceFilterId,
                faceProp: msg.faceProp as FacePropId,
                updatedAt: Date.now(),
              },
            }));
            sendToAllGuests(
              {
                type: 'preview-frame',
                participantId: senderPid,
                frame: msg.frame,
                faceFilter: msg.faceFilter,
                faceProp: msg.faceProp,
              },
              senderPid
            );
          }
          return;
        }

        if (type === 'cursor-move') {
          const cursor = (msg.cursor as { x: number; y: number } | null) ?? null;
          setRemoteCursors((prev) => ({ ...prev, [senderPid]: cursor }));
          sendToAllGuests({ type: 'cursor-move', participantId: senderPid, cursor }, senderPid);
          return;
        }

        if (typeof msg.msgId === 'string' && markSeen(msg.msgId)) return;

        switch (type) {
          case 'join-room': {
            const res = engine.joinParticipant(
              senderPid,
              typeof msg.name === 'string' ? msg.name : undefined
            );
            if (!res.ok) {
              const errPayload = { type: 'join-error', targetPid: senderPid, error: res.error };
              sourceConn?.send(errPayload);
              bc?.postMessage(errPayload);
              return;
            }
            if (sourceConn) {
              hostConnsRef.current.set(senderPid, sourceConn);
            }
            const joinedPayload = {
              type: 'joined',
              targetPid: senderPid,
              room: structuredClone(engine.room),
            };
            sourceConn?.send(joinedPayload);
            bc?.postMessage(joinedPayload);
            break;
          }
          case 'update-participant': {
            const patch = (msg.patch || {}) as Record<string, unknown>;
            engine.updateParticipant(senderPid, {
              name: typeof patch.name === 'string' ? patch.name : undefined,
              ready: typeof patch.ready === 'boolean' ? patch.ready : undefined,
              faceFilter: typeof patch.faceFilter === 'string' ? (patch.faceFilter as FaceFilterId) : undefined,
              faceProp: typeof patch.faceProp === 'string' ? (patch.faceProp as FacePropId) : undefined,
            });
            break;
          }
          case 'update-config':
            engine.updateConfig((msg.patch || {}) as Partial<RoomConfig>);
            break;
          case 'set-phase':
            engine.setPhase(msg.phase as RoomState['phase']);
            break;
          case 'start-capture':
            engine.startCapture();
            break;
          case 'shot-frame':
            if (typeof msg.shotIndex === 'number' && typeof msg.imageData === 'string') {
              engine.recordShotFrame(senderPid, msg.shotIndex, msg.imageData);
            }
            break;
          case 'update-customization':
            engine.updateCustomization((msg.patch || {}) as Partial<StripCustomization>);
            break;
          case 'upsert-sticker':
            if (msg.sticker) engine.upsertSticker(msg.sticker as PlacedSticker);
            break;
          case 'remove-sticker':
            if (typeof msg.stickerId === 'string') engine.removeSticker(msg.stickerId);
            break;
          case 'add-doodle':
            if (msg.stroke) engine.addDoodle(msg.stroke as DoodleStroke);
            break;
          case 'undo-doodle':
            engine.undoDoodle();
            break;
          case 'clear-doodles':
            engine.clearDoodles();
            break;
          case 'reset-retake':
            engine.resetForRetake(msg.targetPhase === 'setup' ? 'setup' : 'prep');
            break;
        }
      };

      if (bc) {
        bc.onmessage = (e) => handleGuestMessage(e.data);
      }

      try {
        const peer = new Peer(`photolelo-host-${code}`, {
          config: { iceServers: ICE_SERVERS },
        });
        peerRef.current = peer;

        peer.on('connection', (conn) => {
          conn.on('data', (data) => handleGuestMessage(data, conn));
          conn.on('close', () => {
            for (const [pid, c] of hostConnsRef.current.entries()) {
              if (c === conn) {
                hostConnsRef.current.delete(pid);
                engine.disconnectParticipant(pid);
              }
            }
          });
        });

        peer.on('error', () => {
          // BroadcastChannel remains active even if PeerJS cloud signaling is offline
        });
      } catch {
        // Fallback to BroadcastChannel only
      }

      return () => {
        disposed = true;
        engine.clearTimer();
        engineRef.current = null;
        bc?.close();
        channelRef.current = null;
        for (const conn of hostConnsRef.current.values()) conn.close();
        hostConnsRef.current.clear();
        peerRef.current?.destroy();
        peerRef.current = null;
      };
    }

    // Guest mode
    let joinedSuccessfully = false;
    const handleHostMessage = (raw: unknown) => {
      if (disposed || !raw || typeof raw !== 'object') return;
      const msg = raw as Record<string, unknown>;
      const type = String(msg.type || '');

      if (type === 'joined') {
        if (msg.targetPid && msg.targetPid !== participantId) return;
        joinedSuccessfully = true;
        setConnected(true);
        setJoinError(null);
        setRoom(msg.room as RoomState);
      } else if (type === 'join-error') {
        if (msg.targetPid && msg.targetPid !== participantId) return;
        setJoinError(String(msg.error || 'Unable to join room.'));
      } else if (type === 'room-state') {
        joinedSuccessfully = true;
        setConnected(true);
        setRoom(msg.room as RoomState);
      } else if (type === 'preview-frame') {
        const sender = String(msg.participantId || '');
        if (sender && sender !== participantId && typeof msg.frame === 'string') {
          setRemoteFrames((prev) => ({
            ...prev,
            [sender]: {
              frame: msg.frame as string,
              faceFilter: msg.faceFilter as FaceFilterId,
              faceProp: msg.faceProp as FacePropId,
              updatedAt: Date.now(),
            },
          }));
        }
      } else if (type === 'cursor-move') {
        const sender = String(msg.participantId || '');
        if (sender && sender !== participantId) {
          setRemoteCursors((prev) => ({
            ...prev,
            [sender]: (msg.cursor as { x: number; y: number } | null) ?? null,
          }));
        }
      } else if (type === 'snap-trigger') {
        if (typeof msg.msgId === 'string' && markSeen(msg.msgId)) return;
        onSnapRef.current?.(Number(msg.shotIndex), String(msg.posePrompt || ''));
      }
    };

    const joinPayload = {
      type: 'join-room',
      msgId: `join-${participantId}-${Date.now()}`,
      code,
      participantId,
      name: participantName,
    };

    if (bc) {
      bc.onmessage = (e) => handleHostMessage(e.data);
      bc.postMessage(joinPayload);
    }

    try {
      const peer = new Peer({ config: { iceServers: ICE_SERVERS } });
      peerRef.current = peer;

      peer.on('open', () => {
        if (disposed) return;
        const conn = peer.connect(`photolelo-host-${code}`, {
          reliable: true,
          serialization: 'json',
        });
        guestConnRef.current = conn;
        conn.on('open', () => {
          conn.send(joinPayload);
        });
        conn.on('data', handleHostMessage);
        conn.on('close', () => {
          if (!disposed) setConnected(false);
        });
      });

      peer.on('error', () => {
        // Wait for timeout check in case BroadcastChannel already succeeded
      });
    } catch {
      // BroadcastChannel fallback
    }

    const timeout = setTimeout(() => {
      if (!disposed && !joinedSuccessfully) {
        setJoinError(
          `Could not find Room "${code}". Make sure the host has the room open and check the 5-letter code.`
        );
      }
    }, 8500);

    return () => {
      disposed = true;
      clearTimeout(timeout);
      bc?.close();
      channelRef.current = null;
      guestConnRef.current?.close();
      guestConnRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [active, roomCode, isHost, roomMode, participantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const emitGuestAction = useCallback(
    (payload: Record<string, unknown>) => {
      const full = {
        ...payload,
        participantId,
        msgId: `${participantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      if (guestConnRef.current?.open) {
        guestConnRef.current.send(full);
      }
      try {
        channelRef.current?.postMessage(full);
      } catch {
        // ignore
      }
    },
    [participantId]
  );

  const updateParticipant = useCallback(
    (patch: Partial<Pick<Participant, 'name' | 'ready' | 'faceFilter' | 'faceProp'>>) => {
      if (isHost && engineRef.current) {
        engineRef.current.updateParticipant(participantId, patch);
      } else {
        emitGuestAction({ type: 'update-participant', patch });
      }
    },
    [isHost, participantId, emitGuestAction]
  );

  const updateConfig = useCallback(
    (patch: Partial<RoomConfig>) => {
      if (isHost && engineRef.current) {
        engineRef.current.updateConfig(patch);
      } else {
        emitGuestAction({ type: 'update-config', patch });
      }
    },
    [isHost, emitGuestAction]
  );

  const setPhase = useCallback(
    (phase: RoomState['phase']) => {
      if (isHost && engineRef.current) {
        engineRef.current.setPhase(phase);
      } else {
        emitGuestAction({ type: 'set-phase', phase });
      }
    },
    [isHost, emitGuestAction]
  );

  const startCapture = useCallback(() => {
    if (isHost && engineRef.current) {
      engineRef.current.startCapture();
    } else {
      emitGuestAction({ type: 'start-capture' });
    }
  }, [isHost, emitGuestAction]);

  const sendPreviewFrame = useCallback(
    (frame: string, faceFilter: FaceFilterId, faceProp: FacePropId) => {
      const payload = { type: 'preview-frame', participantId, frame, faceFilter, faceProp };
      if (isHost) {
        try {
          channelRef.current?.postMessage(payload);
        } catch {
          // ignore
        }
        for (const conn of hostConnsRef.current.values()) {
          if (conn.open) conn.send(payload);
        }
      } else {
        if (guestConnRef.current?.open) guestConnRef.current.send(payload);
        try {
          channelRef.current?.postMessage(payload);
        } catch {
          // ignore
        }
      }
    },
    [isHost, participantId]
  );

  const sendShotFrame = useCallback(
    (shotIndex: number, imageData: string) => {
      if (isHost && engineRef.current) {
        engineRef.current.recordShotFrame(participantId, shotIndex, imageData);
      } else {
        emitGuestAction({ type: 'shot-frame', shotIndex, imageData });
      }
    },
    [isHost, participantId, emitGuestAction]
  );

  const sendCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      const payload = { type: 'cursor-move', participantId, cursor };
      if (isHost) {
        try {
          channelRef.current?.postMessage(payload);
        } catch {
          // ignore
        }
        for (const conn of hostConnsRef.current.values()) {
          if (conn.open) conn.send(payload);
        }
      } else {
        if (guestConnRef.current?.open) guestConnRef.current.send(payload);
        try {
          channelRef.current?.postMessage(payload);
        } catch {
          // ignore
        }
      }
    },
    [isHost, participantId]
  );

  const updateCustomization = useCallback(
    (patch: Partial<StripCustomization>) => {
      if (isHost && engineRef.current) {
        engineRef.current.updateCustomization(patch);
      } else {
        emitGuestAction({ type: 'update-customization', patch });
      }
    },
    [isHost, emitGuestAction]
  );

  const upsertSticker = useCallback(
    (sticker: PlacedSticker) => {
      if (isHost && engineRef.current) {
        engineRef.current.upsertSticker(sticker);
      } else {
        emitGuestAction({ type: 'upsert-sticker', sticker });
      }
    },
    [isHost, emitGuestAction]
  );

  const removeSticker = useCallback(
    (stickerId: string) => {
      if (isHost && engineRef.current) {
        engineRef.current.removeSticker(stickerId);
      } else {
        emitGuestAction({ type: 'remove-sticker', stickerId });
      }
    },
    [isHost, emitGuestAction]
  );

  const addDoodle = useCallback(
    (stroke: DoodleStroke) => {
      if (isHost && engineRef.current) {
        engineRef.current.addDoodle(stroke);
      } else {
        emitGuestAction({ type: 'add-doodle', stroke });
      }
    },
    [isHost, emitGuestAction]
  );

  const undoDoodle = useCallback(() => {
    if (isHost && engineRef.current) {
      engineRef.current.undoDoodle();
    } else {
      emitGuestAction({ type: 'undo-doodle' });
    }
  }, [isHost, emitGuestAction]);

  const clearDoodles = useCallback(() => {
    if (isHost && engineRef.current) {
      engineRef.current.clearDoodles();
    } else {
      emitGuestAction({ type: 'clear-doodles' });
    }
  }, [isHost, emitGuestAction]);

  const resetRetake = useCallback(
    (targetPhase: 'setup' | 'prep' = 'prep') => {
      if (isHost && engineRef.current) {
        engineRef.current.resetForRetake(targetPhase);
      } else {
        emitGuestAction({ type: 'reset-retake', targetPhase });
      }
    },
    [isHost, emitGuestAction]
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
