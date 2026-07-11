import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';

const execFileAsync = promisify(execFile);

const ALLOWED_EXT = new Set(['.webm', '.mp4', '.mov']);
const MAX_BYTES = 40 * 1024 * 1024; // 40MB local demo limit

export function getUploadDirs(rootDir = process.cwd()) {
  const UPLOAD_ROOT = path.join(rootDir, 'public', 'uploads');
  return {
    UPLOAD_ROOT,
    VIDEO_DIR: path.join(UPLOAD_ROOT, 'videos'),
    POSTER_DIR: path.join(UPLOAD_ROOT, 'posters'),
  };
}

export async function ensureUploadDirs(rootDir = process.cwd()) {
  const { VIDEO_DIR, POSTER_DIR } = getUploadDirs(rootDir);
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  await fs.mkdir(POSTER_DIR, { recursive: true });
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

export async function saveUploadedVideo(
  file: File,
  rootDir = process.cwd()
): Promise<{
  src: string;
  poster: string;
  duration: number;
  id: string;
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

  try {
    await extractPoster(videoPath, posterPath);
  } catch {
    const fallbackPng = path.join(POSTER_DIR, `${id}.png`);
    await fs.copyFile(path.join(rootDir, 'public/posters/1.png'), fallbackPng);
    return {
      id,
      src: `/uploads/videos/${videoName}`,
      poster: `/uploads/posters/${id}.png`,
      duration: await probeDurationSeconds(videoPath),
    };
  }

  const duration = await probeDurationSeconds(videoPath);
  return {
    id,
    src: `/uploads/videos/${videoName}`,
    poster: `/uploads/posters/${posterName}`,
    duration,
  };
}
