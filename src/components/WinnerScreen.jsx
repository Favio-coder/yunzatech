import { Link } from 'react-router-dom'
import { Avatar, Icon } from './ui'
export default function WinnerScreen({ activity }) {
  return (
    <div className="winner-screen">
      <span className="winner-medal">
        <Icon name="trophy" size={36} />
      </span>
      <span className="eyebrow">¡TENEMOS GANADOR!</span>
      <Avatar name={activity.winnerDisplayName} photoURL={activity.winnerPhotoURL} large />
      <h1>
        ¡{activity.winnerDisplayName}
        <br />
        <em>tumbó el monte!</em>
      </h1>
      <p>
        Una gran celebración merece una gran historia.
        <br />
        {activity.name}
      </p>
      <div className="winner-stats">
        <span>
          <strong>{activity.participantCount}</strong> participantes
        </span>
        <span>
          <strong>{activity.hitCount}</strong> hachazos
        </span>
      </div>
      <Link className="button" to="/">
        Volver al inicio <Icon name="arrow" />
      </Link>
    </div>
  )
}
