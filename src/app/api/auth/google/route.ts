import { NextResponse } from 'next/server';
import { getAuthUrl, isGoogleConfigured } from '@/lib/google';

// GET /api/auth/google - Start OAuth flow
export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json({
      error: 'Google API not configured',
      message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables',
    }, { status: 500 });
  }

  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
