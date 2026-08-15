import React, { useState } from 'react';
import TripForm from './components/TripForm';
import RouteMap from './components/RouteMap';
import TripSummary from './components/TripSummary';
import LogSheetList from './components/LogSheetList';

export default function App() {
  const [tripResult, setTripResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSuccess = (result) => {
    setTripResult(result);
    setError(null);
  };

  const handleError = (errMsg) => {
    setError(errMsg);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">RoutePilot</h1>
              <p className="text-xs text-slate-400">FMCSA Hours-of-Service Trip Planner</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              HOS Log Sheets & Route Planner
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Form Section */}
        <section>
          <TripForm
            onSuccess={handleSuccess}
            onError={handleError}
            isLoading={loading}
            setIsLoading={setLoading}
          />
        </section>

        {/* Error Banner */}
        {error && (
          <section className="bg-red-950/90 border border-red-800 text-red-200 p-4 rounded-xl shadow-lg flex items-start space-x-3 animate-fade-in">
            <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-sm">
              <h4 className="font-semibold text-red-100">Trip Planning Error</h4>
              <p className="mt-1 text-red-300">{error}</p>
            </div>
          </section>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 text-center text-slate-400 animate-pulse">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3"></div>
            <p className="text-sm font-medium text-slate-300">Geocoding locations & calculating HOS compliant route...</p>
            <p className="text-xs text-slate-500 mt-1">This involves fetching coordinates, OSRM routing data, and executing HOS engine algorithms.</p>
          </div>
        )}

        {/* Route Results Section */}
        {tripResult && !loading && (
          <section className="space-y-8">
            {/* Trip Summary Card */}
            <TripSummary tripResult={tripResult} />

            {/* Route Map */}
            <RouteMap route={tripResult.route} />

            {/* Daily Log Sheets */}
            <LogSheetList dailyLogs={tripResult.daily_logs} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500 mt-auto">
        RoutePilot HOS Engine & Trip Planner &copy; {new Date().getFullYear()} — Built with React & Tailwind CSS
      </footer>
    </div>
  );
}
