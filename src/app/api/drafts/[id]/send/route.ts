import { NextRequest, NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/google';
import prisma from '@/lib/prisma';

// Encode email to base64 for Gmail API
function encodeEmail(to: string, from: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// POST /api/drafts/[id]/send - Send an email draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the draft
    const draft = await prisma.emailDraft.findUnique({
      where: { id },
      include: { friend: true },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status === 'sent') {
      return NextResponse.json({ error: 'Email already sent' }, { status: 400 });
    }

    if (!draft.friend.email) {
      return NextResponse.json({ error: 'Friend has no email address' }, { status: 400 });
    }

    // Get auth
    const auth = await prisma.googleAuth.findUnique({
      where: { id: 'default' },
    });

    if (!auth) {
      return NextResponse.json({
        error: 'Not connected to Google',
        message: 'Please connect your Google account first',
      }, { status: 401 });
    }

    // Send email via Gmail API
    const gmail = getGmailClient(auth.accessToken, auth.refreshToken || undefined);
    const raw = encodeEmail(draft.friend.email, auth.email || '', draft.subject, draft.body);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    // Update draft status
    const updatedDraft = await prisma.emailDraft.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
      include: { friend: true },
    });

    // Update friend status
    await prisma.friend.update({
      where: { id: draft.friendId },
      data: {
        status: 'Waiting for Reply',
        lastEmailSent: new Date(),
        lastEmailContent: draft.body,
      },
    });

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
      message: `Email sent to ${draft.friend.name}`,
    });
  } catch (error) {
    console.error('Error sending email:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token')) {
      await prisma.googleAuth.deleteMany({});
      return NextResponse.json({
        error: 'Authentication expired',
        message: 'Please reconnect your Google account',
      }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
