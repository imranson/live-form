import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../../server/sessions.js';
import { buildProgress } from '../../../shared/game.js';

const progress = buildProgress([], 8, false);

describe('SessionStore', () => {
  it('creates anonymous sessions with random ids', () => {
    const store = new SessionStore(60_000);
    const a = store.create(8, progress);
    const b = store.create(8, progress);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
    expect(store.get(a.id)).toBe(a);
    expect(Object.keys(a).sort()).toEqual(['answers', 'busy', 'createdAt', 'id', 'pending', 'progress', 'target', 'updatedAt']);
  });

  it('expires sessions after the TTL of inactivity', () => {
    let now = 0;
    const store = new SessionStore(1_000, 100, () => now);
    const s = store.create(8, progress);
    now = 900;
    store.touch(s);
    now = 1_800;
    expect(store.get(s.id)).toBe(s);
    now = 2_901;
    expect(store.get(s.id)).toBeUndefined();
  });

  it('prunes expired sessions in bulk', () => {
    let now = 0;
    const store = new SessionStore(1_000, 100, () => now);
    store.create(8, progress);
    store.create(8, progress);
    now = 5_000;
    store.prune();
    expect(store.size).toBe(0);
  });

  it('evicts the least recently used session when full', () => {
    let now = 0;
    const store = new SessionStore(60_000, 2, () => now++);
    const first = store.create(8, progress);
    const second = store.create(8, progress);
    store.touch(first);
    store.create(8, progress);
    expect(store.get(second.id)).toBeUndefined();
    expect(store.get(first.id)).toBe(first);
    expect(store.size).toBe(2);
  });
});
