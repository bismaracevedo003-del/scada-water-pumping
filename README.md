# SCADA Water Pumping Station

**PLC Engineering · SCADA/HMI · Industrial IoT · Software Integration**

Supervision and control system for a dual-pump water pumping station. The project integrates a Siemens S7-1200 control strategy, a process simulator, a Node.js telemetry API, a React HMI dashboard and a MySQL historical database.

> **Nota (ES):** Este repositorio es una demostración de ingeniería. La lógica se validó en simulador; el proyecto TIA se genera con Openness y la conexión S7 real queda documentada pero no verificada en hardware. Consulta la matriz de evidencia más abajo.

---

## 1. Industrial problem

A pumping station must keep the tank level inside an operating band while avoiding dry running, water hammer and unnecessary pump starts. Operators need manual and automatic modes, automatic pump alternation to balance runtime, alarm acknowledgment and historical trends for OEE-style analysis.

## 2. Objectives

- Control two pumps (lead/lag) from level, pressure and flow instrumentation.
- Support **MANUAL** and **AUTO** modes with bumpless mode changes.
- Alternate the lead pump by accumulated runtime to balance wear.
- Detect and latch alarms: low level, high pressure, dry run, overload, sensor fault and jammed pump.
- Provide a real-time web HMI, telemetry API, alarm history and trends.
- Keep a clear separation between simulated, real and synthetic data.

## 3. System architecture

```text
       PROCESS / SIMULATOR
  Level · Flow · Pressure · Pump status
                |
                v
      SIEMENS S7-1200 CPU 1214C
      FB_AI_Scale · FB_PumpControl · FB_Alarm
                |
      Modbus TCP / S7online (planned)
                |
                v
          NODE.JS API + WebSocket
          Source: simulator | s7
          +-------+---------+
          |                 |
          v                 v
     MYSQL 8 DB        REACT HMI
   telemetry/alarms   dashboard/trends
          |
          v
     Reports / CSV export
```

See [docs/architecture.md](docs/architecture.md) for protocols, tag addresses and data flow.

## 4. Components

| Layer | Technology |
| --- | --- |
| PLC | Siemens S7-1200 CPU 1214C, TIA Portal V19, Ladder (LAD) |
| Simulation | Python 3.14 process model + S7-PLCSIM V19 / PLCSIM Advanced (optional) |
| Backend | Node.js 24, Express 5, WebSocket (`ws`), `nodes7` |
| Frontend | React 19, Vite 7, SVG trend charts |
| Database | MySQL 8, `mysql2` |
| Tests | `node --test`, Python `unittest` |

## 5. Engineering documents

- [Architecture and communication](docs/architecture.md)
- [I/O list and tag map](docs/io-list.md)
- [Control sequence and alarm logic](docs/control-sequence.md)
- [Test plan and results](docs/test-plan.md)
- [Ladder block documentation](plc/documentation/ladder-blocks.md)
- [TIA Openness build procedure](plc/program/README.md)

## 6. PLC logic

| Block | Function |
| --- | --- |
| `FB_AI_Scale` | Converts 4–20 mA raw counts to engineering units, with wire-break and range checks |
| `FB_PumpControl` | Manual/auto command, lead/lag alternation, runtime counters, start/stop interlocks |
| `FB_Alarm` | Alarm detection, latching and acknowledgment |
| `OB1` | Cyclic call: scaling → alarms → pump control → telemetry mapping |

The simulator implements the same state machine as the Ladder documented in `plc/documentation/`.

## 7. Screenshots and evidence

- [Dashboard layout](screenshots/dashboard.svg)
- [PLC control sequence](screenshots/control-sequence.svg)
- [Architecture diagram](screenshots/architecture.svg)

> Real HMI/PLCSIM captures will be added after running the project with TIA Portal and PLCSIM Advanced on a machine with a virtual NIC.

## 8. Installation

```powershell
cd "C:\Users\Bismarck Acevedo\Documents\Github\scada-water-pumping"
npm run setup
Copy-Item .env.example .env
npm test
npm run dev
```

Open `http://127.0.0.1:5173` after starting the frontend in another terminal:

```powershell
npm run dev:frontend
```

Default mode is `PLC_SOURCE=simulator`, so no PLC or database is required. The Python process model runs behind `simulation/bridge.py`; built-in demo scenarios are defined in `simulation/scenarios.json` and selected with `SIMULATION_SCENARIO`.

### PLC connection

```powershell
# .env
PLC_SOURCE=s7
PLC_HOST=192.168.0.1
PLC_PORT=102
```

The S7 adapter reads the DB 10 tag map documented in `docs/io-list.md`. It requires a reachable S7-1200 with PUT/GET enabled or PLCSIM Advanced with a virtual Ethernet adapter. Verify protocol, CPU firmware and licensing before hardware integration.

### MySQL (optional)

```powershell
docker compose up -d
```

Then set `DB_HOST`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` in `.env`. Without `DB_*` configuration the API uses an in-memory repository with the same interface.

## 9. API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Service status and active source |
| `GET` | `/api/v1/telemetry` | Latest process values and pump states |
| `GET` | `/api/v1/alarms` | Active and acknowledged alarms |
| `POST` | `/api/v1/alarms/:id/ack` | Acknowledge an alarm |
| `POST` | `/api/v1/pumps/:id/mode` | Set `AUTO` or `MANUAL` |
| `POST` | `/api/v1/pumps/:id/command` | Start/stop in manual mode |
| `GET` | `/api/v1/history?limit=100` | Stored telemetry samples |
| `GET` | `/api/v1/events` | Operator actions and injected faults |
| `POST` | `/api/v1/simulation/fault` | Inject a fault (simulator source only) |
| `WS` | `/ws/telemetry` | Telemetry push at poll interval |

Export stored telemetry with `python scripts/export_report.py --output report.csv`.

## 10. Tests

```powershell
npm test
```

Covers scaling math, pump alternation, interlocks, alarm latching/acknowledgment, API contracts and repository persistence. Results are recorded in [docs/test-plan.md](docs/test-plan.md).

## 11. Evidence and credibility matrix

| Item | Status | Evidence |
| --- | --- | --- |
| Process model and control logic | Simulated and unit tested | `simulation/tests`, `backend/tests` |
| Ladder / FB design | Designed and documented, generated by Openness script | `plc/` |
| TIA Portal V19 project execution | Not run in this environment | Requires licensed TIA Openness + PLCSIM |
| S7 TCP communication | Implemented, not hardware verified | `backend/src/adapters/s7-adapter.js` |
| MySQL schema | Provided; tested with in-memory fallback | `database/schema.sql` |
| Trends and operator inputs | Synthetic/simulated data | `simulation/scenarios.json` |
| Dashboard screenshots | SVG mockups | `screenshots/` |

## 12. Limitations and future work

- No real PLC, field instrumentation or VFD was connected during development.
- OPC UA, MQTT publishing and WinCC RT integration are future work.
- Anti-water-hammer ramp control should be added before a real deployment.
- Add authentication and role-based access before exposing the HMI outside a lab network.

## 13. Quality checklist

- [x] Industrial problem clearly defined
- [x] Architecture and technical diagrams
- [x] Organized source code
- [x] Functional PLC-equivalent simulation
- [x] User interface
- [x] Database and API
- [x] Documented tests
- [x] Visual evidence (diagrams/mockups)
- [x] Complete README (technical English + Spanish notes)
- [x] Repository initialized on `main`

---

**Author:** Bismarck Acevedo — Electronic Engineer, Industrial Automation & PLC Programming.
