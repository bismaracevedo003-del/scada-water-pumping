import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { WebSocket } from 'ws';

import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repositories/in-memory-repository.js';
import { S7_ADDRESSES } from '../src/adapters/s7-adapter.js';
import { TAG_NAMES } from '../src/tags.js';

const config = {
  corsOrigin: '*',
  pollIntervalMs: 1000,
  plcSource: 'simulator',
};

class FakeAdapter {
  constructor() {
    this.writes = [];
    this.ticks = 0;
    this.snapshot = Object.fromEntries(TAG_NAMES.map((tag) => [tag, false]));
    Object.assign(this.snapshot, {
      TankLevel_PV: 42.5,
      DischargePressure_PV: 4.2,
      Flow_PV: 40,
      Pump1_Run: true,
      Pump2_Run: false,
      Pump1_Mode: 1,
      Pump2_Mode: 1,
      LeadPump: 1,
      Alarm_LowLevel: true,
      source: 'simulator',
    });
  }

  async connect() {
    return this;
  }

  async readSnapshot() {
    this.ticks += 1;
    return { ...this.snapshot, elapsed_s: this.ticks };
  }

  async writeTag(tag, value) {
    this.writes.push({ tag, value });
    if (tag === 'AlarmAck') this.snapshot.Alarm_LowLevel = false;
    return true;
  }

  close() {}
}

let adapter;
let repository;
let service;
let baseUrl;

beforeEach(async (context) => {
  adapter = new FakeAdapter();
  repository = new InMemoryRepository();
  service = createApp({ adapter, repository, config });
  await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${service.server.address().port}`;
  await service.poll();
  context.after(async () => {
    service.stopPolling();
    service.server.close();
  });
});

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('health reports active source and repository', async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.source, 'simulator');
  assert.equal(body.repository, 'InMemoryRepository');
});

test('telemetry exposes DB10 tags', async () => {
  const response = await fetch(`${baseUrl}/api/v1/telemetry`);
  const body = await response.json();
  for (const tag of TAG_NAMES.slice(0, 10)) {
    if (['Pump1_Command', 'Pump2_Command', 'AlarmAck'].includes(tag)) continue;
    assert.ok(Object.hasOwn(body, tag), `missing ${tag}`);
  }
  assert.equal(body.TankLevel_PV, 42.5);
});

test('mode change writes mapped tag', async () => {
  const result = await post('/api/v1/pumps/2/mode', { mode: 'MANUAL' });
  assert.equal(result.status, 200);
  assert.deepEqual(adapter.writes.at(-1), { tag: 'Pump2_Mode', value: 0 });
  const invalid = await post('/api/v1/pumps/3/mode', { mode: 'AUTO' });
  assert.equal(invalid.status, 400);
});

test('manual command writes boolean tag', async () => {
  const result = await post('/api/v1/pumps/1/command', { command: true });
  assert.equal(result.status, 200);
  assert.deepEqual(adapter.writes.at(-1), { tag: 'Pump1_Command', value: true });
});

test('alarm acknowledgment writes pulse and marks alarm', async () => {
  const alarmsBefore = await (await fetch(`${baseUrl}/api/v1/alarms`)).json();
  assert.equal(alarmsBefore.count, 1);
  const result = await post('/api/v1/alarms/LowLevel/ack', {});
  assert.equal(result.status, 200);
  assert.deepEqual(adapter.writes.at(-1), { tag: 'AlarmAck', value: true });
  await service.poll();
  const alarmsAfter = await (await fetch(`${baseUrl}/api/v1/alarms`)).json();
  assert.equal(alarmsAfter.count, 0);
});

test('history returns stored samples newest first', async () => {
  await service.poll();
  await service.poll();
  const response = await fetch(`${baseUrl}/api/v1/history?limit=2`);
  const rows = await response.json();
  assert.equal(rows.length, 2);
  assert.ok(rows[0].elapsed_s >= rows[1].elapsed_s);
});

test('events store operator actions', async () => {
  await post('/api/v1/pumps/1/mode', { mode: 'MANUAL' });
  const events = await (await fetch(`${baseUrl}/api/v1/events`)).json();
  assert.equal(events[0].type, 'mode_change');
});

test('fault injection endpoint unavailable without simulator adapter', async () => {
  const original = service;
  assert.ok(original);
  const result = await post('/api/v1/simulation/fault', { fault: 'sensor_fault' });
  assert.equal(result.status, 400);
});

test('websocket broadcasts telemetry snapshots', async () => {
  const socket = new WebSocket(`ws://127.0.0.1:${service.server.address().port}/ws/telemetry`);
  await new Promise((resolve) => socket.once('open', resolve));
  const messagePromise = new Promise((resolve) => socket.once('message', (raw) => resolve(JSON.parse(raw))));
  await service.poll();
  const message = await messagePromise;
  assert.equal(message.type, 'telemetry');
  assert.equal(message.data.TankLevel_PV, 42.5);
  socket.close();
});

test('in-memory repository keeps samples and events', async () => {
  const local = new InMemoryRepository({ maxSamples: 2 });
  await local.init();
  await local.saveSample({ TankLevel_PV: 1 });
  await local.saveSample({ TankLevel_PV: 2 });
  await local.saveSample({ TankLevel_PV: 3 });
  await local.saveEvent({ type: 'test' });
  const samples = await local.listSamples(10);
  assert.deepEqual(samples.map((item) => item.TankLevel_PV), [3, 2]);
  assert.equal((await local.listEvents())[0].type, 'test');
});

test('tag map is consistent between docs, backend and S7 adapter', () => {
  const docs = readFileSync(new URL('../../docs/io-list.md', import.meta.url), 'utf8');
  for (const tag of TAG_NAMES) {
    assert.ok(docs.includes(tag), `tag ${tag} missing in docs`);
    assert.ok(S7_ADDRESSES[tag], `tag ${tag} missing in S7 map`);
  }
});
