import { describe, expect, it } from 'vitest';
import { loadVerifySets, verifySets } from '../utils';

describe('Grayscale effect', () => {
  const NAME = 'Grayscale';

  it('applies grayscale and matches expected output', () => {
    const sets = loadVerifySets(NAME, import.meta.url);
    expect(sets).toBeDefined();
    if (!sets) return;

    verifySets(NAME, sets, (original) => {
      original.grayscale();
    });
  });
});
