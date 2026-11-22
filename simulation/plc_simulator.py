"""Software model of a dual-pump water pumping station.

The tag names match DB10 in docs/io-list.md so the same API can switch
between this simulator and a real S7-1200 without changing contracts.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

EU_RANGES = {
    "TankLevel_PV": (0.0, 100.0),
    "DischargePressure_PV": (0.0, 10.0),
    "Flow_PV": (0.0, 120.0),
}

ALARM_NAMES = (
    "LowLevel",
    "HighPressure",
    "DryRun",
    "Overload",
    "SensorFault",
    "JammedPump",
)


def scale_4_20ma(raw_ma: float, eu_min: float, eu_max: float) -> tuple[float, bool]:
    normalized = (raw_ma - 4.0) / 16.0
    fault = raw_ma < 3.8 or raw_ma > 20.8
    normalized = min(1.0, max(0.0, normalized))
    return eu_min + normalized * (eu_max - eu_min), fault


def counts_to_ma(raw_counts: int) -> float:
    return 4.0 + (raw_counts - 5530) / 22118 * 16.0


@dataclass
class FBAlarm:
    latched: bool = False
    ack_prev: bool = False

    def update(self, condition: bool, ack: bool) -> bool:
        rising_ack = ack and not self.ack_prev
        self.ack_prev = ack
        if condition:
            self.latched = True
        if rising_ack and not condition:
            self.latched = False
        return self.latched


@dataclass
class PumpingStation:
    scenario: dict[str, Any] = field(default_factory=dict)
    volume_m3: float = 5.0
    pump_flow_m3h: float = 45.0
    swap_interval_s: float = 600.0
    nominal_inflow_m3h: float = 20.0

    def __post_init__(self) -> None:
        self.level = float(self.scenario.get("initial_level", 50.0))
        self.inflow_m3h = float(self.scenario.get("inflow_m3h", self.nominal_inflow_m3h))
        self.pressure_offset_bar = float(self.scenario.get("pressure_offset_bar", 0.0))
        self.modes = [1, 1]
        self.commands = [False, False]
        self.running = [False, False]
        self.runtime_s = [0.0, 0.0]
        self.lead_pump = 1
        self.flow_m3h = 0.0
        self.pressure_bar = 0.0
        self.elapsed_s = 0.0
        self.overload = [False, False]
        self.sensor_fault = False
        self.flow_blocked = False
        self.emergency_stop = True
        self.jam_timer_s = 0.0
        self.ack_pulse = False
        self.alarms = {name: FBAlarm() for name in ALARM_NAMES}

    def set_mode(self, pump: int, mode: str | int) -> None:
        if pump not in (1, 2):
            raise ValueError("pump must be 1 or 2")
        value = 1 if mode in ("AUTO", 1, "1") else 0
        self.modes[pump - 1] = value

    def set_command(self, pump: int, command: bool) -> None:
        if pump not in (1, 2):
            raise ValueError("pump must be 1 or 2")
        self.commands[pump - 1] = bool(command)

    def acknowledge(self, alarm_id: str | None = None) -> bool:
        if alarm_id is not None and alarm_id not in ALARM_NAMES:
            return False
        self.ack_pulse = True
        return True

    def inject_fault(self, name: str, active: bool = True) -> bool:
        faults = {
            "overload_pump1": lambda value: self.overload.__setitem__(0, value),
            "overload_pump2": lambda value: self.overload.__setitem__(1, value),
            "sensor_fault": lambda value: setattr(self, "sensor_fault", value),
            "flow_blocked": lambda value: setattr(self, "flow_blocked", value),
            "emergency_stop": lambda value: setattr(self, "emergency_stop", value),
        }
        if name not in faults:
            return False
        faults[name](bool(active))
        return True

    def set_inflow(self, value_m3h: float) -> None:
        self.inflow_m3h = max(0.0, float(value_m3h))

    def tick(self, dt: float = 1.0) -> dict[str, Any]:
        dt = max(0.0, float(dt))
        self._update_process(dt)
        conditions = self._alarm_conditions()
        for name, alarm in self.alarms.items():
            alarm.update(conditions[name], self.ack_pulse)
        self.ack_pulse = False
        self._control(dt)
        self.elapsed_s += dt
        return self.snapshot()

    def _update_process(self, dt: float) -> None:
        pump_count = sum(1 for value in self.running if value)
        if self.level <= 5.0 or self.flow_blocked:
            actual_flow = 0.0
        else:
            ripple = 0.98 + 0.02 * math.sin(self.elapsed_s / 7.0)
            actual_flow = pump_count * self.pump_flow_m3h * ripple
        self.flow_m3h = actual_flow
        net_flow = self.inflow_m3h - actual_flow
        self.level = min(100.0, max(0.0, self.level + net_flow * dt / 3600.0 / self.volume_m3 * 100.0))
        if self.level <= 5.0:
            self.pressure_bar = 0.2
        else:
            self.pressure_bar = min(
                12.0,
                1.5 + 0.075 * actual_flow + 0.4 * max(0, pump_count - 1) + self.pressure_offset_bar,
            )

    def _alarm_conditions(self) -> dict[str, bool]:
        pump_running = any(self.running)
        jam_condition = pump_running and self.flow_m3h < 2.0
        self.jam_timer_s = self.jam_timer_s + 1.0 if jam_condition else 0.0
        return {
            "LowLevel": self.level < 15.0,
            "HighPressure": self.pressure_bar > 9.5,
            "DryRun": pump_running and self.level < 5.0,
            "Overload": any(self.overload),
            "SensorFault": self.sensor_fault,
            "JammedPump": self.jam_timer_s >= 10.0,
        }

    def _control(self, dt: float) -> None:
        high_pressure = self.alarms["HighPressure"].latched
        for index in range(2):
            pump = index + 1
            is_lead = self.lead_pump == pump
            start_threshold = 30.0 if is_lead else 20.0
            stop_threshold = 75.0 if is_lead else 85.0
            enable = self.emergency_stop and self.level > 5.0 and not self.overload[index] and not high_pressure
            if not enable:
                self.running[index] = False
            elif self.modes[index] == 1:
                if self.level < start_threshold:
                    self.running[index] = True
                if self.level > stop_threshold:
                    self.running[index] = False
            else:
                self.running[index] = self.commands[index]
            if self.running[index]:
                self.runtime_s[index] += dt

        lead_runtime = self.runtime_s[self.lead_pump - 1]
        no_demand = self.level >= 30.0
        if lead_runtime >= self.swap_interval_s and self.level > 50.0 and no_demand:
            self.lead_pump = 2 if self.lead_pump == 1 else 1
            self.runtime_s = [0.0, 0.0]

    def snapshot(self) -> dict[str, Any]:
        level_eu, level_fault = scale_4_20ma(self._to_ma(self.level, "TankLevel_PV"), *EU_RANGES["TankLevel_PV"])
        pressure_eu, pressure_fault = scale_4_20ma(
            self._to_ma(self.pressure_bar, "DischargePressure_PV"), *EU_RANGES["DischargePressure_PV"]
        )
        flow_eu, flow_fault = scale_4_20ma(self._to_ma(self.flow_m3h, "Flow_PV"), *EU_RANGES["Flow_PV"])
        sensor_fault = self.sensor_fault or level_fault or pressure_fault or flow_fault
        return {
            "TankLevel_PV": round(level_eu, 3),
            "DischargePressure_PV": round(pressure_eu, 3),
            "Flow_PV": round(flow_eu, 3),
            "Pump1_Run": self.running[0],
            "Pump2_Run": self.running[1],
            "Pump1_Fault": self.overload[0],
            "Pump2_Fault": self.overload[1],
            "Pump1_Mode": self.modes[0],
            "Pump2_Mode": self.modes[1],
            "LeadPump": self.lead_pump,
            "Pump1_Runtime_s": round(self.runtime_s[0], 1),
            "Pump2_Runtime_s": round(self.runtime_s[1], 1),
            "Alarm_LowLevel": self.alarms["LowLevel"].latched,
            "Alarm_HighPressure": self.alarms["HighPressure"].latched,
            "Alarm_DryRun": self.alarms["DryRun"].latched,
            "Alarm_Overload": self.alarms["Overload"].latched,
            "Alarm_SensorFault": sensor_fault,
            "Alarm_JammedPump": self.alarms["JammedPump"].latched,
            "source": "simulator",
            "scenario": self.scenario.get("name", "custom"),
            "elapsed_s": round(self.elapsed_s, 1),
            "inflow_m3h": self.inflow_m3h,
        }

    @staticmethod
    def _to_ma(value: float, tag: str) -> float:
        eu_min, eu_max = EU_RANGES[tag]
        return 4.0 + (value - eu_min) / (eu_max - eu_min) * 16.0


def load_scenario(name: str) -> dict[str, Any]:
    path = Path(__file__).with_name("scenarios.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    scenarios = data["scenarios"]
    if name not in scenarios:
        raise ValueError(f"Unknown scenario: {name}. Available: {', '.join(scenarios)}")
    scenario = dict(scenarios[name])
    scenario["name"] = name
    return scenario


def run_scenario(name: str, duration_s: int, interval_s: int) -> None:
    scenario = load_scenario(name)
    station = PumpingStation(scenario=scenario)
    for event in scenario.get("events", []):
        at = float(event.get("at_s", 0))
        if at > 0:
            continue
        action = event["action"]
        if action == "inject_fault":
            station.inject_fault(event["fault"], bool(event.get("active", True)))
        elif action == "set_inflow":
            station.set_inflow(float(event["value_m3h"]))

    for second in range(1, int(duration_s) + 1):
        for event in scenario.get("events", []):
            if abs(float(event.get("at_s", 0)) - second) < 0.001:
                action = event["action"]
                if action == "inject_fault":
                    station.inject_fault(event["fault"], bool(event.get("active", True)))
                elif action == "set_inflow":
                    station.set_inflow(float(event["value_m3h"]))
        snapshot = station.tick(1.0)
        if second % interval_s == 0 or second == 1:
            print(json.dumps(snapshot, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate the water pumping station")
    parser.add_argument("--scenario", default="normal")
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--interval", type=int, default=10)
    args = parser.parse_args()
    run_scenario(args.scenario, args.duration, args.interval)


if __name__ == "__main__":
    main()
