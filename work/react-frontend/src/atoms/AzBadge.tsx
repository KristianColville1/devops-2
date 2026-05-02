import styles from './AzBadge.module.css'

export function AzBadge({ az }: { az: string }) {
  return <span className={styles.badge}>{az}</span>
}
