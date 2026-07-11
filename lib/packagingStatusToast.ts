/** Toast copy when packaging status advances. */
export function packagingStatusToast(
  previous: string | undefined,
  next: string | undefined
): string | null {
  if (previous !== 'processing') return null;
  if (next === 'ready') return 'Ready';
  if (next === 'failed') return 'Processing failed';
  return null;
}
