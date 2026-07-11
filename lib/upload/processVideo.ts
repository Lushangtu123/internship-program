import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { getObjectStore, type ObjectStore } from '@/lib/storage';
import { guessContentType } from '@/lib/storage/types';
import { ABR_LADDER, buildMasterPlaylist } from '@/lib/upload/abrLadder';

const execFileAsync = promisify(execFile);

const ALLOWED_EXT = new Set(['.webm', '.mp4', '.mov']);
const MAX_BYTES = 40 * 1024 * 1024; // 40MB local demo limit
const HLS_TIMEOUT_MS = 420_000;

export function getUploadDirs(rootDir = process.cwd()) {
  const UPLOAD_ROOT = path.join(rootDir, 'public', 'uploads');
  return {
    UPLOAD_ROOT,
    VIDEO_DIR: path.join(UPLOAD_ROOT, 'videos'),
    POSTER_DIR: path.join(UPLOAD_ROOT, 'posters'),
    HLS_DIR: path.join(UPLOAD_ROOT, 'hls'),
  };
}

export async function ensureUploadDirs(rootDir = process.cwd()) {
  const { VIDEO_DIR, POSTER_DIR, HLS_DIR } = getUploadDirs(rootDir);
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  await fs.mkdir(POSTER_DIR, { recursive: true });
  await fs.mkdir(HLS_DIR, { recursive: true });
}

function extensionFor(file: File) {
  const fromName = path.extname(file.name || '').toLowerCase();
  if (ALLOWED_EXT.has(fromName)) return fromName;
  if (file.type === 'video/webm') return '.webm';
  if (file.type === 'video/mp4') return '.mp4';
  if (file.type === 'video/quicktime') return '.mov';
  return null;
}

async function probeDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      filePath,
    ]);
    const value = parseFloat(stdout.trim());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function extractPoster(videoPath: string, posterPath: string) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    '0.2',
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    posterPath,
  ]);
}

async function encodeVariant(input: {
  inputPath: string;
  outDir: string;
  height: number;
  videoBitrate: string;
  withAudio: boolean;
}) {
  await fs.mkdir(input.outDir, { recursive: true });
  const playlist = path.join(input.outDir, 'index.m3u8');
  const segmentPattern = path.join(input.outDir, 'seg_%03d.ts');
  const args = [
    '-y',
    '-i',
    input.inputPath,
    '-vf',
    `scale=-2:${input.height}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-b:v',
    input.videoBitrate,
    '-maxrate',
    input.videoBitrate,
    '-bufsize',
    input.videoBitrate,
    '-pix_fmt',
    'yuv420p',
    ...(input.withAudio
      ? (['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] as string[])
      : (['-an'] as string[])),
    '-f',
    'hls',
    '-hls_time',
    '2',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    segmentPattern,
    playlist,
  ];
  await execFileAsync('ffmpeg', args, { timeout: HLS_TIMEOUT_MS });
  await fs.access(playlist);
}

/** Single-rendition fallback (legacy path). */
async function transcodeSingleRendition(
  inputPath: string,
  outDir: string
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  const playlist = path.join(outDir, 'index.m3u8');
  const segmentPattern = path.join(outDir, 'seg_%03d.ts');
  const baseArgs = [
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '28',
    '-pix_fmt',
    'yuv420p',
  ];
  const hlsArgs = [
    '-f',
    'hls',
    '-hls_time',
    '2',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    segmentPattern,
    playlist,
  ];
  try {
    await execFileAsync(
      'ffmpeg',
      [...baseArgs, '-c:a', 'aac', '-b:a', '128k', '-ac', '2', ...hlsArgs],
      { timeout: HLS_TIMEOUT_MS }
    );
  } catch {
    await execFileAsync('ffmpeg', [...baseArgs, '-an', ...hlsArgs], {
      timeout: HLS_TIMEOUT_MS,
    });
  }
  await fs.access(playlist);
}

/**
 * Multi-bitrate HLS package (360p / 480p / 720p) + master.m3u8.
 * Falls back to a single rendition if the ladder encode fails.
 */
export async function transcodeToHls(
  inputPath: string,
  id: string,
  rootDir = process.cwd(),
  store: ObjectStore = getObjectStore(rootDir)
): Promise<string> {
  const { HLS_DIR } = getUploadDirs(rootDir);
  const outDir = path.join(HLS_DIR, id);
  await fs.mkdir(outDir, { recursive: true });

  try {
    let hasAudio = true;
    for (const rung of ABR_LADDER) {
      const variantDir = path.join(outDir, rung.name);
      try {
        await encodeVariant({
          inputPath,
          outDir: variantDir,
          height: rung.height,
          videoBitrate: rung.videoBitrate,
          withAudio: hasAudio,
        });
      } catch (error) {
        if (!hasAudio) throw error;
        // Source may lack an audio stream — retry the whole ladder silently.
        hasAudio = false;
        await encodeVariant({
          inputPath,
          outDir: variantDir,
          height: rung.height,
          videoBitrate: rung.videoBitrate,
          withAudio: false,
        });
      }
    }

    const master = buildMasterPlaylist(ABR_LADDER, { hasAudio });
    const masterPath = path.join(outDir, 'master.m3u8');
    await fs.writeFile(masterPath, master, 'utf-8');
    // Keep index.m3u8 as an alias for older clients / tests.
    await fs.writeFile(path.join(outDir, 'index.m3u8'), master, 'utf-8');
  } catch (error) {
    console.error('ABR ladder failed, falling back to single rendition:', error);
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });
    await transcodeSingleRendition(inputPath, outDir);
  }

  await store.putDirectory(`hls/${id}`, outDir);
  const masterKey = existsSync(path.join(outDir, 'master.m3u8'))
    ? `hls/${id}/master.m3u8`
    : `hls/${id}/index.m3u8`;
  return store.publicUrl(masterKey);
}

export async function saveUploadedVideo(
  file: File,
  rootDir = process.cwd()
): Promise<{
  src: string;
  progressiveSrc: string;
  poster: string;
  duration: number;
  id: string;
  absolutePath: string;
}> {
  const accepted = await acceptUploadedVideo(file, rootDir);
  let src = accepted.progressiveSrc;
  try {
    src = await transcodeToHls(accepted.absolutePath, accepted.id, rootDir);
  } catch (error) {
    console.error('HLS transcode failed, using progressive source:', error);
  }

  return {
    id: accepted.id,
    src,
    progressiveSrc: accepted.progressiveSrc,
    poster: accepted.poster,
    duration: accepted.duration,
    absolutePath: accepted.absolutePath,
  };
}

/** Fast path: persist file + poster + duration, skip HLS (async packaging). */
export async function acceptUploadedVideo(
  file: File,
  rootDir = process.cwd(),
  store: ObjectStore = getObjectStore(rootDir)
): Promise<{
  progressiveSrc: string;
  poster: string;
  duration: number;
  id: string;
  absolutePath: string;
}> {
  if (file.size <= 0) {
    throw Object.assign(new Error('Empty file'), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    throw Object.assign(new Error('File too large (max 40MB)'), { status: 413 });
  }

  const ext = extensionFor(file);
  if (!ext) {
    throw Object.assign(new Error('Only .webm, .mp4, or .mov allowed'), {
      status: 400,
    });
  }

  await ensureUploadDirs(rootDir);
  const { VIDEO_DIR, POSTER_DIR } = getUploadDirs(rootDir);
  const id = `up_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const videoName = `${id}${ext}`;
  const posterName = `${id}.jpg`;
  const videoPath = path.join(VIDEO_DIR, videoName);
  const posterPath = path.join(POSTER_DIR, posterName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(videoPath, buffer);

  let localPosterPath = posterPath;
  let posterKey = `posters/${posterName}`;
  try {
    await extractPoster(videoPath, posterPath);
  } catch {
    const fallbackPng = path.join(POSTER_DIR, `${id}.png`);
    await fs.copyFile(path.join(rootDir, 'public/posters/1.png'), fallbackPng);
    localPosterPath = fallbackPng;
    posterKey = `posters/${id}.png`;
  }

  const duration = await probeDurationSeconds(videoPath);
  const videoKey = `videos/${videoName}`;

  const progressiveSrc = await store.putFile(
    videoKey,
    videoPath,
    guessContentType(videoKey)
  );
  const poster = await store.putFile(
    posterKey,
    localPosterPath,
    guessContentType(posterKey)
  );

  return {
    id,
    progressiveSrc,
    poster,
    duration,
    absolutePath: videoPath,
  };
}
