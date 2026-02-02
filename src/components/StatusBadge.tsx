'use client';

import { FriendStatus } from '@/lib/types';

const statusColors: Record<FriendStatus, string> = {
  'Not Contacted': 'bg-gray-100 text-gray-700',
  'Email Sent': 'bg-blue-100 text-blue-700',
  'Waiting for Reply': 'bg-yellow-100 text-yellow-700',
  'Dates Received': 'bg-green-100 text-green-700',
  'Match Found': 'bg-purple-100 text-purple-700',
  'Expressed Interest': 'bg-pink-100 text-pink-700',
};

interface StatusBadgeProps {
  status: FriendStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-700';
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${colorClass} ${sizeClass}`}>
      {status}
    </span>
  );
}
