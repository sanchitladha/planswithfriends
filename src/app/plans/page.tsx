'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import { MyPlan } from '@/lib/types';

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
  gmail: { label: 'Gmail', color: 'bg-red-100 text-red-700' },
  google_calendar: { label: 'Google Calendar', color: 'bg-blue-100 text-blue-700' },
};

export default function PlansPage() {
  const [plans, setPlans] = useState<MyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MyPlan | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    startDate: '',
    endDate: '',
    description: '',
    source: 'manual',
    confirmed: true,
  });

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = editingPlan
        ? await fetch(`/api/plans/${editingPlan.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          })
        : await fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to save plan'}`);
        return;
      }

      closeModal();
      fetchPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Error saving plan. Check console for details.');
    }
  };

  const handleEdit = (plan: MyPlan) => {
    setEditingPlan(plan);
    setFormData({
      title: plan.title,
      location: plan.location || '',
      startDate: new Date(plan.startDate).toISOString().split('T')[0],
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : '',
      description: plan.description || '',
      source: plan.source,
      confirmed: plan.confirmed,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await fetch(`/api/plans/${id}`, { method: 'DELETE' });
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingPlan(null);
    setFormData({
      title: '',
      location: '',
      startDate: '',
      endDate: '',
      description: '',
      source: 'manual',
      confirmed: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const confirmedPlans = plans.filter((p) => p.confirmed);
  const tentativePlans = plans.filter((p) => !p.confirmed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My 2026 Plans</h1>
          <p className="text-gray-600 mt-1">Your travel and event schedule</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Plan
        </button>
      </div>

      {/* Confirmed Plans */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Confirmed Plans ({confirmedPlans.length})
          </h2>
        </div>
        {confirmedPlans.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No confirmed plans yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {confirmedPlans.map((plan) => (
              <div key={plan.id} className="p-4 hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{plan.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${SOURCE_LABELS[plan.source]?.color || SOURCE_LABELS.manual.color}`}>
                        {SOURCE_LABELS[plan.source]?.label || 'Manual'}
                      </span>
                    </div>
                    {plan.location && (
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {plan.location}
                      </p>
                    )}
                    <p className="text-sm text-indigo-600 mt-1">
                      {formatDate(plan.startDate)}
                      {plan.endDate && ` - ${formatDate(plan.endDate)}`}
                    </p>
                    {plan.description && (
                      <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(plan)}
                      className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tentative Plans */}
      {tentativePlans.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              Tentative Plans ({tentativePlans.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {tentativePlans.map((plan) => (
              <div key={plan.id} className="p-4 hover:bg-gray-50 opacity-75">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{plan.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${SOURCE_LABELS[plan.source]?.color || SOURCE_LABELS.manual.color}`}>
                        {SOURCE_LABELS[plan.source]?.label || 'Manual'}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                        Tentative
                      </span>
                    </div>
                    {plan.location && (
                      <p className="text-sm text-gray-600 mt-1">{plan.location}</p>
                    )}
                    <p className="text-sm text-indigo-600 mt-1">
                      {formatDate(plan.startDate)}
                      {plan.endDate && ` - ${formatDate(plan.endDate)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(plan)}
                      className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
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

      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={editingPlan ? 'Edit Plan' : 'Add Plan'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="New York Trip"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="New York, NY"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Business trip with some sightseeing"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="manual">Manual</option>
                <option value="gmail">Gmail</option>
                <option value="google_calendar">Google Calendar</option>
              </select>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer mt-6">
                <input
                  type="checkbox"
                  checked={formData.confirmed}
                  onChange={(e) => setFormData({ ...formData, confirmed: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Confirmed</span>
              </label>
            </div>
          </div>
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
              {editingPlan ? 'Save Changes' : 'Add Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
