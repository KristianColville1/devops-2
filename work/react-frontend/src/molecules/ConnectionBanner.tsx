import { StatusDot } from '../atoms/StatusDot'

const LABELS = {
  connected:    'live',
  connecting:   'connecting',
  reconnecting: 'reconnecting',
}

const TAG_COLOR = {
  connected:    'is-success is-light',
  connecting:   'is-warning is-light',
  reconnecting: 'is-warning is-light',
}

export function ConnectionBanner({ status }) {
  return (
    <span className={`tag is-medium ${TAG_COLOR[status] ?? ''}`} style={{ gap: 6 }}>
      <StatusDot status={status} />
      {LABELS[status] ?? status}
    </span>
  )
}
