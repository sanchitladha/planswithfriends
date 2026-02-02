'use client';

import { useState, useEffect, useCallback } from 'react';
import { SharedCalendarEvent, Friend } from '@/lib/types';

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const MATCH_TYPE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  same_event: {
    label: 'Same Event',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'You and your friend are attending the same event!',
  },
  overlap: {
    label: 'Date Overlap',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Your travel dates overlap - potential meetup opportunity!',
  },
  nearby: {
    label: 'Nearby Location',
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Your friend will be in a nearby location.',
  },
};

export default function CalendarPage() {
  const [events, setEvents] = useState<SharedCalendarEvent[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, friendsRes] = await Promise.all([
        fetch('/api/calendar'),
        fetch('/api/friends'),
      ]);
      const [eventsData, friendsData] = await Promise.all([
        eventsRes.json(),
        friendsRes.json(),
      ]);
      setEvents(eventsData);
      setFriends(friendsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearCalendar = async () => {
    if (!confirm('Are you sure you want to clear all calendar events?')) return;
    try {
      await fetch('/api/calendar', { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error clearing calendar:', error);
    }
  };

  const getFriendNames = (participantsJson: string): string[] => {
    try {
      const participantIds: string[] = JSON.parse(participantsJson);
      return participantIds.map((id) => {
        const friend = friends.find((f) => f.id === id);
        return friend?.name || 'Unknown';
      });
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shared Calendar</h1>
          <p className="text-gray-600 mt-1">Potential meetups with friends based on overlapping plans</p>
        </div>
        {events.length > 0 && (
          <button
            onClick={clearCalendar}
            className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Match Types</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(MATCH_TYPE_LABELS).map(([key, { label, color, description }]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded-full ${color}`}>{label}</span>
              <span className="text-xs text-gray-500">{description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Events */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Upcoming Matches ({events.length})
          </h2>
        </div>
        {events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">No matches found yet</p>
            <p className="mt-2">
              Use the &quot;Sync with Friends&quot; button on the Dashboard, then simulate replies to discover potential meetups!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {events.map((event) => {
              const matchType = MATCH_TYPE_LABELS[event.matchType] || MATCH_TYPE_LABELS.overlap;
              const participantNames = getFriendNames(event.participants);

              return (
                <div key={event.id} className="p-4 hover:bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Date Badge */}
                    <div className="flex-shrink-0 w-20 text-center">
                      <div className="bg-indigo-100 rounded-lg p-2">
                        <div className="text-xs text-indigo-600 uppercase">
                          {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-2xl font-bold text-indigo-700">
                          {new Date(event.startDate).getDate()}
                        </div>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900">{event.title}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${matchType.color}`}>
                          {matchType.label}
                        </span>
                      </div>

                      {event.location && (
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {event.location}
                        </p>
                      )}

                      <p className="text-sm text-indigo-600 mt-1">
                        {formatDate(event.startDate)}
                        {event.endDate && ` - ${formatDate(event.endDate)}`}
                      </p>

                      {participantNames.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">With:</span>
                          <div className="flex flex-wrap gap-1">
                            {participantNames.map((name, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      <button className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                        Plan Meetup
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <h3 className="font-medium text-indigo-900 mb-2">How it works</h3>
        <ol className="text-sm text-indigo-800 space-y-1 list-decimal list-inside">
          <li>Add your 2026 plans on the My Plans page</li>
          <li>Add friends on the Friends page (make sure they have email addresses)</li>
          <li>Click &quot;Sync with Friends&quot; on the Dashboard to generate personalized outreach emails</li>
          <li>Use &quot;Simulate Reply&quot; to see how the app processes friend responses</li>
          <li>Matching events will appear here automatically!</li>
        </ol>
      </div>
    </div>
  );
}
