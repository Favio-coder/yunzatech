import { Link } from 'react-router-dom'
import TreeScene from '../components/TreeScene'
import { Icon } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

const illustration = [
  ['gift', 0.32, 0.37],
  ['ribbon', 0.56, 0.22],
  ['balloon', 0.69, 0.38],
  ['gift', 0.56, 0.49],
  ['money', 0.37, 0.19],
  ['ribbon', 0.22, 0.49],
  ['money', 0.73, 0.54],
].map(([kind, x, y], i) => ({ kind, x, y, id: i }))
export default function HomePage() {
  const { user, admin } = useAuth()
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">
          <span className="tiny-line" /> LA TRADICIÓN ENCUENTRA UN NUEVO LUGAR
        </span>
        <h1>
          Donde nos reunimos,
          <br />
          <em>la fiesta florece.</em>
        </h1>
        <p>
          Decora, comparte y prueba tu suerte. La emoción de la yunza,
          <br className="desktop-break" /> con tu comunidad, desde donde estés.
        </p>
      </div>
      <section className="welcome-grid">
        <div className="welcome-copy">
          <span className="badge">
            <i /> BIENVENIDOS A YUNZA TECH
          </span>
          <h2>
            Un árbol.
            <br />
            Toda tu gente.
            <br />
            <span>Una gran celebración.</span>
          </h2>
          <p>
            Volvamos a encontrarnos alrededor del monte.
            <br />
            Los regalos los ponemos entre todos;
            <br />
            la suerte decide quién se lo lleva.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/join">
              Unirme a una yunza <Icon name="arrow" />
            </Link>
            {admin && (
              <Link className="button button-outline" to="/admin">
                <Icon name="plus" />
                Crear actividad
              </Link>
            )}
          </div>
          <div className="hero-note">
            <span className="mini-faces">✦</span>
            <div>
              <strong>
                {user
                  ? `¡Qué bueno verte, ${user.displayName?.split(' ')[0]}!`
                  : 'La mejor parte es compartirla.'}
              </strong>
              <small>Solo necesitas tu cuenta de Google para participar.</small>
            </div>
          </div>
        </div>
        <div className="hero-tree">
          <div className="tree-caption">
            <span className="live-dot" /> EL PUNTO DE ENCUENTRO <span>✦</span>
          </div>
          <TreeScene decorations={illustration} />
          <span className="illustration-label">
            Ilustración · tu árbol se decora en la actividad
          </span>
        </div>
      </section>
      <section className="how-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ASÍ DE FÁCIL, ASÍ DE NUESTRO</span>
            <h2>La misma emoción, un nuevo encuentro.</h2>
          </div>
          <span className="section-aside">
            De principio a fiesta <Icon name="arrow" size={18} />
          </span>
        </div>
        <div className="steps-grid">
          {[
            {
              icon: 'users',
              title: 'Encuentra a tu gente',
              text: 'Entra con Google y únete con el código o enlace de tu actividad.',
            },
            {
              icon: 'tree',
              title: 'Dale vida al monte',
              text: 'Llena el árbol de regalos, cintas y colores. Cada detalle cuenta.',
            },
            {
              icon: 'trophy',
              title: '¡Que caiga la suerte!',
              text: 'Espera tu turno, da el hachazo y descubre quién tumba el monte.',
            },
          ].map((step, i) => (
            <article className="step-card" key={step.title}>
              <div className={`step-icon step-${i}`}>
                <Icon name={step.icon} size={24} />
              </div>
              <span className="step-number">0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
