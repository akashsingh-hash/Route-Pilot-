"""
hos_calculator.py — Core HOS planning algorithm.

Pure function module: no Django imports, no ORM, no request objects.
Fully unit-testable in isolation.

FMCSA HOS Rules (property-carrying driver, 70/8 cycle):
  - 11-hour driving limit per duty window
  - 14-hour on-duty window
  - 30-minute break required after 8 cumulative driving hours
  - 10 consecutive hours off duty resets the 11-hr and 14-hr clocks
  - 70-hour / 8-day cycle limit; 34-hour restart resets cycle to 0

NOTE on calendar-day vs duty-window driving limits:
  The 11-hour driving limit is enforced per DUTY WINDOW, not per calendar day.
  A calendar-day entry in daily_logs may show more than 11 hours of driving
  if the driver completed a 10-hour rest and began a new duty window within
  the same calendar day (e.g. rest ends at 22:30, driver logs 1.5 hr before
  midnight — that 1.5 hr belongs to a new duty window but lands on the same
  calendar day as the previous window's 11 hr). This is physically compliant.
  Do NOT flag calendar days with >11 hr driving as a bug — assert on duty
  windows, not raw calendar-day totals.
"""

import math

# ─── FMCSA HOS constants (hardcoded per spec §0 — not configurable) ───────────
MAX_DRIVING_PER_WINDOW = 11.0    # hours driving allowed per duty window
MAX_DUTY_WINDOW        = 14.0    # hours from first on-duty until window closes
BREAK_THRESHOLD        = 8.0     # cumulative driving hours before mandatory break
BREAK_DURATION         = 0.5     # hours (30 min)
REST_DURATION          = 10.0    # hours off duty to reset 11/14-hr clocks
CYCLE_LIMIT            = 70.0    # 70-hr/8-day cycle cap
RESTART_DURATION       = 34.0    # hours off duty for full cycle restart
FUEL_INTERVAL_MILES    = 1000.0  # miles between required fuel stops
FUEL_STOP_DURATION     = 0.5     # hours


def calculate_hos_plan(
    total_driving_hours: float,
    total_distance_miles: float,
    current_cycle_used: float,
    pickup_duration: float = 1.0,
    dropoff_duration: float = 1.0,
) -> dict:
    """
    Simulates the trip against HOS limits and returns duty segments split
    into calendar days, plus warnings.

    Args:
        total_driving_hours:  Total driving time for the full trip (including
                              deadhead current→pickup leg) as returned by routing.py.
        total_distance_miles: Total route distance (same scope as driving hours).
        current_cycle_used:   Hours already used in driver's current 70-hr cycle.
        pickup_duration:      On-duty-not-driving time at pickup (default 1.0 hr).
        dropoff_duration:     On-duty-not-driving time at dropoff (default 1.0 hr).

    Returns:
        {
          "daily_logs": [ { day, date_label, segments, totals, digital_total }, ... ],
          "events":     [ { type, elapsed_hours, elapsed_miles }, ... ],
          "warnings":   [ str, ... ]
        }
    """
    # ── State initialisation ───────────────────────────────────────────────────
    clock: float               = 0.0
    cycle_hours_used: float    = float(current_cycle_used)
    driving_since_break: float = 0.0
    duty_window_start: float   = 0.0
    driving_today: float       = 0.0   # driving hrs in current duty window
    miles_since_fuel: float    = 0.0

    # miles accumulated per driving hour (used to track fuel interval)
    mph: float = (total_distance_miles / total_driving_hours
                  if total_driving_hours > 0 else 0.0)

    flat_segments: list[dict] = []  # absolute-time segments (start/end in trip hours)
    events: list[dict]        = []  # fuel/rest/restart events in trip-elapsed order
    warnings: list[str]       = []
    cumulative_miles: float   = 0.0  # total miles driven so far (never resets)

    # ── Helper: append segment, advance clock, accrue cycle hours ──────────────
    def add_seg(status: str, duration: float, label: str) -> None:
        nonlocal clock, cycle_hours_used
        if duration < 1e-9:
            return
        start = clock
        end   = round(clock + duration, 9)
        flat_segments.append({"status": status, "start": start, "end": end, "label": label})
        clock = end
        # Only driving and on_duty_not_driving count toward the 70-hr cycle.
        # Off-duty time (rests, restarts, end-of-day padding) does NOT.
        if status in ("driving", "on_duty_not_driving"):
            cycle_hours_used = round(cycle_hours_used + duration, 9)

    # ── Pickup ─────────────────────────────────────────────────────────────────
    add_seg("on_duty_not_driving", pickup_duration, "Pickup")

    # ── Driving phase ──────────────────────────────────────────────────────────
    remaining_drive: float = float(total_driving_hours)

    while remaining_drive > 1e-9:
        # ── Pre-driving checks (evaluated in priority order each iteration) ───

        # 1. Cycle limit hit — insert 34-hr restart, reset cycle to 0.
        #    We cap the driving block exactly at cycle=70 (via hours_to_cycle
        #    below) so this branch fires only when the cap was just reached.
        if round(cycle_hours_used, 9) >= CYCLE_LIMIT:
            events.append({
                "type": "restart_34hr",
                "elapsed_hours": round(clock, 4),
                "elapsed_miles": round(cumulative_miles, 4),
            })
            add_seg("off_duty", RESTART_DURATION, "34-hr Cycle Restart")
            cycle_hours_used    = 0.0
            duty_window_start   = clock
            driving_today       = 0.0
            driving_since_break = 0.0
            warnings.append("34-hour cycle restart was required.")
            continue

        # 2. 11-hr driving limit or 14-hr duty window exhausted — insert 10-hr rest.
        window_used = round(clock - duty_window_start, 9)
        if (round(driving_today, 9) >= MAX_DRIVING_PER_WINDOW
                or window_used >= MAX_DUTY_WINDOW):
            events.append({
                "type": "rest_10hr",
                "elapsed_hours": round(clock, 4),
                "elapsed_miles": round(cumulative_miles, 4),
            })
            add_seg("off_duty", REST_DURATION, "10-hr Rest")
            duty_window_start   = clock
            driving_today       = 0.0
            driving_since_break = 0.0
            continue

        # 3. 8 cumulative driving hours — insert mandatory 30-min break.
        if round(driving_since_break, 9) >= BREAK_THRESHOLD:
            add_seg("on_duty_not_driving", BREAK_DURATION, "30-min Break")
            driving_since_break = 0.0
            continue

        # ── Calculate maximum drivable block before any limit fires ────────────
        hours_to_break  = BREAK_THRESHOLD        - driving_since_break
        hours_to_11hr   = MAX_DRIVING_PER_WINDOW - driving_today
        hours_to_window = MAX_DUTY_WINDOW        - (clock - duty_window_start)
        hours_to_cycle  = CYCLE_LIMIT            - cycle_hours_used
        hours_to_fuel   = ((FUEL_INTERVAL_MILES - miles_since_fuel) / mph
                           if mph > 0 else float("inf"))

        max_block = min(
            remaining_drive,
            hours_to_break,
            hours_to_11hr,
            hours_to_window,
            hours_to_cycle,
            hours_to_fuel,
        )
        max_block = round(max_block, 9)

        if max_block < 1e-9:
            # Safety guard — should not be reached with correct pre-checks above
            break

        # ── Drive the block ───────────────────────────────────────────────────
        block_miles = max_block * mph
        add_seg("driving", max_block, "Driving")
        driving_today       = round(driving_today       + max_block, 9)
        driving_since_break = round(driving_since_break + max_block, 9)
        miles_since_fuel    = round(miles_since_fuel    + block_miles, 9)
        cumulative_miles    = round(cumulative_miles    + block_miles, 9)
        remaining_drive     = round(remaining_drive     - max_block, 9)

        # ── Fuel stop if 1000-mile interval reached ───────────────────────────
        if mph > 0 and miles_since_fuel >= FUEL_INTERVAL_MILES - 1e-6:
            events.append({
                "type": "fuel",
                "elapsed_hours": round(clock, 4),
                "elapsed_miles": round(cumulative_miles, 4),
            })
            add_seg("on_duty_not_driving", FUEL_STOP_DURATION, "Fuel Stop")
            miles_since_fuel = 0.0

    # ── Dropoff ────────────────────────────────────────────────────────────────
    add_seg("on_duty_not_driving", dropoff_duration, "Dropoff")

    # ── Pad last calendar day to exact 24-hr boundary with off_duty ───────────
    remainder = round(clock % 24.0, 9)
    if remainder > 1e-9:
        add_seg("off_duty", round(24.0 - remainder, 9), "Off Duty")

    # ── Split flat timeline into per-calendar-day log entries ─────────────────
    return {
        "daily_logs": _build_daily_logs(flat_segments),
        "events":     events,
        "warnings":   warnings,
    }


def _build_daily_logs(flat_segments: list[dict]) -> list[dict]:
    """
    Clip absolute-time segments into per-calendar-day buckets (0–24 hr each).

    Segments crossing midnight are split at the boundary: each piece appears
    in its respective day with start_hour/end_hour relative to that day's
    midnight (0 = midnight, 24 = next midnight).

    NOTE: The 11-hr driving limit is per DUTY WINDOW, not per calendar day.
    A calendar-day entry may show >11 hr driving when a 10-hr rest divides
    two duty windows within the same calendar day. This is compliant behaviour —
    see the module-level docstring.
    """
    if not flat_segments:
        return []

    total_end = flat_segments[-1]["end"]
    num_days  = max(1, math.ceil(round(total_end / 24.0, 6)))

    daily_logs = []
    for d in range(num_days):
        day_abs_start = d * 24.0
        day_abs_end   = day_abs_start + 24.0

        day_segs = []
        for seg in flat_segments:
            clip_start = max(seg["start"], day_abs_start)
            clip_end   = min(seg["end"],   day_abs_end)
            if clip_end - clip_start < 1e-9:
                continue
            day_segs.append({
                "status":     seg["status"],
                "start_hour": round(clip_start - day_abs_start, 4),
                "end_hour":   round(clip_end   - day_abs_start, 4),
                "label":      seg["label"],
            })

        totals = {
            "off_duty":             0.0,
            "sleeper_berth":        0.0,
            "driving":              0.0,
            "on_duty_not_driving":  0.0,
        }
        for s in day_segs:
            dur = s["end_hour"] - s["start_hour"]
            if s["status"] in totals:
                totals[s["status"]] = round(totals[s["status"]] + dur, 4)

        digital_total = round(totals["driving"] + totals["on_duty_not_driving"], 4)

        daily_logs.append({
            "day":           d + 1,
            "date_label":    f"Day {d + 1}",
            "segments":      day_segs,
            "totals":        totals,
            "digital_total": digital_total,
        })

    return daily_logs
