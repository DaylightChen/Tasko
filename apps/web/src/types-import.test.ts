import * as types from '@tasko/types';
import { describe, expect, it } from 'vitest';

describe('@tasko/types workspace resolution', () => {
  it('resolves @tasko/types from apps/web', () => {
    expect(types).toBeDefined();
  });
});
