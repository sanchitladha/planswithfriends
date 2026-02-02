'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { Friend, FriendStatus, GeneratedEmail } from '@/lib/types';

export default function Dashboard() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<GeneratedEmail | null>(null);
  const [simulatingReply, setSimulatingReply] = useState<string | null>(null);
  const [replyModal, setReplyModal] = useState<{ show: boolean; content: string; friendName: string }>({
    show: false,
    content: '',
    friendName: '',
  });

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleSeedData = async () => {
    try {
      await fetch('/api/seed', { method: 'POST' });
      fetchFriends();
    } catch (error) {
      console.error('Error seeding data:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.emails && data.emails.length > 0) {
        setGeneratedEmails(data.emails);
        setShowEmailModal(true);
      } else if (data.error) {
        alert(data.error);
      } else {
        alert('No friends to sync with. Add friends with email addresses first!');
      }
      fetchFriends();
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateReply = async (friendId: string, friendName: string) => {
    setSimulatingReply(friendId);
    try {
      const res = await fetch('/api/simulate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      const data = await res.json();
      if (data.success) {
        setReplyModal({
          show: true,
          content: data.replyEmail,
          friendName,
        });
        fetchFriends();
      }
    } catch (error) {
      console.error('Error simulating reply:', error);
    } finally {
      setSimulatingReply(null);
    }
  };

  const statusCounts = friends.reduce((acc, friend) => {
    const status = friend.status as FriendStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<FriendStatus, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Coordinate your 2026 plans with friends</p>
        </div>
        <div className="flex gap-3">
          {friends.length === 0 && (
            <button
              onClick={handleSeedData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Load Sample Data
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || friends.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync with Friends
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(['Not Contacted', 'Email Sent', 'Waiting for Reply', 'Dates Received', 'Match Found', 'Expressed Interest'] as FriendStatus[]).map((status) => (
          <div key={status} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{statusCounts[status] || 0}</div>
            <StatusBadge status={status} size="sm" />
          </div>
        ))}
      </div>

      {/* Friends List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Friends Status</h2>
        </div>
        {friends.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No friends added yet.</p>
            <p className="mt-2">Click &quot;Load Sample Data&quot; to get started or add friends manually.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {friends.map((friend) => (
              <div key={friend.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-600 font-medium">
                        {friend.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{friend.name}</h3>
                      <p className="text-sm text-gray-500">{friend.email || 'No email'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={friend.status as FriendStatus} />
                  {(friend.status === 'Waiting for Reply' || friend.status === 'Email Sent') && (
                    <button
                      onClick={() => handleSimulateReply(friend.id, friend.name)}
                      disabled={simulatingReply === friend.id}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {simulatingReply === friend.id ? 'Simulating...' : 'Simulate Reply'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Emails Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Generated Emails"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {generatedEmails.length} personalized email(s) generated and marked as sent.
          </p>
          <div className="space-y-2">
            {generatedEmails.map((email) => (
              <button
                key={email.friendId}
                onClick={() => setSelectedEmail(email)}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="font-medium text-gray-900">{email.friendName}</div>
                <div className="text-sm text-gray-500 truncate">{email.subject}</div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Individual Email Modal */}
      <Modal
        isOpen={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        title={selectedEmail ? `Email to ${selectedEmail.friendName}` : ''}
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Subject</label>
              <p className="text-gray-900">{selectedEmail.subject}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Body</label>
              <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-sm text-gray-800 whitespace-pre-wrap font-sans">
                {selectedEmail.body}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Simulated Reply Modal */}
      <Modal
        isOpen={replyModal.show}
        onClose={() => setReplyModal({ show: false, content: '', friendName: '' })}
        title={`Reply from ${replyModal.friendName}`}
      >
        <div className="space-y-4">
          <p className="text-green-600 font-medium">
            Plans received and calendar updated!
          </p>
          <pre className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800 whitespace-pre-wrap font-sans">
            {replyModal.content}
          </pre>
        </div>
      </Modal>
    </div>
  );
}
