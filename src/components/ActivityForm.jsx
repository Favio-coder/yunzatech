import { defaults } from '../constants/activity'
import { useState } from 'react'
import { Icon } from './ui'
export default function ActivityForm({ onSave, pending, initial = defaults, editing = false }) {
  const [form, setForm] = useState(initial)
  const [customMinutes, setCustomMinutes] = useState(
    ![1, 5, 8, 10].includes(initial.decorationMinutes),
  )
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  return (
    <form
      className="activity-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(form)
      }}
    >
      <label>
        Nombre de la actividad
        <input
          required
          minLength={3}
          maxLength={80}
          placeholder="Ej. La yunza de nuestro equipo"
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
        />
      </label>
      <label>
        Descripción <span className="optional">(opcional)</span>
        <textarea
          maxLength={500}
          rows={2}
          placeholder="Una razón más para celebrar juntos…"
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
        />
      </label>
      <label>
        Tiempo para decorar
        <select
          value={customMinutes ? 'custom' : form.decorationMinutes}
          onChange={(event) => {
            const value = event.target.value
            setCustomMinutes(value === 'custom')
            if (value !== 'custom') update('decorationMinutes', Number(value))
          }}
        >
          <option value="1">1 minuto</option>
          <option value="5">5 minutos</option>
          <option value="8">8 minutos</option>
          <option value="10">10 minutos</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      {customMinutes && (
        <label>
          Minutos de decoración
          <input
            type="number"
            required
            min={1}
            max={60}
            step={1}
            value={form.decorationMinutes}
            onChange={(event) => update('decorationMinutes', Number(event.target.value))}
          />
          <small>Elige entre 1 y 60 minutos completos.</small>
        </label>
      )}
      <div className="form-grid">
        {[
          { key: 'initialHealth', title: 'Resistencia del árbol', min: 1, max: 100000 },
          { key: 'turnSeconds', title: 'Segundos por turno', min: 5, max: 300 },
          { key: 'minDamage', title: 'Daño mínimo', min: 1, max: 10000 },
          { key: 'maxDamage', title: 'Daño máximo', min: form.minDamage, max: 10000 },
          { key: 'decorationLimit', title: 'Adornos por persona', min: 1, max: 30 },
        ].map((field) => (
          <label key={field.key}>
            {field.title}
            <input
              type="number"
              required
              min={field.min}
              max={field.max}
              value={form[field.key]}
              onChange={(event) => update(field.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <p className="form-hint">
        Hasta 100 participantes por actividad. Cada persona tiene una oportunidad por ronda.
      </p>
      <button className="button w-full" disabled={pending}>
        {pending ? 'Guardando…' : editing ? 'Guardar configuración' : 'Crear mi actividad'}
        <Icon name={editing ? 'check' : 'plus'} />
      </button>
    </form>
  )
}
