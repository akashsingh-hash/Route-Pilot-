import React from 'react';

/**
 * TripSummary.jsx — Summary card displaying high-level trip metrics:
 * - Total distance (miles)
 * - Total driving hours
 * - Number of days
 * - Number of stops
 * - Any HOS compliance warnings
 */
export default function TripSummary({ tripResult }) {
  if (!tripResult || !tripResult.route) return null;

  const { route, daily_logs = [], warnings = [] } = tripResult;
  const totalDistance = route.total_distance_miles?.toFixed(1) || '0.0';
  const totalDrivingHours = route.total_driving_hours?.toFixed(1) || '0.0';
  const numDays = daily_logs.length;
  const numStops = route.stops?.length || 0;

  return (
    <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">Trip Summary</h2>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {numDays} Day Itinerary
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1: Distance */}
        <div className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Distance</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{totalDistance}</span>
            <span className="text-xs text-indigo-400 font-semibold">mi</span>
          </div>
        </div>

        {/* Metric 2: Driving Time */}
        <div className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Driving</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{totalDrivingHours}</span>
            <span className="text-xs text-indigo-400 font-semibold">hrs</span>
          </div>
        </div>

        {/* Metric 3: Days */}
        <div className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Trip Duration</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{numDays}</span>
            <span className="text-xs text-indigo-400 font-semibold">day{numDays === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Metric 4: Stops */}
        <div className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Stops</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{numStops}</span>
            <span className="text-xs text-indigo-400 font-semibold">stop{numStops === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Warnings List */}
      {warnings && warnings.length > 0 && (
        <div className="bg-amber-950/80 border border-amber-800/80 rounded-lg p-3 text-xs text-amber-200 space-y-1">
          <div className="font-semibold text-amber-300 flex items-center space-x-1.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>HOS Compliance Warnings ({warnings.length})</span>
          </div>
          <ul className="list-disc list-inside pl-4 text-amber-300/90 space-y-0.5">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
