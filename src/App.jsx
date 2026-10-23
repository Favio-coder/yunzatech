import { useState } from 'react'
import { Link, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { apiConfigured, configured, login, logout, usingEmulators } from './services/firebase'
import { Avatar, Icon, Notice } from './components/ui'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import JoinPage from './pages/JoinPage'
import ActivityPage from './pages/ActivityPage'

export function LoginButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function signIn() {
    setBusy(true)
    setError('')
    try {
      await login()
    } catch (error) {
      setError(
        error.code === 'auth/popup-closed-by-user'
          ? 'Se cerró la ventana de acceso. Puedes intentarlo de nuevo.'
          : error.message,
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button className="button" onClick={signIn} disabled={busy || !configured}>
        <span className="google-g">G</span>
        {busy ? 'Conectando…' : 'Continuar con Google'}
      </button>
      <Notice error>{error}</Notice>
    </div>
  )
}
function Guard({ children, admin = false }) {
  const session = useAuth()
  if (session.loading) return <div className="empty-state">Cargando tu sesión…</div>
  if (!session.user)
    return (
      <div className="auth-card">
        <span className="eyebrow">BIENVENIDO A LA YUNZA</span>
        <h1>
          Tu lugar en
          <br />
          <em>la celebración.</em>
        </h1>
        <p>Inicia sesión para unirte o gestionar una actividad.</p>
        <LoginButton />
      </div>
    )
  if (session.error)
    return (
      <div className="empty-state">
        <Icon name="leaf" size={40} />
        <h2>No pudimos verificar tu perfil</h2>
        <p>{session.error}</p>
        <button className="button" onClick={session.retry}>
          Reintentar
        </button>
      </div>
    )
  if (admin && !session.admin)
    return (
      <div className="empty-state">
        <Icon name="leaf" size={40} />
        <h2>Tu cuenta es de participante</h2>
        <p>
          El rol administrador se habilita desde Firebase Console, marcando el campo isAdmin de tu
          perfil. Si te lo acaban de activar, esta pantalla se actualizará sola.
        </p>
        <Link className="button" to="/join">
          Unirme a una yunza
        </Link>
      </div>
    )
  return children
}
export default function App() {
  const { user, admin, error } = useAuth()
  const { pathname } = useLocation()
  const [logoutError, setLogoutError] = useState('')
  const display = pathname.startsWith('/display/')
  return (
    <div className={`app-shell ${display ? 'display-shell' : ''}`}>
      {!display && (
        <aside className="sidebar">
          <Link className="brand" to="/">
            <span className="brand-symbol">
              <Icon name="tree" size={27} />
            </span>
            yunza<span className="brand-light">tech</span>
            <span className="brand-dot">.</span>
          </Link>
          <span className="sidebar-label">CELEBREMOS JUNTOS</span>
          <nav>
            <NavLink to="/" end>
              <Icon name="home" />
              Inicio
            </NavLink>
            <NavLink to="/join">
              <Icon name="users" />
              Unirme a una yunza
            </NavLink>
            <NavLink to="/admin">
              <Icon name="grid" />
              Mis actividades{admin && <span className="nav-admin">ADMIN</span>}
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <div className="tradition-card">
              <Icon name="leaf" size={27} />
              <h3>La tradición sigue viva.</h3>
              <p>
                Ahora, también nos
                <br />
                encontramos en digital.
              </p>
              <span>HECHO PARA COMPARTIR ↗</span>
            </div>
            <small>
              Una fiesta que nos conecta.
              <br />
              Yunza Tech © 2026
            </small>
          </div>
        </aside>
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Nuestra comunidad <span>/</span>{' '}
            <strong>
              {display
                ? 'Pantalla pública'
                : pathname.startsWith('/admin')
                  ? 'Mis actividades'
                  : pathname.startsWith('/activities')
                    ? 'La celebración'
                    : pathname === '/join'
                      ? 'Unirme a una yunza'
                      : 'Inicio'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="connection-label">
              <i />
              {usingEmulators ? 'Emuladores locales' : 'Tradición que conecta'}
            </span>
            {user ? (
              <>
                <Avatar name={user.displayName} photoURL={user.photoURL} />
                <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                <button
                  className="icon-button"
                  aria-label="Cerrar sesión"
                  onClick={() => logout().catch((error) => setLogoutError(error.message))}
                >
                  <Icon name="logout" />
                </button>
              </>
            ) : (
              !display && (
                <Link className="text-link" to="/join">
                  Ingresar <Icon name="arrow" size={16} />
                </Link>
              )
            )}
          </div>
        </header>
        <main className="page-content">
          <Notice error>{(!user && error) || logoutError}</Notice>
          {!configured && (
            <Notice>
              Firebase aún no está configurado. Copia .env.example a .env y completa los datos de tu
              aplicación. La ilustración del inicio es una vista visual; no simula una partida.
            </Notice>
          )}
          {configured && !apiConfigured && (
            <Notice>
              Falta VITE_API_BASE_URL: el servidor de la yunza no está configurado y las acciones no
              funcionarán hasta definirlo.
            </Notice>
          )}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/join"
              element={
                <Guard>
                  <JoinPage />
                </Guard>
              }
            />
            <Route
              path="/admin"
              element={
                <Guard admin>
                  <AdminPage />
                </Guard>
              }
            />
            <Route
              path="/admin/activities/:activityId"
              element={
                <Guard admin>
                  <ActivityPage management />
                </Guard>
              }
            />
            <Route
              path="/activities/:activityId"
              element={
                <Guard>
                  <ActivityPage />
                </Guard>
              }
            />
            <Route
              path="/activities/:activityId/winner"
              element={
                <Guard>
                  <ActivityPage winnerRoute />
                </Guard>
              }
            />
            <Route path="/display/:activityId" element={<ActivityPage display />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="page-footer">
          <span>Raíces compartidas. Nuevas formas de celebrar.</span>
          <span>
            <Icon name="leaf" size={14} /> De nuestra comunidad, para todos.
          </span>
        </footer>
      </div>
    </div>
  )
}
