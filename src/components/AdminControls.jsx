import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Notice } from './ui'

export default function AdminControls({
  activity,
  activityId,
  code,
  busy,
  action,
  editing,
  onToggleEditing,
}) {
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState('')
  const shareUrl = window.location.origin + import.meta.env.BASE_URL + 'join?code=' + code
  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setCopyError('')
    } catch {
      setCopyError('No se pudo copiar. Selecciona y copia el enlace manualmente.')
    }
  }
  return (
    <>
      {' '}
      <Notice error>{copyError}</Notice>{' '}
      <section className="panel admin-controls">
        <span className="eyebrow">PANEL DEL ORGANIZADOR</span>
        <h3>Que comience el encuentro</h3>
        <div className="share-code">
          <small>Código de acceso</small>
          <strong>{code}</strong>
          <button className="text-link" onClick={() => copy(code, 'Código copiado')}>
            Copiar código <Icon name="link" size={15} />
          </button>
        </div>
        <input
          className="share-input"
          aria-label="Enlace para compartir"
          readOnly
          value={shareUrl}
          onFocus={(event) => event.target.select()}
        />
        <button
          className="button button-outline w-full"
          onClick={() => copy(shareUrl, 'Enlace copiado')}
        >
          <Icon name="link" />
          Copiar invitación
        </button>
        {copied && <small role="status">{copied}</small>}
        <Link className="text-link public-link" target="_blank" to={`/display/${activityId}`}>
          Abrir pantalla pública ↗
        </Link>
        {['LOBBY', 'DECORATING', 'READY'].includes(activity.state) && (
          <button
            className="button button-outline w-full"
            disabled={busy}
            onClick={() => action('registration', { open: !activity.registrationOpen })}
          >
            {activity.registrationOpen ? 'Cerrar inscripciones' : 'Abrir inscripciones'}
          </button>
        )}
        {activity.state === 'LOBBY' && (
          <>
            <button
              className="button w-full"
              disabled={busy || !activity.participantCount}
              onClick={() => action('decorateStart')}
            >
              Comenzar decoración <Icon name="arrow" />
            </button>
            <button className="text-link" onClick={() => onToggleEditing()}>
              {editing ? 'Cerrar configuración' : 'Editar configuración'}
            </button>
          </>
        )}
        {activity.state === 'READY' && (
          <button className="button w-full" disabled={busy} onClick={() => action('playStart')}>
            ¡Comenzar la yunza! <Icon name="arrow" />
          </button>
        )}
        {activity.state === 'PLAYING' && (
          <button
            className="button button-outline w-full"
            disabled={busy}
            onClick={() => action('skip', { turnNumber: activity.turnNumber })}
          >
            Omitir este turno
          </button>
        )}
        {!['FINISHED', 'CANCELLED'].includes(activity.state) && (
          <details className="cancel-details">
            <summary>Cancelar actividad</summary>
            <p>La cancelación termina esta actividad definitivamente.</p>
            <button className="danger-button" disabled={busy} onClick={() => action('cancel')}>
              Confirmar cancelación
            </button>
          </details>
        )}
      </section>
    </>
  )
}
