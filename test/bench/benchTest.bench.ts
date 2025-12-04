import { bench, describe } from 'vitest';
import { Anvil } from '../../src/Anvil';

describe('test benchmark', () => {
  bench('test1', () => {
    const anvil = new Anvil(1000, 1000, 32);
    for (let i = 0; i < 100; i++) {
      anvil.resize(1, 1);
      anvil.resize(1000, 1000);
    }
  });
});
