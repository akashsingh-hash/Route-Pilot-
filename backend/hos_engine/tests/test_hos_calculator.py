"""
test_hos_calculator.py — Unit tests for the HOS calculator.

Tests the 4 edge cases specified in Section 2.4 of the build spec:
  a) Short trip  — 6 hr driving,  350 mi, cycle_used=0
  b) Medium trip — 15 hr driving, 900 mi, cycle_used=0
  c) Long trip   — 42 hr driving, 2500 mi, cycle_used=0
  d) High cycle  — 10 hr driving, 600 mi, cycle_used=65

Pure Python tests: no Django dependency.
"""

import unittest
import sys
import os

# Ensure the backend directory is on the path so we can import the module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from hos_engine.services.hos_calculator import calculate_hos_plan


# ─── Helpers ──────────────────────────────────────────────────────────────────

def coalesced_events(daily_logs: list[dict]) -> list[dict]:
    """
    Reconstruct a flat, de-duplicated event list from daily_logs.

    Segments that span a midnight boundary get split across two calendar days
    by the day-splitting logic.  This helper re-joins them so we can count
    *logical* events (e.g. one 34-hr restart = one event, not two segments).
    """
    all_segs = []
    for day in daily_logs:
        day_offset = (day["day"] - 1) * 24.0
        for seg in day["segments"]:
            all_segs.append({
                "label": seg["label"],
                "start": day_offset + seg["start_hour"],
                "end":   day_offset + seg["end_hour"],
            })
    all_segs.sort(key=lambda s: s["start"])

    events: list[dict] = []
    for seg in all_segs:
        if (events
                and events[-1]["label"] == seg["label"]
                and abs(events[-1]["end"] - seg["start"]) < 0.01):
            events[-1]["end"] = seg["end"]
        else:
            events.append(dict(seg))
    return events


def count_by_label(events: list[dict], label: str) -> int:
    return sum(1 for e in events if e["label"] == label)


# ─── Test cases ───────────────────────────────────────────────────────────────

class TestShortTrip(unittest.TestCase):
    """
    Scenario (a): 6 driving hours, 350 miles, cycle_used=0.

    Expected timeline (single duty window, no limits hit):
      0→1     Pickup (ODND)
      1→7     Drive 6 hr
      7→8     Dropoff (ODND)
      8→24    Off Duty (padding)

    1 log sheet.  No rests, no breaks, no fuel stops.
    Day 1 totals: off_duty=16, driving=6, ODND=2 → sum=24, digital=8.
    """

    @classmethod
    def setUpClass(cls):
        cls.result = calculate_hos_plan(
            total_driving_hours=6.0,
            total_distance_miles=350.0,
            current_cycle_used=0.0,
        )
        cls.logs   = cls.result["daily_logs"]
        cls.events = coalesced_events(cls.logs)

    def test_number_of_log_sheets(self):
        self.assertEqual(len(self.logs), 1)

    def test_day1_totals_sum_to_24(self):
        t = self.logs[0]["totals"]
        total = t["off_duty"] + t["sleeper_berth"] + t["driving"] + t["on_duty_not_driving"]
        self.assertAlmostEqual(total, 24.0, places=4)

    def test_day1_totals_values(self):
        t = self.logs[0]["totals"]
        self.assertAlmostEqual(t["off_duty"],             16.0, places=4)
        self.assertAlmostEqual(t["sleeper_berth"],         0.0, places=4)
        self.assertAlmostEqual(t["driving"],               6.0, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],   2.0, places=4)

    def test_day1_digital_total(self):
        self.assertAlmostEqual(self.logs[0]["digital_total"], 8.0, places=4)

    def test_no_rests(self):
        self.assertEqual(count_by_label(self.events, "10-hr Rest"), 0)

    def test_no_breaks(self):
        self.assertEqual(count_by_label(self.events, "30-min Break"), 0)

    def test_no_fuel_stops(self):
        self.assertEqual(count_by_label(self.events, "Fuel Stop"), 0)

    def test_no_warnings(self):
        self.assertEqual(len(self.result["warnings"]), 0)


class TestMediumTrip(unittest.TestCase):
    """
    Scenario (b): 15 driving hours, 900 miles, cycle_used=0.

    Expected timeline (two duty windows):
      0→1      Pickup (ODND)
      1→9      Drive 8 hr  → break threshold hit
      9→9.5    30-min Break (ODND)
      9.5→12.5 Drive 3 hr  → 11-hr driving limit hit
      12.5→22.5 10-hr Rest
      22.5→26.5 Drive 4 hr (remaining)
      26.5→27.5 Dropoff (ODND)
      27.5→48   Off Duty (padding)

    2 log sheets, 1 rest, 1 break, 0 fuel, 0 warnings.
    Day 1: off_duty=10, driving=12.5, ODND=1.5, digital=14.0
    Day 2: off_duty=20.5, driving=2.5, ODND=1.0, digital=3.5
    """

    @classmethod
    def setUpClass(cls):
        cls.result = calculate_hos_plan(
            total_driving_hours=15.0,
            total_distance_miles=900.0,
            current_cycle_used=0.0,
        )
        cls.logs   = cls.result["daily_logs"]
        cls.events = coalesced_events(cls.logs)

    def test_number_of_log_sheets(self):
        self.assertEqual(len(self.logs), 2)

    # ── Day 1 ──
    def test_day1_totals_sum_to_24(self):
        t = self.logs[0]["totals"]
        total = t["off_duty"] + t["sleeper_berth"] + t["driving"] + t["on_duty_not_driving"]
        self.assertAlmostEqual(total, 24.0, places=4)

    def test_day1_totals_values(self):
        t = self.logs[0]["totals"]
        self.assertAlmostEqual(t["off_duty"],            10.0, places=4)
        self.assertAlmostEqual(t["sleeper_berth"],        0.0, places=4)
        self.assertAlmostEqual(t["driving"],             12.5, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.5, places=4)

    def test_day1_digital_total(self):
        self.assertAlmostEqual(self.logs[0]["digital_total"], 14.0, places=4)

    # ── Day 2 ──
    def test_day2_totals_sum_to_24(self):
        t = self.logs[1]["totals"]
        total = t["off_duty"] + t["sleeper_berth"] + t["driving"] + t["on_duty_not_driving"]
        self.assertAlmostEqual(total, 24.0, places=4)

    def test_day2_totals_values(self):
        t = self.logs[1]["totals"]
        self.assertAlmostEqual(t["off_duty"],            20.5, places=4)
        self.assertAlmostEqual(t["sleeper_berth"],        0.0, places=4)
        self.assertAlmostEqual(t["driving"],              2.5, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.0, places=4)

    def test_day2_digital_total(self):
        self.assertAlmostEqual(self.logs[1]["digital_total"], 3.5, places=4)

    # ── Events ──
    def test_one_rest(self):
        self.assertEqual(count_by_label(self.events, "10-hr Rest"), 1)

    def test_one_break(self):
        self.assertEqual(count_by_label(self.events, "30-min Break"), 1)

    def test_no_fuel_stops(self):
        self.assertEqual(count_by_label(self.events, "Fuel Stop"), 0)

    def test_no_warnings(self):
        self.assertEqual(len(self.result["warnings"]), 0)


class TestLongTrip(unittest.TestCase):
    """
    Scenario (c): 42 driving hours, 2500 miles, cycle_used=0.

    4 log sheets, 3 rests, 4 breaks, 2 fuel stops, 0 warnings.

    Day 1: off_duty=10.0, driving=12.5, ODND=1.5, digital=14.0
    Day 2: off_duty=10.0, driving=13.0, ODND=1.0, digital=14.0
    Day 3: off_duty=10.0, driving=13.0, ODND=1.0, digital=14.0
    Day 4: off_duty=19.0, driving=3.5,  ODND=1.5, digital=5.0
    """

    @classmethod
    def setUpClass(cls):
        cls.result = calculate_hos_plan(
            total_driving_hours=42.0,
            total_distance_miles=2500.0,
            current_cycle_used=0.0,
        )
        cls.logs   = cls.result["daily_logs"]
        cls.events = coalesced_events(cls.logs)

    def test_number_of_log_sheets(self):
        self.assertEqual(len(self.logs), 4)

    # ── Every day sums to 24 ──
    def test_all_days_sum_to_24(self):
        for day_log in self.logs:
            t = day_log["totals"]
            total = t["off_duty"] + t["sleeper_berth"] + t["driving"] + t["on_duty_not_driving"]
            self.assertAlmostEqual(
                total, 24.0, places=4,
                msg=f"Day {day_log['day']} totals sum to {total}, expected 24.0",
            )

    # ── Per-day detailed totals ──
    def test_day1(self):
        t = self.logs[0]["totals"]
        self.assertAlmostEqual(t["off_duty"],            10.0, places=4)
        self.assertAlmostEqual(t["driving"],             12.5, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.5, places=4)
        self.assertAlmostEqual(self.logs[0]["digital_total"], 14.0, places=4)

    def test_day2(self):
        t = self.logs[1]["totals"]
        self.assertAlmostEqual(t["off_duty"],            10.0, places=4)
        self.assertAlmostEqual(t["driving"],             13.0, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.0, places=4)
        self.assertAlmostEqual(self.logs[1]["digital_total"], 14.0, places=4)

    def test_day3(self):
        t = self.logs[2]["totals"]
        self.assertAlmostEqual(t["off_duty"],            10.0, places=4)
        self.assertAlmostEqual(t["driving"],             13.0, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.0, places=4)
        self.assertAlmostEqual(self.logs[2]["digital_total"], 14.0, places=4)

    def test_day4(self):
        t = self.logs[3]["totals"]
        self.assertAlmostEqual(t["off_duty"],            19.0, places=4)
        self.assertAlmostEqual(t["driving"],              3.5, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.5, places=4)
        self.assertAlmostEqual(self.logs[3]["digital_total"], 5.0, places=4)

    # ── Event counts ──
    def test_three_rests(self):
        self.assertEqual(count_by_label(self.events, "10-hr Rest"), 3)

    def test_four_breaks(self):
        self.assertEqual(count_by_label(self.events, "30-min Break"), 4)

    def test_two_fuel_stops(self):
        self.assertEqual(count_by_label(self.events, "Fuel Stop"), 2)

    def test_no_warnings(self):
        self.assertEqual(len(self.result["warnings"]), 0)


class TestHighCycleTrip(unittest.TestCase):
    """
    Scenario (d): 10 driving hours, 600 miles, cycle_used=65.

    Expected timeline:
      0→1    Pickup (ODND)          cycle: 65→66
      1→5    Drive 4 hr             cycle: 66→70  (cycle limit hit)
      5→39   34-hr Cycle Restart    cycle: → 0
      39→45  Drive 6 hr             cycle: 0→6
      45→46  Dropoff (ODND)         cycle: 6→7
      46→48  Off Duty (padding)

    2 log sheets, 0 rests, 0 breaks, 0 fuel, 1 restart, 1 warning.
    Day 1: off_duty=19, driving=4, ODND=1, digital=5.0
    Day 2: off_duty=17, driving=6, ODND=1, digital=7.0
    """

    @classmethod
    def setUpClass(cls):
        cls.result = calculate_hos_plan(
            total_driving_hours=10.0,
            total_distance_miles=600.0,
            current_cycle_used=65.0,
        )
        cls.logs   = cls.result["daily_logs"]
        cls.events = coalesced_events(cls.logs)

    def test_number_of_log_sheets(self):
        self.assertEqual(len(self.logs), 2)

    # ── Day 1 ──
    def test_day1_totals_sum_to_24(self):
        t = self.logs[0]["totals"]
        total = t["off_duty"] + t["sleeper_berth"] + t["driving"] + t["on_duty_not_driving"]
        self.assertAlmostEqual(total, 24.0, places=4)

    def test_day1_totals_values(self):
        t = self.logs[0]["totals"]
        self.assertAlmostEqual(t["off_duty"],            19.0, places=4)
        self.assertAlmostEqual(t["sleeper_berth"],        0.0, places=4)
        self.assertAlmostEqual(t["driving"],              4.0, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.0, places=4)

    def test_day1_digital_total(self):
        self.assertAlmostEqual(self.logs[0]["digital_total"], 5.0, places=4)

    # ── Day 2 ──
    def test_day2_totals_sum_to_24(self):
        t = self.logs[1]["totals"]
        total = t["off_duty"] + t["sleeper_berth"] + t["driving"] + t["on_duty_not_driving"]
        self.assertAlmostEqual(total, 24.0, places=4)

    def test_day2_totals_values(self):
        t = self.logs[1]["totals"]
        self.assertAlmostEqual(t["off_duty"],            17.0, places=4)
        self.assertAlmostEqual(t["sleeper_berth"],        0.0, places=4)
        self.assertAlmostEqual(t["driving"],              6.0, places=4)
        self.assertAlmostEqual(t["on_duty_not_driving"],  1.0, places=4)

    def test_day2_digital_total(self):
        self.assertAlmostEqual(self.logs[1]["digital_total"], 7.0, places=4)

    # ── Events ──
    def test_no_rests(self):
        self.assertEqual(count_by_label(self.events, "10-hr Rest"), 0)

    def test_no_breaks(self):
        self.assertEqual(count_by_label(self.events, "30-min Break"), 0)

    def test_no_fuel_stops(self):
        self.assertEqual(count_by_label(self.events, "Fuel Stop"), 0)

    def test_one_restart(self):
        self.assertEqual(count_by_label(self.events, "34-hr Cycle Restart"), 1)

    def test_one_warning(self):
        self.assertEqual(len(self.result["warnings"]), 1)
        self.assertIn("34-hour cycle restart", self.result["warnings"][0].lower())


if __name__ == "__main__":
    unittest.main()
