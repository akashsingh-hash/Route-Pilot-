import React from 'react';

/**
 * LogSheet.jsx — SVG Renderer for standard FMCSA Driver's Daily Log Grid.
 *
 * Renders:
 * - 4 Duty Status Rows (Off Duty, Sleeper Berth, Driving, On Duty Not Driving)
 * - 24-Hour scale with 15-minute subdivisions
 * - Stepped duty-status lines with transition dots & vertical connectors
 * - Stationary bracket [ ] indicators for dock/on-duty wait periods
 * - Remarks timeline showing location & activity labels
 * - Individual row totals summing to 24 hours
 * - Circled digital on-duty total (Driving + On Duty Not Driving)
 */
export default function LogSheet({ log }) {
  if (!log) return null;

  const { day, date_label, segments = [], totals = {}, digital_total = 0 } = log;

  // Grid Layout Constants
  const SVG_WIDTH = 920;
  const SVG_HEIGHT = 380;
  const MARGIN_LEFT = 160;  // Space for row titles
  const GRID_WIDTH = 600;   // 24 hours => 25px per hour
  const MARGIN_RIGHT = 160; // Space for row totals & digital badge
  const GRID_TOP = 55;      // Top margin for hour labels
  const ROW_HEIGHT = 38;    // Height per duty status row
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

  // Hour label formatter: 12, 1, 2 ... 11, Midnight, 1 ... 11, Midnight
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
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl overflow-x-auto">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-sm rounded-md">
            {date_label || `Day ${day}`}
          </span>
          <h3 className="text-base font-semibold text-slate-200">Driver's Daily Log (24 Hours)</h3>
        </div>

        {/* Digital Total Badge */}
        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total On-Duty:</span>
          <div className="flex items-center space-x-1.5 bg-slate-900 px-3 py-1 rounded-full border border-indigo-500/50">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center border-2 border-indigo-400 shadow-md">
              {digital_total.toFixed(1)}
            </div>
            <span className="text-xs text-indigo-300 font-medium">hrs</span>
          </div>
        </div>
      </div>

      {/* SVG Log Grid */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto min-w-[750px] select-none"
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

        {/* Row Background Banding & Titles */}
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

              {/* Row Label (Left Side) */}
              <text
                x={MARGIN_LEFT - 12}
                y={rowYTop + ROW_HEIGHT / 2 + 4}
                textAnchor="end"
                fill={status.color}
                fontSize="11"
                fontWeight="700"
              >
                {status.label}
              </text>

              {/* Row Total (Right Side) */}
              <g transform={`translate(${MARGIN_LEFT + GRID_WIDTH + 20}, ${rowYTop + ROW_HEIGHT / 2 + 4})`}>
                <text fill="#cbd5e1" fontSize="12" fontWeight="600" textAnchor="start">
                  {(totals[status.key] || 0).toFixed(1)} <tspan fill="#64748b" fontSize="10">hrs</tspan>
                </text>
              </g>
            </g>
          );
        })}

        {/* Vertical Time Grid Ticks & Labels */}
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
                  {/* 15-min tick */}
                  <line
                    x1={getX(h + 0.25)}
                    y1={GRID_TOP}
                    x2={getX(h + 0.25)}
                    y2={GRID_TOP + GRID_HEIGHT}
                    stroke="#1e293b"
                    strokeWidth="0.75"
                  />
                  {/* 30-min (half hour) tick */}
                  <line
                    x1={getX(h + 0.5)}
                    y1={GRID_TOP}
                    x2={getX(h + 0.5)}
                    y2={GRID_TOP + GRID_HEIGHT}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  {/* 45-min tick */}
                  <line
                    x1={getX(h + 0.75)}
                    y1={GRID_TOP}
                    x2={getX(h + 0.75)}
                    y2={GRID_TOP + GRID_HEIGHT}
                    stroke="#1e293b"
                    strokeWidth="0.75"
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
                    {/* Left Bracket '[' */}
                    <path d={`M ${x1 + 3} ${y - 12} L ${x1} ${y - 12} L ${x1} ${y + 12} L ${x1 + 3} ${y + 12}`} />
                    {/* Right Bracket ']' */}
                    <path d={`M ${x2 - 3} ${y - 12} L ${x2} ${y - 12} L ${x2} ${y + 12} L ${x2 - 3} ${y + 12}`} />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Circled Digital Total Graphic (Right Side Display) */}
        <g transform={`translate(${MARGIN_LEFT + GRID_WIDTH + 95}, ${GRID_TOP + 45})`}>
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

        {/* ── Remarks & Location Timeline Row (Below Grid) ── */}
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

          <text x={MARGIN_LEFT - 12} y="5" textAnchor="end" fill="#94a3b8" fontSize="11" fontWeight="700">
            REMARKS:
          </text>

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

      {/* Segment Summary Table / Remarks Detail */}
      <div className="mt-4 border-t border-slate-800 pt-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Duty Segments & Remarks Detail — {date_label || `Day ${day}`}</span>
          <span className="text-[10px] text-slate-500 font-normal">Timeline numbers (#1, #2...) correspond to SVG ticks above</span>
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
    </div>
  );
}

