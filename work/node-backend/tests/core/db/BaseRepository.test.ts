import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseRepository } from '@/core/db/BaseRepository.js'

const mockSend = vi.fn()

vi.mock('@/core/db/client.js', () => ({
  getDocClient: () => ({ send: mockSend }),
}))

class TestRepo extends BaseRepository {
  tableName = 'test-table'

  get(key) { return this.getItem(key) }
  put(item) { return this.putItem(item) }
  del(key) { return this.deleteItem(key) }
  scan() { return this.scanItems() }
}

describe('BaseRepository', () => {
  let repo

  beforeEach(() => {
    mockSend.mockReset()
    repo = new TestRepo()
  })

  it('getItem returns the item from the response', async () => {
    const item = { id: '1', name: 'test' }
    mockSend.mockResolvedValue({ Item: item })
    expect(await repo.get({ id: '1' })).toEqual(item)
  })

  it('getItem returns null when item is not found', async () => {
    mockSend.mockResolvedValue({ Item: undefined })
    expect(await repo.get({ id: 'missing' })).toBeNull()
  })

  it('putItem sends to dynamo', async () => {
    mockSend.mockResolvedValue({})
    await repo.put({ id: '1', value: 'x' })
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('deleteItem sends to dynamo', async () => {
    mockSend.mockResolvedValue({})
    await repo.del({ id: '1' })
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('scanItems returns all items', async () => {
    const items = [{ id: '1' }, { id: '2' }]
    mockSend.mockResolvedValue({ Items: items })
    expect(await repo.scan()).toEqual(items)
  })

  it('scanItems returns empty array when Items is missing', async () => {
    mockSend.mockResolvedValue({})
    expect(await repo.scan()).toEqual([])
  })
})
