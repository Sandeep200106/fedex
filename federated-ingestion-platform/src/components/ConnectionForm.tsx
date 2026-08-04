import { useState } from 'react'
import type { ConnectionConfig, ConnectionType, Environment } from '../types'
import { CONNECTION_FIELD_CONFIG, CONNECTION_TYPES, connectionTypeDefaults } from '../data/templates'
import { slugify } from '../utils/slug'
import HelpTip from './HelpTip'

interface ConnectionFormProps {
  value: ConnectionConfig
  onChange: (next: ConnectionConfig) => void
}

export default function ConnectionForm({ value, onChange }: ConnectionFormProps) {
  const [tagDraft, setTagDraft] = useState('')
  const [idTouched, setIdTouched] = useState(Boolean(value.connection_id))

  function patch(fields: Partial<ConnectionConfig>) {
    onChange({ ...value, ...fields })
  }

  function handleNameChange(name: string) {
    const next: Partial<ConnectionConfig> = { name }
    if (!idTouched) {
      next.connection_id = `conn_${slugify(name)}_${value.environment}`
    }
    patch(next)
  }

  function handleTypeChange(type: ConnectionType) {
    onChange(connectionTypeDefaults(value, type))
  }

  function handleEnvironmentChange(environment: Environment) {
    const next: Partial<ConnectionConfig> = { environment }
    if (!idTouched && value.name) {
      next.connection_id = `conn_${slugify(value.name)}_${environment}`
    }
    patch(next)
  }

  function addTag() {
    const tag = tagDraft.trim()
    if (tag && !value.tags.includes(tag)) {
      patch({ tags: [...value.tags, tag] })
    }
    setTagDraft('')
  }

  function removeTag(tag: string) {
    patch({ tags: value.tags.filter((t) => t !== tag) })
  }

  const fields = CONNECTION_FIELD_CONFIG[value.type]

  return (
    <div className="form-grid">
      <div className="field">
        <label>Connection name</label>
        <input value={value.name} placeholder="Orders DB (Production)" onChange={(e) => handleNameChange(e.target.value)} />
      </div>

      <div className="field">
        <label>Connection ID</label>
        <input
          value={value.connection_id}
          placeholder="conn_orders_db_prod"
          onChange={(e) => {
            setIdTouched(true)
            patch({ connection_id: e.target.value })
          }}
        />
        <span className="hint">Referenced from pipeline configs as connection_ref.</span>
      </div>

      <div className="field">
        <label>Type</label>
        <select value={value.type} onChange={(e) => handleTypeChange(e.target.value as ConnectionType)}>
          {CONNECTION_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Environment</label>
        <select value={value.environment} onChange={(e) => handleEnvironmentChange(e.target.value as Environment)}>
          <option value="dev">dev</option>
          <option value="staging">staging</option>
          <option value="prod">prod</option>
        </select>
      </div>

      {fields.host.show && (
        <div className="field">
          <label>
            {fields.host.label}
            {!fields.host.required && ' (optional)'}
          </label>
          <input value={value.host} placeholder={fields.host.placeholder} onChange={(e) => patch({ host: e.target.value })} />
        </div>
      )}

      {fields.port.show && (
        <div className="field">
          <label>
            Port
            {!fields.port.required && ' (optional)'}
          </label>
          <input
            type="number"
            value={value.port}
            onChange={(e) => patch({ port: e.target.value === '' ? '' : Number(e.target.value) })}
          />
        </div>
      )}

      {fields.database.show && (
        <div className="field">
          <label>
            {fields.database.label}
            {!fields.database.required && ' (optional)'}
          </label>
          <input
            value={value.database}
            placeholder={fields.database.placeholder}
            onChange={(e) => patch({ database: e.target.value })}
          />
        </div>
      )}

      <div className="field">
        <label>Owner</label>
        <input value={value.owner} placeholder="data-engineering" onChange={(e) => patch({ owner: e.target.value })} />
      </div>

      <div className="field">
        <label>
          Auth method
          <HelpTip text="How Airflow authenticates to this connection at run time. secret_manager and iam_role avoid storing credentials directly; basic/oauth2 rely on the secret reference below." />
        </label>
        <select
          value={value.auth.method}
          onChange={(e) => patch({ auth: { ...value.auth, method: e.target.value as ConnectionConfig['auth']['method'] } })}
        >
          <option value="secret_manager">secret_manager</option>
          <option value="basic">basic</option>
          <option value="oauth2">oauth2</option>
          <option value="iam_role">iam_role</option>
        </select>
      </div>

      <div className="field">
        <label>
          Secret reference
          <HelpTip text="A pointer to where the actual credential lives (e.g. a Vault path or secret manager ARN) — never the credential itself." />
        </label>
        <input
          value={value.auth.secret_ref}
          placeholder="vault://data-eng/connections/orders_db_prod"
          onChange={(e) => patch({ auth: { ...value.auth, secret_ref: e.target.value } })}
        />
      </div>

      <div className="field full">
        <label>Tags</label>
        <div className="chip-row">
          {value.tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
              <button type="button" onClick={() => removeTag(tag)}>
                ×
              </button>
            </span>
          ))}
          <input
            style={{ width: 140 }}
            value={tagDraft}
            placeholder="add tag + Enter"
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            onBlur={addTag}
          />
        </div>
      </div>
    </div>
  )
}
