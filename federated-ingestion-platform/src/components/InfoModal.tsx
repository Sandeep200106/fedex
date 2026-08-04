import { useEffect } from 'react'
import type { ArchNode } from '../data/archNodes'

interface InfoModalProps {
  node: ArchNode | null
  onClose: () => void
}

export default function InfoModal({ node, onClose }: InfoModalProps) {
  useEffect(() => {
    if (!node) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [node, onClose])

  if (!node) return null

  return (
    <div className="arch-modal-overlay" onClick={onClose}>
      <div className="arch-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="arch-modal-head">
          <span className="arch-node-badge" style={{ background: node.color }}>
            {node.code}
          </span>
          <div>
            <strong>{node.label}</strong>
            {node.sublabel && <span className="arch-modal-sublabel">{node.sublabel}</span>}
          </div>
          <button type="button" className="arch-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="arch-modal-body">{node.detail}</p>
      </div>
    </div>
  )
}
