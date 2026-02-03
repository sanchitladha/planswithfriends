import { NextResponse } from 'next/server';
import { isGoogleConfigured } from '@/lib/google';
import prisma from '@/lib/prisma';

// GET /api/auth/google/status - Check authentication status
export async function GET() {
  try {
    const configured = isGoogleConfigured();

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: 'Google API credentials not configured',
      });
    }

    // Check if we have stored tokens
    const auth = await prisma.googleAuth.findUnique({
      where: { id: 'default' },
    });

    if (!auth) {
      return NextResponse.json({
        configured: true,
        connected: false,
        message: 'Not connected to Google',
      });
    }

    // Check if token is expired
    const isExpired = auth.expiryDate && new Date(auth.expiryDate) < new Date();

    return NextResponse.json({
      configured: true,
      connected: !isExpired,
      email: auth.email,
      expiresAt: auth.expiryDate,
      message: isExpired ? 'Token expired, please reconnect' : 'Connected to Google',
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ error: 'Failed to check auth status' }, { status: 500 });
  }
}

// DELETE /api/auth/google/status - Disconnect from Google
export async function DELETE() {
  try {
    await prisma.googleAuth.deleteMany({});
    return NextResponse.json({ success: true, message: 'Disconnected from Google' });
  } catch (error) {
    console.error('Error disconnecting:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
