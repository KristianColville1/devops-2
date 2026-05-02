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
