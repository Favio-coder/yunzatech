import { shortPhases } from '../constants/activity'
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    tree: 'M12 3 5 12h3l-4 6h6v4h4v-4h6l-4-6h3L12 3Z',
    home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3V10Z',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    users:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    arrow: 'M5 12h14 m-6-6 6 6-6 6',
    plus: 'M12 5v14 M5 12h14',
    clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    leaf: 'M20 3C8 2 2 8 5 16c7 7 16-2 15-13Z M4 21 15 10',
    link: 'm10 13 4-4 M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
    check: 'm5 12 4 4L19 6',
    trophy:
      'M8 3h8v8a4 4 0 0 1-8 0V3Z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 15v6 M8 21h8',
    logout: 'M9 4H4v16h5 M14 8l4 4-4 4 M8 12h13',
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.leaf} />
    </svg>
  )
}
export function Notice({ children, error = false }) {
  if (!children) return null
  return (
    <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
export function PhaseBadge({ state }) {
  return <span className={`badge phase-${state}`}>{shortPhases[state] || state}</span>
}
export function Avatar({ name, photoURL, large = false }) {
  return photoURL ? (
    <img
      className={`avatar ${large ? 'avatar-large' : ''}`}
      src={photoURL}
      alt={name}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className={`avatar ${large ? 'avatar-large' : ''}`} aria-label={name}>
      {name?.slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}
