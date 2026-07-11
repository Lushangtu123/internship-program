import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { getObjectStore, type ObjectStore } from '@/lib/storage';
import { guessContentType } from '@/lib/storage/types';

const execFileAsync = promisify(execFile);

const ALLOWED_EXT = new Set(['.webm', '.mp4', '.mov']);
const MAX_BYTES = 40 * 1024 * 1024; // 40MB local demo limit

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

/** Single-rendition VOD HLS package; publishes via ObjectStore. */
export async function transcodeToHls(
  inputPath: string,
  id: string,
  rootDir = process.cwd(),
  store: ObjectStore = getObjectStore(rootDir)
): Promise<string> {
  const { HLS_DIR } = getUploadDirs(rootDir);
  const outDir = path.join(HLS_DIR, id);
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
      { timeout: 180000 }
    );
  } catch {
    await execFileAsync('ffmpeg', [...baseArgs, '-an', ...hlsArgs], {
      timeout: 180000,
    });
  }

  await fs.access(playlist);
  await store.putDirectory(`hls/${id}`, outDir);
  return store.publicUrl(`hls/${id}/index.m3u8`);
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
