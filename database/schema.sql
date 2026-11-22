CREATE DATABASE IF NOT EXISTS scada_water
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE scada_water;

CREATE TABLE IF NOT EXISTS telemetry_samples (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tank_level DECIMAL(6, 2) NOT NULL,
  pressure_bar DECIMAL(6, 2) NOT NULL,
  flow_m3h DECIMAL(7, 2) NOT NULL,
  pump1_run TINYINT(1) NOT NULL DEFAULT 0,
  pump2_run TINYINT(1) NOT NULL DEFAULT 0,
  lead_pump TINYINT(1) NOT NULL DEFAULT 1,
  source VARCHAR(32) NOT NULL DEFAULT 'simulator',
  recorded_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_telemetry_recorded_at (recorded_at DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_events_created_at (created_at DESC),
  INDEX idx_events_type (event_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
