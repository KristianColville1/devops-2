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

export interface ChatMessage {
  id: string
  clientId?: string | null
  username: string
  text: string
  timestamp: number
  pending?: boolean
}

export type WsEvent =
  | { event: 'snapshot'; data: { nodes: NodeRecord[]; messages: ChatMessage[] } }
  | { event: 'node:registered'; data: NodeRecord }
  | { event: 'node:heartbeat'; data: Pick<NodeRecord, 'instanceId' | 'memoryPct' | 'cpuPct' | 'wsConnections'> }
  | { event: 'node:deregistered'; data: { instanceId: string } }
  | { event: 'request:routed'; data: { instanceId: string; timestamp: number } }
  | { event: 'chat:message'; data: ChatMessage }
