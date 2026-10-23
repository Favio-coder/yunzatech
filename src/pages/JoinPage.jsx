import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon, Notice } from '../components/ui'
import { useOperation } from '../hooks/useOperation'
export default function JoinPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') || '')
  const { run, pending, error } = useOperation()
  const navigate = useNavigate()
  async function submit(event) {
    event.preventDefault()
    const result = await run({ action: 'joinCode', code: code.trim().toUpperCase() })
    if (result) navigate(`/activities/${result.activityId}`)
  }
  return (
    <div className="join-layout">
      <div>
        <span className="eyebrow">TU COMUNIDAD TE ESPERA</span>
        <h1>
          Ya tienes
          <br />
          <em>un lugar en la ronda.</em>
        </h1>
        <p>
          Ingresa el código que compartió tu organizador.
          <br />
          El monte lo decoramos entre todos.
        </p>
        <div className="join-tree">
          <Icon name="tree" size={170} />
          <span>✦</span>
        </div>
      </div>
      <form className="panel join-form" onSubmit={submit}>
        <span className="form-icon">
          <Icon name="users" size={30} />
        </span>
        <h2>Únete a la celebración</h2>
        <p>Un código, muchas historias por compartir.</p>
        <label htmlFor="join-code">Código de la actividad</label>
        <input
          id="join-code"
          className="code-input"
          autoComplete="off"
          placeholder="A1B2C3D4E5"
          required
          minLength={10}
          maxLength={10}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />
        <Notice error>{error}</Notice>
        <button className="button w-full" disabled={pending}>
          {pending ? 'Buscando tu actividad…' : 'Entrar a la yunza'}
          <Icon name="arrow" />
        </button>
        <small>Tu participación se conserva cuando recargas o vuelves a entrar.</small>
      </form>
    </div>
  )
}
