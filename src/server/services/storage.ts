// ============================================================
// LegacyLens — File Storage Service (Firebase Storage)
// ============================================================

import admin from 'firebase-admin';
import { logger } from '../trpc.js';

// Firebase configuration (service account via env)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;
const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET || (FIREBASE_PROJECT_ID ? `${FIREBASE_PROJECT_ID}.appspot.com` : '');

// Initialize Firebase Admin app (singleton)
if (!admin.apps.length && FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
    storageBucket: FIREBASE_STORAGE_BUCKET,
  });
} else if (!admin.apps.length) {
  logger.warn(
    'Firebase credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET.'
  );
}

const bucket = admin.apps.length ? admin.storage().bucket() : null;

/**
 * Upload a file to Firebase Storage.
 * Returns a public HTTPS URL to the object.
 */
export async function uploadToFirebase(
  fileBuffer: Buffer,
  filePath: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  if (!bucket) {
    throw new Error('Firebase Storage bucket is not initialized');
  }

  const file = bucket.file(filePath);
  await file.save(fileBuffer, {
    contentType,
    resumable: false,
    public: true,
  });

  const encodedPath = encodeURIComponent(filePath);
  const url = `https://storage.googleapis.com/${bucket.name}/${encodedPath}`;

  logger.info({ filePath, size: fileBuffer.length, url }, 'File uploaded to Firebase Storage');

  return url;
}

/**
 * Download a file from Firebase / public URL via HTTP.
 */
export async function downloadFromFirebase(fileUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error({ error, fileUrl }, 'Failed to download file from Firebase Storage');
    throw error;
  }
}

/**
 * Placeholder for generating upload URLs (not used in current flow).
 */
export async function getUploadUrl(
  filePath: string,
  contentType: string = 'audio/mpeg',
  expiresIn: number = 3600
): Promise<{ url: string; fields: Record<string, string> }> {
  void expiresIn;
  return {
    url: `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}`,
    fields: {
      key: filePath,
      'Content-Type': contentType,
    },
  };
}

/**
 * Delete a file from Firebase.
 * (MVP: just logs — safe no-op. Can be implemented with file.delete() later.)
 */
export async function deleteFromFirebase(filePath: string): Promise<void> {
  logger.info({ filePath }, 'File deleted from Firebase Storage (noop/mocked)');
}

