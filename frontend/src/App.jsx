import { useCallback, useEffect, useState } from 'react';
import AlarmPanel from '../components/AlarmPanel.jsx';
import PumpControls from '../components/PumpControls.jsx';
import StatusCard from '../components/StatusCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import {
  acknowledgeAlarm,
  getAlarms,
  getHistory,
  getTelemetry,
  injectFault,
  setPumpCommand,
  setPumpMode,
} from './api.js';

const FAULTS = [
  { id: 'sensor_fault', label: 'Sensor 4-20 mA' },
  { id: 'overload_pump1', label: 'Pump 1 overload' },
  { id: 'flow_blocked', label: 'Flow blocked' },
  { id: 'emergency_stop', label: 'E-stop trip', active: false },
];

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState('unknown');
  const [message, setMessage] = useState('');
  const [faults, setFaults] = useState({});

  const refreshAlarms = useCallback(() => {
    getAlarms().then((body) => setAlarms(body.alarms)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTelemetry()
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {});
    getHistory()
      .then((data) => {
        if (!cancelled) setHistory([...data].reverse());
      })
      .catch(() => {});
    refreshAlarms();

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/telemetry`);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== 'telemetry') return;
      setSnapshot(payload.data);
      setSource(payload.data.source || 'unknown');
      setHistory((current) => [...current, payload.data].slice(-120));
      refreshAlarms();
    };

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [refreshAlarms]);

  const action = async (callback) => {
    try {
      await callback();
      setMessage('Command accepted');
    } catch (error) {
      setMessage(error.message);
    }
    refreshAlarms();
  };

  const toggleFault = (fault) => {
    const active = !faults[fault.id];
    action(async () => {
      await injectFault(fault.id, active);
      setFaults((current) => ({ ...current, [fault.id]: active }));
    });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <span className="eyebrow">INDUSTRIAL AUTOMATION · SCADA</span>
          <h1>Water Pumping Station</h1>
          <p>Siemens S7-1200 control strategy · dual pump lead/lag · live supervision</p>
        </div>
        <div className="topbar-status">
          <span className={`badge ${connected ? 'ok' : 'alarm'}`}>{connected ? 'LIVE' : 'OFFLINE'}</span>
          <span className="source">Source: {source}</span>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <main>
        <section className="cards-grid">
          <StatusCard
            label="Tank level"
            value={snapshot?.TankLevel_PV?.toFixed(1) ?? '--'}
            unit="%"
            hint="Scale 0-100 % · 4-20 mA"
            tone="info"
          />
          <StatusCard
            label="Discharge pressure"
            value={snapshot?.DischargePressure_PV?.toFixed(2) ?? '--'}
            unit="bar"
            hint="Alarm above 9.5 bar"
            tone="warn"
          />
          <StatusCard
            label="Flow"
            value={snapshot?.Flow_PV?.toFixed(1) ?? '--'}
            unit="m³/h"
            hint="Scale 0-120 m³/h"
            tone="good"
          />
          <StatusCard
            label="Lead pump"
            value={snapshot?.LeadPump ?? '--'}
            unit=""
            hint="Alternates by runtime"
            tone="default"
          />
        </section>

        <TrendChart samples={history} />
        <PumpControls
          snapshot={snapshot}
          onMode={(pump, mode) => action(() => setPumpMode(pump, mode))}
          onCommand={(pump, command) => action(() => setPumpCommand(pump, command))}
        />

        <div className="bottom-grid">
          <AlarmPanel alarms={alarms} onAcknowledge={(id) => action(() => acknowledgeAlarm(id))} />
          <section className="card simulator-card">
            <header className="section-header">
              <div>
                <h2>Simulation controls</h2>
                <p>Only available with PLC_SOURCE=simulator</p>
              </div>
            </header>
            <div className="fault-list">
              {FAULTS.map((fault) => (
                <button
                  key={fault.id}
                  type="button"
                  className={faults[fault.id] || fault.active ? 'fault on' : 'fault'}
                  onClick={() => toggleFault(fault)}
                >
                  {fault.label}
                </button>
              ))}
            </div>
            <p className="footnote">
              Fallas inyectadas y datos de tendencia son sintéticos; no representan lecturas de campo.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
