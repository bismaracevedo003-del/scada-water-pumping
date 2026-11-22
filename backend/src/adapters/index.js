export async function createAdapter(config) {
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
