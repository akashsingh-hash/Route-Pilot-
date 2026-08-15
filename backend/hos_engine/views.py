import requests as http_requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripPlanRequestSerializer
from .services.routing import geocode, get_route
from .services.hos_calculator import calculate_hos_plan


class PlanTripView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        current_location = data["current_location"]
        pickup_location = data["pickup_location"]
        dropoff_location = data["dropoff_location"]
        current_cycle_used = data["current_cycle_used"]

        # --- Geocode all three locations ---
        try:
            current_coords = geocode(current_location)
            pickup_coords = geocode(pickup_location)
            dropoff_coords = geocode(dropoff_location)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except http_requests.RequestException as e:
            return Response(
                {"error": f"Geocoding service unavailable: {str(e)}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # --- Fetch real route from current → pickup → dropoff ---
        try:
            route_data = get_route([current_coords, pickup_coords, dropoff_coords])
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except http_requests.RequestException as e:
            return Response(
                {"error": f"Routing service unavailable: {str(e)}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # --- Run HOS calculator with real routing data ---
        hos_result = calculate_hos_plan(
            total_driving_hours=route_data["total_driving_hours"],
            total_distance_miles=route_data["total_distance_miles"],
            current_cycle_used=current_cycle_used,
        )

        # --- Build stops list: pickup + events (interpolated) + dropoff ---
        geometry = route_data["geometry"]
        total_miles = route_data["total_distance_miles"]

        stops = [
            {
                "type": "pickup",
                "location": pickup_location,
                "lat": pickup_coords[0],
                "lon": pickup_coords[1],
                "duration_hours": 1.0,
            },
        ]

        # Interpolate each event's position along the route geometry
        for event in hos_result["events"]:
            fraction = (event["elapsed_miles"] / total_miles) if total_miles > 0 else 0.0
            fraction = max(0.0, min(1.0, fraction))
            lat, lon = _interpolate_geometry(geometry, fraction)

            if event["type"] == "fuel":
                label = f"Fuel stop @ approx mile {round(event['elapsed_miles'])}"
                duration = 0.5
            elif event["type"] == "rest_10hr":
                label = f"10-hr rest @ approx mile {round(event['elapsed_miles'])}"
                duration = 10.0
            elif event["type"] == "restart_34hr":
                label = f"34-hr restart @ approx mile {round(event['elapsed_miles'])}"
                duration = 34.0
            else:
                label = event["type"]
                duration = 0.0

            stops.append({
                "type": event["type"],
                "location": label,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "duration_hours": duration,
            })

        stops.append({
            "type": "dropoff",
            "location": dropoff_location,
            "lat": dropoff_coords[0],
            "lon": dropoff_coords[1],
            "duration_hours": 1.0,
        })

        # --- Assemble final response matching Section 2.2 contract ---
        response_body = {
            "route": {
                "geometry": geometry,
                "total_distance_miles": route_data["total_distance_miles"],
                "total_driving_hours": route_data["total_driving_hours"],
                "stops": stops,
            },
            "daily_logs": hos_result["daily_logs"],
            "warnings": hos_result["warnings"],
        }

        return Response(response_body, status=status.HTTP_200_OK)


def _interpolate_geometry(geometry: list[list[float]], fraction: float) -> tuple[float, float]:
    """
    Given a route geometry ([[lat, lon], ...]) and a fraction (0.0–1.0)
    representing how far along the route a point is, return the interpolated
    (lat, lon) at that fraction of total route distance.

    Uses simple piecewise linear interpolation along the polyline segments.
    """
    if not geometry:
        return (0.0, 0.0)
    if fraction <= 0.0:
        return (geometry[0][0], geometry[0][1])
    if fraction >= 1.0:
        return (geometry[-1][0], geometry[-1][1])

    # Compute cumulative segment lengths (Euclidean in lat/lon space — good
    # enough for interpolation purposes, not used for distance measurement).
    seg_lengths = []
    total_length = 0.0
    for i in range(1, len(geometry)):
        dlat = geometry[i][0] - geometry[i - 1][0]
        dlon = geometry[i][1] - geometry[i - 1][1]
        seg_len = (dlat**2 + dlon**2) ** 0.5
        seg_lengths.append(seg_len)
        total_length += seg_len

    if total_length < 1e-12:
        return (geometry[0][0], geometry[0][1])

    target_dist = fraction * total_length
    accumulated = 0.0

    for i, seg_len in enumerate(seg_lengths):
        if accumulated + seg_len >= target_dist - 1e-12:
            # Interpolate within this segment
            remaining = target_dist - accumulated
            t = remaining / seg_len if seg_len > 1e-12 else 0.0
            lat = geometry[i][0] + t * (geometry[i + 1][0] - geometry[i][0])
            lon = geometry[i][1] + t * (geometry[i + 1][1] - geometry[i][1])
            return (lat, lon)
        accumulated += seg_len

    # Fallback: return last point
    return (geometry[-1][0], geometry[-1][1])
