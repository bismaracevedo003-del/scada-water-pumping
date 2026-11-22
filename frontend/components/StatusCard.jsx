export default function StatusCard({ label, value, unit, hint, tone = 'default' }) {
  return (
    <article className={`card status-card tone-${tone}`}>
      <span className="card-label">{label}</span>
      <div className="card-value">
        {value}
        <small>{unit}</small>
      </div>
      <span className="card-hint">{hint}</span>
    </article>
  );
}
