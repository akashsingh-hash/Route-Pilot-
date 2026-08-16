import React from 'react';

/**
 * LogSheet.jsx — SVG Renderer for standard FMCSA Driver's Daily Log Grid.
 * Features a sticky left column for duty status row labels so labels remain
 * pinned while scrolling horizontally across the 24-hour timeline.
 */
export default function LogSheet({ log, routeInfo = {} }) {
  if (!log) return null;

  const { day, date_label, segments = [], totals = {}, digital_total = 0 } = log;

  // Compute FMCSA Header values
  const totalDriving = routeInfo.total_driving_hours || 0;
  const totalDistance = routeInfo.total_distance_miles || 0;
  const avgMph = totalDriving > 0 ? (totalDistance / totalDriving) : 0;
  const milesDrivingToday = (totals.driving ? (totals.driving * avgMph) : 0).toFixed(1);

  const stops = routeInfo.stops || [];
  const pickupStop = stops.find((s) => s.type === 'pickup') || stops[0];
  const dropoffStop = stops.find((s) => s.type === 'dropoff') || stops[stops.length - 1];

  const fromLocation = pickupStop?.location || 'N/A';
  const toLocation = dropoffStop?.location || 'N/A';

  // Grid Layout Constants inside SVG (Right side scrollable canvas)
  const MARGIN_LEFT = 15;     // Small inner padding from left SVG border
  const GRID_WIDTH = 600;     // 24 hours => 25px per hour
  const MARGIN_RIGHT = 160;   // Space for row totals & digital badge
  const SVG_WIDTH = MARGIN_LEFT + GRID_WIDTH + MARGIN_RIGHT; // 775px total SVG canvas width
  const SVG_HEIGHT = 300;     // Compact height without extra vertical padding

  const GRID_TOP = 45;        // Top margin for hour labels
  const ROW_HEIGHT = 38;      // Height per duty status row
  const GRID_HEIGHT = ROW_HEIGHT * 4; // 152px total grid height

  const STATUS_CONFIG = [
    { key: 'off_duty', label: '1. OFF DUTY', rowIdx: 0, color: '#94a3b8' },
    { key: 'sleeper_berth', label: '2. SLEEPER BERTH', rowIdx: 1, color: '#a855f7' },
    { key: 'driving', label: '3. DRIVING', rowIdx: 2, color: '#38bdf8' },
    { key: 'on_duty_not_driving', label: '4. ON DUTY (NOT DRIVING)', rowIdx: 3, color: '#f59e0b' },
  ];

  const STATUS_ROW_MAP = {
    off_duty: 0,
    sleeper_berth: 1,
    driving: 2,
    on_duty_not_driving: 3,
  };

  // Convert decimal hour (0-24) to X coordinate on SVG grid
  const getX = (hour) => MARGIN_LEFT + (hour / 24.0) * GRID_WIDTH;

  // Get Y coordinate for center of row
  const getY = (rowIdx) => GRID_TOP + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

  // Hour label formatter: M, 1, 2 ... N ... M
  const getHourLabel = (h) => {
    if (h === 0 || h === 24) return 'M';
    if (h === 12) return 'N';
    return (h % 12).toString();
  };

  // Format decimal hours to HH:MM string for remarks
  const formatTime = (decimalHours) => {
    const totalMinutes = Math.round(decimalHours * 60);
    const hrs = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-6 shadow-2xl">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs sm:text-sm rounded-md">
            {date_label || `Day ${day}`}
          </span>
          <h3 className="text-sm sm:text-base font-semibold text-slate-200">Driver's Daily Log (24 Hours)</h3>
        </div>

        {/* Digital Total Badge */}
        <div className="flex items-center space-x-2.5">
          <span className="text-[11px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">Total On-Duty:</span>
          <div className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1 rounded-full border border-indigo-500/50">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center border-2 border-indigo-400 shadow-md">
              {digital_total.toFixed(1)}
            </div>
            <span className="text-xs text-indigo-300 font-medium">hrs</span>
          </div>
        </div>
      </div>

      {/* FMCSA Official Header Fields Block */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 sm:p-3.5 mb-4 text-xs">
        {/* Row 1: trip + vehicle identity fields */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 mb-2.5">
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              Date (Relative Day)
            </span>
            <span className="text-slate-200 font-medium">{date_label || `Day ${day}`}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              Miles Driving Today
            </span>
            <span className="text-slate-200 font-mono font-semibold">{milesDrivingToday} mi</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              From (Pickup)
            </span>
            <span className="text-slate-200 font-medium truncate block" title={fromLocation}>
              {fromLocation}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              To (Dropoff)
            </span>
            <span className="text-slate-200 font-medium truncate block" title={toLocation}>
              {toLocation}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              Carrier Name
            </span>
            <span className="text-slate-400 italic text-[11px] sm:text-xs">RoutePilot Demo Carrier</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              Truck / Tractor #
            </span>
            <span className="text-slate-400 italic text-[11px] sm:text-xs">Not collected in MVP</span>
          </div>
        </div>

        {/* Row 2: carrier address fields (FMCSA § 395.8 required) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-2.5 border-t border-slate-800/60">
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              Main Office Address
            </span>
            <span className="text-slate-400 italic text-[11px] sm:text-xs">Not collected in MVP</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
              Home Terminal Address
            </span>
            <span className="text-slate-400 italic text-[11px] sm:text-xs">Not collected in MVP</span>
          </div>
        </div>
      </div>

      {/* ── Log Grid Layout: Sticky Left Row Labels + Scrollable Timeline Canvas ── */}
      <div className="relative flex border border-slate-800/80 rounded-xl bg-slate-950 my-4 shadow-inner">
        {/* Pinned Sticky Left Column for Row Status Labels */}
        <div className="sticky left-0 z-20 bg-slate-950/95 backdrop-blur-sm border-r border-slate-800 flex flex-col shrink-0 select-none shadow-md" style={{ width: '150px' }}>
          {/* Top Header Placeholder */}
          <div className="h-[45px] border-b border-slate-800 flex items-center justify-end pr-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
          </div>

          {/* 4 Duty Status Row Labels */}
          {STATUS_CONFIG.map((status) => (
            <div key={status.key} className="h-[38px] flex items-center justify-end pr-3 border-b border-slate-800/40 last:border-b-0">
              <span className="text-[11px] font-bold tracking-tight" style={{ color: status.color }}>
                {status.label}
              </span>
            </div>
          ))}

          {/* Remarks Row Label */}
          <div className="h-[65px] border-t border-slate-800 flex items-start justify-end pr-3 pt-3">
            <span className="text-[11px] font-bold text-slate-400">REMARKS:</span>
          </div>
        </div>

        {/* Horizontally Scrollable Timeline Grid Container */}
        <div className="flex-1 overflow-x-auto">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-auto min-w-[680px] select-none"
            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          >
            {/* Background Grid Container */}
            <rect
              x={MARGIN_LEFT}
              y={GRID_TOP}
              width={GRID_WIDTH}
              height={GRID_HEIGHT}
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="1.5"
            />

            {/* Row Background Banding */}
            {STATUS_CONFIG.map((status) => {
              const rowYTop = GRID_TOP + status.rowIdx * ROW_HEIGHT;
              const isEven = status.rowIdx % 2 === 0;

              return (
                <g key={status.key}>
                  {/* Row Alternating Background */}
                  <rect
                    x={MARGIN_LEFT}
                    y={rowYTop}
                    width={GRID_WIDTH}
                    height={ROW_HEIGHT}
                    fill={isEven ? '#0f172a' : '#1e293b'}
                    opacity="0.6"
                  />

                  {/* Horizontal Row Divider Line */}
                  {status.rowIdx > 0 && (
                    <line
                      x1={MARGIN_LEFT}
                      y1={rowYTop}
                      x2={MARGIN_LEFT + GRID_WIDTH}
                      y2={rowYTop}
                      stroke="#334155"
                      strokeWidth="1"
                    />
                  )}

                  {/* Row Total (Right Side) */}
                  <g transform={`translate(${MARGIN_LEFT + GRID_WIDTH + 20}, ${rowYTop + ROW_HEIGHT / 2 + 4})`}>
                    <text fill="#cbd5e1" fontSize="12" fontWeight="600" textAnchor="start">
                      {(totals[status.key] || 0).toFixed(1)} <tspan fill="#64748b" fontSize="10">hrs</tspan>
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Vertical Time Grid Ticks & Hour Labels */}
            {Array.from({ length: 25 }).map((_, h) => {
              const x = getX(h);
              const isMidnight = h === 0 || h === 24 || h === 12;

              return (
                <g key={h}>
                  {/* Full Vertical Line for Hourly Divisions */}
                  <line
                    x1={x}
                    y1={GRID_TOP}
                    x2={x}
                    y2={GRID_TOP + GRID_HEIGHT}
                    stroke={isMidnight ? '#64748b' : '#334155'}
                    strokeWidth={isMidnight ? '1.5' : '1'}
                    strokeDasharray={isMidnight ? 'none' : '2,2'}
                  />

                  {/* Hour Label above Grid */}
                  <text
                    x={x}
                    y={GRID_TOP - 10}
                    textAnchor="middle"
                    fill={isMidnight ? '#38bdf8' : '#94a3b8'}
                    fontSize="11"
                    fontWeight={isMidnight ? '700' : '500'}
                  >
                    {getHourLabel(h)}
                  </text>

                  {/* Sub-hour Ticks (15, 30, 45 min) */}
                  {h < 24 && (
                    <>
                      <line
                        x1={getX(h + 0.25)}
                        y1={GRID_TOP}
                        x2={getX(h + 0.25)}
                        y2={GRID_TOP + GRID_HEIGHT}
                        stroke="#1e293b"
                        strokeWidth="0.5"
                      />
                      <line
                        x1={getX(h + 0.5)}
                        y1={GRID_TOP}
                        x2={getX(h + 0.5)}
                        y2={GRID_TOP + GRID_HEIGHT}
                        stroke="#334155"
                        strokeWidth="0.75"
                        strokeDasharray="1,3"
                      />
                      <line
                        x1={getX(h + 0.75)}
                        y1={GRID_TOP}
                        x2={getX(h + 0.75)}
                        y2={GRID_TOP + GRID_HEIGHT}
                        stroke="#1e293b"
                        strokeWidth="0.5"
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* ── Stepped Duty-Status Log Lines & Connectors ── */}
            <g id="duty-log-lines">
              {segments.map((seg, idx) => {
                const rowIdx = STATUS_ROW_MAP[seg.status] ?? 0;
                const x1 = getX(seg.start_hour);
                const x2 = getX(seg.end_hour);
                const y = getY(rowIdx);

                const nextSeg = segments[idx + 1];
                const nextRowIdx = nextSeg ? (STATUS_ROW_MAP[nextSeg.status] ?? rowIdx) : null;
                const nextY = nextRowIdx !== null ? getY(nextRowIdx) : null;

                const color = STATUS_CONFIG[rowIdx]?.color || '#38bdf8';
                const isStationary = seg.status === 'on_duty_not_driving' ||
                                    (seg.label && /pickup|dropoff|fuel|break/i.test(seg.label));

                return (
                  <g key={idx}>
                    {/* Horizontal Status Line */}
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2}
                      y2={y}
                      stroke={color}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Transition Start Dot */}
                    <circle
                      cx={x1}
                      cy={y}
                      r="4"
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth="2"
                    />

                    {/* Transition End Dot */}
                    <circle
                      cx={x2}
                      cy={y}
                      r="4"
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth="2"
                    />

                    {/* Vertical Connector Line to Next Status */}
                    {nextY !== null && nextY !== y && (
                      <line
                        x1={x2}
                        y1={y}
                        x2={x2}
                        y2={nextY}
                        stroke="#e2e8f0"
                        strokeWidth="2.5"
                        strokeDasharray="none"
                      />
                    )}

                    {/* Stationary Bracket Notation [ ] for Dock/Wait/Break periods */}
                    {isStationary && x2 - x1 > 8 && (
                      <g fill="none" stroke="#f59e0b" strokeWidth="1.5">
                        <path d={`M ${x1 + 3} ${y - 12} L ${x1} ${y - 12} L ${x1} ${y + 12} L ${x1 + 3} ${y + 12}`} />
                        <path d={`M ${x2 - 3} ${y - 12} L ${x2} ${y - 12} L ${x2} ${y + 12} L ${x2 - 3} ${y + 12}`} />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Circled Digital Total Graphic (Right Side Display) */}
            <g transform={`translate(${MARGIN_LEFT + GRID_WIDTH + 95}, ${GRID_TOP + 35})`}>
              <circle cx="20" cy="20" r="22" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2.5" />
              <text x="20" y="24" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="800">
                {digital_total.toFixed(1)}
              </text>
              <text x="20" y="-8" textAnchor="middle" fill="#818cf8" fontSize="9" fontWeight="700" letterSpacing="0.5">
                DIGITAL TOTAL
              </text>
              <text x="20" y="52" textAnchor="middle" fill="#94a3b8" fontSize="9">
                (ON DUTY HRS)
              </text>
            </g>

            {/* ── Remarks Baseline & Numbered Timeline Ticks ── */}
            <g transform={`translate(0, ${GRID_TOP + GRID_HEIGHT + 22})`}>
              {/* Baseline rule */}
              <line
                x1={MARGIN_LEFT}
                y1="0"
                x2={MARGIN_LEFT + GRID_WIDTH}
                y2="0"
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Numbered tick marks along timeline baseline */}
              {segments.map((seg, i) => {
                const x = getX(seg.start_hour);
                return (
                  <g key={i} transform={`translate(${x}, 0)`}>
                    <line x1="0" y1="-5" x2="0" y2="8" stroke="#818cf8" strokeWidth="2" />
                    <circle cx="0" cy="14" r="6.5" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.5" />
                    <text x="0" y="17" textAnchor="middle" fill="#c7d2fe" fontSize="8" fontWeight="800">
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Segment Summary Table / Remarks Detail */}
      <div className="mt-4 border-t border-slate-800 pt-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Duty Segments & Remarks Detail — {date_label || `Day ${day}`}</span>
          <span className="text-[10px] text-slate-500 font-normal">Timeline numbers (#1, #2...) correspond to SVG ticks above</span>
        </div>

        {/* Shipping Documents row (FMCSA § 395.8 required field) */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mb-3 px-2.5 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">Shipping Documents:</span>
          <span className="text-slate-400 italic">DVL / Manifest No. — Not collected in MVP</span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0 sm:ml-4">Shipper & Commodity:</span>
          <span className="text-slate-400 italic">Not collected in MVP</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {segments.map((seg, idx) => (
            <div key={idx} className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg text-xs flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="inline-flex items-center space-x-1 font-mono text-indigo-400 font-bold">
                  <span className="w-4 h-4 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700 flex items-center justify-center text-[9px]">
                    #{idx + 1}
                  </span>
                  <span>{formatTime(seg.start_hour)} - {formatTime(seg.end_hour)}</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {(seg.end_hour - seg.start_hour).toFixed(1)}h
                </span>
              </div>
              <div className="text-slate-200 font-medium my-1" title={seg.label}>
                {seg.label}
              </div>
              <div className="mt-1">
                <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-semibold capitalize ${
                  seg.status === 'driving' ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                  seg.status === 'on_duty_not_driving' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  seg.status === 'sleeper_berth' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                  'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {seg.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Certification line (FMCSA § 395.8 required) */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Driver Certification:</span>
          <span className="text-slate-500 italic">
            I hereby certify that my daily log entries are true and correct.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Driver Signature:</span>
          <span className="inline-block border-b border-slate-600 text-slate-600 text-[11px] min-w-[140px] sm:min-w-[180px] pb-0.5">
            _________________ (Not collected in MVP)
          </span>
        </div>
      </div>
    </div>
  );
}
