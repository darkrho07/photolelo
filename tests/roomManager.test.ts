import { describe, expect, it } from 'vitest';
import { RoomManager } from '../server/roomManager';

describe('RoomManager', () => {
  it('creates 5-letter room codes and manages Duo capacity', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('duo', 'Aarav');
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(room.maxParticipants).toBe(2);

    const p1 = rm.joinRoom(room.code, 'id-1', 'Aarav');
    expect('room' in p1).toBe(true);
    const p2 = rm.joinRoom(room.code, 'id-2', 'Maya');
    expect('room' in p2).toBe(true);

    const p3 = rm.joinRoom(room.code, 'id-3', 'Extra');
    expect('error' in p3).toBe(true);

    if ('room' in p2) {
      expect(p2.room.participants.map((p) => p.name)).toEqual(['Aarav', 'Maya']);
      expect(p2.room.customization.caption).toBe('Aarav & Maya');
    }
  });

  it('supports Squad mode up to 4 participants', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('squad', 'Host');
    expect(room.maxParticipants).toBe(4);

    ['u1', 'u2', 'u3', 'u4'].forEach((id, idx) => {
      const res = rm.joinRoom(room.code, id, `Friend ${idx + 1}`);
      expect('room' in res).toBe(true);
    });

    const fifth = rm.joinRoom(room.code, 'u5', 'Fifth');
    expect('error' in fifth).toBe(true);
  });

  it('waits until all connected Duo participants are ready before starting capture', () => {
    const events: string[] = [];
    const rm = new RoomManager({
      broadcastRoomState: (r) => events.push(`state:${r.phase}:${r.capture.stage}`),
      broadcastEvent: (_code, payload) => events.push(`event:${String(payload.type)}`),
    });

    const room = rm.createRoom('duo', 'Aarav');
    rm.joinRoom(room.code, 'p1', 'Aarav');
    rm.joinRoom(room.code, 'p2', 'Maya');
    rm.setPhase(room.code, 'prep');

    // Only p1 ready -> should not start capture
    rm.updateParticipant(room.code, 'p1', { ready: true });
    expect(rm.getRoom(room.code)?.phase).toBe('prep');
    expect(rm.getRoom(room.code)?.capture.active).toBe(false);

    // Now p2 ready -> starts capture automatically!
    rm.updateParticipant(room.code, 'p2', { ready: true });
    expect(rm.getRoom(room.code)?.phase).toBe('capture');
    expect(rm.getRoom(room.code)?.capture.active).toBe(true);
    expect(rm.getRoom(room.code)?.capture.stage).toBe('curtain');
    expect(events.some((e) => e === 'state:capture:curtain')).toBe(true);

    rm.clearAllTimers();
  });

  it('syncs stickers, doodles, and retakes cleanly', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('duo', 'Aarav');
    rm.joinRoom(room.code, 'p1', 'Aarav');

    rm.upsertSticker(room.code, {
      id: 's1',
      stickerId: 'word-xoxo',
      label: 'XOXO',
      kind: 'word',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
    });
    expect(rm.getRoom(room.code)?.customization.stickers).toHaveLength(1);

    rm.addDoodle(room.code, {
      id: 'd1',
      color: '#FF4D4D',
      width: 0.008,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
    });
    expect(rm.getRoom(room.code)?.customization.doodles).toHaveLength(1);

    rm.undoDoodle(room.code);
    expect(rm.getRoom(room.code)?.customization.doodles).toHaveLength(0);

    rm.resetForRetake(room.code, 'prep');
    expect(rm.getRoom(room.code)?.phase).toBe('prep');
    expect(rm.getRoom(room.code)?.customization.stickers).toHaveLength(0);
  });
});
