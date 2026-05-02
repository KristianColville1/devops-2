import type { ReactNode } from 'react'
import styles from './MetricPill.module.css'

interface Props {
  icon: ReactNode
  label: string
  value: number
  max?: number
}

export function MetricPill({ icon, label, value, max = 100 }: Props) {
  const pct = Math.min((value / max) * 100, 100)
  const high = pct > 80

  return (
    <div className={styles.pill}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      <div className={styles.track}>
        <div className={styles.fill} data-high={String(high)} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.value}>{value}%</span>
    </div>
  )
}
