import { Avatar, Icon } from './ui'
export default function CommunityPanels({ activity, participants, history, user, display }) {
  return (
    <div className="bottom-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>
            La comunidad <span className="count-pill">{participants.length}</span>
          </h2>
          <Icon name="users" />
        </div>
        <p className="subtle-text">
          {activity.registrationOpen
            ? 'Las inscripciones están abiertas.'
            : 'Las inscripciones están cerradas.'}
        </p>
        {participants.length ? (
          <ul className="participant-list">
            {participants.map((person) => (
              <li key={person.uid}>
                <Avatar name={person.displayName} photoURL={person.photoURL} />
                <span>{person.displayName}</span>
                {person.uid === user?.uid && !display && <small>Tú</small>}
                {person.uid === activity.currentTurnUid && activity.state === 'PLAYING' && (
                  <span className="badge">Su turno</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="inline-empty">El primer encuentro empieza con una invitación.</div>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>La historia del monte</h2>
          <Icon name="clock" />
        </div>
        <p className="subtle-text">{activity.hitCount} hachazos registrados · últimos 100 turnos</p>
        {history.length ? (
          <ol className="history-list">
            {history.map((turn) => (
              <li key={turn.id}>
                <span className={`history-icon ${turn.status === 'SKIPPED' ? 'skip' : ''}`}>
                  {turn.status === 'HIT' ? '🪓' : '↷'}
                </span>
                <div>
                  <strong>{turn.displayName}</strong>
                  <p>
                    {turn.status === 'HIT'
                      ? `dio un hachazo de ${turn.damage} puntos`
                      : turn.reason === 'ADMIN'
                        ? 'Turno omitido por el organizador'
                        : 'Su turno venció sin un golpe'}
                  </p>
                  <small>
                    Ronda {turn.round} · Turno {turn.turnNumber}
                    {turn.status === 'HIT' ? ` · ${turn.remainingHealth} de resistencia` : ''}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="inline-empty">Cada turno dejará aquí su historia.</div>
        )}
      </section>
    </div>
  )
}
