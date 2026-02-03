'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { Friend, FriendStatus, EmailDraft, GoogleAuthStatus } from '@/lib/types';

export default function Dashboard() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<EmailDraft | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', body: '' });
  const [showEmailModal, setShowEmailModal] = useState(false);
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
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/drafts');
      const data = await res.json();
      setDrafts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      setDrafts([]);
    }
  }, []);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/google/status');
      const data = await res.json();
      setGoogleStatus(data);
    } catch (error) {
      console.error('Error fetching Google status:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchFriends(), fetchDrafts(), fetchGoogleStatus()]).finally(() => {
      setLoading(false);
    });
  }, [fetchFriends, fetchDrafts, fetchGoogleStatus]);

  const handleSeedData = async () => {
    try {
      await fetch('/api/seed', { method: 'POST' });
      fetchFriends();
    } catch (error) {
      console.error('Error seeding data:', error);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start Google connection');
      }
    } catch (error) {
      console.error('Error connecting to Google:', error);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await fetch('/api/auth/google/status', { method: 'DELETE' });
      fetchGoogleStatus();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Calendar synced! Imported ${data.imported} events.`);
      } else {
        alert(data.error || 'Failed to sync calendar');
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleDraftOutreach = async () => {
    setCreatingDrafts(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createInGmail: googleStatus?.connected }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Created ${data.created} email draft(s) for review!`);
        fetchDrafts();
        fetchFriends();
      } else {
        alert(data.error || 'Failed to create drafts');
      }
    } catch (error) {
      console.error('Error creating drafts:', error);
    } finally {
      setCreatingDrafts(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.emails && data.emails.length > 0) {
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

  const handleEditDraft = (draft: EmailDraft) => {
    setEditingDraft(draft);
    setEditForm({ subject: draft.subject, body: draft.body });
  };

  const handleSaveDraft = async () => {
    if (!editingDraft) return;
    try {
      const res = await fetch(`/api/drafts/${editingDraft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        fetchDrafts();
        setEditingDraft(null);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const handleSendDraft = async (draftId: string) => {
    if (!googleStatus?.connected) {
      alert('Please connect your Google account first to send emails.');
      return;
    }
    setSendingDraft(draftId);
    try {
      const res = await fetch(`/api/drafts/${draftId}/send`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchDrafts();
        fetchFriends();
      } else {
        alert(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending draft:', error);
    } finally {
      setSendingDraft(null);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' });
      fetchDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const statusCounts = friends.reduce((acc, friend) => {
    const status = friend.status as FriendStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<FriendStatus, number>);

  const pendingDrafts = drafts.filter((d) => d.status === 'pending_review' || d.status === 'draft');

  // Get draft for a friend if exists
  const getDraftForFriend = (friendId: string) => {
    return drafts.find((d) => d.friendId === friendId && d.status !== 'sent');
  };

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
        <div className="flex gap-3 flex-wrap">
          {friends.length === 0 && (
            <button
              onClick={handleSeedData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Load Sample Data
            </button>
          )}
        </div>
      </div>

      {/* Google Connection Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${googleStatus?.connected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div>
              <p className="font-medium text-gray-900">
                {googleStatus?.connected ? `Connected as ${googleStatus.email}` : 'Google Account'}
              </p>
              <p className="text-sm text-gray-500">{googleStatus?.message || 'Connect to sync calendar and send emails'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {googleStatus?.connected ? (
              <>
                <button
                  onClick={handleSyncCalendar}
                  disabled={syncingCalendar}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {syncingCalendar ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Sync Calendar
                    </>
                  )}
                </button>
                <button
                  onClick={handleDisconnectGoogle}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={!googleStatus?.configured}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Connect Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Outreach Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Outreach Agent</h2>
            <p className="text-sm text-gray-500">Generate personalized emails for your friends</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDraftOutreach}
              disabled={creatingDrafts || friends.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {creatingDrafts ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating Drafts...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Draft Outreach
                </>
              )}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || friends.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
                  Quick Sync (Demo)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pending Drafts for Review */}
      {pendingDrafts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-yellow-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Review Drafts ({pendingDrafts.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">Review and edit these emails before sending</p>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingDrafts.map((draft) => (
              <div key={draft.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">{draft.friend?.name}</span>
                      <span className="text-sm text-gray-500">{draft.friend?.email}</span>
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        {draft.status === 'pending_review' ? 'Pending Review' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{draft.subject}</p>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{draft.body.substring(0, 150)}...</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEditDraft(draft)}
                      className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleSendDraft(draft.id)}
                      disabled={sendingDraft === draft.id || !googleStatus?.connected}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {sendingDraft === draft.id ? 'Sending...' : 'Confirm & Send'}
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(['Not Contacted', 'Email Sent', 'Waiting for Reply', 'Dates Received', 'Match Found', 'Expressed Interest'] as FriendStatus[]).map((status) => (
          <div key={status} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{statusCounts[status] || 0}</div>
            <StatusBadge status={status} size="sm" />
          </div>
        ))}
      </div>

      {/* Friends List with Email Preview */}
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
            {friends.map((friend) => {
              const draft = getDraftForFriend(friend.id);
              return (
                <div key={friend.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 font-medium">
                            {friend.name.split(' ').map((n) => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900">{friend.name}</h3>
                          <p className="text-sm text-gray-500">{friend.email || 'No email'}</p>
                        </div>
                      </div>

                      {/* Email Preview for friends with drafts or sent emails */}
                      {(draft || friend.lastEmailContent) && (
                        <div className="mt-3 ml-13 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-500">
                              {draft ? (draft.status === 'sent' ? 'Sent Email' : 'Draft Email') : 'Last Email Sent'}
                            </span>
                            {friend.lastEmailSent && (
                              <span className="text-xs text-gray-400">
                                {new Date(friend.lastEmailSent).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {draft ? draft.body.substring(0, 120) : friend.lastEmailContent?.substring(0, 120)}...
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Draft Modal */}
      <Modal
        isOpen={!!editingDraft}
        onClose={() => setEditingDraft(null)}
        title={`Edit Email to ${editingDraft?.friend?.name}`}
      >
        {editingDraft && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={editForm.body}
                onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingDraft(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Sync Email Modal (Demo) */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Sync Complete"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Emails have been generated and friends have been updated. Check the Friends Status cards for details.
          </p>
        </div>
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
