export function MetricPill({ label, value, max = 100 }) {
  const color = value / max > 0.8 ? 'is-warning' : 'is-success'
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <progress className={`progress is-small ${color}`} value={value} max={max} style={{ flex: 1, marginBottom: 0 }} />
      <span className="is-size-7 has-text-grey" style={{ width: 32, textAlign: 'right', flexShrink: 0 }}>
        {value}%
      </span>
    </div>
  )
}
