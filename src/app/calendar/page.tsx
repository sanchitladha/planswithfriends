'use client';

import { useState, useEffect, useCallback } from 'react';
import { SharedCalendarEvent, Friend, MyPlan } from '@/lib/types';

interface FriendPlan {
  id: string;
  friendId: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  source: string;
}

interface FriendWithPlans extends Friend {
  plans: FriendPlan[];
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLong(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const MATCH_TYPE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  same_event: {
    label: 'Same Place & Time!',
    color: 'bg-green-100 text-green-700 border-green-300',
    description: 'You\'ll both be there at the same time!',
  },
  date_overlap: {
    label: 'Dates Overlap',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    description: 'Same dates, different locations',
  },
  nearby_dates: {
    label: 'Within 3 Days',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    description: 'Same location, dates within 3 days',
  },
  potential: {
    label: 'Potential',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    description: 'Dates within 3 days',
  },
  overlap: {
    label: 'Date Overlap',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    description: 'Your travel dates overlap',
  },
  nearby: {
    label: 'Nearby',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    description: 'Nearby location match',
  },
};

export default function CalendarPage() {
  const [events, setEvents] = useState<SharedCalendarEvent[]>([]);
  const [friends, setFriends] = useState<FriendWithPlans[]>([]);
  const [myPlans, setMyPlans] = useState<MyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, friendsRes, plansRes] = await Promise.all([
        fetch('/api/calendar'),
        fetch('/api/friends'),
        fetch('/api/plans'),
      ]);
      const [eventsData, friendsData, plansData] = await Promise.all([
        eventsRes.json(),
        friendsRes.json(),
        plansRes.json(),
      ]);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setMyPlans(Array.isArray(plansData) ? plansData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setEvents([]);
      setFriends([]);
      setMyPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearCalendar = async () => {
    if (!confirm('Are you sure you want to clear all matches?')) return;
    try {
      await fetch('/api/calendar', { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error clearing calendar:', error);
    }
  };

  // Get all friend plans across all friends
  const allFriendPlans = friends.flatMap((friend) =>
    (friend.plans || []).map((plan) => ({
      ...plan,
      friendName: friend.name,
      friendId: friend.id,
    }))
  ).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Find my plan that matches a calendar event (for showing context)
  const findMyPlanForEvent = (event: SharedCalendarEvent) => {
    // Look for a my plan that's within 3 days of this event
    const eventStart = new Date(event.startDate);
    const msPerDay = 24 * 60 * 60 * 1000;

    return myPlans.find((plan) => {
      const planStart = new Date(plan.startDate);
      const planEnd = plan.endDate ? new Date(plan.endDate) : planStart;
      const daysDiff = Math.abs(eventStart.getTime() - planStart.getTime()) / msPerDay;
      return daysDiff <= 7; // Show if within a week
    });
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
          <p className="text-gray-600 mt-1">View friends&apos; plans and find overlap opportunities</p>
        </div>
        {events.length > 0 && (
          <button
            onClick={clearCalendar}
            className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            Clear Matches
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: All Friends' Plans */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Friends&apos; Plans ({allFriendPlans.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">All plans from your friends</p>
          </div>
          {allFriendPlans.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="font-medium">No friend plans yet</p>
              <p className="text-sm mt-1">Use &quot;Simulate Reply&quot; on the Dashboard to add friend plans</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {allFriendPlans.map((plan) => (
                <div key={plan.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 text-center">
                      <div className="text-xs text-gray-500 uppercase">
                        {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="text-xl font-bold text-gray-700">
                        {new Date(plan.startDate).getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                          {plan.friendName}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 mt-1">{plan.title}</h3>
                      {plan.location && (
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {plan.location}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(plan.startDate)}
                        {plan.endDate && ` - ${formatDate(plan.endDate)}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Matches */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-green-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Matches ({events.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">Plans within +/- 3 days of yours</p>
          </div>
          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="font-medium">No matches found yet</p>
              <p className="text-sm mt-1">Matches appear when friends&apos; dates are within 3 days of yours</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {events.map((event) => {
                const matchType = MATCH_TYPE_LABELS[event.matchType] || MATCH_TYPE_LABELS.potential;
                const myPlan = findMyPlanForEvent(event);

                return (
                  <div key={event.id} className="p-4 hover:bg-green-50/50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-12 text-center">
                        <div className="bg-green-100 rounded-lg p-1">
                          <div className="text-xs text-green-600 uppercase">
                            {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          <div className="text-xl font-bold text-green-700">
                            {new Date(event.startDate).getDate()}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${matchType.color}`}>
                            {matchType.label}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mt-1">{event.title}</h3>
                        {event.location && (
                          <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {event.location}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateLong(event.startDate)}
                          {event.endDate && ` - ${formatDateLong(event.endDate)}`}
                        </p>

                        {/* Show which of my plans this relates to */}
                        {myPlan && (
                          <div className="mt-2 p-2 bg-indigo-50 rounded text-xs">
                            <span className="text-indigo-600 font-medium">Your plan:</span>{' '}
                            <span className="text-indigo-800">{myPlan.title}</span>
                            {myPlan.location && <span className="text-indigo-600"> in {myPlan.location}</span>}
                            <span className="text-indigo-500">
                              {' '}({formatDate(myPlan.startDate)}
                              {myPlan.endDate && ` - ${formatDate(myPlan.endDate)}`})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* My Plans Reference */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <h3 className="font-medium text-indigo-900 mb-3">Your 2026 Plans (for reference)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {myPlans.filter(p => p.confirmed).map((plan) => (
            <div key={plan.id} className="bg-white p-3 rounded-lg shadow-sm">
              <h4 className="font-medium text-gray-900">{plan.title}</h4>
              {plan.location && <p className="text-sm text-gray-600">{plan.location}</p>}
              <p className="text-xs text-indigo-600 mt-1">
                {formatDate(plan.startDate)}
                {plan.endDate && ` - ${formatDate(plan.endDate)}`}
              </p>
            </div>
          ))}
          {myPlans.filter(p => p.confirmed).length === 0 && (
            <p className="text-sm text-indigo-700 col-span-full">No confirmed plans yet. Add plans on the My Plans page.</p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Match Types</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full border bg-green-100 text-green-700 border-green-300">Same Place & Time!</span>
            <span className="text-xs text-gray-500">Both at same location during same dates</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full border bg-purple-100 text-purple-700 border-purple-300">Within 3 Days</span>
            <span className="text-xs text-gray-500">Same location, dates within 3 days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full border bg-blue-100 text-blue-700 border-blue-300">Dates Overlap</span>
            <span className="text-xs text-gray-500">Same dates, different locations</span>
          </div>
        </div>
      </div>
    </div>
  );
}
