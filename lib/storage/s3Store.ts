import { createHash, createHmac } from 'crypto';
import { promises as fs } from 'fs';
import {
  guessContentType,
  normalizeStorageKey,
  type ObjectStore,
} from '@/lib/storage/types';

export interface S3StoreConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional custom endpoint (MinIO / R2 / GCS interoperable). */
  endpoint?: string;
  /** Public base used in returned URLs (CDN). Falls back to endpoint/virtual-host. */
  publicBaseUrl?: string;
  forcePathStyle?: boolean;
}

function hmac(key: Buffer | string, data: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hashSha256(data: Buffer | string) {
  return createHash('sha256').update(data).digest('hex');
}

function amzDate(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Minimal S3-compatible PutObject (SigV4) without AWS SDK.
 * Enough for progressive video / poster / HLS artifacts.
 */
export class S3CompatibleObjectStore implements ObjectStore {
  readonly driver = 's3' as const;

  constructor(private readonly config: S3StoreConfig) {}

  private hostForRequest() {
    if (this.config.endpoint) {
      const url = new URL(this.config.endpoint);
      return url.host;
    }
    return `${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
  }

  private objectUrl(key: string) {
    const normalized = normalizeStorageKey(key);
    if (this.config.endpoint) {
      const base = this.config.endpoint.replace(/\/$/, '');
      if (this.config.forcePathStyle !== false) {
        return `${base}/${this.config.bucket}/${normalized}`;
      }
      const url = new URL(this.config.endpoint);
      return `${url.protocol}//${this.config.bucket}.${url.host}/${normalized}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${normalized}`;
  }

  publicUrl(key: string): string {
    const normalized = normalizeStorageKey(key);
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, '')}/${normalized}`;
    }
    return this.objectUrl(normalized);
  }

  async put(
    key: string,
    body: Buffer,
    contentType = guessContentType(key)
  ): Promise<string> {
    const normalized = normalizeStorageKey(key);
    const now = new Date();
    const { amz, dateStamp } = amzDate(now);
    const host = this.hostForRequest();
    const payloadHash = hashSha256(body);
    const canonicalUri = this.config.endpoint
      ? `/${this.config.bucket}/${normalized}`
          .split('/')
          .map((part) => encodeURIComponent(part).replace(/%2F/g, '/'))
          .join('/')
          .replace(/\/{2,}/g, '/')
      : `/${normalized
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')}`;

    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amz}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amz,
      credentialScope,
      hashSha256(canonicalRequest),
    ].join('\n');

    const kDate = hmac(`AWS4${this.config.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.config.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning)
      .update(stringToSign, 'utf8')
      .digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = this.objectUrl(normalized);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amz,
        Host: host,
      },
      body: new Uint8Array(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `S3 PutObject failed (${response.status}): ${text.slice(0, 200)}`
      );
    }

    return this.publicUrl(normalized);
  }

  async putFile(
    key: string,
    filePath: string,
    contentType?: string
  ): Promise<string> {
    const body = await fs.readFile(filePath);
    return this.put(key, body, contentType ?? guessContentType(key));
  }

  async putDirectory(keyPrefix: string, localDir: string): Promise<string[]> {
    const { readdir } = await import('fs/promises');
    const path = await import('path');
    const urls: string[] = [];
    const entries = await readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(localDir, entry.name);
      if (entry.isDirectory()) {
        urls.push(
          ...(await this.putDirectory(
            `${normalizeStorageKey(keyPrefix)}/${entry.name}`,
            full
          ))
        );
        continue;
      }
      const key = `${normalizeStorageKey(keyPrefix)}/${entry.name}`;
      urls.push(await this.putFile(key, full));
    }
    return urls;
  }
}
