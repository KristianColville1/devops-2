import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResourceNotFoundException } from '@aws-sdk/client-dynamodb'
import { bootstrapDb } from '@/core/db/bootstrap.js'

const mockSend = vi.fn()

vi.mock('@/core/db/client.js', () => ({
  getRawClient: () => ({ send: mockSend }),
}))

describe('bootstrapDb', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  afterEach(() => {
    delete process.env.DYNAMO_LOCAL
  })

  it('skips all DB calls when DYNAMO_LOCAL is not set', async () => {
    await bootstrapDb()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('checks if the table exists when DYNAMO_LOCAL is true', async () => {
    process.env.DYNAMO_LOCAL = 'true'
    mockSend.mockResolvedValue({})
    await bootstrapDb()
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('creates the table when it does not exist', async () => {
    process.env.DYNAMO_LOCAL = 'true'
    mockSend
      .mockRejectedValueOnce(new ResourceNotFoundException({ message: 'Table not found', $metadata: {} }))
      .mockResolvedValueOnce({})
    await bootstrapDb()
    expect(mockSend).toHaveBeenCalledTimes(2)
  })

  it('re-throws unexpected errors', async () => {
    process.env.DYNAMO_LOCAL = 'true'
    mockSend.mockRejectedValue(new Error('network failure'))
    await expect(bootstrapDb()).rejects.toThrow('network failure')
  })
})
