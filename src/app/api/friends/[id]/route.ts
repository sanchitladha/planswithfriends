import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const friend = await prisma.friend.findUnique({
      where: { id },
      include: {
        plans: true,
      },
    });

    if (!friend) {
      return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
    }

    return NextResponse.json(friend);
  } catch (error) {
    console.error('Error fetching friend:', error);
    return NextResponse.json({ error: 'Failed to fetch friend' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, status } = body;

    const friend = await prisma.friend.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(status && { status }),
      },
    });

    return NextResponse.json(friend);
  } catch (error) {
    console.error('Error updating friend:', error);
    return NextResponse.json({ error: 'Failed to update friend' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.friend.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting friend:', error);
    return NextResponse.json({ error: 'Failed to delete friend' }, { status: 500 });
  }
}
