import ActivityCountdown from './ActivityCountdown'
import { Avatar } from './ui'
export default function TurnIndicator({ activity, participants, now, synced }) {
  const person = participants.find((p) => p.uid === activity.currentTurnUid)
  return (
    <div className="turn-card">
      <span className="eyebrow">
        RONDA {activity.round} · TURNO {activity.turnNumber}
      </span>
      <div className="person">
        <Avatar name={activity.currentTurnDisplayName} photoURL={person?.photoURL} />
        <div>
          <small>Es el turno de</small>
          <h3>{activity.currentTurnDisplayName}</h3>
        </div>
      </div>
      <ActivityCountdown
        endsAt={activity.turnEndsAt}
        now={now}
        synced={synced}
        label="Para dar el hachazo"
      />
    </div>
  )
}
