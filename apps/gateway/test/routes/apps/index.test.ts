import { describe, expect, it } from 'vitest';

import { handlers } from '../../../src/routes/apps/index.js';

describe('apps route module', () => {
  it('handles the app routes', () => {
    expect(Object.keys(handlers).sort()).toEqual(['listApps', 'updateApp']);
  });
});
