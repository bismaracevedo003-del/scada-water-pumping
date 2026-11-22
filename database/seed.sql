USE scada_water;

INSERT INTO telemetry_samples
  (tank_level, pressure_bar, flow_m3h, pump1_run, pump2_run, lead_pump, source, recorded_at)
VALUES
  (48.20, 4.80, 44.10, 1, 0, 1, 'simulator', NOW() - INTERVAL 6 SECOND),
  (48.05, 4.78, 43.80, 1, 0, 1, 'simulator', NOW() - INTERVAL 5 SECOND),
  (47.90, 4.75, 43.50, 1, 0, 1, 'simulator', NOW() - INTERVAL 4 SECOND),
  (47.75, 4.72, 44.00, 1, 0, 1, 'simulator', NOW() - INTERVAL 3 SECOND),
  (47.60, 4.70, 43.20, 1, 0, 1, 'simulator', NOW() - INTERVAL 2 SECOND),
  (47.45, 4.68, 43.90, 1, 0, 1, 'simulator', NOW() - INTERVAL 1 SECOND);

INSERT INTO events (event_type, payload, created_at)
VALUES
  ('mode_change', JSON_OBJECT('pump', 1, 'mode', 'AUTO'), NOW() - INTERVAL 30 SECOND),
  ('fault_injection', JSON_OBJECT('fault', 'sensor_fault', 'active', FALSE), NOW() - INTERVAL 20 SECOND);
