import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const plans = await prisma.myPlan.findMany({
      include: {
        legs: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, location, startDate, endDate, description, source, confirmed, legs } = body;

    if (!title || !startDate) {
      return NextResponse.json({ error: 'Title and start date are required' }, { status: 400 });
    }

    const plan = await prisma.myPlan.create({
      data: {
        title,
        location: location || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description: description || null,
        source: source || 'manual',
        confirmed: confirmed !== undefined ? confirmed : true,
        legs: legs && legs.length > 0 ? {
          create: legs.map((leg: { location: string; startDate: string; endDate?: string; notes?: string }, index: number) => ({
            location: leg.location,
            startDate: new Date(leg.startDate),
            endDate: leg.endDate ? new Date(leg.endDate) : null,
            notes: leg.notes || null,
            order: index,
          })),
        } : undefined,
      },
      include: {
        legs: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
