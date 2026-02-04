import { NextRequest, NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/google';
import prisma from '@/lib/prisma';

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateRange(startDate: Date, endDate: Date | null): string {
  const start = formatDate(startDate);
  if (!endDate) return start;
  const end = formatDate(endDate);
  return `${start} - ${end}`;
}

// Generate personalized email for a friend
function generateEmail(
  friendName: string,
  myPlans: { title: string; location: string | null; startDate: Date; endDate: Date | null }[]
): { subject: string; body: string } {
  const firstName = friendName.split(' ')[0];

  const plansText = myPlans
    .map((plan) => {
      const dateRange = formatDateRange(plan.startDate, plan.endDate);
      const location = plan.location ? ` in ${plan.location}` : '';
      return `  • ${plan.title}${location}: ${dateRange}`;
    })
    .join('\n');

  const subject = `Let's sync up our 2026 plans!`;

  const body = `Hey ${firstName}!

Hope you're doing well! I've been thinking about all the adventures 2026 might bring, and I wanted to reach out to see what fun travels or events you have planned this year.

I'm trying to be more proactive about coordinating with friends so we don't miss opportunities to meet up. Whether it's a concert, a wedding, a trip, or just passing through somewhere interesting - I'd love to know!

Here are my confirmed plans so far:

${plansText}

If any of these overlap with your schedule or if you're planning something in a similar area, it would be amazing to connect!

Would love to hear what's on your calendar for 2026. Even if nothing is set in stone yet, let me know what you're thinking about!

Looking forward to catching up!

P.S. Feel free to just reply with your plans - even a quick list works!`;

  return { subject, body };
}

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

// GET /api/drafts - Get all email drafts
export async function GET() {
  try {
    const drafts = await prisma.emailDraft.findMany({
      include: {
        friend: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

// POST /api/drafts - Create drafts for friends (Draft Outreach)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { friendIds, createInGmail = false } = body;

    // Get auth for Gmail draft creation
    const auth = await prisma.googleAuth.findUnique({
      where: { id: 'default' },
    });

    // Get my confirmed plans
    const myPlans = await prisma.myPlan.findMany({
      where: {
        confirmed: true,
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: 'asc' },
    });

    if (myPlans.length === 0) {
      return NextResponse.json({
        error: 'No confirmed plans found',
        message: 'Add some plans first before creating outreach emails',
      }, { status: 400 });
    }

    // Get friends to email
    let friends;
    if (friendIds && friendIds.length > 0) {
      friends = await prisma.friend.findMany({
        where: {
          id: { in: friendIds },
          email: { not: null },
        },
      });
    } else {
      // Get all friends with emails
      friends = await prisma.friend.findMany({
        where: {
          email: { not: null },
        },
      });
    }

    if (friends.length === 0) {
      return NextResponse.json({
        error: 'No eligible friends found',
        message: 'Add friends with email addresses first',
      }, { status: 400 });
    }

    const createdDrafts = [];
    const errors = [];

    for (const friend of friends) {
      try {
        // Check if draft already exists
        const existingDraft = await prisma.emailDraft.findFirst({
          where: {
            friendId: friend.id,
            status: { in: ['draft', 'pending_review'] },
          },
        });

        if (existingDraft) {
          errors.push({ friendId: friend.id, error: 'Draft already exists' });
          continue;
        }

        // Generate email content
        const { subject, body: emailBody } = generateEmail(friend.name, myPlans);

        let gmailDraftId = null;

        // Create Gmail draft if requested and authenticated
        if (createInGmail && auth && friend.email) {
          try {
            const gmail = getGmailClient(auth.accessToken, auth.refreshToken || undefined);
            const raw = encodeEmail(friend.email, auth.email || '', subject, emailBody);

            const gmailDraft = await gmail.users.drafts.create({
              userId: 'me',
              requestBody: {
                message: { raw },
              },
            });

            gmailDraftId = gmailDraft.data.id || null;
          } catch (gmailError) {
            console.error('Error creating Gmail draft:', gmailError);
            // Continue without Gmail draft
          }
        }

        // Save draft to database
        const draft = await prisma.emailDraft.create({
          data: {
            friendId: friend.id,
            subject,
            body: emailBody,
            gmailDraftId,
            status: 'pending_review',
          },
          include: { friend: true },
        });

        // Update friend status
        await prisma.friend.update({
          where: { id: friend.id },
          data: { status: 'Email Sent' },
        });

        createdDrafts.push(draft);
      } catch (friendError) {
        console.error(`Error creating draft for ${friend.name}:`, friendError);
        errors.push({ friendId: friend.id, error: 'Failed to create draft' });
      }
    }

    return NextResponse.json({
      success: true,
      created: createdDrafts.length,
      drafts: createdDrafts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error creating drafts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create drafts', details: errorMessage }, { status: 500 });
  }
}

// PUT /api/drafts - Regenerate all pending drafts with latest plans
export async function PUT() {
  try {
    // Get my confirmed plans
    const myPlans = await prisma.myPlan.findMany({
      where: {
        confirmed: true,
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: 'asc' },
    });

    if (myPlans.length === 0) {
      return NextResponse.json({
        error: 'No confirmed plans found',
        message: 'Add some plans first before updating drafts',
      }, { status: 400 });
    }

    // Get all pending drafts
    const pendingDrafts = await prisma.emailDraft.findMany({
      where: {
        status: { in: ['draft', 'pending_review'] },
      },
      include: { friend: true },
    });

    if (pendingDrafts.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'No pending drafts to update',
      });
    }

    const updatedDrafts = [];

    for (const draft of pendingDrafts) {
      if (!draft.friend) continue;

      // Generate new email content with latest plans
      const { subject, body } = generateEmail(draft.friend.name, myPlans);

      // Update the draft
      const updated = await prisma.emailDraft.update({
        where: { id: draft.id },
        data: { subject, body },
        include: { friend: true },
      });

      updatedDrafts.push(updated);
    }

    return NextResponse.json({
      success: true,
      updated: updatedDrafts.length,
      drafts: updatedDrafts,
    });
  } catch (error) {
    console.error('Error updating drafts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update drafts', details: errorMessage }, { status: 500 });
  }
}
