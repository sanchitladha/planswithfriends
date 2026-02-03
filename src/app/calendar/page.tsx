'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MyPlan } from '@/lib/types';

interface FriendPlan {
  id: string;
  friendId: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface FriendWithPlans {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  lastEmailSent: string | null;
  lastEmailContent: string | null;
  createdAt: string;
  updatedAt: string;
  plans: FriendPlan[];
}

interface CalculatedMatch {
  id: string;
  friendPlan: FriendPlan & { friendName: string };
  myPlan: MyPlan;
  matchType: string;
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

// Check if locations are similar
function areLocationsSimilar(loc1: string | null, loc2: string | null): boolean {
  if (!loc1 || !loc2) return false;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm1 = normalize(loc1);
  const norm2 = normalize(loc2);

  // Check if one contains the other or they share a city name
  const city1 = loc1.split(',')[0].toLowerCase().trim();
  const city2 = loc2.split(',')[0].toLowerCase().trim();

  return norm1.includes(norm2) || norm2.includes(norm1) || city1 === city2 ||
         city1.includes(city2) || city2.includes(city1);
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
};

const PROXIMITY_DAYS = 3;

export default function CalendarPage() {
  const [friends, setFriends] = useState<FriendWithPlans[]>([]);
  const [myPlans, setMyPlans] = useState<MyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [friendsRes, plansRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/plans'),
      ]);
      const [friendsData, plansData] = await Promise.all([
        friendsRes.json(),
        plansRes.json(),
      ]);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setMyPlans(Array.isArray(plansData) ? plansData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setFriends([]);
      setMyPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get all friend plans across all friends
  const allFriendPlans = useMemo(() => {
    return friends.flatMap((friend) =>
      (friend.plans || []).map((plan) => ({
        ...plan,
        friendName: friend.name,
      }))
    ).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [friends]);

  // Calculate matches dynamically
  const calculatedMatches = useMemo(() => {
    const matches: CalculatedMatch[] = [];
    const confirmedPlans = myPlans.filter(p => p.confirmed);

    for (const friendPlanWithName of allFriendPlans) {
      for (const myPlan of confirmedPlans) {
        const friendStart = new Date(friendPlanWithName.startDate);
        const friendEnd = friendPlanWithName.endDate ? new Date(friendPlanWithName.endDate) : friendStart;
        const myStart = new Date(myPlan.startDate);
        const myEnd = myPlan.endDate ? new Date(myPlan.endDate) : myStart;

        const { isNearby, overlap } = areDatesNearby(friendStart, friendEnd, myStart, myEnd, PROXIMITY_DAYS);
        const locationsMatch = areLocationsSimilar(friendPlanWithName.location, myPlan.location);

        // Only create a match if dates are nearby (within +/- 3 days)
        if (isNearby) {
          let matchType: string;

          if (overlap && locationsMatch) {
            matchType = 'same_event'; // Same time, same place!
          } else if (locationsMatch) {
            matchType = 'nearby_dates'; // Same place, dates within 3 days
          } else if (overlap) {
            matchType = 'date_overlap'; // Same time, different place
          } else {
            matchType = 'potential'; // Dates within 3 days, different places
          }

          matches.push({
            id: `${friendPlanWithName.id}-${myPlan.id}`,
            friendPlan: friendPlanWithName,
            myPlan,
            matchType,
          });
        }
      }
    }

    // Sort by match quality (same_event > nearby_dates > date_overlap > potential)
    const matchOrder = { same_event: 0, nearby_dates: 1, date_overlap: 2, potential: 3 };
    return matches.sort((a, b) => {
      const orderDiff = (matchOrder[a.matchType as keyof typeof matchOrder] || 4) -
                        (matchOrder[b.matchType as keyof typeof matchOrder] || 4);
      if (orderDiff !== 0) return orderDiff;
      return new Date(a.friendPlan.startDate).getTime() - new Date(b.friendPlan.startDate).getTime();
    });
  }, [allFriendPlans, myPlans]);

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

        {/* Right Column: Matches (Dynamically Calculated) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-green-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Matches ({calculatedMatches.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">Plans within +/- 3 days of yours (auto-detected)</p>
          </div>
          {calculatedMatches.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="font-medium">No matches found yet</p>
              <p className="text-sm mt-1">Matches appear when friends&apos; dates are within 3 days of yours</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {calculatedMatches.map((match) => {
                const matchType = MATCH_TYPE_LABELS[match.matchType] || MATCH_TYPE_LABELS.potential;

                return (
                  <div key={match.id} className="p-4 hover:bg-green-50/50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-12 text-center">
                        <div className="bg-green-100 rounded-lg p-1">
                          <div className="text-xs text-green-600 uppercase">
                            {new Date(match.friendPlan.startDate).toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          <div className="text-xl font-bold text-green-700">
                            {new Date(match.friendPlan.startDate).getDate()}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${matchType.color}`}>
                            {matchType.label}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                            {match.friendPlan.friendName}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mt-1">{match.friendPlan.title}</h3>
                        {match.friendPlan.location && (
                          <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {match.friendPlan.location}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateLong(match.friendPlan.startDate)}
                          {match.friendPlan.endDate && ` - ${formatDateLong(match.friendPlan.endDate)}`}
                        </p>

                        {/* Show which of my plans this matches */}
                        <div className="mt-2 p-2 bg-indigo-50 rounded text-xs">
                          <span className="text-indigo-600 font-medium">Matches your plan:</span>{' '}
                          <span className="text-indigo-800">{match.myPlan.title}</span>
                          {match.myPlan.location && <span className="text-indigo-600"> in {match.myPlan.location}</span>}
                          <span className="text-indigo-500">
                            {' '}({formatDate(match.myPlan.startDate)}
                            {match.myPlan.endDate && ` - ${formatDate(match.myPlan.endDate)}`})
                          </span>
                        </div>
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
        <h3 className="text-sm font-medium text-gray-700 mb-3">Match Types (sorted by quality)</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full border bg-green-100 text-green-700 border-green-300">Same Place & Time!</span>
            <span className="text-xs text-gray-500">Both at same location during overlapping dates</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full border bg-purple-100 text-purple-700 border-purple-300">Within 3 Days</span>
            <span className="text-xs text-gray-500">Same location, dates within 3 days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full border bg-blue-100 text-blue-700 border-blue-300">Dates Overlap</span>
            <span className="text-xs text-gray-500">Overlapping dates, different locations</span>
          </div>
        </div>
      </div>
    </div>
  );
}
