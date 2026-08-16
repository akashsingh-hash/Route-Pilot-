import React, { useState } from 'react';
import LogSheet from './LogSheet';

/**
 * LogSheetList.jsx — Container for multiple daily log sheets.
 * Renders tabbed navigation to switch between days or view all stacked.
 */
export default function LogSheetList({ dailyLogs = [], routeInfo = {} }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' or day number

  if (!dailyLogs || dailyLogs.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-8 text-center text-slate-400">
        <p className="text-sm">No daily log sheets generated yet.</p>
      </div>
    );
  }

  const logsToRender = activeTab === 'all'
    ? dailyLogs
    : dailyLogs.filter((log) => log.day === activeTab);

  return (
    <div className="space-y-6">
      {/* Header and Tab Navigation */}
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">FMCSA Daily Log Sheets</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generated {dailyLogs.length} day log sheet{dailyLogs.length === 1 ? '' : 's'} for this trip itinerary.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-lg border border-slate-700/60">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All Days (Stacked)
          </button>

          {dailyLogs.map((log) => (
            <button
              key={log.day}
              onClick={() => setActiveTab(log.day)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === log.day
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Day {log.day}
            </button>
          ))}
        </div>
      </div>

      {/* Rendered Log Sheets */}
      <div className="space-y-6">
        {logsToRender.map((log) => (
          <LogSheet key={log.day} log={log} routeInfo={routeInfo} />
        ))}
      </div>
    </div>
  );
}
