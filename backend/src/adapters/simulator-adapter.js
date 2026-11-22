import { spawn } from 'node:child_process';
import path from 'node:path';

export class SimulatorAdapter {
  constructor({ root, python = 'python', scenario = 'normal', pollIntervalMs = 1000 }) {
    this.root = root;
    this.python = python;
    this.scenario = scenario;
    this.pollIntervalMs = pollIntervalMs;
    this.pending = new Map();
    this.buffer = '';
    this.nextId = 1;
    this.child = null;
    this.connected = false;
  }

  async connect() {
    const cwd = path.join(this.root, 'simulation');
    this.child = spawn(this.python, ['bridge.py', this.scenario], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this._onData(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => process.stderr.write(`[simulator] ${chunk}`));
    this.child.on('exit', (code) => {
      this.connected = false;
      for (const { reject } of this.pending.values()) {
        reject(new Error(`Simulator exited with code ${code}`));
      }
      this.pending.clear();
    });
    await this._request({ cmd: 'snapshot' });
    this.connected = true;
    return this;
  }

  async readSnapshot() {
    return this._request({ cmd: 'tick', dt: this.pollIntervalMs / 1000 });
  }

  async writeTag(tag, value) {
    const commands = {
      Pump1_Mode: () => ({ cmd: 'set_mode', pump: 1, mode: value }),
      Pump2_Mode: () => ({ cmd: 'set_mode', pump: 2, mode: value }),
      Pump1_Command: () => ({ cmd: 'set_command', pump: 1, command: value }),
      Pump2_Command: () => ({ cmd: 'set_command', pump: 2, command: value }),
      AlarmAck: () => ({ cmd: 'ack' }),
    };
    const build = commands[tag];
    if (!build) throw new Error(`Tag ${tag} is not writable`);
    return this._request(build());
  }

  async injectFault(fault, active = true) {
    return this._request({ cmd: 'inject_fault', fault, active });
  }

  async setInflow(valueM3h) {
    return this._request({ cmd: 'set_inflow', value_m3h: valueM3h });
  }

  close() {
    if (this.child && !this.child.killed) this.child.kill();
    this.connected = false;
  }

  _onData(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.data);
    }
  }

  _request(payload) {
    if (!this.child) return Promise.reject(new Error('Adapter is not connected'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Simulator request timed out'));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ ...payload, id })}\n`);
    });
  }
}
