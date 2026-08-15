import React, { useState } from 'react';
import { planTrip } from '../api/tripApi';

export default function TripForm({ onSuccess, onError, isLoading, setIsLoading }) {
  const [formData, setFormData] = useState({
    current_location: 'Dallas, TX',
    pickup_location: 'Houston, TX',
    dropoff_location: 'Atlanta, GA',
    current_cycle_used: '12.5',
  });

  const [validationError, setValidationError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const loading = isLoading !== undefined ? isLoading : localLoading;
  const setLoading = setIsLoading || setLocalLoading;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationError) setValidationError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const { current_location, pickup_location, dropoff_location, current_cycle_used } = formData;

    // Client-side validations
    if (!current_location.trim() || !pickup_location.trim() || !dropoff_location.trim()) {
      setValidationError('All location fields are required.');
      return;
    }

    const cycleVal = parseFloat(current_cycle_used);
    if (isNaN(cycleVal) || cycleVal < 0 || cycleVal > 70) {
      setValidationError('Current cycle used must be a number between 0 and 70 hours.');
      return;
    }

    const payload = {
      current_location: current_location.trim(),
      pickup_location: pickup_location.trim(),
      dropoff_location: dropoff_location.trim(),
      current_cycle_used: cycleVal,
    };

    setLoading(true);
    if (onError) onError(null);

    try {
      const result = await planTrip(payload);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      if (onError) onError(err.message || 'Failed to plan trip.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-6 shadow-xl">
      <div className="flex items-center space-x-2 mb-4">
        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <h2 className="text-lg font-semibold text-white">Trip Parameters</h2>
      </div>

      {validationError && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-800/80 text-red-200 text-sm rounded-lg flex items-center space-x-2">
          <svg className="w-5 h-5 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="current_location" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Current Location
          </label>
          <input
            id="current_location"
            name="current_location"
            type="text"
            required
            value={formData.current_location}
            onChange={handleChange}
            placeholder="e.g. Dallas, TX"
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-sm"
          />
        </div>

        <div>
          <label htmlFor="pickup_location" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Pickup Location
          </label>
          <input
            id="pickup_location"
            name="pickup_location"
            type="text"
            required
            value={formData.pickup_location}
            onChange={handleChange}
            placeholder="e.g. Houston, TX"
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-sm"
          />
        </div>

        <div>
          <label htmlFor="dropoff_location" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Dropoff Location
          </label>
          <input
            id="dropoff_location"
            name="dropoff_location"
            type="text"
            required
            value={formData.dropoff_location}
            onChange={handleChange}
            placeholder="e.g. Atlanta, GA"
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-sm"
          />
        </div>

        <div>
          <label htmlFor="current_cycle_used" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Current Cycle Used (0–70 hrs)
          </label>
          <input
            id="current_cycle_used"
            name="current_cycle_used"
            type="number"
            min="0"
            max="70"
            step="0.5"
            required
            value={formData.current_cycle_used}
            onChange={handleChange}
            placeholder="0 - 70"
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-sm"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-500/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Planning Route & HOS...</span>
              </>
            ) : (
              <>
                <span>Calculate HOS Route</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
