const SERIES = [
  { key: 'TankLevel_PV', label: 'Level %', color: '#38bdf8', min: 0, max: 100 },
  { key: 'DischargePressure_PV', label: 'Pressure bar', color: '#fbbf24', min: 0, max: 10 },
  { key: 'Flow_PV', label: 'Flow m³/h', color: '#34d399', min: 0, max: 120 },
];

function pointsFor(samples, series) {
  const width = 600;
  const height = 200;
  if (samples.length < 2) return '';
  return samples
    .map((sample, index) => {
      const x = (index / (samples.length - 1)) * width;
      const raw = Number(sample[series.key]) || 0;
      const normalized = Math.min(1, Math.max(0, (raw - series.min) / (series.max - series.min)));
      const y = height - normalized * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function TrendChart({ samples }) {
  return (
    <section className="card chart-card">
      <header className="section-header">
        <div>
          <h2>Process trends</h2>
          <p>Last {samples.length} samples · 1 s scan</p>
        </div>
        <div className="legend">
          {SERIES.map((series) => (
            <span key={series.key}>
              <i style={{ background: series.color }} /> {series.label}
            </span>
          ))}
        </div>
      </header>
      <svg className="trend" viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Process trends">
        {[0, 50, 100, 150, 200].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} className="grid-line" />
        ))}
        {SERIES.map((series) => (
          <polyline
            key={series.key}
            points={pointsFor(samples, series)}
            fill="none"
            stroke={series.color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </section>
  );
}
