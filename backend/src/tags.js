export const TAG_NAMES = [
  'TankLevel_PV',
  'DischargePressure_PV',
  'Flow_PV',
  'Pump1_Run',
  'Pump2_Run',
  'Pump1_Fault',
  'Pump2_Fault',
  'Pump1_Mode',
  'Pump2_Mode',
  'Pump1_Command',
  'Pump2_Command',
  'LeadPump',
  'Pump1_Runtime_s',
  'Pump2_Runtime_s',
  'Alarm_LowLevel',
  'Alarm_HighPressure',
  'Alarm_DryRun',
  'Alarm_Overload',
  'Alarm_SensorFault',
  'Alarm_JammedPump',
  'AlarmAck',
];

export const WRITE_TAGS = new Set([
  'Pump1_Mode',
  'Pump2_Mode',
  'Pump1_Command',
  'Pump2_Command',
  'AlarmAck',
]);

export function normalizeTagValue(tag, value) {
  if (tag.endsWith('_Mode') || tag === 'LeadPump') return Number(value);
  if (tag.startsWith('Alarm') || tag.endsWith('_Command') || tag.endsWith('_Run')) return Boolean(value);
  return Number(value);
}
