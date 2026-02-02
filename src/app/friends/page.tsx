'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { Friend, FriendStatus, FRIEND_STATUSES } from '@/lib/types';

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', status: 'Not Contacted' as FriendStatus });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFriend) {
        await fetch(`/api/friends/${editingFriend.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/friends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setShowAddModal(false);
      setEditingFriend(null);
      setFormData({ name: '', email: '', phone: '', status: 'Not Contacted' });
      fetchFriends();
    } catch (error) {
      console.error('Error saving friend:', error);
    }
  };

  const handleEdit = (friend: Friend) => {
    setEditingFriend(friend);
    setFormData({
      name: friend.name,
      email: friend.email || '',
      phone: friend.phone || '',
      status: friend.status as FriendStatus,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this friend?')) return;
    try {
      await fetch(`/api/friends/${id}`, { method: 'DELETE' });
      fetchFriends();
    } catch (error) {
      console.error('Error deleting friend:', error);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingFriend(null);
    setFormData({ name: '', email: '', phone: '', status: 'Not Contacted' });
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
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <p className="text-gray-600 mt-1">Manage your friends list</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Friend
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {friends.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No friends added yet.</p>
            <p className="mt-2">Click &quot;Add Friend&quot; to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Plans</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {friends.map((friend) => (
                  <tr key={friend.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 text-sm font-medium">
                            {friend.name.split(' ').map((n) => n[0]).join('')}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{friend.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{friend.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{friend.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={friend.status as FriendStatus} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {friend.plans?.length || 0} plan(s)
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(friend)}
                        className="text-indigo-600 hover:text-indigo-800 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(friend.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={editingFriend ? 'Edit Friend' : 'Add Friend'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          {editingFriend && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as FriendStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {FRIEND_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {editingFriend ? 'Save Changes' : 'Add Friend'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
