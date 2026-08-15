"""
routing.py — Nominatim geocoding + OSRM route fetching.

NOTE on rate-limiting / caching:
  - Nominatim's usage policy requires max 1 req/sec for bulk use.
    For MVP/single requests this is fine; add caching (e.g. functools.lru_cache
    or Redis) before any production traffic load.
  - OSRM public demo server (router.project-osrm.org) is for demo only.
    For production, self-host OSRM or use a paid routing API.
"""

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"

# Required by Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
# Note: avoid special characters like parentheses in User-Agent — Nominatim may reject them.
NOMINATIM_HEADERS = {
    "User-Agent": "RoutePilot/1.0",
    "Accept-Language": "en",
}

METERS_PER_MILE = 1609.344
SECONDS_PER_HOUR = 3600.0


def geocode(location_str: str) -> tuple[float, float]:
    """
    Geocode a location string to (lat, lon) via Nominatim.

    Args:
        location_str: Human-readable location, e.g. "Dallas, TX"

    Returns:
        (lat, lon) as floats

    Raises:
        ValueError: If location cannot be geocoded.
        requests.RequestException: On network errors.
    """
    params = {
        "q": location_str,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    }
    response = requests.get(
        NOMINATIM_URL,
        params=params,
        headers=NOMINATIM_HEADERS,
        timeout=10,
    )
    response.raise_for_status()

    results = response.json()
    if not results:
        raise ValueError(f"Could not geocode location: '{location_str}'")

    lat = float(results[0]["lat"])
    lon = float(results[0]["lon"])
    return (lat, lon)


def get_route(coords: list[tuple[float, float]]) -> dict:
    """
    Fetch a driving route from OSRM for an ordered list of (lat, lon) waypoints.

    OSRM expects coordinates as lon,lat in the URL path (opposite of our convention).
    We swap here and normalize all output geometry back to [lat, lon] order before
    returning — the caller and frontend never need to think about coordinate order.

    Args:
        coords: List of (lat, lon) tuples, minimum 2.

    Returns:
        dict with keys:
            geometry         — list of [lat, lon] pairs along the route
            total_distance_miles — float
            total_driving_hours  — float

    Raises:
        ValueError: If OSRM returns a non-Ok status or no routes.
        requests.RequestException: On network errors.
    """
    # OSRM URL format: /route/v1/driving/lon1,lat1;lon2,lat2;...
    waypoints = ";".join(f"{lon},{lat}" for lat, lon in coords)
    url = f"{OSRM_BASE_URL}/{waypoints}"

    params = {
        "overview": "full",
        "geometries": "geojson",
    }
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()

    data = response.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError(f"OSRM returned no routes: {data.get('code', 'unknown error')}")

    route = data["routes"][0]

    # OSRM GeoJSON geometry is [[lon, lat], ...] — swap to [lat, lon]
    raw_coords = route["geometry"]["coordinates"]
    geometry = [[lat, lon] for lon, lat in raw_coords]

    distance_miles = route["distance"] / METERS_PER_MILE
    driving_hours = route["duration"] / SECONDS_PER_HOUR

    return {
        "geometry": geometry,
        "total_distance_miles": round(distance_miles, 1),
        "total_driving_hours": round(driving_hours, 2),
    }
