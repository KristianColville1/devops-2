import { FiServer, FiCpu, FiHardDrive, FiWifi, FiMapPin, FiClock, FiTerminal } from 'react-icons/fi'
import { StatusDot } from '../atoms/StatusDot'
import { AzBadge } from '../atoms/AzBadge'
import { MetricPill } from '../atoms/MetricPill'
import styles from './NodeCard.module.css'
import type { NodeRecord } from '../types'

export function NodeCard({ node }: { node: NodeRecord }) {
  const regTime = new Date(node.registeredAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <StatusDot status={node.status} />
        <FiServer size={13} className={styles.serverIcon} />
        <span className={styles.id}>{node.instanceId}</span>
        <AzBadge az={node.az} />
      </div>

      <div className={styles.meta}>
        <div className={styles.row}>
          <span className={styles.rowLabel}><FiTerminal size={11} /> hostname</span>
          <span className={styles.mono}>{node.hostname}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}><FiMapPin size={11} /> private ip</span>
          <span className={styles.mono}>{node.privateIp}</span>
        </div>
      </div>

      <div className={styles.metrics}>
        <MetricPill icon={<FiCpu size={11} />} label="CPU" value={node.cpuPct} />
        <MetricPill icon={<FiHardDrive size={11} />} label="MEM" value={node.memoryPct} />
        <div className={styles.wsRow}>
          <span className={styles.wsIcon}><FiWifi size={11} /></span>
          <span className={styles.wsLabel}>WS</span>
          <span className={styles.wsValue}>{node.wsConnections} conn</span>
        </div>
      </div>

      <div className={styles.footer}>
        <FiClock size={10} style={{ marginRight: 5, flexShrink: 0 }} />
        registered {regTime}
      </div>
    </div>
  )
}
