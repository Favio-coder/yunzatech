export default function HitButton({ enabled, pending, onHit }) {
  return (
    <button className="button button-hit w-full" disabled={!enabled || pending} onClick={onHit}>
      {pending ? 'Registrando hachazo…' : enabled ? '🪓 Dar hachazo' : '🪓 Espera tu turno'}
    </button>
  )
}
