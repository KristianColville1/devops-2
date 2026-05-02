import { ConnectionBanner } from '../molecules/ConnectionBanner'
import { NodeGrid } from '../organisms/NodeGrid'
import { useNodes } from '../hooks/useNodes'

export function Dashboard() {
  const { nodes, wsStatus } = useNodes()

  return (
    <>
      <nav className="navbar" role="navigation">
        <div className="navbar-brand">
          <span className="navbar-item has-text-weight-semibold">Infra Dashboard</span>
          <span className="navbar-item has-text-grey is-size-7">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="navbar-end">
          <div className="navbar-item">
            <ConnectionBanner status={wsStatus} />
          </div>
        </div>
      </nav>

      <NodeGrid nodes={nodes} />
    </>
  )
}
