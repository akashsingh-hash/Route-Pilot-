# RoutePilot — Full Build Spec (for Antigravity)

**Project:** RoutePilot — a trip planner that takes a trucker's route details and outputs a compliant route map + FMCSA Hours-of-Service (HOS) Daily Log Sheets.

**Goal:** Production-ready, deployable, clean-code full-stack app. Django REST backend + React frontend. This doc is the single source of truth — implement it phase by phase, in order. Do not skip ahead to frontend polish before the HOS engine is correct and tested.

---

## 0. Assumptions (hardcode these, do not make configurable)

- Property-carrying driver
- 70-hour / 8-day cycle (not 60/7)
- No adverse driving conditions
- Fuel stop required at least once every 1,000 miles
- 1 hour fixed on-duty time at pickup, 1 hour fixed on-duty time at dropoff
- 11-hour driving limit, 14-hour on-duty window, 30-minute break required after 8 cumulative driving hours, 10 consecutive hours off duty required to reset the 11/14-hour clocks

---

## 1. Root folder structure

```
routepilot/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── config/                  # Django project settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── hos_engine/              # Django app
│       ├── models.py            # optional: TripRequest, TripResult (for history, not required for MVP)
│       ├── serializers.py
│       ├── views.py             # /api/plan-trip/ endpoint
│       ├── urls.py
│       ├── services/
│       │   ├── routing.py       # OSRM + Nominatim calls
│       │   └── hos_calculator.py # the core algorithm — pure functions, unit-testable
│       └── tests/
│           └── test_hos_calculator.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── tripApi.js
│       ├── components/
│       │   ├── TripForm.jsx
│       │   ├── RouteMap.jsx
│       │   ├── LogSheet.jsx      # SVG/canvas renderer for one daily log grid
│       │   ├── LogSheetList.jsx  # renders N log sheets for multi-day trips
│       │   └── TripSummary.jsx
│       └── styles/
├── README.md
└── .gitignore
```

---

## 2. Backend

### 2.1 Stack
Django 5.x, djangorestframework, django-cors-headers, requests, python-dotenv. SQLite is fine (no persistence requirement, stateless calculator).

### 2.2 API contract

`POST /api/plan-trip/`

Request body:
```json
{
  "current_location": "Dallas, TX",
  "pickup_location": "Houston, TX",
  "dropoff_location": "Atlanta, GA",
  "current_cycle_used": 12.5
}
```

Response body:
```json
{
  "route": {
    "geometry": [[lat, lon], ...],
    "total_distance_miles": 812.4,
    "total_driving_hours": 13.2,
    "stops": [
      {"type": "pickup", "location": "Houston, TX", "lat": .., "lon": .., "duration_hours": 1},
      {"type": "fuel", "location": "approx mile 1000", "lat": .., "lon": .., "duration_hours": 0.5},
      {"type": "rest_10hr", "location": "...", "lat": .., "lon": .., "duration_hours": 10},
      {"type": "dropoff", "location": "Atlanta, GA", "lat": .., "lon": .., "duration_hours": 1}
    ]
  },
  "daily_logs": [
    {
      "day": 1,
      "date_label": "Day 1",
      "segments": [
        {"status": "on_duty_not_driving", "start_hour": 6.0, "end_hour": 6.5, "label": "Pickup - Houston, TX"},
        {"status": "driving", "start_hour": 6.5, "end_hour": 14.5, "label": "Driving"},
        {"status": "off_duty", "start_hour": 14.5, "end_hour": 24.0, "label": "Rest"}
      ],
      "totals": {"off_duty": 9.5, "sleeper_berth": 0, "driving": 8.0, "on_duty_not_driving": 6.5},
      "digital_total": 14.5
    }
  ],
  "warnings": []
}
```

`start_hour`/`end_hour` are decimal hours on a 0–24 midnight-to-midnight scale — this maps directly onto the log sheet grid columns.

### 2.3 `services/routing.py`
- `geocode(location_str) -> (lat, lon)` via Nominatim (`https://nominatim.openstreetmap.org/search`)
- `get_route(coords: list[(lat,lon)]) -> dict` via OSRM (`https://router.project-osrm.org/route/v1/driving/{lon,lat;lon,lat;...}?overview=full&geometries=geojson`)
- Add a `User-Agent` header on Nominatim calls (required by their usage policy) — set it to something like `RoutePilot/1.0 (contact: your-email)`
- Cache/rate-limit awareness isn't required for MVP but note it in code comments

### 2.4 `services/hos_calculator.py` — THE CORE ALGORITHM

This is a pure function, no Django imports, fully unit-testable:

```python
def calculate_hos_plan(
    total_driving_hours: float,
    total_distance_miles: float,
    current_cycle_used: float,
    pickup_duration=1.0,
    dropoff_duration=1.0,
) -> dict:
    """
    Simulates the trip hour-by-hour against HOS limits and returns
    a list of duty segments split into calendar days, plus stop markers.
    """
```

**Algorithm (implement exactly this logic):**

1. Initialize: `cycle_hours_used = current_cycle_used`, `clock = 0.0` (start of day 1, assume driver starts at hour 0 = midnight for simplicity, or make it configurable to "now"), `driving_since_break = 0.0`, `duty_window_start = 0.0`, `driving_today = 0.0`, `miles_since_fuel = 0.0`.
2. Build an ordered list of "activities" to schedule: `[pickup(1hr), drive(total_driving_hours), dropoff(1hr)]`, splitting the drive activity to interleave fuel stops every 1000 miles.
3. Walk through activities, accumulating elapsed time. Before adding any driving block, check:
   - If `driving_since_break >= 8.0` → insert a 0.5hr break (on_duty_not_driving), reset `driving_since_break = 0`
   - If `driving_today >= 11.0` OR `(clock - duty_window_start) >= 14.0` → insert 10hr off_duty block, reset `driving_today = 0`, `driving_since_break = 0`, `duty_window_start = clock_after_rest`
   - If `cycle_hours_used >= 70.0` → insert a rest period sufficient to bring cycle back under limit (for MVP: insert 34hr restart and reset `cycle_hours_used = 0`), add a `warning` to the response
4. Every driving hour added: increment `driving_today`, `driving_since_break`, `cycle_hours_used`, `miles_since_fuel` (proportionally to distance/hours ratio)
5. Every on-duty (not driving) hour added (pickup/dropoff/fuel/break): increment `cycle_hours_used` (breaks/off-duty do NOT count toward cycle hours — 30 min break can be on or off duty, treat as on-duty-not-driving for simplicity but do not add to `driving_today`)
6. Once all activities are scheduled, split the flat segment timeline into calendar days by hour-of-day (0–24 boundaries), producing one `daily_logs` entry per day, each with its own `totals` that sum to 24.
7. Fuel stops: every time `miles_since_fuel >= 1000`, insert a 0.5hr on_duty_not_driving "Fuel" stop, reset `miles_since_fuel = 0`.

**Edge cases to test explicitly (write these as unit tests first):**
- Short trip (under 11hr driving, no pickup/dropoff spillover) → single log sheet, no rest stops
- Medium trip (~15hr driving) → should insert exactly one 10hr rest, produce 2 log sheets
- Long trip (~40hr+ driving) → multiple rests, multiple fuel stops, 3+ log sheets
- Trip where `current_cycle_used` is already high (e.g. 65) → should trigger the 70hr cycle warning/restart early

### 2.5 Tests
Write `test_hos_calculator.py` with at least the 4 cases above using `pytest` or Django's `TestCase`. Assert on segment counts, total hours per day summing to 24, and that no single day's driving exceeds 11hrs.

---

## 3. Frontend

### 3.1 Stack
React 18 + Vite, Tailwind CSS, `leaflet` + `react-leaflet`, `axios`.

### 3.2 `TripForm.jsx`
4 inputs (current, pickup, dropoff location as text; current_cycle_used as number 0-70), client-side validation, submit button with loading state. On submit, call `tripApi.planTrip(payload)`.

### 3.3 `RouteMap.jsx`
Leaflet map, draw the route polyline from `route.geometry`, drop markers for each stop in `route.stops` with a popup showing type + location + duration. Different marker icon/color per stop type (pickup=green, dropoff=red, fuel=orange, rest=blue).

### 3.4 `LogSheet.jsx` — the daily log grid

Render one SVG matching the official FMCSA Driver's Daily Log grid: 4 horizontal rows (Off Duty, Sleeper Berth, Driving, On Duty Not Driving) × 24-hour columns (midnight to midnight), each hour subdivided into 15-minute tick marks.

**Exact visual behavior (per Schneider driver-training reference — replicate this precisely, not an approximation):**

- On every duty-status change, place a **dot** at the exact time on the row for the new status.
- Draw a **horizontal line** along that row for the duration the driver stays in that status.
- Draw a **vertical connector line** from the end-dot of the previous status straight down/up to the start-dot of the new status on its row — this produces the continuous "stepped line" look of a real log, not disconnected segments.
- If the vehicle is stationary but duty status does NOT change during that time (e.g. waiting at a dock still on-duty-not-driving), denote it with a **bracket** `[ ]` above that portion of the line instead of a new segment.
- **Remarks row**: under each status-change dot, print a short label with **city, state + specific activity** — not just the status name. E.g. `"Green Bay, WI — Pre-trip/TI"`, `"Fond du Lac, WI"`, `"Paw Paw, IL — 30 min break"`, `"Edwardsville, IL — Post-trip"`. Pull city/state from the `label` field on each segment (backend should populate this from the stop/location data, not just "Driving"/"On Duty").
- **Per-row totals**: sum each row's duration and print on the right edge (e.g. `Off Duty: 8.5`, `Sleeper Berth: 5`, `Driving: 9.5`, `On Duty: 1`). These four must sum to exactly 24.
- **Digital/grand total**: separately sum (Driving + On Duty Not Driving) into one number and render it **circled** — this is the day's total on-duty hours, distinct from the four individual row totals. Add this as a `digital_total` field the backend includes per day and the component renders as a circled number near the totals column.
- First entry of the day (start of shift) always begins with a dot transitioning from whatever status the driver was in at midnight.

Keep this component pure (props in → SVG out) so it's easy to unit-test/visually QA against the reference image and against the Schneider training example (a 24hr day with Off Duty 8.5 / Sleeper Berth 5 / Driving 9.5 / On Duty 1, digital total 10.5, circled).

### 3.5 `LogSheetList.jsx`
Maps over `daily_logs` array, renders a `<LogSheet>` per day with a "Day N" header, in a tab or stacked-scroll layout.

### 3.6 `TripSummary.jsx`
Small card: total distance, total driving hours, number of days, number of stops, any warnings.

### 3.7 `App.jsx`
Layout: form at top (or sidebar), map + summary + log sheets below once results come back. Loading and error states.

---

## 4. Environment & config

**backend/.env.example**
```
DEBUG=True
SECRET_KEY=changeme
ALLOWED_HOSTS=localhost,127.0.0.1,.onrender.com
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

**frontend/.env.example**
```
VITE_API_URL=http://localhost:8000
```

`config/settings.py` must read `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `SECRET_KEY`, `DEBUG` from env vars via `python-dotenv`, not hardcoded.

---

## 5. Deployment

- **Backend → Render**: New Web Service, build command `pip install -r requirements.txt`, start command `gunicorn config.wsgi`, add `gunicorn` and `whitenoise` to requirements.txt for static files. Set env vars from `.env.example` in Render dashboard.
- **Frontend → Vercel**: Import repo, root directory `frontend/`, framework preset Vite, set `VITE_API_URL` env var to the Render backend URL.
- After both are live, update backend's `CORS_ALLOWED_ORIGINS` to the real Vercel URL and redeploy.

---

## 6. README.md must include

- One-line project description + the 4 assumptions from section 0
- Local setup steps (backend venv + migrate + runserver; frontend npm install + dev)
- API contract (copy section 2.2)
- Live demo link + screenshot/gif
- Tech stack list

---

## 7. Build order (feed to Antigravity as separate prompts/phases)

1. Scaffold folder structure + Django project + DRF installed, empty `/api/plan-trip/` returning dummy JSON
2. Implement `routing.py` (geocode + OSRM), wire into the view, return real route geometry
3. Implement `hos_calculator.py` + full test suite — do NOT move on until all 4 edge-case tests pass
4. Wire calculator output into the view response matching the exact contract in 2.2
5. Scaffold React app, `TripForm` + API call wired to backend, show raw JSON response first (sanity check)
6. Build `RouteMap` with Leaflet
7. Build `LogSheet` SVG renderer against the reference image, then `LogSheetList`
8. Tailwind polish pass on the whole app — spacing, colors, mobile responsiveness
9. Deploy both, fix CORS, do end-to-end QA with 3 real test trips
10. Write README, record Loom, push final commit

---

## 8. QA checklist before submitting

- [ ] No single day shows >11 driving hours on the log sheet
- [ ] 30-min break appears after every 8hr driving stretch
- [ ] 10hr rest appears whenever 11hr/14hr limit is hit
- [ ] Fuel stops appear roughly every 1000 miles
- [ ] Log sheet totals per day sum to exactly 24 hours
- [ ] Map shows accurate route + all stop markers
- [ ] Works on a short trip, a 2-day trip, and a 4+ day trip
- [ ] Mobile responsive
- [ ] No console errors, no exposed API keys, .env files gitignored
