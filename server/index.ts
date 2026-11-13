import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from './roomManager.js';
import { RoomMode, RoomState } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || (isProduction ? 3000 : 3001));
const HOST = isProduction ? '0.0.0.0' : '127.0.0.1';

interface ClientMeta {
  ws: WebSocket;
  roomCode?: string;
  participantId?: string;
}

const app = express();
app.use(express.json({ limit: '6mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 6 * 1024 * 1024,
});

const clients = new Set<ClientMeta>();
const roomManager = new RoomManager();

function safeSend(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomState(room: RoomState) {
  const message = JSON.stringify({ type: 'room-state', room });
  for (const client of clients) {
    if (client.roomCode === room.code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function broadcastEvent(
  roomCode: string,
  payload: Record<string, unknown>,
  excludeParticipantId?: string
) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (
      client.roomCode === roomCode &&
      client.participantId !== excludeParticipantId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(message);
    }
  }
}

roomManager.setBroadcaster({
  broadcastRoomState,
  broadcastEvent,
});

// REST API endpoints
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'photo-lelo', ...roomManager.getStats() });
});

app.get('/api/stats', (_req, res) => {
  res.json(roomManager.getStats());
});

app.post('/api/rooms', (req, res) => {
  const mode: RoomMode = req.body?.mode === 'squad' ? 'squad' : 'duo';
  const hostName = typeof req.body?.name === 'string' ? req.body.name : 'You';
  const room = roomManager.createRoom(mode, hostName);
  res.status(201).json({ code: room.code, mode: room.mode, room });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({
    code: room.code,
    mode: room.mode,
    maxParticipants: room.maxParticipants,
    participantCount: room.participants.filter((p) => p.connected).length,
    phase: room.phase,
  });
});

// Serve built client in production
if (isProduction) {
  const distDir = path.resolve(__dirname, '../dist');
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// WebSocket Realtime Handler
wss.on('connection', (ws) => {
  const meta: ClientMeta = { ws };
  clients.add(meta);

  ws.on('message', (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const type = String(msg.type || '');

    if (type === 'ping') {
      safeSend(ws, { type: 'pong', ts: Date.now() });
      return;
    }

    if (type === 'join-room') {
      const code = String(msg.code || '').trim().toUpperCase();
      const participantId = String(msg.participantId || '').trim();
      const name = typeof msg.name === 'string' ? msg.name : undefined;

      if (!code || !participantId) {
        safeSend(ws, { type: 'error', error: 'Missing room code or participant id' });
        return;
      }

      const result = roomManager.joinRoom(code, participantId, name);
      if ('error' in result) {
        safeSend(ws, { type: 'join-error', error: result.error });
        return;
      }

      meta.roomCode = result.room.code;
      meta.participantId = result.participant.id;
      safeSend(ws, {
        type: 'joined',
        room: result.room,
        participantId: result.participant.id,
      });
      broadcastRoomState(result.room);
      return;
    }

    if (!meta.roomCode || !meta.participantId) return;
    const code = meta.roomCode;
    const pid = meta.participantId;

    switch (type) {
      case 'preview-frame': {
        // Relay live compressed video frame to other room peers without mutating state
        if (typeof msg.frame === 'string') {
          broadcastEvent(
            code,
            {
              type: 'preview-frame',
              participantId: pid,
              frame: msg.frame,
              faceFilter: msg.faceFilter,
              faceProp: msg.faceProp,
            },
            pid
          );
        }
        break;
      }

      case 'cursor-move': {
        const cursor =
          msg.cursor && typeof msg.cursor === 'object'
            ? (msg.cursor as { x: number; y: number })
            : null;
        broadcastEvent(
          code,
          {
            type: 'cursor-move',
            participantId: pid,
            cursor,
          },
          pid
        );
        break;
      }

      case 'update-participant': {
        const patch = (msg.patch || {}) as Record<string, unknown>;
        const room = roomManager.updateParticipant(code, pid, {
          name: typeof patch.name === 'string' ? patch.name : undefined,
          ready: typeof patch.ready === 'boolean' ? patch.ready : undefined,
          faceFilter: typeof patch.faceFilter === 'string' ? patch.faceFilter : undefined,
          faceProp: typeof patch.faceProp === 'string' ? patch.faceProp : undefined,
        });
        if (room) broadcastRoomState(room);
        break;
      }

      case 'update-config': {
        const patch = (msg.patch || {}) as Record<string, unknown>;
        const room = roomManager.updateConfig(code, patch);
        if (room) broadcastRoomState(room);
        break;
      }

      case 'set-phase': {
        const phase = msg.phase as RoomState['phase'];
        if (['setup', 'prep', 'capture', 'customize', 'export'].includes(phase)) {
          const room = roomManager.setPhase(code, phase);
          if (room) broadcastRoomState(room);
        }
        break;
      }

      case 'start-capture': {
        const room = roomManager.startCaptureSession(code);
        if (room) broadcastRoomState(room);
        break;
      }

      case 'shot-frame': {
        const shotIndex = Number(msg.shotIndex);
        const imageData = typeof msg.imageData === 'string' ? msg.imageData : '';
        if (Number.isInteger(shotIndex) && shotIndex >= 0 && shotIndex < 6 && imageData) {
          const room = roomManager.recordShotFrame(code, pid, shotIndex, imageData);
          if (room) broadcastRoomState(room);
        }
        break;
      }

      case 'update-customization': {
        const patch = (msg.patch || {}) as Record<string, unknown>;
        const room = roomManager.updateCustomization(code, patch);
        if (room) broadcastRoomState(room);
        break;
      }

      case 'upsert-sticker': {
        if (msg.sticker && typeof msg.sticker === 'object') {
          const room = roomManager.upsertSticker(code, msg.sticker as never);
          if (room) broadcastRoomState(room);
        }
        break;
      }

      case 'remove-sticker': {
        if (typeof msg.stickerId === 'string') {
          const room = roomManager.removeSticker(code, msg.stickerId);
          if (room) broadcastRoomState(room);
        }
        break;
      }

      case 'add-doodle': {
        if (msg.stroke && typeof msg.stroke === 'object') {
          const room = roomManager.addDoodle(code, msg.stroke as never);
          if (room) broadcastRoomState(room);
        }
        break;
      }

      case 'undo-doodle': {
        const room = roomManager.undoDoodle(code);
        if (room) broadcastRoomState(room);
        break;
      }

      case 'clear-doodles': {
        const room = roomManager.clearDoodles(code);
        if (room) broadcastRoomState(room);
        break;
      }

      case 'reset-retake': {
        const targetPhase =
          msg.targetPhase === 'setup' || msg.targetPhase === 'prep' ? msg.targetPhase : 'prep';
        const room = roomManager.resetForRetake(code, targetPhase);
        if (room) broadcastRoomState(room);
        break;
      }
    }
  });

  ws.on('close', () => {
    clients.delete(meta);
    if (meta.roomCode && meta.participantId) {
      const room = roomManager.disconnectParticipant(meta.roomCode, meta.participantId);
      if (room) broadcastRoomState(room);
    }
  });
});

// Periodic stale room cleanup every 15 minutes
const cleanupInterval = setInterval(() => {
  roomManager.cleanupStaleRooms();
}, 15 * 60 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`Photo Lelo server listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  roomManager.clearAllTimers();
  server.close();
});
