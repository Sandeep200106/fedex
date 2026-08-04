import type { DqCheckStatus, DqFileSample } from '../types'
import { formatBytes, formatDate } from '../utils/format'

interface FileSizeChartProps {
  history: DqFileSample[]
  avg: number | null
  todayStatus: DqCheckStatus
}

const CHART_HEIGHT = 120

const STATUS_LABEL: Record<DqCheckStatus, string> = {
  pass: 'Pass',
  warning: 'Warning',
  fail: 'Fail',
  pending: 'Pending',
}

export default function FileSizeChart({ history, avg, todayStatus }: FileSizeChartProps) {
  const values = history.map((h) => h.size_bytes ?? 0)
  const maxVal = Math.max(...values, avg ?? 0, 1)
  const avgHeightPct = avg !== null ? Math.min((avg / maxVal) * 100, 100) : null
  const lastIndex = history.length - 1

  return (
    <div className="filesize-chart">
      <div className="filesize-chart-plot" style={{ height: CHART_HEIGHT }}>
        {avgHeightPct !== null && (
          <div className="filesize-avg-line" style={{ bottom: `${avgHeightPct}%` }}>
            <span className="filesize-avg-label">avg 7d: {formatBytes(avg)}</span>
          </div>
        )}
        {history.map((sample, i) => {
          const isToday = i === lastIndex
          const missing = !sample.file_exists || sample.size_bytes === null
          const heightPct = missing ? 3 : Math.max((sample.size_bytes! / maxVal) * 100, 2)
          const barClass = missing ? 'bar-fail bar-missing' : isToday ? `bar-${todayStatus}` : 'bar-muted'
          return (
            <div className="filesize-bar-col" key={sample.date}>
              {isToday && !missing && <span className="filesize-bar-value">{formatBytes(sample.size_bytes)}</span>}
              <div className={`filesize-bar ${barClass}`} style={{ height: `${heightPct}%` }} tabIndex={0}>
                <span className="filesize-bar-tooltip">
                  {formatDate(sample.date)} — {missing ? 'file missing' : formatBytes(sample.size_bytes)}
                </span>
                {missing && <span className="filesize-bar-missing-mark">✕</span>}
              </div>
              <span className={`filesize-bar-date ${isToday ? 'is-today' : ''}`}>{isToday ? 'Today' : formatDate(sample.date)}</span>
            </div>
          )
        })}
      </div>
      <div className="filesize-legend">
        <span className="legend-item">
          <span className="legend-swatch bar-muted" /> Prior days
        </span>
        <span className="legend-item">
          <span className={`legend-swatch bar-${todayStatus}`} /> Today — {STATUS_LABEL[todayStatus]}
        </span>
      </div>
    </div>
  )
}
