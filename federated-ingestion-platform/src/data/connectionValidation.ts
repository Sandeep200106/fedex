import type { ConnectionConfig } from '../types'
import { CONNECTION_FIELD_CONFIG } from './templates'

export function validateConnection(conn: ConnectionConfig): string[] {
  const issues: string[] = []
  if (!conn.name) issues.push('connection name is required')
  if (!conn.connection_id) issues.push('connection ID is required')
  if (!conn.owner) issues.push('owner is required')
  if (!conn.auth.secret_ref) issues.push('secret reference is required')

  const fields = CONNECTION_FIELD_CONFIG[conn.type]
  if (fields.host.required && !conn.host) issues.push(`${fields.host.label.toLowerCase()} is required`)
  if (fields.database.required && !conn.database) issues.push(`${fields.database.label.toLowerCase()} is required`)
  return issues
}
