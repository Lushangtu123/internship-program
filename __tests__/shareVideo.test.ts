import { describe, it, expect, vi } from 'vitest';
import {
  shareOutcomeMessage,
  shareVideoLink,
} from '@/lib/shareVideo';

describe('shareVideo', () => {
  it('maps outcomes to toast copy', () => {
    expect(shareOutcomeMessage('shared')).toBe('Shared');
    expect(shareOutcomeMessage('copied')).toBe('Link copied');
    expect(shareOutcomeMessage('failed')).toBe('Couldn’t share');
    expect(shareOutcomeMessage('cancelled')).toBeNull();
  });

  it('uses native share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareVideoLink({
      url: 'http://localhost/?v=1',
      title: 't',
      text: 'x',
      share,
    });
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalled();
  });

  it('falls back to clipboard when share is missing', async () => {
    const copyText = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareVideoLink({
      url: 'http://localhost/?v=1',
      title: 't',
      text: 'x',
      share: undefined,
      copyText,
    });
    expect(outcome).toBe('copied');
    expect(copyText).toHaveBeenCalledWith('http://localhost/?v=1');
  });

  it('treats AbortError as cancelled', async () => {
    const err = new Error('Nope');
    err.name = 'AbortError';
    const outcome = await shareVideoLink({
      url: 'http://localhost/?v=1',
      title: 't',
      text: 'x',
      share: async () => {
        throw err;
      },
      copyText: vi.fn(),
    });
    expect(outcome).toBe('cancelled');
  });
});
