import React, { useState } from 'react';
import { planTrip } from '../api/tripApi';

export default function TripForm({ onSuccess, onError, isLoading, setIsLoading }) {
  const [formData, setFormData] = useState({
    current_location: 'Dallas, TX',
    pickup_location: 'Houston, TX',
    dropoff_location: 'Atlanta, GA',
    current_cycle_used: '12.5',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [validationError, setValidationError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [showCycleTooltip, setShowCycleTooltip] = useState(false);

  const loading = isLoading !== undefined ? isLoading : localLoading;
  const setLoading = setIsLoading || setLocalLoading;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (validationError) setValidationError('');
  };

  const validateForm = () => {
    const errors = {};
    const { current_location, pickup_location, dropoff_location, current_cycle_used } = formData;

    if (!current_location.trim()) {
      errors.current_location = 'Please enter a current location.';
    }
    if (!pickup_location.trim()) {
      errors.pickup_location = 'Please enter a pickup location.';
    }
    if (!dropoff_location.trim()) {
      errors.dropoff_location = 'Please enter a dropoff location.';
    }

    // Pickup = Dropoff is not allowed (current = pickup IS allowed)
    if (
      pickup_location.trim() &&
      dropoff_location.trim() &&
      pickup_location.trim().toLowerCase() === dropoff_location.trim().toLowerCase()
    ) {
      errors.dropoff_location = 'Pickup and dropoff locations must be different.';
    }

    if (current_cycle_used === '' || current_cycle_used === null || current_cycle_used === undefined) {
      errors.current_cycle_used = 'Current cycle must be between 0 and 70 hours.';
    } else {
      const cycleVal = parseFloat(current_cycle_used);
      if (isNaN(cycleVal)) {
        errors.current_cycle_used = 'Current cycle must be between 0 and 70 hours.';
      } else if (cycleVal < 0 || cycleVal > 70) {
        errors.current_cycle_used = 'Current cycle must be between 0 and 70 hours.';
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // Clear previous trip results immediately on every new submission attempt.
    // This ensures stale results never persist alongside new validation or API errors.
    if (onSuccess) onSuccess(null);

    // Perform client-side field validation
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setValidationError('Please fix the highlighted input errors before submitting.');
      return;
    }

    setFieldErrors({});

    const payload = {
      current_location: formData.current_location.trim(),
      pickup_location: formData.pickup_location.trim(),
      dropoff_location: formData.dropoff_location.trim(),
      current_cycle_used: parseFloat(formData.current_cycle_used),
    };

    setLoading(true);
    if (onError) onError(null);

    try {
      const result = await planTrip(payload);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      // Surface a user-friendly message for geocoding/location errors
      const msg = err.message || 'Failed to plan trip.';
      const isLocationError =
        msg.includes('geocod') || msg.includes('Geocod') ||
        msg.includes('Could not') || msg.includes('location') ||
        msg.includes('422');
      if (onError) {
        onError(
          isLocationError
            ? 'Unable to find one or more locations. Please check the entered locations.'
            : msg
        );
      }
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

      {/* Top Validation Error Banner */}
      {validationError && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-800/80 text-red-200 text-sm rounded-lg flex items-center space-x-2 animate-fade-in">
          <svg className="w-5 h-5 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Location Field */}
        <div>
          <label htmlFor="current_location" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Current Location
          </label>
          <input
            id="current_location"
            name="current_location"
            type="text"
            value={formData.current_location}
            onChange={handleChange}
            placeholder="e.g. Dallas, TX"
            className={`w-full px-3 py-2 bg-slate-900/80 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none transition-colors text-sm ${
              fieldErrors.current_location
                ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
            }`}
          />
          {fieldErrors.current_location && (
            <p className="text-red-400 text-[11px] font-medium mt-1 flex items-center space-x-1">
              <span>⚠️ {fieldErrors.current_location}</span>
            </p>
          )}
        </div>

        {/* Pickup Location Field */}
        <div>
          <label htmlFor="pickup_location" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Pickup Location
          </label>
          <input
            id="pickup_location"
            name="pickup_location"
            type="text"
            value={formData.pickup_location}
            onChange={handleChange}
            placeholder="e.g. Houston, TX"
            className={`w-full px-3 py-2 bg-slate-900/80 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none transition-colors text-sm ${
              fieldErrors.pickup_location
                ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
            }`}
          />
          {fieldErrors.pickup_location && (
            <p className="text-red-400 text-[11px] font-medium mt-1 flex items-center space-x-1">
              <span>⚠️ {fieldErrors.pickup_location}</span>
            </p>
          )}
        </div>

        {/* Dropoff Location Field */}
        <div>
          <label htmlFor="dropoff_location" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Dropoff Location
          </label>
          <input
            id="dropoff_location"
            name="dropoff_location"
            type="text"
            value={formData.dropoff_location}
            onChange={handleChange}
            placeholder="e.g. Atlanta, GA"
            className={`w-full px-3 py-2 bg-slate-900/80 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none transition-colors text-sm ${
              fieldErrors.dropoff_location
                ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
            }`}
          />
          {fieldErrors.dropoff_location && (
            <p className="text-red-400 text-[11px] font-medium mt-1 flex items-center space-x-1">
              <span>⚠️ {fieldErrors.dropoff_location}</span>
            </p>
          )}
        </div>

        {/* Current Cycle Used Field */}
        <div>
          <label htmlFor="current_cycle_used" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            <span className="inline-flex items-center space-x-1.5">
              <span>Current Cycle Used (0–70 hrs)</span>
              <span
                className="relative cursor-help"
                onMouseEnter={() => setShowCycleTooltip(true)}
                onMouseLeave={() => setShowCycleTooltip(false)}
                onFocus={() => setShowCycleTooltip(true)}
                onBlur={() => setShowCycleTooltip(false)}
                tabIndex={0}
                role="button"
                aria-label="Info about current cycle used"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {showCycleTooltip && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-slate-700 border border-slate-600 text-xs text-slate-200 rounded-lg shadow-xl z-50 normal-case tracking-normal font-normal leading-relaxed pointer-events-none">
                    Hours already consumed in the driver's 70-hour cycle. The remaining cycle hours affect when a 34-hour restart is required.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-700"></span>
                  </span>
                )}
              </span>
            </span>
          </label>
          <input
            id="current_cycle_used"
            name="current_cycle_used"
            type="number"
            min="0"
            max="70"
            step="0.5"
            value={formData.current_cycle_used}
            onChange={handleChange}
            placeholder="0 - 70"
            className={`w-full px-3 py-2 bg-slate-900/80 border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none transition-colors text-sm ${
              fieldErrors.current_cycle_used
                ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                : 'border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
            }`}
          />
          {fieldErrors.current_cycle_used && (
            <p className="text-red-400 text-[11px] font-medium mt-1 flex items-center space-x-1">
              <span>⚠️ {fieldErrors.current_cycle_used}</span>
            </p>
          )}
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
