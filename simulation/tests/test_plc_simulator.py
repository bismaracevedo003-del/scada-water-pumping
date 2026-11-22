import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from plc_simulator import FBAlarm, PumpingStation, counts_to_ma, load_scenario, scale_4_20ma


class ScalingTests(unittest.TestCase):
    def test_4ma_maps_to_minimum(self):
        value, fault = scale_4_20ma(4.0, 0.0, 100.0)
        self.assertAlmostEqual(value, 0.0)
        self.assertFalse(fault)

    def test_20ma_maps_to_maximum(self):
        value, fault = scale_4_20ma(20.0, 0.0, 100.0)
        self.assertAlmostEqual(value, 100.0)
        self.assertFalse(fault)

    def test_out_of_range_sets_fault(self):
        _, fault = scale_4_20ma(3.5, 0.0, 100.0)
        self.assertTrue(fault)

    def test_s7_counts_conversion(self):
        self.assertAlmostEqual(counts_to_ma(5530), 4.0, places=3)
        self.assertAlmostEqual(counts_to_ma(27648), 20.0, places=3)


class AlarmTests(unittest.TestCase):
    def test_latch_and_ack_after_condition_clears(self):
        alarm = FBAlarm()
        self.assertTrue(alarm.update(True, False))
        self.assertTrue(alarm.update(False, False))
        self.assertFalse(alarm.update(False, True))
        self.assertFalse(alarm.update(False, False))

    def test_ack_does_not_clear_active_condition(self):
        alarm = FBAlarm()
        alarm.update(True, False)
        self.assertTrue(alarm.update(True, True))


class ControlTests(unittest.TestCase):
    def test_lead_starts_below_30_percent(self):
        station = PumpingStation(scenario={"initial_level": 25, "inflow_m3h": 0})
        snapshot = station.tick()
        self.assertTrue(snapshot["Pump1_Run"])
        self.assertFalse(snapshot["Pump2_Run"])

    def test_lag_starts_below_20_percent(self):
        station = PumpingStation(scenario={"initial_level": 18, "inflow_m3h": 0})
        snapshot = station.tick()
        self.assertTrue(snapshot["Pump1_Run"])
        self.assertTrue(snapshot["Pump2_Run"])

    def test_all_pumps_stop_above_high_level(self):
        station = PumpingStation(scenario={"initial_level": 90, "inflow_m3h": 100})
        station.running = [True, True]
        snapshot = station.tick()
        self.assertFalse(snapshot["Pump1_Run"])
        self.assertFalse(snapshot["Pump2_Run"])

    def test_overload_stops_pump_and_latches_alarm(self):
        station = PumpingStation(scenario={"initial_level": 25, "inflow_m3h": 0})
        station.inject_fault("overload_pump1", True)
        snapshot = station.tick()
        self.assertFalse(snapshot["Pump1_Run"])
        self.assertTrue(snapshot["Alarm_Overload"])

    def test_ack_reasserts_while_fault_active(self):
        station = PumpingStation(scenario={"initial_level": 10, "inflow_m3h": 0})
        station.tick()
        station.acknowledge("LowLevel")
        snapshot = station.tick()
        self.assertTrue(snapshot["Alarm_LowLevel"])

    def test_ack_clears_after_fault_disappears(self):
        station = PumpingStation(scenario={"initial_level": 10, "inflow_m3h": 0})
        station.tick()
        station.level = 80
        for _ in range(3):
            station.tick()
        station.acknowledge("LowLevel")
        snapshot = station.tick()
        self.assertFalse(snapshot["Alarm_LowLevel"])

    def test_lead_alternates_by_runtime(self):
        station = PumpingStation(scenario={"initial_level": 60, "inflow_m3h": 20})
        station.runtime_s[0] = 700
        snapshot = station.tick()
        self.assertEqual(snapshot["LeadPump"], 2)

    def test_manual_start_blocked_at_low_low_level(self):
        station = PumpingStation(scenario={"initial_level": 3, "inflow_m3h": 0})
        station.set_mode(1, "MANUAL")
        station.set_command(1, True)
        snapshot = station.tick()
        self.assertFalse(snapshot["Pump1_Run"])

    def test_dry_run_alarm(self):
        station = PumpingStation(scenario={"initial_level": 3, "inflow_m3h": 0})
        station.running = [True, False]
        snapshot = station.tick()
        self.assertTrue(snapshot["Alarm_DryRun"])

    def test_jammed_pump_after_ten_seconds(self):
        station = PumpingStation(scenario={"initial_level": 25, "inflow_m3h": 0})
        station.inject_fault("flow_blocked", True)
        snapshot = station.tick()
        for _ in range(12):
            snapshot = station.tick()
        self.assertTrue(snapshot["Pump1_Run"])
        self.assertTrue(snapshot["Alarm_JammedPump"])

    def test_sensor_fault_alarm(self):
        station = PumpingStation()
        station.inject_fault("sensor_fault", True)
        snapshot = station.tick()
        self.assertTrue(snapshot["Alarm_SensorFault"])

    def test_snapshot_exposes_db10_tag_map(self):
        station = PumpingStation()
        snapshot = station.tick()
        for tag in (
            "TankLevel_PV",
            "DischargePressure_PV",
            "Flow_PV",
            "Pump1_Run",
            "Pump2_Run",
            "LeadPump",
            "Alarm_LowLevel",
        ):
            self.assertIn(tag, snapshot)


class ScenarioTests(unittest.TestCase):
    def test_load_builtin_scenario(self):
        scenario = load_scenario("normal")
        self.assertEqual(scenario["name"], "normal")

    def test_unknown_scenario_raises(self):
        with self.assertRaises(ValueError):
            load_scenario("missing")


if __name__ == "__main__":
    unittest.main()
