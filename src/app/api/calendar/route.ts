import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const events = await prisma.sharedCalendarEvent.findMany({
      orderBy: {
        startDate: 'asc',
      },
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.sharedCalendarEvent.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing calendar:', error);
    return NextResponse.json({ error: 'Failed to clear calendar' }, { status: 500 });
  }
}
