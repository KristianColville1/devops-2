import { FiServer } from 'react-icons/fi'
import { NodeCard } from '../molecules/NodeCard'
import styles from './NodeGrid.module.css'
import type { NodeRecord } from '../types'

export function NodeGrid({ nodes }: { nodes: NodeRecord[] }) {
  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <FiServer size={36} className={styles.emptyIcon} />
        <p>Waiting for nodes to register</p>
        <p className={styles.hint}>Cards appear here as the ASG scales up.</p>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {nodes.map((node) => (
        <NodeCard key={node.instanceId} node={node} />
      ))}
    </div>
  )
}
