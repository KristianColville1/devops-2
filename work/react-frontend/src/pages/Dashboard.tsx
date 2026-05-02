import { FiActivity } from 'react-icons/fi'
import { ConnectionBanner } from '../molecules/ConnectionBanner'
import { NodeGrid } from '../organisms/NodeGrid'
import { ChatPanel } from '../molecules/ChatPanel'
import { useNodes } from '../hooks/useNodes'
import styles from './Dashboard.module.css'

export function Dashboard() {
  const { nodes, wsStatus, messages, sendMessage } = useNodes()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <FiActivity size={16} color="var(--accent-blue)" />
          <span className={styles.title}>Infra Dashboard</span>
          <span className={styles.count}>{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
        </div>
        <ConnectionBanner status={wsStatus} />
      </header>

      <div className={styles.body}>
        <NodeGrid nodes={nodes} />
        <ChatPanel messages={messages} onSend={sendMessage} />
      </div>
    </div>
  )
}
