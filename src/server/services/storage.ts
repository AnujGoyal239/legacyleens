// ============================================================
// LegacyLens — File Storage Service
// Supports Google Cloud Storage (GCS) and Backblaze B2.
// Set STORAGE_PROVIDER=gcs or STORAGE_PROVIDER=b2 in .env.
// Defaults to GCS if GCS_BUCKET is set, otherwise B2.
// ============================================================

import crypto from 'crypto';
import { logger } from '../trpc.js';

const STORAGE_PROVIDER =
  process.env.STORAGE_PROVIDER ||
  (process.env.GCS_BUCKET ? 'gcs' : 'b2');

// ============================================================
// Google Cloud Storage
// ============================================================

const GCS_BUCKET = process.env.GCS_BUCKET;
const GCS_PROJECT_ID = process.env.GCP_PROJECT_ID;

async function getGcsClient() {
  const { Storage } = await import('@google-cloud/storage');
  const opts: Record<string, string> = {};
  if (GCS_PROJECT_ID) opts.projectId = GCS_PROJECT_ID;
  if (process.env.GCS_KEY_FILE) opts.keyFilename = process.env.GCS_KEY_FILE;
  return new Storage(opts);
}

async function uploadToGCS(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  if (!GCS_BUCKET) throw new Error('GCS_BUCKET is not configured');

  const storage = await getGcsClient();
  const bucket = storage.bucket(GCS_BUCKET);
  const file = bucket.file(fileName);

  await file.save(fileBuffer, {
    metadata: { contentType },
    resumable: false,
  });

  await file.makePublic();

  const url = `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`;
  logger.info({ fileName, size: fileBuffer.length, url }, 'File uploaded to GCS');
  return url;
}

async function downloadFromGCS(fileUrl: string): Promise<Buffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status}): ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function deleteFromGCS(fileName: string): Promise<void> {
  if (!GCS_BUCKET) return;
  const storage = await getGcsClient();
  try {
    await storage.bucket(GCS_BUCKET).file(fileName).delete();
    logger.info({ fileName }, 'File deleted from GCS');
  } catch (err) {
    logger.warn({ fileName, err }, 'Failed to delete from GCS');
  }
}

// ============================================================
// Backblaze B2 (legacy / fallback)
// ============================================================

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;

type B2Auth = {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
};

type B2UploadUrl = {
  uploadUrl: string;
  authorizationToken: string;
};

let cachedAuth: B2Auth | null = null;
let cachedUpload: B2UploadUrl | null = null;

function requireB2Env() {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME || !B2_BUCKET_ID) {
    throw new Error('Backblaze B2 is not configured. Missing B2_* env vars.');
  }
}

async function b2AuthorizeAccount(): Promise<B2Auth> {
  requireB2Env();
  const basic = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`B2 authorize failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as B2Auth;
}

async function b2GetUploadUrl(auth: B2Auth): Promise<B2UploadUrl> {
  requireB2Env();
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`B2 get_upload_url failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as B2UploadUrl;
}

async function getB2UploadTarget() {
  if (!cachedAuth) cachedAuth = await b2AuthorizeAccount();
  if (!cachedUpload) cachedUpload = await b2GetUploadUrl(cachedAuth);
  return { auth: cachedAuth, upload: cachedUpload };
}

function fileUrlFromDownloadUrl(downloadUrl: string, fileName: string) {
  const encoded = encodeURIComponent(fileName).replace(/%2F/g, '/');
  return `${downloadUrl}/file/${B2_BUCKET_NAME}/${encoded}`;
}

async function uploadToB2Only(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  requireB2Env();
  const sha1 = crypto.createHash('sha1').update(fileBuffer).digest('hex');
  const { auth, upload } = await getB2UploadTarget();

  const res = await fetch(upload.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: upload.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(fileName),
      'Content-Type': contentType,
      'Content-Length': String(fileBuffer.length),
      'X-Bz-Content-Sha1': sha1,
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    cachedUpload = null;
    throw new Error(`B2 upload failed (${res.status}): ${text || res.statusText}`);
  }

  const url = fileUrlFromDownloadUrl(auth.downloadUrl, fileName);
  logger.info({ fileName, size: fileBuffer.length, url }, 'File uploaded to Backblaze B2');
  return url;
}

async function downloadFromB2Only(fileUrl: string): Promise<Buffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status}): ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// ============================================================
// Unified public API
// ============================================================

export async function uploadToB2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  if (STORAGE_PROVIDER === 'gcs') {
    return uploadToGCS(fileBuffer, fileName, contentType);
  }
  return uploadToB2Only(fileBuffer, fileName, contentType);
}

export async function downloadFromB2(fileUrl: string): Promise<Buffer> {
  if (STORAGE_PROVIDER === 'gcs') {
    return downloadFromGCS(fileUrl);
  }
  return downloadFromB2Only(fileUrl);
}

export async function deleteFromB2(fileName: string): Promise<void> {
  if (STORAGE_PROVIDER === 'gcs') {
    return deleteFromGCS(fileName);
  }
  logger.info({ fileName }, 'deleteFromB2 is not implemented yet (noop)');
}

if (STORAGE_PROVIDER === 'gcs') {
  if (!GCS_BUCKET) {
    logger.warn('STORAGE_PROVIDER=gcs but GCS_BUCKET is not set.');
  } else {
    logger.info({ bucket: GCS_BUCKET }, 'Using Google Cloud Storage');
  }
} else {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
    logger.warn('Backblaze B2 credentials are missing. File uploads will fail.');
  } else {
    logger.info('Using Backblaze B2 storage');
  }
}
