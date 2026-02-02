import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const SAMPLE_FRIENDS = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@email.com', phone: '+1 (555) 123-4567' },
  { name: 'Mike Chen', email: 'mike.chen@email.com', phone: '+1 (555) 234-5678' },
  { name: 'Emily Rodriguez', email: 'emily.r@email.com', phone: '+1 (555) 345-6789' },
  { name: 'David Kim', email: 'david.kim@email.com', phone: '+1 (555) 456-7890' },
  { name: 'Jessica Williams', email: 'jess.williams@email.com', phone: null },
  { name: 'Alex Thompson', email: 'alex.t@email.com', phone: '+1 (555) 567-8901' },
];

const SAMPLE_PLANS = [
  {
    title: 'New York Trip',
    location: 'New York, NY',
    startDate: new Date('2026-03-15'),
    endDate: new Date('2026-03-20'),
    description: 'Business trip with some sightseeing',
    source: 'google_calendar',
    confirmed: true,
  },
  {
    title: 'Amalfi Coast Wedding',
    location: 'Amalfi, Italy',
    startDate: new Date('2026-06-10'),
    endDate: new Date('2026-06-17'),
    description: 'College friend\'s destination wedding',
    source: 'gmail',
    confirmed: true,
  },
  {
    title: 'Eugene Trip',
    location: 'Eugene, OR',
    startDate: new Date('2026-04-25'),
    endDate: new Date('2026-04-28'),
    description: 'Visiting family',
    source: 'manual',
    confirmed: true,
  },
  {
    title: 'Coachella Weekend',
    location: 'Palm Springs, CA',
    startDate: new Date('2026-04-10'),
    endDate: new Date('2026-04-13'),
    description: 'Music festival with friends',
    source: 'manual',
    confirmed: true,
  },
  {
    title: 'Tokyo Adventure',
    location: 'Tokyo, Japan',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-14'),
    description: 'Two week exploration of Japan',
    source: 'gmail',
    confirmed: false,
  },
];

export async function POST() {
  try {
    // Clear existing data
    await prisma.sharedCalendarEvent.deleteMany({});
    await prisma.friendPlan.deleteMany({});
    await prisma.friend.deleteMany({});
    await prisma.myPlan.deleteMany({});

    // Create sample friends
    const createdFriends = await Promise.all(
      SAMPLE_FRIENDS.map((friend) =>
        prisma.friend.create({
          data: friend,
        })
      )
    );

    // Create sample plans
    const createdPlans = await Promise.all(
      SAMPLE_PLANS.map((plan) =>
        prisma.myPlan.create({
          data: plan,
        })
      )
    );

    return NextResponse.json({
      success: true,
      friends: createdFriends.length,
      plans: createdPlans.length,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
