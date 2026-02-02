import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GeneratedEmail } from '@/lib/types';

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRange(startDate: Date, endDate: Date | null): string {
  const start = formatDate(startDate);
  if (!endDate) return start;
  const end = formatDate(endDate);
  return `${start} - ${end}`;
}

function generatePersonalizedEmail(
  friendName: string,
  myPlans: { title: string; location: string | null; startDate: Date; endDate: Date | null }[]
): { subject: string; body: string } {
  const firstName = friendName.split(' ')[0];

  const plansText = myPlans
    .map((plan) => {
      const dateRange = formatDateRange(plan.startDate, plan.endDate);
      const location = plan.location ? ` in ${plan.location}` : '';
      return `  - ${plan.title}${location}: ${dateRange}`;
    })
    .join('\n');

  const subject = `Let's sync up our 2026 plans! `;

  const body = `Hey ${firstName}!

Hope you're doing great! I've been thinking about all the adventures 2026 might bring, and I wanted to reach out to see what fun travels or events you have planned this year.

I'm trying to be more proactive about coordinating with friends so we don't miss opportunities to meet up. Whether it's a concert, a wedding, a trip, or just passing through somewhere interesting - I'd love to know!

Here are my confirmed plans so far:

${plansText}

If any of these overlap with your schedule or if you're planning something in a similar area, it would be amazing to connect!

Would love to hear what's on your calendar for 2026. Even if nothing is set in stone yet, let me know what you're thinking about!

Looking forward to catching up,
[Your Name]

P.S. Feel free to just reply with your plans - even a quick list works! I'm using a new system to help track everyone's schedules so we can find overlap.`;

  return { subject, body };
}

export async function POST() {
  try {
    // Get all friends who haven't been contacted or need follow-up
    const friends = await prisma.friend.findMany({
      where: {
        email: { not: null },
        OR: [
          { status: 'Not Contacted' },
          { status: 'Email Sent' },
        ],
      },
    });

    // Get all my confirmed plans
    const myPlans = await prisma.myPlan.findMany({
      where: {
        confirmed: true,
        startDate: {
          gte: new Date(),
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    if (myPlans.length === 0) {
      return NextResponse.json({
        error: 'No confirmed plans found. Add some plans first!',
      }, { status: 400 });
    }

    const generatedEmails: GeneratedEmail[] = [];

    for (const friend of friends) {
      const { subject, body } = generatePersonalizedEmail(friend.name, myPlans);

      // Update friend status and save email content
      await prisma.friend.update({
        where: { id: friend.id },
        data: {
          status: 'Email Sent',
          lastEmailSent: new Date(),
          lastEmailContent: body,
        },
      });

      generatedEmails.push({
        friendId: friend.id,
        friendName: friend.name,
        subject,
        body,
      });
    }

    // Also update status to "Waiting for Reply" for those already sent
    await prisma.friend.updateMany({
      where: {
        status: 'Email Sent',
        lastEmailSent: {
          not: null,
        },
      },
      data: {
        status: 'Waiting for Reply',
      },
    });

    return NextResponse.json({
      success: true,
      emailsSent: generatedEmails.length,
      emails: generatedEmails,
    });
  } catch (error) {
    console.error('Error syncing with friends:', error);
    return NextResponse.json({ error: 'Failed to sync with friends' }, { status: 500 });
  }
}
