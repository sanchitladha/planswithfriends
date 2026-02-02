import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const friends = await prisma.friend.findMany({
      include: {
        plans: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const friend = await prisma.friend.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
      },
    });

    return NextResponse.json(friend, { status: 201 });
  } catch (error) {
    console.error('Error creating friend:', error);
    return NextResponse.json({ error: 'Failed to create friend' }, { status: 500 });
  }
}
