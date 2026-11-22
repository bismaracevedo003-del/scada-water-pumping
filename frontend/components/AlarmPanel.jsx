export default function AlarmPanel({ alarms, onAcknowledge }) {
  const active = alarms.filter((alarm) => alarm.active);
  return (
    <section className="card alarms-card">
      <header className="section-header">
        <div>
          <h2>Alarms</h2>
          <p>{active.length} active · latched in PLC</p>
        </div>
        {active.length === 0 && <span className="badge ok">NORMAL</span>}
      </header>
      <div className="alarm-list">
        {alarms.map((alarm) => (
          <div key={alarm.id} className={`alarm-row ${alarm.active ? 'active' : 'clear'}`}>
            <div>
              <strong>{alarm.id}</strong>
              <small>{alarm.active ? (alarm.acknowledged ? 'Acknowledged · still active' : 'Unacknowledged') : 'Clear'}</small>
            </div>
            <button type="button" onClick={() => onAcknowledge(alarm.id)} disabled={!alarm.active}>
              ACK
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
