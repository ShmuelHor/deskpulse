import { describe, expect, it } from 'vitest';
import { App, AppList, AppUpdate, Session } from '../src/sessions.js';

const id = '0b7f8c3e-2c55-4b8e-9f3e-1d2a3b4c5d6e';
const app = { id: 'firefox', name: 'Firefox', icon: 'firefox' };
const session = {
  id,
  appId: 'firefox',
  start: '2026-11-08T10:00:00Z',
  end: '2026-11-08T10:05:00Z',
};

describe('apps', () => {
  it('accepts an app, a list and an update', () => {
    expect(App.safeParse(app).success).toBe(true);
    expect(AppList.safeParse({ items: [app] }).success).toBe(true);
    expect(AppUpdate.safeParse({ name: 'Browser' }).success).toBe(true);
  });

  it('rejects icon paths, categories and renaming the id', () => {
    expect(App.safeParse({ ...app, icon: '/usr/share/icons/x.png' }).success).toBe(false);
    expect(App.safeParse({ ...app, category: 'work' }).success).toBe(false);
    expect(AppUpdate.safeParse({ name: 'x', id: 'y' }).success).toBe(false);
  });
});

describe('Session', () => {
  it('accepts a session and rejects one that carries a title', () => {
    expect(Session.safeParse(session).success).toBe(true);
    expect(Session.safeParse({ ...session, title: 'Inbox' }).success).toBe(false);
  });

  it('rejects a session that ends before it starts', () => {
    expect(Session.safeParse({ ...session, end: '2026-11-08T09:00:00Z' }).success).toBe(false);
  });
});
