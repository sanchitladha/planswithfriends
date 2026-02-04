'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import { MyPlan, TripLeg } from '@/lib/types';

interface LegFormData {
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
}

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

const emptyLeg: LegFormData = { location: '', startDate: '', endDate: '', notes: '' };

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
  const [legs, setLegs] = useState<LegFormData[]>([]);
  const [showLegs, setShowLegs] = useState(false);

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
      // Filter out empty legs
      const validLegs = legs.filter(leg => leg.location && leg.startDate);

      const payload = {
        ...formData,
        legs: validLegs.length > 0 ? validLegs : undefined,
      };

      const response = editingPlan
        ? await fetch(`/api/plans/${editingPlan.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

    // Load existing legs
    if (plan.legs && plan.legs.length > 0) {
      setLegs(plan.legs.map(leg => ({
        location: leg.location,
        startDate: new Date(leg.startDate).toISOString().split('T')[0],
        endDate: leg.endDate ? new Date(leg.endDate).toISOString().split('T')[0] : '',
        notes: leg.notes || '',
      })));
      setShowLegs(true);
    } else {
      setLegs([]);
      setShowLegs(false);
    }

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
    setLegs([]);
    setShowLegs(false);
  };

  const addLeg = () => {
    setLegs([...legs, { ...emptyLeg }]);
  };

  const updateLeg = (index: number, field: keyof LegFormData, value: string) => {
    const newLegs = [...legs];
    newLegs[index] = { ...newLegs[index], [field]: value };
    setLegs(newLegs);
  };

  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
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

  const renderPlanCard = (plan: MyPlan, isTentative = false) => (
    <div key={plan.id} className={`p-4 hover:bg-gray-50 ${isTentative ? 'opacity-75' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900">{plan.title}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${SOURCE_LABELS[plan.source]?.color || SOURCE_LABELS.manual.color}`}>
              {SOURCE_LABELS[plan.source]?.label || 'Manual'}
            </span>
            {isTentative && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                Tentative
              </span>
            )}
            {plan.legs && plan.legs.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                {plan.legs.length} stops
              </span>
            )}
          </div>

          {/* Show primary location if no legs, or show as "Main" */}
          {plan.location && (!plan.legs || plan.legs.length === 0) && (
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

          {/* Trip Legs */}
          {plan.legs && plan.legs.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 border-purple-200 pl-3">
              {plan.legs.map((leg, index) => (
                <div key={leg.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-700">{leg.location}</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-7">
                    {formatDate(leg.startDate)}
                    {leg.endDate && ` - ${formatDate(leg.endDate)}`}
                  </p>
                  {leg.notes && (
                    <p className="text-xs text-gray-400 ml-7">{leg.notes}</p>
                  )}
                </div>
              ))}
            </div>
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
  );

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
            {confirmedPlans.map((plan) => renderPlanCard(plan))}
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
            {tentativePlans.map((plan) => renderPlanCard(plan, true))}
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
              placeholder="Turkey - Albania - Sorrento Trip"
            />
          </div>

          {!showLegs && (
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {showLegs ? 'Trip Start *' : 'Start Date *'}
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {showLegs ? 'Trip End' : 'End Date'}
              </label>
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

          {/* Multi-leg toggle */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowLegs(!showLegs);
                if (!showLegs && legs.length === 0) {
                  addLeg();
                }
              }}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {showLegs ? 'Remove multiple stops' : 'Add multiple stops (multi-city trip)'}
            </button>
          </div>

          {/* Trip Legs */}
          {showLegs && (
            <div className="space-y-3 bg-purple-50 p-3 rounded-lg">
              <label className="block text-sm font-medium text-purple-700">Trip Stops</label>
              {legs.map((leg, index) => (
                <div key={index} className="bg-white p-3 rounded-lg border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-700">Stop {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeLeg(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Location (e.g., Istanbul)"
                    value={leg.location}
                    onChange={(e) => updateLeg(index, 'location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={leg.startDate}
                      onChange={(e) => updateLeg(index, 'startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <input
                      type="date"
                      value={leg.endDate}
                      onChange={(e) => updateLeg(index, 'endDate', e.target.value)}
                      placeholder="End date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={leg.notes}
                    onChange={(e) => updateLeg(index, 'notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addLeg}
                className="w-full py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm"
              >
                + Add Another Stop
              </button>
            </div>
          )}

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
