export class MysqlRepository {
  constructor({ host, port, user, password, name }) {
    this.connection = { host, port, user, password, name };
    this.pool = null;
  }

  async init() {
    let mysql;
    try {
      ({ default: mysql } = await import('mysql2/promise'));
    } catch (error) {
      throw new Error(`MySQL repository requires the optional "mysql2" package: ${error.message}`);
    }
    const { host, port, user, password, name } = this.connection;
    this.pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: name,
      waitForConnections: true,
      connectionLimit: 5,
    });
    await this.pool.query('SELECT 1');
    return this;
  }

  async saveSample(snapshot) {
    await this.pool.execute(
      `INSERT INTO telemetry_samples
       (tank_level, pressure_bar, flow_m3h, pump1_run, pump2_run, lead_pump, source, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshot.TankLevel_PV,
        snapshot.DischargePressure_PV,
        snapshot.Flow_PV,
        Number(snapshot.Pump1_Run),
        Number(snapshot.Pump2_Run),
        snapshot.LeadPump,
        snapshot.source,
        new Date(),
      ],
    );
  }

  async saveEvent(event) {
    await this.pool.execute(
      `INSERT INTO events (event_type, payload, created_at) VALUES (?, ?, ?)`,
      [event.type, JSON.stringify(event), new Date()],
    );
  }

  async listSamples(limit = 100) {
    const [rows] = await this.pool.execute(
      `SELECT tank_level, pressure_bar, flow_m3h, pump1_run, pump2_run, lead_pump, source, recorded_at
       FROM telemetry_samples ORDER BY recorded_at DESC LIMIT ?`,
      [limit],
    );
    return rows;
  }

  async listEvents(limit = 100) {
    const [rows] = await this.pool.execute(
      `SELECT event_type, payload, created_at FROM events ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows;
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}
