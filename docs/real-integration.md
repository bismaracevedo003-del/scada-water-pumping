# SCADA real-mode integration

## Default behavior (unchanged)

`MODE` defaults to `simulation` and `DATA_SOURCE` defaults to `simulator`. The Node API keeps
using the Python process model and the in-memory repository unless `DB_*` variables were already
configured. No real package is imported in this path.

## Activating real mode

Real mode is activated **only** through environment variables (or a copied `.env`):

```powershell
Copy-Item config/real.env.example .env
# edit .env: set MODE=real, DATA_SOURCE=mqtt, DB_DRIVER=mysql and real values
npm run setup:real   # installs optional MQTT driver in backend/node_modules
npm run dev
```

In `MODE=real` the API requires:

- `DATA_SOURCE=mqtt` — otherwise startup fails with a clear error. It never reverts to `simulator`.
- `DB_DRIVER=mysql` plus `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — otherwise startup fails.
- The optional `mqtt` package. `mysql2` is already a backend dependency but is loaded dynamically,
  so a missing driver produces an explicit error instead of a silent simulation fallback.

`REAL_STRICT=true` is the recommended setting. It does not change the no-fallback rule; it keeps
all validation active (TLS CA, credentials and topic configuration).

## MQTT contract

- `MQTT_SNAPSHOT_TOPIC` (default `<MQTT_TOPIC_PREFIX>/telemetry`) carries JSON snapshots with the
  DB10 tag names from `docs/io-list.md`. The adapter adds `source: "mqtt"` for the health endpoint.
- Pump mode/command and alarm acknowledgment writes are published to
  `<MQTT_TOPIC_PREFIX>/command/<Tag>` only when `ALLOW_WRITES=true`. By default all real writes
  are rejected with an error.
- QoS 1 is used for commands and subscription. Retained telemetry is cached in memory for the REST
  and WebSocket API; if no message arrives within `MQTT_TIMEOUT_MS` the poll fails visibly.

## MySQL history

`DB_DRIVER=mysql` uses the existing `database/schema.sql` tables. The repository is created with
`mysql2/promise` via a dynamic import inside `init()`. Connection or schema errors are surfaced by
`/api/v1/health` (`pollingError`) and by the startup log; they never switch the API to in-memory.

## Real HMI/SCADA deployment

| Item | Recommendation for this repo |
| --- | --- |
| Host/port | Run the Node API on an internal host, e.g. `0.0.0.0:3001`; keep the React HMI on `https://hmi.example.internal`. Set `CORS_ORIGIN` to the exact HTTPS origin. |
| TLS / reverse proxy | Terminate TLS at nginx/Traefik on 443. Proxy `/api/v1` HTTP and upgrade `/ws/telemetry` to the Node process. Use `mqtts://` (port 8883) with `MQTT_TLS=true` and a CA file; do not expose MQTT or MySQL publicly. |
| Authentication | Put the HMI and API behind OIDC/basic auth at the reverse proxy. Add a separate service account for MQTT and a least-privilege DB user. Keep `ALLOW_WRITES=false` until operator roles and command whitelisting are verified. |
| Safety | Pump interlocks stay in the S7 program. Software adapters cannot bypass E-stop, guard or two-hand circuits. Validate a written command procedure before enabling `ALLOW_WRITES=true`. |

## Verification without real hardware

```powershell
npm test
```

The existing Node and Python tests run with `MODE` unset (simulation) and do not need MQTT,
MySQL or PLCSIM. To smoke-test failure behavior, set `MODE=real` with an unreachable host and
confirm that startup exits with the explicit configuration/connection error.
