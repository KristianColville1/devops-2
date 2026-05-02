import { StatusDot } from '../atoms/StatusDot'
import { AzBadge } from '../atoms/AzBadge'
import { MetricPill } from '../atoms/MetricPill'

export function NodeCard({ node }) {
  return (
    <div className="card node-card">
      <div className="card-header" style={{ alignItems: 'center', gap: 8, padding: '10px 14px' }}>
        <StatusDot status={node.status} />
        <span className="card-header-title is-size-7 p-0" style={{ fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.instanceId}
        </span>
        <AzBadge az={node.az} />
      </div>

      <div className="card-content p-3">
        <table className="table is-narrow is-fullwidth is-size-7 mb-3" style={{ background: 'transparent' }}>
          <tbody>
            <tr>
              <td className="has-text-grey">hostname</td>
              <td className="has-text-weight-medium" style={{ fontFamily: 'monospace' }}>{node.hostname}</td>
            </tr>
            <tr>
              <td className="has-text-grey">private ip</td>
              <td style={{ fontFamily: 'monospace' }}>{node.privateIp}</td>
            </tr>
          </tbody>
        </table>

        <MetricPill label="CPU" value={node.cpuPct} />
        <MetricPill label="MEM" value={node.memoryPct} />

        <div className="metric-row mt-1">
          <span className="metric-label">WS</span>
          <span className="is-size-7 has-text-grey">{node.wsConnections} conn</span>
        </div>
      </div>

      <div className="card-footer">
        <span className="card-footer-item is-size-7 has-text-grey">
          registered {new Date(node.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
