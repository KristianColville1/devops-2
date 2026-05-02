import { describe, it, expect } from 'vitest'
import { getRawClient, getDocClient } from '@/core/db/client.js'

describe('db client singletons', () => {
  it('getRawClient returns the same instance on repeated calls', () => {
    expect(getRawClient()).toBe(getRawClient())
  })

  it('getDocClient returns the same instance on repeated calls', () => {
    expect(getDocClient()).toBe(getDocClient())
  })

  it('getDocClient is distinct from the raw client', () => {
    expect(getDocClient()).not.toBe(getRawClient())
  })
})
