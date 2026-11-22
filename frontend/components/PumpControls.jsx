export default function PumpControls({ snapshot, onMode, onCommand }) {
  return (
    <section className="pump-grid">
      {[1, 2].map((number) => {
        const run = Boolean(snapshot?.[`Pump${number}_Run`]);
        const mode = snapshot?.[`Pump${number}_Mode`] === 1 ? 'AUTO' : 'MANUAL';
        const fault = Boolean(snapshot?.[`Pump${number}_Fault`]);
        const lead = snapshot?.LeadPump === number;
        const runtime = Number(snapshot?.[`Pump${number}_Runtime_s`] || 0);
        return (
          <article key={number} className={`card pump-card ${run ? 'running' : ''}`}>
            <header className="section-header">
              <div>
                <h2>Pump {number}</h2>
                <p>{lead ? 'LEAD · alternating duty' : 'LAG · standby'}</p>
              </div>
              <span className={`badge ${fault ? 'alarm' : run ? 'ok' : 'idle'}`}>
                {fault ? 'FAULT' : run ? 'RUNNING' : 'STOPPED'}
              </span>
            </header>
            <div className="pump-meta">
              <span>Mode: <strong>{mode}</strong></span>
              <span>Runtime: <strong>{Math.round(runtime / 60)} min</strong></span>
            </div>
            <div className="button-row">
              <button type="button" className={mode === 'AUTO' ? 'primary' : ''} onClick={() => onMode(number, 'AUTO')}>
                AUTO
              </button>
              <button type="button" className={mode === 'MANUAL' ? 'primary' : ''} onClick={() => onMode(number, 'MANUAL')}>
                MANUAL
              </button>
              <button type="button" disabled={mode !== 'MANUAL'} onClick={() => onCommand(number, true)}>
                START
              </button>
              <button type="button" disabled={mode !== 'MANUAL'} onClick={() => onCommand(number, false)}>
                STOP
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
