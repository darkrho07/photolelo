import http from 'node:http';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RoomManager } from '../server/roomManager';

describe('Realtime Room HTTP + WebSocket Integration', () => {
  let server: http.Server;
  let baseUrl: string;
  let wsUrl: string;
  const rm = new RoomManager();

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    const wss = new WebSocketServer({ server, path: '/ws' });
    const sockets = new Set<{ ws: WebSocket; code?: string; pid?: string }>();

    rm.setBroadcaster({
      broadcastRoomState: (room) => {
        const msg = JSON.stringify({ type: 'room-state', room });
        for (const s of sockets) {
          if (s.code === room.code && s.ws.readyState === WebSocket.OPEN) {
            s.ws.send(msg);
          }
        }
      },
      broadcastEvent: (code, payload, excludePid) => {
        const msg = JSON.stringify(payload);
        for (const s of sockets) {
          if (s.code === code && s.pid !== excludePid && s.ws.readyState === WebSocket.OPEN) {
            s.ws.send(msg);
          }
        }
      },
    });

    app.post('/api/rooms', (req, res) => {
      const room = rm.createRoom(req.body?.mode || 'duo', req.body?.name || 'You');
      res.status(201).json({ code: room.code, room });
    });

    wss.on('connection', (ws) => {
      const meta: { ws: WebSocket; code?: string; pid?: string } = { ws };
      sockets.add(meta);

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'join-room') {
          const res = rm.joinRoom(msg.code, msg.participantId, msg.name);
          if ('room' in res) {
            meta.code = res.room.code;
            meta.pid = res.participant.id;
            ws.send(JSON.stringify({ type: 'joined', room: res.room }));
            rm.setPhase(res.room.code, res.room.phase);
            for (const s of sockets) {
              if (s.code === res.room.code && s.ws.readyState === WebSocket.OPEN) {
                s.ws.send(JSON.stringify({ type: 'room-state', room: res.room }));
              }
            }
          }
        } else if (msg.type === 'preview-frame' && meta.code) {
          for (const s of sockets) {
            if (s.code === meta.code && s.pid !== meta.pid && s.ws.readyState === WebSocket.OPEN) {
              s.ws.send(JSON.stringify({ type: 'preview-frame', participantId: meta.pid, frame: msg.frame }));
            }
          }
        } else if (msg.type === 'upsert-sticker' && meta.code) {
          const updated = rm.upsertSticker(meta.code, msg.sticker);
          if (updated) {
            for (const s of sockets) {
              if (s.code === meta.code && s.ws.readyState === WebSocket.OPEN) {
                s.ws.send(JSON.stringify({ type: 'room-state', room: updated }));
              }
            }
          }
        }
      });

      ws.on('close', () => sockets.delete(meta));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    rm.clearAllTimers();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('allows two partners to join, relay live preview frames, and sync stickers', async () => {
    const createRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'duo', name: 'Aarav' }),
    });
    expect(createRes.status).toBe(201);
    const { code } = (await createRes.json()) as { code: string };

    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    const msgs1: Array<Record<string, unknown>> = [];
    const msgs2: Array<Record<string, unknown>> = [];

    ws1.on('message', (d) => msgs1.push(JSON.parse(d.toString())));
    ws2.on('message', (d) => msgs2.push(JSON.parse(d.toString())));

    await Promise.all([
      new Promise<void>((r) => ws1.once('open', () => r())),
      new Promise<void>((r) => ws2.once('open', () => r())),
    ]);

    ws1.send(JSON.stringify({ type: 'join-room', code, participantId: 'p1', name: 'Aarav' }));
    ws2.send(JSON.stringify({ type: 'join-room', code, participantId: 'p2', name: 'Maya' }));

    await new Promise((r) => setTimeout(r, 100));

    ws1.send(JSON.stringify({ type: 'preview-frame', frame: 'data:image/jpeg;base64,ABC' }));
    ws2.send(
      JSON.stringify({
        type: 'upsert-sticker',
        sticker: { id: 'stk1', stickerId: 'bow', label: '🎀', kind: 'emoji', x: 0.4, y: 0.4, scale: 1, rotation: 0 },
      })
    );

    await new Promise((r) => setTimeout(r, 120));

    expect(msgs2.some((m) => m.type === 'preview-frame' && m.participantId === 'p1')).toBe(true);
    const latestRoomOnWs1 = [...msgs1].reverse().find((m) => m.type === 'room-state') as {
      room: { participants: unknown[]; customization: { stickers: unknown[] } };
    };
    expect(latestRoomOnWs1?.room.participants).toHaveLength(2);
    expect(latestRoomOnWs1?.room.customization.stickers).toHaveLength(1);

    ws1.close();
    ws2.close();
  });
});
