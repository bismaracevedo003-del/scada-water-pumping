# I/O list and tag map

## 1. Physical I/O (S7-1200 CPU 1214C)

| Address | Type | Description | Range / state |
| --- | --- | --- | --- |
| `I0.0` | DI | Tank low-low level switch (LSLL) | 1 = low |
| `I0.1` | DI | Tank high-high level switch (LSHH) | 1 = high |
| `I0.2` | DI | Pump 1 overload auxiliary contact | 1 = trip |
| `I0.3` | DI | Pump 2 overload auxiliary contact | 1 = trip |
| `I0.4` | DI | Emergency stop (NC) | 1 = healthy |
| `I0.5` | DI | Flow proof switch | 1 = flow |
| `IW64` | AI | Level transmitter, 4-20 mA | 0-100 % |
| `IW66` | AI | Discharge pressure transmitter, 4-20 mA | 0-10 bar |
| `IW68` | AI | Flow transmitter, 4-20 mA | 0-120 m³/h |
| `Q0.0` | DO | Pump 1 contactor / VFD run | 1 = run |
| `Q0.1` | DO | Pump 2 contactor / VFD run | 1 = run |
| `Q0.2` | DO | Warning beacon | 1 = on |
| `Q0.3` | DO | Horn | 1 = on |
| `QW80` | AQ | Pump 1 VFD speed reference, 4-20 mA | 0-50 Hz |
| `QW82` | AQ | Pump 2 VFD speed reference, 4-20 mA | 0-50 Hz |

## 2. HMI tag database (DB10)

| Offset | Name | Type | Access | Description |
| --- | --- | --- | --- | --- |
| 0.0 | `TankLevel_PV` | Real | R | Tank level in % |
| 4.0 | `DischargePressure_PV` | Real | R | Pressure in bar |
| 8.0 | `Flow_PV` | Real | R | Flow in m³/h |
| 12.0 | `Pump1_Run` | Bool | R | Pump 1 running feedback |
| 12.1 | `Pump2_Run` | Bool | R | Pump 2 running feedback |
| 12.2 | `Pump1_Fault` | Bool | R | Pump 1 fault latched |
| 12.3 | `Pump2_Fault` | Bool | R | Pump 2 fault latched |
| 14.0 | `Pump1_Mode` | Int | R/W | 0 = MANUAL, 1 = AUTO |
| 16.0 | `Pump2_Mode` | Int | R/W | 0 = MANUAL, 1 = AUTO |
| 18.0 | `Pump1_Command` | Bool | R/W | Manual start request |
| 18.1 | `Pump2_Command` | Bool | R/W | Manual start request |
| 20.0 | `LeadPump` | Int | R | 1 or 2 |
| 22.0 | `Pump1_Runtime_s` | DInt | R | Accumulated run time |
| 26.0 | `Pump2_Runtime_s` | DInt | R | Accumulated run time |
| 30.0 | `Alarm_LowLevel` | Bool | R | Low level latched |
| 30.1 | `Alarm_HighPressure` | Bool | R | High pressure latched |
| 30.2 | `Alarm_DryRun` | Bool | R | Dry run latched |
| 30.3 | `Alarm_Overload` | Bool | R | Pump overload latched |
| 30.4 | `Alarm_SensorFault` | Bool | R | 4-20 mA out of range |
| 30.5 | `Alarm_JammedPump` | Bool | R | Run command without flow |
| 32.0 | `AlarmAck` | Bool | R/W | Rising edge clears latch |

## 3. Scaling formula

```text
EU = ((RAW - 5530) / (27648 - 5530)) * (EU_MAX - EU_MIN) + EU_MIN
```

- 4 mA = 5530 counts, 20 mA = 27648 counts (S7-1200 default).
- Values outside 4-20 mA by more than 5 % set `Alarm_SensorFault`.
- `EU_MIN/MAX`: level 0-100 %, pressure 0-10 bar, flow 0-120 m³/h.

## 4. Nota (ES)

El simulador usa exactamente estos nombres y tipos para que el contrato entre PLC, API y HMI no cambie al migrar de `simulator` a `s7`.
