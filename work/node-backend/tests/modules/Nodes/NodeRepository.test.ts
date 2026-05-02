import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NodeRepository } from '@/modules/Nodes/NodeRepository.js'

const mockSend = vi.fn()

vi.mock('@/core/db/client.js', () => ({
  getDocClient: () => ({ send: mockSend }),
}))

const node = {
  instanceId: 'i-0abc1234567890def',
  hostname: 'ip-10-0-1-5',
  az: 'us-east-1a',
  privateIp: '10.0.1.5',
  registeredAt: 1000000,
  lastSeen: 1000000,
  memoryPct: 40,
  wsConnections: 2,
  cpuPct: 10,
  status: 'active',
  expiresAt: 1000300,
}

describe('NodeRepository', () => {
  let repo

  beforeEach(() => {
    mockSend.mockReset()
    repo = new NodeRepository()
  })

  it('register stores the node record', async () => {
    mockSend.mockResolvedValue({})
    await repo.register(node)
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('findById returns the node when it exists', async () => {
    mockSend.mockResolvedValue({ Item: node })
    expect(await repo.findById(node.instanceId)).toEqual(node)
  })

  it('findById returns null when node is not found', async () => {
    mockSend.mockResolvedValue({ Item: undefined })
    expect(await repo.findById('i-missing')).toBeNull()
  })

  it('heartbeat sends an update to dynamo', async () => {
    mockSend.mockResolvedValue({})
    await repo.heartbeat(node.instanceId, { memoryPct: 55, cpuPct: 12, wsConnections: 3 })
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('deregister removes the node by instanceId', async () => {
    mockSend.mockResolvedValue({})
    await repo.deregister(node.instanceId)
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('listActive returns all scanned nodes', async () => {
    mockSend.mockResolvedValue({ Items: [node] })
    const result = await repo.listActive()
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(node)
  })

  it('listActive returns empty array when table is empty', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    expect(await repo.listActive()).toEqual([])
  })
})
