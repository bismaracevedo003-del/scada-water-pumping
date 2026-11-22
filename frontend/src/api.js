async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function getTelemetry() {
  return request('/api/v1/telemetry');
}

export function getAlarms() {
  return request('/api/v1/alarms');
}

export function getHistory(limit = 120) {
  return request(`/api/v1/history?limit=${limit}`);
}

export function setPumpMode(pump, mode) {
  return request(`/api/v1/pumps/${pump}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export function setPumpCommand(pump, command) {
  return request(`/api/v1/pumps/${pump}/command`, {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

export function acknowledgeAlarm(id) {
  return request(`/api/v1/alarms/${encodeURIComponent(id)}/ack`, { method: 'POST', body: '{}' });
}

export function injectFault(fault, active) {
  return request('/api/v1/simulation/fault', {
    method: 'POST',
    body: JSON.stringify({ fault, active }),
  });
}
