interface HelpTipProps {
  text: string
}

export default function HelpTip({ text }: HelpTipProps) {
  return (
    <span className="help-tip" tabIndex={0}>
      ?<span className="help-tip-bubble">{text}</span>
    </span>
  )
}
