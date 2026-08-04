import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="arch-modal-overlay" onClick={onClose}>
      <div className="large-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="large-modal-head">
          <h2 className="large-modal-title">{title}</h2>
          <button type="button" className="arch-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="large-modal-body">{children}</div>
      </div>
    </div>
  )
}
