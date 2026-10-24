import AdminControls from '../components/AdminControls'
import CommunityPanels from '../components/CommunityPanels'
import { phaseLabels } from '../constants/activity'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLive } from '../hooks/useLive'
import { useOperation } from '../hooks/useOperation'
import { useExpiration } from '../hooks/useExpiration'
import { useServerTime } from '../hooks/useServerTime'
import TreeScene from '../components/TreeScene'
import ActivityCountdown from '../components/ActivityCountdown'
import { DecorationPicker } from '../components/DecorationLayer'
import TurnIndicator from '../components/TurnIndicator'
import HitButton from '../components/HitButton'
import WinnerScreen from '../components/WinnerScreen'
import ActivityForm from '../components/ActivityForm'
import { Icon, Notice, PhaseBadge } from '../components/ui'

export default function ActivityPage({ management = false, display = false, winnerRoute = false }) {
  const { activityId } = useParams()
  const { user } = useAuth()
  const activityLive = useLive('public', activityId)
  const privateLive = useLive('private', management ? activityId : null)
  const participantLive = useLive('public', activityId, 'participants')
  const decorationLive = useLive('public', activityId, 'decorations')
  const historyLive = useLive('public', activityId, 'turns')
  const operation = useOperation()
  const { now, synced } = useServerTime()
  const [selected, setSelected] = useState('gift')
  const [online, setOnline] = useState(navigator.onLine)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  const activity = activityLive.data
  const participants = participantLive.data || []
  const decorations = decorationLive.data || []
  const history = historyLive.data || []
  const member = participants.some((person) => person.uid === user?.uid)
  const ownDecorations = decorations.filter((item) => item.uid === user?.uid).length
  const busy = operation.pending || !online
  const action = (name, extra = {}) => operation.run({ action: name, activityId, ...extra })
  // Connected participants and the organiser ask the server to check deadlines as they pass.
  useExpiration({
    activityId,
    activity,
    now,
    synced,
    enabled: !display && online && Boolean(user) && (member || management),
  })

  if (activityLive.loading || (management && privateLive.loading))
    return <div className="empty-state">Preparando el encuentro…</div>
  const listenerError =
    activityLive.error ||
    (management && privateLive.error) ||
    participantLive.error ||
    decorationLive.error ||
    historyLive.error
  if (listenerError) return <Notice error>{listenerError}</Notice>
  if (!activity || (management && !privateLive.data))
    return (
      <div className="empty-state">
        <h2>No encontramos esta actividad.</h2>
        <Link className="button" to="/join">
          Ingresar con un código
        </Link>
      </div>
    )
  const isDecorating = activity.state === 'DECORATING' && now < activity.decorationEndsAt
  const canDecorate =
    !display && member && isDecorating && ownDecorations < activity.decorationLimit && !busy
  const renderStatus = (
    <>
      <Notice error>{operation.error}</Notice>
      {!online ? (
        <Notice>
          Estás sin conexión. Mostramos el último estado recibido; las acciones se habilitan al
          reconectar.
        </Notice>
      ) : (
        activityLive.cached && (
          <Notice>Reconectando con Firebase. Esperando el estado actualizado del servidor.</Notice>
        )
      )}
    </>
  )
  if (activity.state === 'FINISHED' && (winnerRoute || display))
    return (
      <>
        {renderStatus}
        <WinnerScreen activity={activity} />
      </>
    )
  return (
    <>
      {renderStatus}
      <div className="activity-heading">
        <div>
          <span className="eyebrow">
            {display
              ? 'CELEBREMOS JUNTOS · VISTA PÚBLICA'
              : management
                ? 'EL ENCUENTRO ESTÁ EN TUS MANOS'
                : 'ESTA FIESTA LA HACEMOS ENTRE TODOS'}
          </span>
          <h1>{activity.name}</h1>
          <p>{activity.description || phaseLabels[activity.state]}</p>
        </div>
        <PhaseBadge state={activity.state} />
      </div>
      <div className="phase-steps" aria-label="Fases de la actividad">
        {['LOBBY', 'DECORATING', 'READY', 'PLAYING', 'FINISHED'].map((state, index) => (
          <span key={state} className={activity.state === state ? 'active' : ''}>
            <b>{index + 1}</b>
            {['Encuentro', 'Decoración', 'Todo listo', 'La yunza', 'Ganador'][index]}
          </span>
        ))}
      </div>
      {winnerRoute && activity.state !== 'FINISHED' && (
        <Notice>La yunza aún no tiene ganador. Aquí puedes seguir la actividad.</Notice>
      )}
      {activity.state === 'CANCELLED' && (
        <Notice>El organizador canceló esta actividad. No se permiten más acciones.</Notice>
      )}
      <div className="game-grid">
        <section className="panel scene-panel">
          <div className="section-heading">
            <span className="eyebrow">
              <span className="live-dot" /> NUESTRO MONTE
            </span>
            <span className="subtle-text">
              {decorations.length} adornos · {activity.participantCount} participantes
            </span>
          </div>
          <TreeScene
            decorations={decorations}
            onPlace={(x, y) => action('decorate', { kind: selected, x, y })}
            interactive={canDecorate}
            health={activity.health}
            initialHealth={activity.initialHealth}
            hitCount={activity.hitCount}
            finished={activity.state === 'FINISHED'}
          />
          {!display && member && activity.state === 'DECORATING' && (
            <div className="decoration-controls">
              <p>
                <strong>Elige un adorno y toca la copa del árbol.</strong>
                <span>
                  {ownDecorations} / {activity.decorationLimit} colocados
                </span>
              </p>
              <DecorationPicker
                selected={selected}
                onSelect={setSelected}
                disabled={!canDecorate}
              />
              <small>
                Puedes usar Tab para enfocar el árbol y Enter para colocar en el centro.
              </small>
            </div>
          )}
        </section>
        <aside className="game-sidebar">
          {activity.state === 'FINISHED' ? (
            <div className="panel compact-winner">
              <Icon name="trophy" size={40} />
              <h2>¡{activity.winnerDisplayName} tumbó el monte!</h2>
              <p>La suerte ya tiene nombre.</p>
              <Link className="button w-full" to={`/activities/${activityId}/winner`}>
                Ver la celebración <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <section className="panel status-panel">
              <span className="eyebrow">EL RITMO DE LA FIESTA</span>
              <h2>{phaseLabels[activity.state]}</h2>
              {activity.state === 'LOBBY' && (
                <p>
                  Estamos reuniendo a la comunidad. La decoración comenzará cuando lo indique el
                  organizador.
                </p>
              )}
              {activity.state === 'DECORATING' && (
                <>
                  <p>Cada regalo le da vida a nuestro monte. ¡Deja tu huella!</p>
                  <ActivityCountdown
                    endsAt={activity.decorationEndsAt}
                    now={now}
                    synced={synced}
                    label="Para decorar"
                  />
                </>
              )}
              {activity.state === 'READY' && (
                <>
                  <div className="ready-icon">
                    <Icon name="check" size={30} />
                  </div>
                  <p>
                    El árbol ya está vestido de fiesta. Esperamos que el organizador dé inicio a la
                    yunza.
                  </p>
                </>
              )}
              {activity.state === 'PLAYING' && (
                <>
                  <TurnIndicator
                    activity={activity}
                    participants={participants}
                    now={now}
                    synced={synced}
                  />
                  {!display && (
                    <HitButton
                      pending={operation.pending}
                      enabled={
                        member &&
                        activity.currentTurnUid === user?.uid &&
                        now < activity.turnEndsAt &&
                        !busy
                      }
                      onHit={() => action('hit', { turnNumber: activity.turnNumber })}
                    />
                  )}
                </>
              )}
              {!display && !member && ['LOBBY', 'DECORATING', 'READY'].includes(activity.state) && (
                <button
                  className="button w-full"
                  disabled={busy || !activity.registrationOpen}
                  onClick={() => action('join')}
                >
                  {activity.registrationOpen
                    ? 'Sumarme a la celebración'
                    : 'Inscripciones cerradas'}
                </button>
              )}
              {!display && member && activity.state === 'LOBBY' && (
                <div className="joined-note">
                  <Icon name="check" />
                  Ya estás en la lista. ¡Nos vemos en la ronda!
                </div>
              )}
            </section>
          )}
          {management && (
            <AdminControls
              activity={activity}
              activityId={activityId}
              code={privateLive.data.code}
              busy={busy}
              action={action}
              editing={editing}
              onToggleEditing={() => setEditing(!editing)}
            />
          )}
        </aside>
      </div>
      {management && editing && activity.state === 'LOBBY' && (
        <section className="panel creation-panel">
          <h2>Configuración de la actividad</h2>
          <ActivityForm
            key={activity.updatedAt}
            initial={privateLive.data}
            editing
            pending={busy}
            onSave={async (config) => {
              const result = await action('updateConfig', { config })
              if (result) setEditing(false)
            }}
          />
        </section>
      )}
      <CommunityPanels
        activity={activity}
        participants={participants}
        history={history}
        user={user}
        display={display}
      />
    </>
  )
}
