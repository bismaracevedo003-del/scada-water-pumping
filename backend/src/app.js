import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { config as defaultConfig } from './config.js';

const ALARM_IDS = [
  'LowLevel',
  'HighPressure',
  'DryRun',
  'Overload',
  'SensorFault',
  'JammedPump',
];

export function createApp({ adapter, repository, config = defaultConfig }) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/telemetry' });
  const acknowledged = new Set();
  let latest = null;
  let timer = null;
  let lastPoll = null;
  let pollingError = null;

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  async function poll() {
    const snapshot = await adapter.readSnapshot();
    latest = snapshot;
    lastPoll = new Date().toISOString();
    pollingError = null;
    await repository.saveSample(snapshot);
    broadcast({ type: 'telemetry', data: snapshot });
    return snapshot;
  }

  function startPolling() {
    if (timer) return;
    timer = setInterval(() => {
      poll().catch((error) => {
        pollingError = error.message;
      });
    }, config.pollIntervalMs);
    poll().catch((error) => {
      pollingError = error.message;
    });
  }

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const client of wss.clients) client.close();
    wss.close();
  }

  app.get('/api/v1/health', (_request, response) => {
    response.json({
      status: 'ok',
      source: adapter.source || (adapter.constructor.name === 'S7Adapter' ? 's7' : 'simulator'),
      adapter: adapter.constructor.name,
      repository: repository.constructor.name,
      pollIntervalMs: config.pollIntervalMs,
      lastPoll,
      pollingError,
    });
  });

  app.get('/api/v1/telemetry', async (_request, response) => {
    const snapshot = latest || (await poll());
    response.json(snapshot);
  });

  app.get('/api/v1/alarms', (_request, response) => {
    const snapshot = latest || {};
    const alarms = ALARM_IDS.map((id) => {
      const active = Boolean(snapshot[`Alarm_${id}`]);
      return { id, active, acknowledged: !active || acknowledged.has(id), severity: 'high' };
    });
    response.json({ alarms, count: alarms.filter((alarm) => alarm.active).length });
  });

  app.post('/api/v1/alarms/:id/ack', async (request, response) => {
    const id = request.params.id;
    if (!ALARM_IDS.includes(id)) {
      return response.status(400).json({ error: `Unknown alarm: ${id}` });
    }
    await adapter.writeTag('AlarmAck', true);
    acknowledged.add(id);
    await repository.saveEvent({ type: 'alarm_ack', alarmId: id });
    return response.json({ acknowledged: id, at: new Date().toISOString() });
  });

  app.post('/api/v1/pumps/:id/mode', async (request, response) => {
    const pump = Number(request.params.id);
    const mode = request.body?.mode;
    if (![1, 2].includes(pump) || !['AUTO', 'MANUAL'].includes(mode)) {
      return response.status(400).json({ error: 'Use pump 1 or 2 and mode AUTO or MANUAL' });
    }
    const tag = `Pump${pump}_Mode`;
    await adapter.writeTag(tag, mode === 'AUTO' ? 1 : 0);
    await repository.saveEvent({ type: 'mode_change', pump, mode });
    return response.json({ pump, mode });
  });

  app.post('/api/v1/pumps/:id/command', async (request, response) => {
    const pump = Number(request.params.id);
    if (![1, 2].includes(pump) || typeof request.body?.command !== 'boolean') {
      return response.status(400).json({ error: 'Use pump 1 or 2 and a boolean command' });
    }
    const tag = `Pump${pump}_Command`;
    await adapter.writeTag(tag, request.body.command);
    acknowledged.delete('LowLevel');
    await repository.saveEvent({ type: 'manual_command', pump, command: request.body.command });
    return response.json({ pump, command: request.body.command });
  });

  app.post('/api/v1/simulation/fault', async (request, response) => {
    if (typeof adapter.injectFault !== 'function') {
      return response.status(400).json({ error: 'Fault injection is only available with the simulator source' });
    }
    const { fault, active = true } = request.body || {};
    if (typeof fault !== 'string') {
      return response.status(400).json({ error: 'fault must be a string' });
    }
    const snapshot = await adapter.injectFault(fault, Boolean(active));
    await repository.saveEvent({ type: 'fault_injection', fault, active: Boolean(active) });
    return response.json({ fault, active: Boolean(active), snapshot });
  });

  app.get('/api/v1/history', async (request, response) => {
    const limit = Math.min(1000, Math.max(1, Number(request.query.limit) || 100));
    response.json(await repository.listSamples(limit));
  });

  app.get('/api/v1/events', async (request, response) => {
    const limit = Math.min(1000, Math.max(1, Number(request.query.limit) || 100));
    response.json(await repository.listEvents(limit));
  });

  app.use((error, _request, response, _next) => {
    response.status(500).json({ error: error.message });
  });

  return {
    app,
    server,
    wss,
    poll,
    startPolling,
    stopPolling,
    getLatest: () => latest,
  };
}
