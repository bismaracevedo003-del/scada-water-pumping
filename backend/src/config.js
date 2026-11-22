import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(value, fallback) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const config = {
  root,
  mode: (process.env.MODE || 'simulation').toLowerCase(),
  realStrict: boolean(process.env.REAL_STRICT, true),
  allowWrites: boolean(process.env.ALLOW_WRITES, false),
  port: integer(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://127.0.0.1:5173',
  pollIntervalMs: integer(process.env.POLL_INTERVAL_MS, 1000),
  plcSource: (process.env.PLC_SOURCE || 'simulator').toLowerCase(),
  dataSource: (process.env.DATA_SOURCE || process.env.PLC_SOURCE || 'simulator').toLowerCase(),
  scenario: process.env.SIMULATION_SCENARIO || 'normal',
  python: process.env.PYTHON_BIN || 'python',
  s7: {
    host: process.env.PLC_HOST || '192.168.0.1',
    port: integer(process.env.PLC_PORT, 102),
    rack: integer(process.env.PLC_RACK, 0),
    slot: integer(process.env.PLC_SLOT, 1),
  },
  mqtt: {
    host: process.env.MQTT_HOST,
    port: integer(process.env.MQTT_PORT, 1883),
    user: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
    tls: boolean(process.env.MQTT_TLS, false),
    tlsCa: process.env.MQTT_TLS_CA,
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'plant/water',
    snapshotTopic: process.env.MQTT_SNAPSHOT_TOPIC || '',
    timeoutMs: integer(process.env.MQTT_TIMEOUT_MS, 5000),
  },
  dbDriver: (process.env.DB_DRIVER || 'memory').toLowerCase(),
  db: {
    host: process.env.DB_HOST,
    port: integer(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
};

export const dbConfigured = Boolean(config.db.host && config.db.user && config.db.name);
