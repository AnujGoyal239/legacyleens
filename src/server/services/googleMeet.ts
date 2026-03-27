// ============================================================
// LegacyLens — Google Meet / Calendar Service
// Uses OAuth2 to create Google Calendar events with Meet links,
// and fetches recordings/transcripts via the Meet REST API.
// ============================================================

import { google, calendar_v3 } from 'googleapis';
import { logger } from '../trpc.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  logger.warn(
    'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set. Google Meet integration will be disabled.'
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getAuthUrl(state?: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function getAuthedClient(accessToken: string, refreshToken?: string | null) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return client;
}

// ------------------------------------------------------------------
// Schedule a Google Calendar event with auto-generated Meet link
// ------------------------------------------------------------------
export async function scheduleMeeting(opts: {
  accessToken: string;
  refreshToken?: string | null;
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  durationMinutes: number;
  attendeeEmails?: string[];
}): Promise<{
  eventId: string;
  meetLink: string;
  htmlLink: string;
  startTime: string;
  endTime: string;
}> {
  const auth = getAuthedClient(opts.accessToken, opts.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const start = new Date(opts.startTime);
  const end = new Date(start.getTime() + opts.durationMinutes * 60 * 1000);

  const event: calendar_v3.Schema$Event = {
    summary: opts.title,
    description: opts.description || `Scheduled via LegacyLens`,
    start: { dateTime: start.toISOString(), timeZone: 'UTC' },
    end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    conferenceData: {
      createRequest: {
        requestId: `legacylens-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: (opts.attendeeEmails ?? []).map((email) => ({ email })),
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  const created = res.data;
  const meetLink =
    created.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ?? '';

  logger.info(
    { eventId: created.id, meetLink },
    'Google Calendar event created with Meet link'
  );

  return {
    eventId: created.id!,
    meetLink,
    htmlLink: created.htmlLink ?? '',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

// ------------------------------------------------------------------
// List upcoming Google Calendar events that have Meet links
// ------------------------------------------------------------------
export async function listUpcomingMeetings(opts: {
  accessToken: string;
  refreshToken?: string | null;
  maxResults?: number;
}): Promise<
  Array<{
    eventId: string;
    title: string;
    meetLink: string;
    htmlLink: string;
    startTime: string;
    endTime: string;
    status: string;
  }>
> {
  const auth = getAuthedClient(opts.accessToken, opts.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: opts.maxResults ?? 20,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items ?? [])
    .filter((e) => e.conferenceData?.entryPoints?.some((ep) => ep.entryPointType === 'video'))
    .map((e) => ({
      eventId: e.id!,
      title: e.summary ?? 'Untitled',
      meetLink:
        e.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ?? '',
      htmlLink: e.htmlLink ?? '',
      startTime: e.start?.dateTime ?? e.start?.date ?? '',
      endTime: e.end?.dateTime ?? e.end?.date ?? '',
      status: e.status ?? 'confirmed',
    }));
}

// ------------------------------------------------------------------
// Get a single event's details
// ------------------------------------------------------------------
export async function getMeetingEvent(opts: {
  accessToken: string;
  refreshToken?: string | null;
  eventId: string;
}) {
  const auth = getAuthedClient(opts.accessToken, opts.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.get({
    calendarId: 'primary',
    eventId: opts.eventId,
  });

  const e = res.data;
  return {
    eventId: e.id!,
    title: e.summary ?? 'Untitled',
    description: e.description ?? '',
    meetLink:
      e.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ?? '',
    htmlLink: e.htmlLink ?? '',
    startTime: e.start?.dateTime ?? e.start?.date ?? '',
    endTime: e.end?.dateTime ?? e.end?.date ?? '',
    status: e.status ?? 'confirmed',
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.email ?? '',
      responseStatus: a.responseStatus ?? 'needsAction',
    })),
  };
}

// ------------------------------------------------------------------
// Delete (cancel) a Calendar event
// ------------------------------------------------------------------
export async function cancelMeeting(opts: {
  accessToken: string;
  refreshToken?: string | null;
  eventId: string;
}) {
  const auth = getAuthedClient(opts.accessToken, opts.refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: opts.eventId,
    sendUpdates: 'all',
  });

  logger.info({ eventId: opts.eventId }, 'Google Calendar event cancelled');
}

export function isGoogleMeetConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
