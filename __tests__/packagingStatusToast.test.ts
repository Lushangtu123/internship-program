import { describe, it, expect } from 'vitest';
import { packagingStatusToast } from '@/lib/packagingStatusToast';

describe('packagingStatusToast', () => {
  it('announces ready after processing', () => {
    expect(packagingStatusToast('processing', 'ready')).toBe('Ready');
  });

  it('announces failure after processing', () => {
    expect(packagingStatusToast('processing', 'failed')).toBe(
      'Processing failed'
    );
  });

  it('stays quiet otherwise', () => {
    expect(packagingStatusToast('ready', 'ready')).toBeNull();
    expect(packagingStatusToast(undefined, 'processing')).toBeNull();
    expect(packagingStatusToast('processing', 'processing')).toBeNull();
  });
});
