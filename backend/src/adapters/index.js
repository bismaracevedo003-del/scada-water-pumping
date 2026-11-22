export async function createAdapter(config) {
  const mode = (config.mode || 'simulation').toLowerCase();
  if (!['simulation', 'real'].includes(mode)) {
    throw new Error(`Unsupported MODE: ${mode} (use simulation or real)`);
  }

  if (mode === 'real') {
    if (config.dataSource !== 'mqtt') {
      throw new Error(
        `MODE=real requires DATA_SOURCE=mqtt, got ${config.dataSource}. ` +
        'Real mode never falls back to the simulator.',
      );
    }
    const { MqttAdapter } = await import('./mqtt-adapter.js');
    return new MqttAdapter({
      mqtt: config.mqtt,
      allowWrites: config.allowWrites,
      realStrict: config.realStrict,
      pollIntervalMs: config.pollIntervalMs,
    });
  }

  if (config.dataSource === 'mqtt') {
    throw new Error('DATA_SOURCE=mqtt requires MODE=real');
  }
  if (config.plcSource === 's7') {
    const { S7Adapter } = await import('./s7-adapter.js');
    return new S7Adapter(config.s7);
  }
  if (config.plcSource !== 'simulator') {
    throw new Error(`Unsupported PLC_SOURCE: ${config.plcSource}`);
  }
  const { SimulatorAdapter } = await import('./simulator-adapter.js');
  return new SimulatorAdapter(config);
}
