import type { ConnectionConfig, ConnectionType } from '../types'
import { CONNECTION_TYPES } from '../data/templates'

interface ConnectionPickerProps {
  role: 'source' | 'target'
  requiredType: ConnectionType
  connections: ConnectionConfig[]
  selectedId: string
  onSelect: (id: string) => void
  onManageConnections: (prefillType: ConnectionType) => void
}

export default function ConnectionPicker({ role, requiredType, connections, selectedId, onSelect, onManageConnections }: ConnectionPickerProps) {
  const typeLabel = CONNECTION_TYPES.find((c) => c.value === requiredType)?.label ?? requiredType
  const matches = connections.filter((c) => c.type === requiredType)
  const selected = matches.find((c) => c.connection_id === selectedId)

  const title = role === 'source' ? 'Source connection' : 'Target connection'
  const subtitle = role === 'source' ? 'Where the pipeline extracts data from.' : 'Where the pipeline loads data into.'

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p>
          {subtitle} This template requires a <strong>{typeLabel}</strong> connection — pick one from your saved connections below.
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="warning-banner">
          No saved {typeLabel} connections yet.
          <button type="button" className="btn small primary" onClick={() => onManageConnections(requiredType)}>
            Add a {typeLabel} connection
          </button>
        </div>
      ) : (
        <div className="field" style={{ maxWidth: 420 }}>
          <label>Saved {typeLabel} connections</label>
          <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Select a connection…</option>
            {matches.map((c) => (
              <option key={c.connection_id} value={c.connection_id}>
                {c.name} ({c.environment})
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <div className="connection-summary">
          <div className="connection-summary-row">
            <span className="badge">{typeLabel}</span>
            <span className="badge">{selected.environment}</span>
            {selected.tags.map((t) => (
              <span className="badge" key={t}>
                {t}
              </span>
            ))}
          </div>
          <dl>
            {selected.host && (
              <>
                <dt>Host</dt>
                <dd>{selected.host}</dd>
              </>
            )}
            {selected.database && (
              <>
                <dt>Database</dt>
                <dd>{selected.database}</dd>
              </>
            )}
            <dt>Owner</dt>
            <dd>{selected.owner}</dd>
            <dt>Auth</dt>
            <dd>
              {selected.auth.method} · {selected.auth.secret_ref}
            </dd>
          </dl>
        </div>
      )}

      <div className="row-actions">
        <button type="button" className="btn small ghost" onClick={() => onManageConnections(requiredType)}>
          Manage connections →
        </button>
      </div>
    </div>
  )
}
