import { NextResponse } from 'next/server';
import { getCalendarClient } from '@/lib/google';
import prisma from '@/lib/prisma';

// Keywords to look for in calendar events
const TRAVEL_KEYWORDS = [
  'flight', 'fly', 'airline', 'airport',
  'hotel', 'airbnb', 'vrbo', 'booking', 'reservation',
  'trip', 'travel', 'vacation', 'holiday',
  'concert', 'festival', 'show', 'event', 'conference',
  'wedding', 'birthday', 'reunion',
];

// Check if an event title/description contains travel-related keywords
function isTravelEvent(title: string, description?: string): boolean {
  const text = `${title} ${description || ''}`.toLowerCase();
  return TRAVEL_KEYWORDS.some(keyword => text.includes(keyword));
}

// Extract location from event
function extractLocation(event: { location?: string | null; summary?: string | null }): string | null {
  if (event.location) return event.location;

  // Try to extract location from title (e.g., "Flight to NYC" -> "NYC")
  const title = event.summary || '';
  const toMatch = title.match(/(?:to|in|at)\s+([A-Z][A-Za-z\s,]+)/i);
  if (toMatch) return toMatch[1].trim();

  return null;
}

// Determine source type based on event content
function determineSource(title: string, description?: string): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  if (text.includes('flight') || text.includes('airline') || text.includes('airport')) {
    return 'google_calendar_flight';
  }
  if (text.includes('hotel') || text.includes('airbnb') || text.includes('booking')) {
    return 'google_calendar_hotel';
  }
  if (text.includes('concert') || text.includes('festival') || text.includes('show')) {
    return 'google_calendar_event';
  }
  return 'google_calendar';
}

// POST /api/calendar/sync - Sync events from Google Calendar
export async function POST() {
  try {
    // Get stored auth
    const auth = await prisma.googleAuth.findUnique({
      where: { id: 'default' },
    });

    if (!auth) {
      return NextResponse.json({
        error: 'Not connected to Google',
        message: 'Please connect your Google account first',
      }, { status: 401 });
    }

    const calendar = getCalendarClient(auth.accessToken, auth.refreshToken || undefined);

    // Fetch events for 2026
    const startOf2026 = new Date('2026-01-01T00:00:00Z');
    const endOf2026 = new Date('2026-12-31T23:59:59Z');

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOf2026.toISOString(),
      timeMax: endOf2026.toISOString(),
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Filter for travel-related events
    const travelEvents = events.filter(event =>
      event.summary && isTravelEvent(event.summary, event.description || undefined)
    );

    // Import events to MyPlan table
    const imported = [];
    const skipped = [];

    for (const event of travelEvents) {
      if (!event.summary || !event.start) continue;

      const startDate = event.start.dateTime || event.start.date;
      const endDate = event.end?.dateTime || event.end?.date;

      if (!startDate) continue;

      // Check if already imported (by title and date)
      const existing = await prisma.myPlan.findFirst({
        where: {
          title: event.summary,
          startDate: new Date(startDate),
          source: { startsWith: 'google_calendar' },
        },
      });

      if (existing) {
        skipped.push(event.summary);
        continue;
      }

      // Create new plan
      const plan = await prisma.myPlan.create({
        data: {
          title: event.summary,
          location: extractLocation(event),
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          description: event.description || null,
          source: determineSource(event.summary, event.description || undefined),
          confirmed: true,
        },
      });

      imported.push(plan);
    }

    return NextResponse.json({
      success: true,
      totalEvents: events.length,
      travelEvents: travelEvents.length,
      imported: imported.length,
      skipped: skipped.length,
      importedPlans: imported,
      skippedTitles: skipped,
    });
  } catch (error) {
    console.error('Error syncing calendar:', error);

    // Check for auth errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token')) {
      // Token expired or revoked
      await prisma.googleAuth.deleteMany({});
      return NextResponse.json({
        error: 'Authentication expired',
        message: 'Please reconnect your Google account',
      }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to sync calendar' }, { status: 500 });
  }
}
