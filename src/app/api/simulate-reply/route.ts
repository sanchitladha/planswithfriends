import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Simulated plans that friends might have
const SIMULATED_PLANS = [
  { title: 'Coachella Music Festival', location: 'Palm Springs, CA', monthOffset: 3 },
  { title: 'Summer Europe Trip', location: 'Paris, France', monthOffset: 5 },
  { title: 'NYC Business Trip', location: 'New York, NY', monthOffset: 2 },
  { title: 'Beach Vacation', location: 'Miami, FL', monthOffset: 6 },
  { title: 'Music Festival', location: 'Austin, TX', monthOffset: 4 },
  { title: 'Wedding', location: 'San Francisco, CA', monthOffset: 7 },
  { title: 'Ski Trip', location: 'Aspen, CO', monthOffset: 1 },
  { title: 'Family Reunion', location: 'Chicago, IL', monthOffset: 8 },
  { title: 'Conference', location: 'Las Vegas, NV', monthOffset: 3 },
  { title: 'Birthday Trip', location: 'Cancun, Mexico', monthOffset: 4 },
];

function getRandomPlans(count: number = 2) {
  const shuffled = [...SIMULATED_PLANS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateReplyEmail(friendName: string, plans: typeof SIMULATED_PLANS): string {
  const firstName = friendName.split(' ')[0];
  const plansText = plans
    .map((plan) => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + plan.monthOffset);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 2);
      return `- ${plan.title} in ${plan.location} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
    })
    .join('\n');

  return `Hey!

Great to hear from you! Love that you're being proactive about this.

Here's what I have on my calendar for 2026:

${plansText}

Let me know if any of these work for a meetup!

Best,
${firstName}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { friendId } = body;

    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }

    const friend = await prisma.friend.findUnique({
      where: { id: friendId },
    });

    if (!friend) {
      return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
    }

    // Generate random plans for this friend
    const randomPlans = getRandomPlans(Math.floor(Math.random() * 2) + 1);
    const replyEmail = generateReplyEmail(friend.name, randomPlans);

    // Create friend plans from the simulated reply
    const createdPlans = [];
    for (const plan of randomPlans) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + plan.monthOffset);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 2);

      const createdPlan = await prisma.friendPlan.create({
        data: {
          friendId: friend.id,
          title: plan.title,
          location: plan.location,
          startDate,
          endDate,
          source: 'email_reply',
        },
      });
      createdPlans.push(createdPlan);
    }

    // Update friend status
    await prisma.friend.update({
      where: { id: friendId },
      data: {
        status: 'Dates Received',
      },
    });

    // Check for matches with my plans
    const myPlans = await prisma.myPlan.findMany({
      where: { confirmed: true },
    });

    const matches = [];
    for (const friendPlan of createdPlans) {
      for (const myPlan of myPlans) {
        // Check if dates overlap or locations match
        const friendStart = new Date(friendPlan.startDate);
        const friendEnd = friendPlan.endDate ? new Date(friendPlan.endDate) : friendStart;
        const myStart = new Date(myPlan.startDate);
        const myEnd = myPlan.endDate ? new Date(myPlan.endDate) : myStart;

        const datesOverlap = friendStart <= myEnd && friendEnd >= myStart;
        const locationsMatch =
          friendPlan.location &&
          myPlan.location &&
          friendPlan.location.toLowerCase().includes(myPlan.location.toLowerCase().split(',')[0]);

        if (datesOverlap || locationsMatch) {
          matches.push({
            friendPlan,
            myPlan,
            matchType: datesOverlap && locationsMatch ? 'same_event' : datesOverlap ? 'overlap' : 'nearby',
          });

          // Create shared calendar event
          await prisma.sharedCalendarEvent.create({
            data: {
              title: `Potential meetup: ${friend.name} - ${friendPlan.title}`,
              location: friendPlan.location,
              startDate: friendPlan.startDate,
              endDate: friendPlan.endDate,
              participants: JSON.stringify([friend.id]),
              matchType: datesOverlap && locationsMatch ? 'same_event' : datesOverlap ? 'overlap' : 'nearby',
            },
          });
        }
      }
    }

    // Update status if matches found
    if (matches.length > 0) {
      await prisma.friend.update({
        where: { id: friendId },
        data: {
          status: 'Match Found',
        },
      });
    }

    return NextResponse.json({
      success: true,
      replyEmail,
      plans: createdPlans,
      matches,
      newStatus: matches.length > 0 ? 'Match Found' : 'Dates Received',
    });
  } catch (error) {
    console.error('Error simulating reply:', error);
    return NextResponse.json({ error: 'Failed to simulate reply' }, { status: 500 });
  }
}
