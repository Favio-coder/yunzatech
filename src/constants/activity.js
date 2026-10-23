export const phaseLabels = {
  LOBBY: 'En el punto de encuentro',
  DECORATING: 'Decorando el monte',
  READY: 'Todo listo para la yunza',
  PLAYING: '¡Que siga la yunza!',
  FINISHED: 'Un monte, una historia',
  CANCELLED: 'Actividad cancelada',
}
export const shortPhases = {
  LOBBY: 'Lobby',
  DECORATING: 'Decoración',
  READY: 'Lista para comenzar',
  PLAYING: 'En juego',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
}

export const defaults = {
  name: '',
  description: '',
  decorationMinutes: 8,
  initialHealth: 500,
  minDamage: 10,
  maxDamage: 35,
  turnSeconds: 30,
  decorationLimit: 10,
}

export const decorationOptions = [
  { kind: 'gift', label: 'Regalo' },
  { kind: 'ribbon', label: 'Cinta' },
  { kind: 'balloon', label: 'Globo' },
  { kind: 'money', label: 'Billete ficticio' },
]
