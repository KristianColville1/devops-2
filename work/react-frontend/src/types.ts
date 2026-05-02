export interface NodeRecord {
  instanceId: string
  hostname: string
  az: string
  privateIp: string
  registeredAt: number
  lastSeen: number
  memoryPct: number
  wsConnections: number
  cpuPct: number
  status: 'active' | 'inactive'
  expiresAt: number
}

export type WsEvent =
  | { event: 'snapshot'; data: { nodes: NodeRecord[] } }
  | { event: 'node:registered'; data: NodeRecord }
  | { event: 'node:heartbeat'; data: Pick<NodeRecord, 'instanceId' | 'memoryPct' | 'cpuPct' | 'wsConnections'> }
  | { event: 'node:deregistered'; data: { instanceId: string } }
  | { event: 'request:routed'; data: { instanceId: string; timestamp: number } }
