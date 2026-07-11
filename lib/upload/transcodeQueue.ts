import { updateVideoPlayback } from '@/lib/db/feedStore';
import { transcodeToHls } from '@/lib/upload/processVideo';

const inFlight = new Set<string>();

/** Fire-and-forget HLS package; progressive src stays playable meanwhile. */
export function enqueueHlsTranscode(input: {
  videoId: string;
  absolutePath: string;
  uploadId: string;
  rootDir?: string;
  dataDir?: string;
}) {
  if (inFlight.has(input.videoId)) return;
  inFlight.add(input.videoId);

  void (async () => {
    try {
      const hlsSrc = await transcodeToHls(
        input.absolutePath,
        input.uploadId,
        input.rootDir
      );
      await updateVideoPlayback(
        input.videoId,
        { src: hlsSrc, status: 'ready' },
        input.dataDir
      );
    } catch (error) {
      console.error('Background HLS failed; keeping progressive src', error);
      await updateVideoPlayback(
        input.videoId,
        { status: 'ready' },
        input.dataDir
      );
    } finally {
      inFlight.delete(input.videoId);
    }
  })();
}
