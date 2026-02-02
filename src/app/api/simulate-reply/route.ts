import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Simulated plans that friends might have
const SIMULATED_PLANS = [
  { title: 'Coachella Music Festival', location: 'Indio, CA', monthOffset: 2 },
  { title: 'Summer Europe Trip', location: 'Paris, France', monthOffset: 5 },
  { title: 'NYC Business Trip', location: 'New York, NY', monthOffset: 0 },
  { title: 'Beach Vacation', location: 'Miami, FL', monthOffset: 6 },
  { title: 'SXSW Conference', location: 'Austin, TX', monthOffset: 1 },
  { title: 'Wedding', location: 'San Francisco, CA', monthOffset: 7 },
  { title: 'Ski Trip', location: 'Aspen, CO', monthOffset: 0 },
  { title: 'Family Reunion', location: 'Chicago, IL', monthOffset: 8 },
  { title: 'Tech Conference', location: 'Las Vegas, NV', monthOffset: 3 },
  { title: 'Birthday Trip', location: 'Cancun, Mexico', monthOffset: 4 },
];

function getRandomPlans(count: number = 2) {
  const shuffled = [...SIMULATED_PLANS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateReplyEmail(friendName: string, plans: { title: string; location: string; startDate: Date; endDate: Date }[]): string {
  const firstName = friendName.split(' ')[0];
  const plansText = plans
    .map((plan) => {
      return `- ${plan.title} in ${plan.location} (${plan.startDate.toLocaleDateString()} - ${plan.endDate.toLocaleDateString()})`;
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

// Check if two date ranges are within proximity (in days)
function areDatesNearby(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
  proximityDays: number = 3
): { isNearby: boolean; overlap: boolean } {
  const msPerDay = 24 * 60 * 60 * 1000;

  // Check for direct overlap
  const overlap = start1 <= end2 && end1 >= start2;

  // Check if within proximity (extend ranges by proximityDays)
  const extendedStart1 = new Date(start1.getTime() - proximityDays * msPerDay);
  const extendedEnd1 = new Date(end1.getTime() + proximityDays * msPerDay);
  const isNearby = extendedStart1 <= end2 && extendedEnd1 >= start2;

  return { isNearby, overlap };
}

// Normalize location for comparison
function normalizeLocation(location: string): string {
  return location.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Check if locations are similar
function areLocationsSimilar(loc1: string | null, loc2: string | null): boolean {
  if (!loc1 || !loc2) return false;

  const norm1 = normalizeLocation(loc1);
  const norm2 = normalizeLocation(loc2);

  // Check if one contains the other or they share a city name
  const city1 = loc1.split(',')[0].toLowerCase().trim();
  const city2 = loc2.split(',')[0].toLowerCase().trim();

  return norm1.includes(norm2) || norm2.includes(norm1) || city1 === city2;
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

    // Create actual dates for the plans
    const plansWithDates = randomPlans.map((plan) => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + plan.monthOffset);
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 15)); // Random day in month
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 2);
      return { ...plan, startDate, endDate };
    });

    const replyEmail = generateReplyEmail(friend.name, plansWithDates);

    // Create friend plans from the simulated reply
    const createdPlans = [];
    for (const plan of plansWithDates) {
      const createdPlan = await prisma.friendPlan.create({
        data: {
          friendId: friend.id,
          title: plan.title,
          location: plan.location,
          startDate: plan.startDate,
          endDate: plan.endDate,
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

    // Check for matches with my plans using proper date proximity
    const myPlans = await prisma.myPlan.findMany({
      where: { confirmed: true },
    });

    const matches = [];
    const PROXIMITY_DAYS = 3; // +/- 3 days

    for (const friendPlan of createdPlans) {
      for (const myPlan of myPlans) {
        const friendStart = new Date(friendPlan.startDate);
        const friendEnd = friendPlan.endDate ? new Date(friendPlan.endDate) : friendStart;
        const myStart = new Date(myPlan.startDate);
        const myEnd = myPlan.endDate ? new Date(myPlan.endDate) : myStart;

        const { isNearby, overlap } = areDatesNearby(friendStart, friendEnd, myStart, myEnd, PROXIMITY_DAYS);
        const locationsMatch = areLocationsSimilar(friendPlan.location, myPlan.location);

        // Only create a match if dates are nearby (within +/- 3 days)
        if (isNearby) {
          let matchType: string;

          if (overlap && locationsMatch) {
            matchType = 'same_event'; // Same time, same place!
          } else if (overlap) {
            matchType = 'date_overlap'; // Same time, different place
          } else if (locationsMatch) {
            matchType = 'nearby_dates'; // Same place, dates within 3 days
          } else {
            matchType = 'potential'; // Dates within 3 days, different places
          }

          matches.push({
            friendPlan,
            myPlan,
            matchType,
          });

          // Create shared calendar event
          await prisma.sharedCalendarEvent.create({
            data: {
              title: `${friend.name}: ${friendPlan.title}`,
              location: friendPlan.location,
              startDate: friendPlan.startDate,
              endDate: friendPlan.endDate,
              participants: JSON.stringify([friend.id]),
              matchType,
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
