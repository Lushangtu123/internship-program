/** Share a video deep link; returns a short UI status message (or null if cancelled). */

export type ShareOutcome = 'shared' | 'copied' | 'failed' | 'cancelled';

export function shareOutcomeMessage(outcome: ShareOutcome): string | null {
  if (outcome === 'shared') return 'Shared';
  if (outcome === 'copied') return 'Link copied';
  if (outcome === 'failed') return 'Couldn’t share';
  return null;
}

export async function shareVideoLink(input: {
  url: string;
  title: string;
  text: string;
  share?: (data: ShareData) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
}): Promise<ShareOutcome> {
  const shareFn =
    input.share ??
    (typeof navigator !== 'undefined' && navigator.share
      ? (data: ShareData) => navigator.share(data)
      : undefined);
  const copyFn =
    input.copyText ??
    (typeof navigator !== 'undefined' && navigator.clipboard?.writeText
      ? (text: string) => navigator.clipboard.writeText(text)
      : undefined);

  if (shareFn) {
    try {
      await shareFn({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard
    }
  }

  if (!copyFn) return 'failed';
  try {
    await copyFn(input.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
