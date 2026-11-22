# Test plan and results

## 1. Scope

Tests cover the process simulator, scaling math, pump control state machine, alarm handling, API contracts and repository abstraction. No real PLC or field devices were connected.

## 2. Test cases

| ID | Case | Expected | Status |
| --- | --- | --- | --- |
| T-01 | 4-20 mA to EU scaling | 4 mA → 0 %, 20 mA → 100 % | Pass |
| T-02 | Out-of-range raw value | `SensorFault` alarm set | Pass |
| T-03 | Level 25 %, AUTO | Lead pump running | Pass |
| T-04 | Level 15 %, AUTO | Lead + lag running | Pass |
| T-05 | Level 90 % | Both pumps stopped | Pass |
| T-06 | Overload while running | Pump stops, `Overload` alarm latched | Pass |
| T-07 | Ack with fault still active | Alarm reasserts | Pass |
| T-08 | Ack after fault cleared | Alarm clears | Pass |
| T-09 | Runtime-based alternation | Lead changes to least-used pump | Pass |
| T-10 | Manual start blocked by low-low level | Pump stays stopped | Pass |
| T-11 | REST telemetry contract | Fields and types match DB10 map | Pass |
| T-12 | WebSocket broadcast | Snapshot delivered to client | Pass |
| T-13 | Repository fallback | Samples stored without MySQL | Pass |
| T-14 | Dry-run detection | Alarm raised below 5 % with run command | Pass |
| T-15 | Jammed pump detection | Alarm after 10 s without flow | Pass |

## 3. Commands

```powershell
npm test
```

Runs `node --test backend/tests` and `python -m unittest discover -s simulation/tests -v`.

## 4. Evidence

Automated test output is reproducible with the command above. Manual simulation scenarios are defined in `simulation/scenarios.json`.

## 5. Pending verification (hardware)

- TIA Portal V19 project download to CPU 1214C.
- Loop check of AI channels with a 4-20 mA source.
- S7 TCP read/write through PLCSIM Advanced virtual NIC.
- Electrical interlock verification with actual contactors and overload relays.

## 6. Nota (ES)

Los casos T-01 a T-15 están automatizados y se ejecutan en segundos. Los pendientes requieren hardware/licencias y se documentan como mejoras futuras, no como resultados obtenidos.
