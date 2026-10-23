import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLive } from '../hooks/useLive'
import { useOperation } from '../hooks/useOperation'
import { Icon, Notice, PhaseBadge } from '../components/ui'
import ActivityForm from '../components/ActivityForm'
export default function AdminPage() {
  const { user } = useAuth()
  const { data: activities, loading, error } = useLive('owned', user.uid)
  const [creating, setCreating] = useState(false)
  const operation = useOperation()
  const navigate = useNavigate()
  async function create(config) {
    const result = await operation.run({ action: 'create', config })
    if (result) navigate(`/admin/activities/${result.activityId}`)
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">TÚ PONES EL MOTIVO. TODOS PONEMOS LA FIESTA.</span>
          <h1>
            Mis <em>actividades.</em>
          </h1>
          <p>Crea un encuentro y deja que la tradición haga el resto.</p>
        </div>
        <button className="button" onClick={() => setCreating(!creating)}>
          <Icon name="plus" />
          {creating ? 'Cerrar formulario' : 'Crear actividad'}
        </button>
      </div>
      <Notice error>{error || operation.error}</Notice>
      {creating && (
        <section className="panel creation-panel">
          <h2>Un nuevo motivo para reunirnos</h2>
          <ActivityForm onSave={create} pending={operation.pending} />
        </section>
      )}
      {loading ? (
        <div className="empty-state">Cargando tus actividades…</div>
      ) : !activities?.length ? (
        <div className="empty-state">
          <Icon name="tree" size={65} />
          <h2>Aquí comienza tu próxima celebración.</h2>
          <p>Crea tu primera yunza y comparte el código con tu comunidad.</p>
          <button className="button button-outline" onClick={() => setCreating(true)}>
            Crear mi primera actividad
          </button>
        </div>
      ) : (
        <div className="activity-grid">
          {activities.map((activity) => (
            <Link
              className="panel activity-card"
              to={`/admin/activities/${activity.id}`}
              key={activity.id}
            >
              <div className="section-heading">
                <span className="form-icon">
                  <Icon name="tree" size={28} />
                </span>
                <PhaseBadge state={activity.state} />
              </div>
              <h2>{activity.name}</h2>
              <p>{activity.description || 'Un nuevo encuentro alrededor del monte.'}</p>
              <div className="activity-card-footer">
                <span>
                  <Icon name="users" size={17} />
                  {activity.participantCount} participantes
                </span>
                <Icon name="arrow" />
              </div>
              {activity.winnerDisplayName && (
                <small>🏆 {activity.winnerDisplayName} tumbó el monte</small>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
