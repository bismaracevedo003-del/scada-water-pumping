import nodes7 from 'nodes7';

export const S7_ADDRESSES = {
  TankLevel_PV: 'DB10,REAL0',
  DischargePressure_PV: 'DB10,REAL4',
  Flow_PV: 'DB10,REAL8',
  Pump1_Run: 'DB10,X12.0',
  Pump2_Run: 'DB10,X12.1',
  Pump1_Fault: 'DB10,X12.2',
  Pump2_Fault: 'DB10,X12.3',
  Pump1_Mode: 'DB10,INT14',
  Pump2_Mode: 'DB10,INT16',
  Pump1_Command: 'DB10,X18.0',
  Pump2_Command: 'DB10,X18.1',
  LeadPump: 'DB10,INT20',
  Pump1_Runtime_s: 'DB10,DINT22',
  Pump2_Runtime_s: 'DB10,DINT26',
  Alarm_LowLevel: 'DB10,X30.0',
  Alarm_HighPressure: 'DB10,X30.1',
  Alarm_DryRun: 'DB10,X30.2',
  Alarm_Overload: 'DB10,X30.3',
  Alarm_SensorFault: 'DB10,X30.4',
  Alarm_JammedPump: 'DB10,X30.5',
  AlarmAck: 'DB10,X32.0',
};

const ADDRESS_TO_TAG = Object.fromEntries(
  Object.entries(S7_ADDRESSES).map(([tag, address]) => [address, tag]),
);

export class S7Adapter {
  constructor({ host, port, rack, slot }) {
    this.connection = { host, port, rack, slot };
    this.driver = new nodes7();
    this.connected = false;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.driver.initiateConnection(this.connection, (error) => {
        if (error) reject(new Error(`S7 connection failed: ${error}`));
        else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      this.driver.setTranslationCB((tag) => S7_ADDRESSES[tag]);
      this.driver.addItems(Object.keys(S7_ADDRESSES));
      this.connected = true;
      resolve();
    });
    return this;
  }

  async readSnapshot() {
    const values = await new Promise((resolve, reject) => {
      this.driver.readAllItems((error, data) => {
        if (error) reject(new Error(`S7 read failed: ${error}`));
        else resolve(data);
      });
    });
    const snapshot = { source: 's7' };
    for (const [key, value] of Object.entries(values || {})) {
      const tag = Object.hasOwn(S7_ADDRESSES, key) ? key : ADDRESS_TO_TAG[key];
      if (tag) snapshot[tag] = value;
    }
    return snapshot;
  }

  async writeTag(tag, value) {
    if (!S7_ADDRESSES[tag]) throw new Error(`Tag ${tag} is not in the DB10 map`);
    return new Promise((resolve, reject) => {
      this.driver.writeItems(tag, value, (error) => {
        if (error) reject(new Error(`S7 write failed: ${error}`));
        else resolve();
      });
    });
  }

  close() {
    if (this.connected) this.driver.dropConnection();
    this.connected = false;
  }
}
