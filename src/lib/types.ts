export type FriendStatus =
  | 'Not Contacted'
  | 'Email Sent'
  | 'Waiting for Reply'
  | 'Dates Received'
  | 'Match Found'
  | 'Expressed Interest';

export const FRIEND_STATUSES: FriendStatus[] = [
  'Not Contacted',
  'Email Sent',
  'Waiting for Reply',
  'Dates Received',
  'Match Found',
  'Expressed Interest',
];

export interface Friend {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: FriendStatus;
  lastEmailSent: Date | null;
  lastEmailContent: string | null;
  createdAt: Date;
  updatedAt: Date;
  plans?: FriendPlan[];
}

export interface FriendPlan {
  id: string;
  friendId: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyPlan {
  id: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  source: string;
  confirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedCalendarEvent {
  id: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  participants: string;
  matchType: string;
  createdAt: Date;
}

export interface GeneratedEmail {
  friendId: string;
  friendName: string;
  subject: string;
  body: string;
}
