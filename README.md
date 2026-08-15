# RoutePilot — HOS & Trip Planner

RoutePilot is a full-stack trip planner for property-carrying commercial drivers that calculates HOS-compliant routes, interleave mandatory rest breaks & fuel stops, and generates official FMCSA Driver's Daily Log Sheets.

---

## 0. Hardcoded HOS Rules & Assumptions

1. **Property-carrying driver** operating on a **70-hour / 8-day cycle** (not 60/7).
2. **No adverse driving conditions** assumed.
3. **Fuel stop required at least once every 1,000 miles** (0.5 hr on-duty time).
4. **Fixed on-duty time**: 1 hour at pickup, 1 hour at dropoff.
5. **FMCSA Clocks**:
   - 11-hour driving limit per duty window.
   - 14-hour on-duty window.
   - Mandatory 30-minute break after 8 cumulative driving hours.
   - Mandatory 10-hour consecutive off-duty rest to reset 11-hr / 14-hr clocks.
   - 34-hour cycle restart when approaching/exceeding 70 hours.

---

## 1. Tech Stack

- **Backend**: Django 5.x, Django REST Framework, `django-cors-headers`, `requests`, `python-dotenv`, `gunicorn`, `whitenoise`.
- **Frontend**: React 18, Vite, Tailwind CSS, Leaflet, `react-leaflet`, `axios`.
- **Geocoding & Routing**: OpenStreetMap Nominatim API + OSRM (Open Source Routing Machine) API.

---

## 2. Local Setup & Running Instructions

### Backend (Django)
```bash
cd backend

# Create & activate virtual environment (Windows)
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Start backend server on port 8000
python manage.py runserver 8000
```

### Frontend (React + Vite)
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server on port 5173
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 3. API Contract

### `POST /api/plan-trip/`

#### Request Body
```json
{
  "current_location": "Dallas, TX",
  "pickup_location": "Houston, TX",
  "dropoff_location": "Atlanta, GA",
  "current_cycle_used": 12.5
}
```

#### Response Body
```json
{
  "route": {
    "geometry": [[32.7767, -96.7970], [29.7604, -95.3698], ...],
    "total_distance_miles": 1021.9,
    "total_driving_hours": 18.8,
    "stops": [
      {
        "type": "pickup",
        "location": "Dallas, TX",
        "lat": 32.7767,
        "lon": -96.7970,
        "duration_hours": 1.0
      },
      {
        "type": "rest_10hr",
        "location": "Jackson, MS",
        "lat": 32.2988,
        "lon": -90.1848,
        "duration_hours": 10.0
      },
      {
        "type": "fuel",
        "location": "approx mile 1000",
        "lat": 33.6401,
        "lon": -84.4269,
        "duration_hours": 0.5
      },
      {
        "type": "dropoff",
        "location": "Atlanta, GA",
        "lat": 33.7490,
        "lon": -84.3880,
        "duration_hours": 1.0
      }
    ]
  },
  "daily_logs": [
    {
      "day": 1,
      "date_label": "Day 1",
      "segments": [
        { "status": "on_duty_not_driving", "start_hour": 0.0, "end_hour": 1.0, "label": "Pickup" },
        { "status": "driving", "start_hour": 1.0, "end_hour": 9.0, "label": "Driving" },
        { "status": "on_duty_not_driving", "start_hour": 9.0, "end_hour": 9.5, "label": "30-min Break" },
        { "status": "driving", "start_hour": 9.5, "end_hour": 14.0, "label": "Driving" },
        { "status": "off_duty", "start_hour": 14.0, "end_hour": 24.0, "label": "10-hr Rest" }
      ],
      "totals": {
        "off_duty": 10.0,
        "sleeper_berth": 0.0,
        "driving": 13.5,
        "on_duty_not_driving": 1.5
      },
      "digital_total": 15.0
    }
  ],
  "warnings": []
}
```

---

## 4. Deployment Instructions

- **Backend (Render)**:
  - Create a new Render Web Service connected to the backend directory.
  - Build Command: `pip install -r requirements.txt`
  - Start Command: `gunicorn config.wsgi`
  - Set Environment Variables: `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `SECRET_KEY`, `DEBUG=False`.
- **Frontend (Vercel)**:
  - Import repository, set Root Directory to `frontend/`.
  - Framework Preset: Vite.
  - Set Environment Variable: `VITE_API_URL` pointing to your deployed Render backend URL.

---

## 5. Live Demo

- **Backend API**: `https://<your-render-app>.onrender.com`
- **Frontend Web App**: `https://<your-vercel-app>.vercel.app`
