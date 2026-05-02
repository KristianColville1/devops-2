import { NodeCard } from '../molecules/NodeCard'

export function NodeGrid({ nodes }) {
  if (nodes.length === 0) {
    return (
      <section className="section">
        <div className="has-text-centered has-text-grey">
          <p className="is-size-5 mb-2">Waiting for nodes to register</p>
          <p className="is-size-7">Cards appear here as the ASG scales up.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="is-flex is-flex-wrap-wrap" style={{ gap: 16 }}>
        {nodes.map((node) => (
          <NodeCard key={node.instanceId} node={node} />
        ))}
      </div>
    </section>
  )
}
