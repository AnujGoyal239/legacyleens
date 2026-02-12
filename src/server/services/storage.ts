// ============================================================
// LegacyLens — File Storage Service (Backblaze B2)
// ============================================================

import crypto from 'crypto';
import { logger } from '../trpc.js';

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;

if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME || !B2_BUCKET_ID) {
  logger.warn(
    'Backblaze B2 credentials are missing. Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, and B2_BUCKET_ID in .env.'
  );
}

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
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`B2 authorize failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as B2Auth;
  return json;
}

async function b2GetUploadUrl(auth: B2Auth): Promise<B2UploadUrl> {
  requireB2Env();
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`B2 get_upload_url failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as B2UploadUrl;
}

async function getB2UploadTarget(): Promise<{ auth: B2Auth; upload: B2UploadUrl }> {
  if (!cachedAuth) cachedAuth = await b2AuthorizeAccount();
  if (!cachedUpload) cachedUpload = await b2GetUploadUrl(cachedAuth);
  return { auth: cachedAuth, upload: cachedUpload };
}

function fileUrlFromDownloadUrl(downloadUrl: string, fileName: string) {
  // B2 "file" URLs keep path separators as `/` in the URL path.
  const encoded = encodeURIComponent(fileName).replace(/%2F/g, '/');
  return `${downloadUrl}/file/${B2_BUCKET_NAME}/${encoded}`;
}

/**
 * Upload a file to Backblaze B2.
 * Returns a public HTTPS URL (bucket must allow public file downloads).
 */
export async function uploadToB2(
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
    // If upload URL/token is stale, clear cache and surface error.
    cachedUpload = null;
    throw new Error(`B2 upload failed (${res.status}): ${text || res.statusText}`);
  }

  const url = fileUrlFromDownloadUrl(auth.downloadUrl, fileName);
  logger.info({ fileName, size: fileBuffer.length, url }, 'File uploaded to Backblaze B2');
  return url;
}

/**
 * Download a file from B2 (via a public URL).
 */
export async function downloadFromB2(fileUrl: string): Promise<Buffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status}): ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a file from B2.
 * (Optional; not used in MVP. Implement later via b2_delete_file_version.)
 */
export async function deleteFromB2(fileName: string): Promise<void> {
  logger.info({ fileName }, 'deleteFromB2 is not implemented yet (noop)');
}

