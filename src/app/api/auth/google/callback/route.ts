import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getAuthenticatedClient } from '@/lib/google';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';

// GET /api/auth/google/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    // Redirect to dashboard with error
    return NextResponse.redirect(new URL('/?auth_error=' + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=no_code', request.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user email
    const auth = getAuthenticatedClient(tokens.access_token, tokens.refresh_token || undefined);
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const userInfo = await oauth2.userinfo.get();

    // Store tokens in database
    await prisma.googleAuth.upsert({
      where: { id: 'default' },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || null,
      },
      create: {
        id: 'default',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || null,
      },
    });

    // Redirect to dashboard with success
    return NextResponse.redirect(new URL('/?auth_success=true', request.url));
  } catch (err) {
    console.error('Error handling OAuth callback:', err);
    return NextResponse.redirect(new URL('/?auth_error=token_exchange_failed', request.url));
  }
}
