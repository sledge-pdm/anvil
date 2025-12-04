import { describe, expect, it } from 'vitest';
import { loadVerifySets, verifySets } from '../utils';

describe('Invert effect', () => {
  const NAME = 'Invert';

  it('applies invert and matches expected output', () => {
    const sets = loadVerifySets(NAME, import.meta.url);
    expect(sets).toBeDefined();
    if (!sets) return;

    verifySets(NAME, sets, (original) => {
      original.invert();
    });
  });
});
