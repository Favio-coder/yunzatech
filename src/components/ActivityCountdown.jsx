import { Icon } from './ui'
export default function ActivityCountdown({
  endsAt,
  now,
  synced = true,
  label = 'Tiempo restante',
}) {
  const seconds = Math.max(0, Math.ceil(((endsAt || now) - now) / 1000))
  return (
    <div className="countdown">
      <Icon name="clock" />
      <span>{label}</span>
      <strong>
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </strong>
      {!synced && <small>Sincronizando reloj</small>}
      {seconds === 0 && <small>Esperando confirmación del servidor</small>}
    </div>
  )
}
