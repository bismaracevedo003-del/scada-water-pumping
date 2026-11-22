import { readFileSync } from 'node:fs';

const WRITABLE_TAGS = new Set([
  'Pump1_Mode',
  'Pump2_Mode',
  'Pump1_Command',
  'Pump2_Command',
  'AlarmAck',
]);

export class MqttAdapter {
  constructor({ mqtt, allowWrites = false, realStrict = true, pollIntervalMs = 1000 }) {
    this.config = mqtt || {};
    this.allowWrites = allowWrites;
    this.realStrict = realStrict;
    this.source = 'mqtt';
    this.connected = false;
    this.client = null;
    this.lastError = null;
    this.snapshot = null;
    this.waiters = [];
    this.topicPrefix = this.config.topicPrefix || 'plant/water';
    this.snapshotTopic = this.config.snapshotTopic || `${this.topicPrefix}/telemetry`;
    this.timeoutMs = this.config.timeoutMs || Math.max(1000, pollIntervalMs * 5);
  }

  async connect() {
    const missing = [];
    if (!this.config.host) missing.push('MQTT_HOST');
    if (!this.topicPrefix) missing.push('MQTT_TOPIC_PREFIX');
    if (missing.length) {
      throw new Error(`MODE=real/DATA_SOURCE=mqtt missing configuration: ${missing.join(', ')}`);
    }
    if (this.realStrict && this.config.tls && !this.config.tlsCa) {
      throw new Error('MODE=real with MQTT_TLS=true and REAL_STRICT=true requires MQTT_TLS_CA');
    }

    let mqtt;
    try {
      mqtt = await import('mqtt');
    } catch (error) {
      throw new Error(
        `MODE=real/DATA_SOURCE=mqtt requires the optional "mqtt" package (${error.message}). ` +
        'Install it only for real mode with: npm --prefix backend install mqtt --no-save',
      );
    }

    const options = { clean: true, connectTimeout: this.timeoutMs };
    if (this.config.user) options.username = this.config.user;
    if (this.config.password) options.password = this.config.password;
    if (this.config.tls) {
      options.rejectUnauthorized = true;
      if (this.config.tlsCa) {
        try {
          options.ca = readFileSync(this.config.tlsCa);
        } catch (error) {
          throw new Error(`MODE=real cannot read MQTT_TLS_CA: ${error.message}`);
        }
      }
    }

    const protocol = this.config.tls ? 'mqtts' : 'mqtt';
    const url = `${protocol}://${this.config.host}:${this.config.port || 1883}`;
    this.client = mqtt.connect(url, options);

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.lastError = error;
        reject(new Error(`MODE=real MQTT connection failed: ${error.message}`));
      };
      this.client.once('error', onError);
      this.client.once('connect', () => {
        this.client.removeListener('error', onError);
        resolve();
      });
    });

    this.client.on('error', (error) => {
      this.lastError = error;
    });
    this.client.on('message', (topic, payload) => this._onMessage(topic, payload));
    await this._subscribe(this.snapshotTopic);
    this.connected = true;
    return this;
  }

  async readSnapshot() {
    if (!this.connected) throw new Error('MQTT adapter is not connected');
    if (this.snapshot) return { ...this.snapshot };
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        const detail = this.lastError ? ` (${this.lastError.message})` : '';
        reject(new Error(`No MQTT snapshot on ${this.snapshotTopic} within ${this.timeoutMs} ms${detail}`));
      }, this.timeoutMs);
      this.waiters.push(waiter);
    });
  }

  async writeTag(tag, value) {
    if (!this.allowWrites) {
      throw new Error('MODE=real writes require ALLOW_WRITES=true; adapter is read-only');
    }
    if (!WRITABLE_TAGS.has(tag)) throw new Error(`Tag ${tag} is not writable over MQTT`);
    return this._publish(`${this.topicPrefix}/command/${tag}`, {
      tag,
      value,
      at: new Date().toISOString(),
    });
  }

  close() {
    if (this.client) this.client.end(true);
    this.connected = false;
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('MQTT adapter closed'));
    }
    this.waiters = [];
  }

  _subscribe(topic) {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) reject(new Error(`MODE=real MQTT subscribe failed: ${error.message}`));
        else resolve();
      });
    });
  }

  _publish(topic, payload) {
    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
        if (error) reject(new Error(`MODE=real MQTT publish failed: ${error.message}`));
        else resolve();
      });
    });
  }

  _onMessage(topic, payload) {
    if (topic !== this.snapshotTopic) return;
    let data;
    try {
      data = JSON.parse(payload.toString('utf8'));
    } catch (error) {
      this.lastError = error;
      return;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.lastError = new Error('MQTT snapshot payload must be a JSON object');
      return;
    }
    this.snapshot = { source: 'mqtt', ...data };
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve({ ...this.snapshot });
    }
  }
}
