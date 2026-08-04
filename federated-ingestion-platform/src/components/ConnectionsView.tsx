import { useEffect, useState } from 'react'
import type { ConnectionConfig, ConnectionType } from '../types'
import { emptyConnectionConfig } from '../types'
import { CONNECTION_TYPES } from '../data/templates'
import { validateConnection } from '../data/connectionValidation'
import ConnectionForm from './ConnectionForm'

interface ConnectionsViewProps {
  connections: ConnectionConfig[]
  onChange: (next: ConnectionConfig[]) => void
  prefillType: ConnectionType | null
  onPrefillConsumed: () => void
}

function draftFor(type: ConnectionType | null): ConnectionConfig {
  const draft = emptyConnectionConfig()
  return type ? { ...draft, type } : draft
}

export default function ConnectionsView({ connections, onChange, prefillType, onPrefillConsumed }: ConnectionsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ConnectionConfig>(draftFor(null))
  const [originalId, setOriginalId] = useState<string | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (prefillType) {
      setSelectedId(null)
      setOriginalId(null)
      setDraft(draftFor(prefillType))
      setIssues([])
      onPrefillConsumed()
    }
  }, [prefillType, onPrefillConsumed])

  function selectForEdit(conn: ConnectionConfig) {
    setSelectedId(conn.connection_id)
    setOriginalId(conn.connection_id)
    setDraft(conn)
    setIssues([])
  }

  function startNew() {
    setSelectedId(null)
    setOriginalId(null)
    setDraft(draftFor(null))
    setIssues([])
  }

  function handleSave() {
    const validationIssues = validateConnection(draft)
    const idCollision = connections.some((c) => c.connection_id === draft.connection_id && c.connection_id !== originalId)
    if (idCollision) validationIssues.push('another connection already uses this connection ID')
    if (validationIssues.length > 0) {
      setIssues(validationIssues)
      return
    }

    const finalized: ConnectionConfig = { ...draft, created_at: draft.created_at || new Date().toISOString() }
    const withoutOriginal = originalId ? connections.filter((c) => c.connection_id !== originalId) : connections
    onChange([...withoutOriginal, finalized])
    setSelectedId(finalized.connection_id)
    setOriginalId(finalized.connection_id)
    setDraft(finalized)
    setIssues([])
  }

  function handleDelete(id: string) {
    onChange(connections.filter((c) => c.connection_id !== id))
    setConfirmDeleteId(null)
    if (selectedId === id) startNew()
  }

  const isDirty = originalId ? JSON.stringify(connections.find((c) => c.connection_id === originalId)) !== JSON.stringify(draft) : true

  return (
    <div className="panel connections-panel">
      <div className="panel-header">
        <h2>Connections</h2>
        <p>Set connection details up once here, then reuse them from any pipeline's Source or Target step instead of re-entering them.</p>
      </div>

      <div className="connections-layout">
        <div className="connections-list">
          <button type="button" className="btn primary small connections-new-btn" onClick={startNew}>
            + New connection
          </button>
          {connections.length === 0 && <p className="hint">No connections saved yet.</p>}
          {connections.map((c) => {
            const typeLabel = CONNECTION_TYPES.find((t) => t.value === c.type)?.label ?? c.type
            return (
              <div
                key={c.connection_id}
                className={`connection-list-item ${selectedId === c.connection_id ? 'active' : ''}`}
                onClick={() => selectForEdit(c)}
              >
                <div>
                  <strong>{c.name || '(unnamed)'}</strong>
                  <div className="connection-list-meta">
                    {typeLabel} · {c.environment}
                  </div>
                </div>
                {confirmDeleteId === c.connection_id ? (
                  <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn small danger" onClick={() => handleDelete(c.connection_id)}>
                      Confirm
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteId(c.connection_id)
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="connections-editor">
          <div className="section-title">{originalId ? 'Edit connection' : 'New connection'}</div>
          <ConnectionForm value={draft} onChange={setDraft} />

          {issues.length > 0 && <div className="warning-banner">Fix the following: {issues.join(' · ')}</div>}

          <div className="row-actions">
            <button type="button" className="btn primary" onClick={handleSave} disabled={!isDirty}>
              {originalId ? 'Save changes' : 'Save connection'}
            </button>
            {originalId && (
              <button type="button" className="btn ghost" onClick={() => selectForEdit(connections.find((c) => c.connection_id === originalId)!)}>
                Revert
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
