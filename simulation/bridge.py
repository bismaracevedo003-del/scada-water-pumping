import json
import sys

from plc_simulator import PumpingStation, load_scenario


def apply_due_events(station, fired):
    elapsed = station.elapsed_s
    for index, event in enumerate(station.scenario.get("events", [])):
        if index in fired or float(event.get("at_s", 0)) > elapsed:
            continue
        fired.add(index)
        action = event["action"]
        if action == "inject_fault":
            station.inject_fault(event["fault"], bool(event.get("active", True)))
        elif action == "set_inflow":
            station.set_inflow(float(event["value_m3h"]))


def main():
    scenario_name = sys.argv[1] if len(sys.argv) > 1 else "normal"
    station = PumpingStation(scenario=load_scenario(scenario_name))
    fired = set()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        request_id = request.get("id")
        command = request.get("cmd")
        data = None
        error = None

        try:
            if command == "tick":
                station.tick(float(request.get("dt", 1.0)))
                apply_due_events(station, fired)
            elif command == "set_mode":
                station.set_mode(int(request["pump"]), request["mode"])
            elif command == "set_command":
                station.set_command(int(request["pump"]), bool(request["command"]))
            elif command == "ack":
                station.acknowledge(request.get("alarm"))
            elif command == "inject_fault":
                station.inject_fault(request["fault"], bool(request.get("active", True)))
            elif command == "set_inflow":
                station.set_inflow(float(request["value_m3h"]))
            elif command != "snapshot":
                raise ValueError(f"Unknown command: {command}")
            data = station.snapshot()
        except Exception as exc:
            error = str(exc)

        print(json.dumps({"id": request_id, "data": data, "error": error}), flush=True)


if __name__ == "__main__":
    main()
