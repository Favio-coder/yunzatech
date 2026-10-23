import { DecorationLayer } from './DecorationLayer'
export default function TreeScene({
  decorations = [],
  onPlace,
  interactive = false,
  health = 100,
  initialHealth = 100,
  finished = false,
  hitCount = 0,
}) {
  const place = (event) => {
    if (!interactive || !onPlace) return
    const box = event.currentTarget.getBoundingClientRect()
    onPlace((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height)
  }
  return (
    <div className={`tree-stage ${interactive ? 'interactive' : ''}`}>
      <div className="scene-spark spark-one">✦</div>
      <div className="scene-spark spark-two">✧</div>
      <div className={`tree-art ${finished ? 'fallen' : ''}`}>
        <svg
          key={hitCount}
          className={hitCount ? 'tree-shake' : ''}
          viewBox="0 0 600 650"
          aria-label="Árbol de yunza"
          role={interactive ? 'button' : 'img'}
          tabIndex={interactive ? 0 : undefined}
          onClick={place}
          onKeyDown={(event) => {
            if (interactive && ['Enter', ' '].includes(event.key)) {
              event.preventDefault()
              onPlace(0.5, 0.37)
            }
          }}
        >
          <defs>
            <linearGradient id="trunk" x2="1" y2="0">
              <stop stopColor="#a3744d" />
              <stop offset="1" stopColor="#be9363" />
            </linearGradient>
            <linearGradient id="crown" x2="0.6" y2="1">
              <stop stopColor="#619b60" />
              <stop offset="1" stopColor="#347452" />
            </linearGradient>
          </defs>
          <ellipse cx="300" cy="592" rx="157" ry="24" fill="#375b33" opacity=".1" />
          <path d="M276 360h52l-9 173 26 49-40-9-44 11 23-50Z" fill="url(#trunk)" />
          <path d="m299 445-85-85 13-15 73 54 72-87 15 11-76 122" fill="#a77b51" />
          <path
            d="m298 470-1 72 M308 478l-2 57"
            stroke="#8c6547"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".5"
          />
          <ellipse cx="300" cy="240.5" rx="222" ry="208" fill="url(#crown)" />
          <circle cx="201" cy="226" r="113" fill="#548f58" />
          <circle cx="361" cy="170" r="116" fill="#639b60" />
          <circle cx="269" cy="144" r="103" fill="#72a76b" />
          <circle cx="405" cy="290" r="104" fill="#44815a" />
          <circle cx="238" cy="321" r="105" fill="#508e59" />
          <circle cx="306" cy="245" r="120" fill="#5c995f" />
          <path
            d="m159 171 17-11 m190-45 17 12 m63 145-14 12 m-222 55 17 7 m57-136 15-4"
            stroke="#a0c483"
            strokeWidth="8"
            strokeLinecap="round"
            opacity=".5"
          />
          <path
            d="m151 544 5-24 13 19 M423 572l8-24 4 23 M175 579l6-17 8 14"
            fill="none"
            stroke="#7e9d61"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
        <DecorationLayer decorations={decorations} />
      </div>
      <div className="tree-ground">
        <span>UN ÁRBOL. MUCHAS HISTORIAS.</span>
      </div>
      <div className="health">
        <div>
          <span>Resistencia del árbol</span>
          <strong>
            {health.toLocaleString()} <small>/ {initialHealth.toLocaleString()}</small>
          </strong>
        </div>
        <progress max={initialHealth} value={health} aria-label="Resistencia del árbol" />
      </div>
    </div>
  )
}
