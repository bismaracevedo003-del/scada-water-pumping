# Ladder block documentation

This document describes the LAD networks to be implemented in TIA Portal V19. The equivalent SCL sources in `../program/src/` are imported by the Openness script so the control strategy can be validated without manual block entry. Convert each SCL block to LAD in TIA when a LAD-only deliverable is required; the network descriptions below are the reference.

## FB_AI_Scale

| Network | Contacts / operations | Result |
| --- | --- | --- |
| N1 | `RawInt := WORD_TO_INT(Raw)` | Convert raw count |
| N2 | `r := (RawInt - 5530) / 22118` | Normalize 4-20 mA |
| N3 | `OR(r < -0.05, r > 1.05)` | `Fault` coil |
| N4 | `LIMIT(r, 0, 1)` then `Value := EuMin + r * (EuMax - EuMin)` | Engineering value |

## FB_Alarm

| Network | Contacts / operations | Result |
| --- | --- | --- |
| N1 | `Condition` NO → `S latched` | Latch on condition |
| N2 | `Ack` NO + `AckPrev` NC + `Condition` NC → `R latched` | Reset only if condition cleared |
| N3 | `MOV(Ack, AckPrev)` | Edge memory |
| N4 | `latched` NO → `Alarm` coil | Alarm output |

## FB_PumpControl

| Network | Contacts / operations | Result |
| --- | --- | --- |
| N1 | `Enable` NC OR `Fault` NO OR `HighPressure` NO → `R Run` | Safety stop |
| N2 | `Mode = 1` (AUTO) AND `StartLevel` → `S Run` | Auto start |
| N3 | `Mode = 1` AND `StopLevel` → `R Run` | Auto stop |
| N4 | `Mode = 0` AND `Command` → `Run := Command` | Manual command |
| N5 | `Run` NO → `INC Runtime` | Runtime counter |

## OB1

| Network | Description |
| --- | --- |
| N1 | Call `FB_AI_Scale` for level, pressure and flow |
| N2 | Call `FB_Alarm` six times (low level, high pressure, dry run, overload, sensor fault, jammed pump) |
| N3 | Call `FB_PumpControl` twice with `Lead := (LeadPump = 1)` and `Lead := (LeadPump = 2)` |
| N4 | If lead runtime > swap interval and level > 50 %, toggle `LeadPump` and reset runtime of both pumps |
| N5 | Map run/fault/alarm bits to DB10 for the HMI |

## Nota (ES)

Cada red Ladder tiene su equivalente exacto en SCL y en el simulador Python. Esto permite defender la lógica en una entrevista aunque el archivo `.ap19` no esté versionado.
