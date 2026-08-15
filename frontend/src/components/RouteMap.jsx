import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const STOP_COLORS = {
  pickup: '#22c55e',       // Green
  dropoff: '#ef4444',      // Red
  fuel: '#f97316',         // Orange
  rest_10hr: '#3b82f6',    // Blue
  restart_34hr: '#a855f7', // Purple
};

const STOP_LABELS = {
  pickup: 'Pickup',
  dropoff: 'Dropoff',
  fuel: 'Fuel Stop',
  rest_10hr: '10-Hour Rest',
  restart_34hr: '34-Hour Restart',
};

function createMarkerIcon(type) {
  const color = STOP_COLORS[type] || '#64748b';
  const html = `
    <div style="
      background-color: ${color};
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 4px 8px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-stop-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

function AutoFitBounds({ geometry, stops }) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    if (geometry && Array.isArray(geometry) && geometry.length > 0) {
      points.push(...geometry);
    } else if (stops && Array.isArray(stops) && stops.length > 0) {
      stops.forEach((s) => {
        if (s.lat && s.lon) points.push([s.lat, s.lon]);
      });
    }

    if (points.length > 0) {
      map.fitBounds(points, { padding: [50, 50] });
    }
  }, [geometry, stops, map]);

  return null;
}

/**
 * Detects nearby/overlapping markers and applies a slight angular offset
 * so close stops (e.g. fuel stop & dropoff ~15 miles apart) don't obscure each other.
 */
function getProcessedStops(stops) {
  if (!stops || !Array.isArray(stops)) return [];

  const clusters = [];
  stops.forEach((stop, originalIdx) => {
    if (!stop.lat || !stop.lon) return;

    let targetCluster = clusters.find((cluster) =>
      cluster.some(
        (item) => Math.hypot(item.lat - stop.lat, item.lon - stop.lon) < 0.25
      )
    );

    if (!targetCluster) {
      targetCluster = [];
      clusters.push(targetCluster);
    }

    targetCluster.push({ ...stop, originalIdx });
  });

  const processed = [];
  const OFFSET_RADIUS = 0.18; // ~12 mile offset in lat/lon space for visual clarity on continental map views

  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      processed.push({ ...cluster[0], renderLat: cluster[0].lat, renderLon: cluster[0].lon });
    } else {
      cluster.forEach((item, idx) => {
        const angle = (idx * (2 * Math.PI)) / cluster.length - Math.PI / 2;
        const renderLat = item.lat + OFFSET_RADIUS * Math.sin(angle);
        const renderLon = item.lon + OFFSET_RADIUS * Math.cos(angle);
        processed.push({ ...item, renderLat, renderLon, isOffset: true });
      });
    }
  });

  return processed.sort((a, b) => a.originalIdx - b.originalIdx);
}

export default function RouteMap({ route }) {
  if (!route) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-12 text-center text-slate-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-base font-medium">No route loaded yet</p>
        <p className="text-xs text-slate-500 mt-1">Submit the trip parameters above to calculate and display the route map.</p>
      </div>
    );
  }

  const geometry = route.geometry || [];
  const rawStops = route.stops || [];
  const processedStops = getProcessedStops(rawStops);

  // Default fallback center if no geometry
  const initialCenter = geometry.length > 0 ? geometry[0] : [32.7767, -96.7970];

  return (
    <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Route Map</h3>
          <p className="text-xs text-slate-400">
            Total Distance: <span className="font-mono text-indigo-300 font-semibold">{route.total_distance_miles?.toFixed(1) || 0} mi</span> | 
            Est. Driving: <span className="font-mono text-indigo-300 font-semibold">{route.total_driving_hours?.toFixed(1) || 0} hrs</span>
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {Object.entries(STOP_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center space-x-1.5 bg-slate-900/60 px-2 py-1 rounded border border-slate-700/50">
              <span className="w-3 h-3 rounded-full inline-block border border-white/50" style={{ backgroundColor: color }}></span>
              <span className="text-slate-300 capitalize">{STOP_LABELS[type] || type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[450px] sm:h-[500px] w-full relative z-0">
        <MapContainer
          center={initialCenter}
          zoom={6}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Route polyline */}
          {geometry.length > 0 && (
            <Polyline
              positions={geometry}
              pathOptions={{ color: '#6366f1', weight: 5, opacity: 0.85 }}
            />
          )}

          {/* Stop markers */}
          {processedStops.map((stop, idx) => {
            if (!stop.renderLat || !stop.renderLon) return null;
            const stopType = stop.type || 'pickup';
            const icon = createMarkerIcon(stopType);
            const label = STOP_LABELS[stopType] || stopType;

            return (
              <Marker
                key={idx}
                position={[stop.renderLat, stop.renderLon]}
                icon={icon}
              >
                <Popup>
                  <div className="text-sm p-1">
                    <div className="flex items-center space-x-2 font-semibold mb-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: STOP_COLORS[stopType] || '#64748b' }}></span>
                      <span className="text-indigo-300">{label}</span>
                      {stop.isOffset && (
                        <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700">
                          Nearby Stop
                        </span>
                      )}
                    </div>
                    <div className="text-slate-200 font-medium mb-1">
                      {stop.location}
                    </div>
                    <div className="text-xs text-slate-400">
                      Duration: <span className="text-slate-200 font-mono">{stop.duration_hours} hr{stop.duration_hours === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <AutoFitBounds geometry={geometry} stops={rawStops} />
        </MapContainer>
      </div>
    </div>
  );
}
