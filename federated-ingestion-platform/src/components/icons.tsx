interface IconProps {
  className?: string
}

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconWizard({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h9M4 12h9M4 18h6" />
      <circle cx="19" cy="16" r="3.4" />
      <path d="M17.6 16l1 1 1.8-2" />
    </svg>
  )
}

export function IconSchema({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 15h16M10 4v16" />
    </svg>
  )
}

export function IconQuality({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7" />
      <path d="M19 6l-3.5 3.5L13 7l-3 3" />
      <path d="M16 6h3v3" />
    </svg>
  )
}

export function IconAssistant({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5h16v10H9l-4 4v-4H4z" />
      <path d="M8.5 10h.01M12 10h.01M15.5 10h.01" strokeWidth={2.2} />
    </svg>
  )
}

export function IconDeploy({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l4 4h-3v7h-2V7H8z" />
      <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
    </svg>
  )
}

export function IconConnections({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
      <path d="M7 10v2a3 3 0 003 3h2" />
    </svg>
  )
}

export function IconAirflow({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 12c0-3.5 2-6 5-6a3 3 0 010 6h-5" />
      <path d="M12 12c-3 2-3.5 5-1.5 7a3 3 0 004-4.5" />
      <path d="M12 12c-3.5 0-6-2-6-5a3 3 0 016 0v5" />
    </svg>
  )
}

export function IconArrow({ className }: IconProps) {
  return (
    <svg {...base} width={16} height={16} viewBox="0 0 24 24" className={className}>
      <path d="M4 12h15M14 6l6 6-6 6" />
    </svg>
  )
}
