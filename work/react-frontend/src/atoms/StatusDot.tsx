import styles from './StatusDot.module.css'

export function StatusDot({ status }: { status: string }) {
  return <span className={styles.dot} data-status={status} />
}
