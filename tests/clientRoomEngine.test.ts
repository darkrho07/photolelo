import { describe, expect, it } from 'vitest';
import { ClientRoomEngine, generateClientRoomCode } from '../src/lib/clientRoomEngine';

describe('ClientRoomEngine (P2P / Vercel Static Fallback)', () => {
  it('generates valid 5-letter room codes and syncs duo guests', () => {
    const code = generateClientRoomCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);

    const states: string[] = [];
    const engine = new ClientRoomEngine(code, 'duo', 'host-1', 'Aarav', {
      onRoomState: (room) => states.push(`${room.phase}:${room.participants.length}`),
      onSnapTrigger: () => {},
    });

    const joinRes = engine.joinParticipant('guest-2', 'Maya');
    expect(joinRes.ok).toBe(true);
    expect(engine.room.participants.map((p) => p.name)).toEqual(['Aarav', 'Maya']);
    expect(engine.room.customization.caption).toBe('Aarav & Maya');

    const thirdRes = engine.joinParticipant('extra-3', 'Extra');
    expect(thirdRes.ok).toBe(false);

    engine.setPhase('prep');
    engine.updateParticipant('host-1', { ready: true });
    expect(engine.room.phase).toBe('prep');

    engine.updateParticipant('guest-2', { ready: true });
    expect(engine.room.phase).toBe('capture');
    expect(engine.room.capture.stage).toBe('curtain');

    engine.clearTimer();
  });
});
