import { decorationOptions } from '../constants/activity'
const symbols = { gift: '🎁', ribbon: '🎀', balloon: '🎈', money: '💵' }
export function DecorationLayer({ decorations }) {
  return (
    <div className="decoration-layer" aria-label={`${decorations.length} adornos en el árbol`}>
      {decorations.map((item) => (
        <span
          key={item.id}
          className="decoration"
          style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
          title={decorationOptions.find((option) => option.kind === item.kind)?.label}
        >
          {symbols[item.kind]}
        </span>
      ))}
    </div>
  )
}
export function DecorationPicker({ selected, onSelect, disabled }) {
  return (
    <div className="decoration-picker" aria-label="Selecciona tu adorno">
      {decorationOptions.map((option) => (
        <button
          key={option.kind}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option.kind)}
          aria-pressed={selected === option.kind}
          className={selected === option.kind ? 'selected' : ''}
        >
          <span>{symbols[option.kind]}</span>
          {option.label}
        </button>
      ))}
    </div>
  )
}
