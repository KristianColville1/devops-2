import { FiWifi, FiWifiOff, FiLoader } from 'react-icons/fi'
import { StatusDot } from '../atoms/StatusDot'
import styles from './ConnectionBanner.module.css'

const LABELS: Record<string, string> = {
  connected:    'live',
  connecting:   'connecting',
  reconnecting: 'reconnecting',
}

const ICONS: Record<string, React.ReactNode> = {
  connected:    <FiWifi size={12} />,
  connecting:   <FiLoader size={12} />,
  reconnecting: <FiLoader size={12} />,
}

export function ConnectionBanner({ status }: { status: string }) {
  return (
    <span className={styles.banner} data-status={status}>
      <StatusDot status={status} />
      {ICONS[status]}
      {LABELS[status] ?? status}
    </span>
  )
}
