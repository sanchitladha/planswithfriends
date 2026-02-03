import { google } from 'googleapis';

// Google OAuth2 configuration
// You'll need to set these environment variables:
// GOOGLE_CLIENT_ID - from Google Cloud Console
// GOOGLE_CLIENT_SECRET - from Google Cloud Console
// GOOGLE_REDIRECT_URI - should be http://localhost:3000/api/auth/google/callback for local dev

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function getAuthenticatedClient(accessToken: string, refreshToken?: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

export function getGmailClient(accessToken: string, refreshToken?: string) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  return google.gmail({ version: 'v1', auth });
}

export function getCalendarClient(accessToken: string, refreshToken?: string) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  return google.calendar({ version: 'v3', auth });
}

// Helper to check if credentials are configured
export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
