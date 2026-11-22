import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

FIELDS = (
    'recorded_at',
    'TankLevel_PV',
    'DischargePressure_PV',
    'Flow_PV',
    'Pump1_Run',
    'Pump2_Run',
    'LeadPump',
    'source',
)


def main():
    parser = argparse.ArgumentParser(description='Export telemetry history to CSV')
    parser.add_argument('--url', default='http://127.0.0.1:3001/api/v1/history?limit=1000')
    parser.add_argument('--output', default=None)
    args = parser.parse_args()

    with urlopen(args.url) as response:
        rows = json.load(response)

    output = args.output or f"telemetry_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}.csv"
    with Path(output).open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            values = dict(row)
            values['recorded_at'] = values.get('storedAt', values.get('elapsed_s', ''))
            writer.writerow(values)
    print(output)


if __name__ == '__main__':
    main()
