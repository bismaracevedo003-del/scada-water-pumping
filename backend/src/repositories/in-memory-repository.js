export class InMemoryRepository {
  constructor({ maxSamples = 5000 } = {}) {
    this.samples = [];
    this.events = [];
    this.maxSamples = maxSamples;
  }

  async init() {
    return this;
  }

  async saveSample(snapshot) {
    this.samples.push({ ...snapshot, storedAt: new Date().toISOString() });
    if (this.samples.length > this.maxSamples) this.samples.shift();
    return this.samples.at(-1);
  }

  async saveEvent(event) {
    const stored = { ...event, id: this.events.length + 1, createdAt: new Date().toISOString() };
    this.events.push(stored);
    return stored;
  }

  async listSamples(limit = 100) {
    return this.samples.slice(-limit).reverse();
  }

  async listEvents(limit = 100) {
    return this.events.slice(-limit).reverse();
  }

  async close() {}
}
