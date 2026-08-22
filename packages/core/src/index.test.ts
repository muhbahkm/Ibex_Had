import { describe, expect, it } from 'vitest';

import { IBEX_HAD_CORE_VERSION } from './index.js';

describe('IBEX HAD core foundation', () => {
  it('exposes a deterministic core version marker', () => {
    expect(IBEX_HAD_CORE_VERSION).toBe('0.0.0');
  });
});
