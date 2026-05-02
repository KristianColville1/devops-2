import { useState } from 'react'
import { useWsEvents, type WsStatus } from './useWsEvents'
import type { NodeRecord } from '../types'

// VITE_API_URL is set for local dev (http://localhost:3000).
// In Docker the var is empty so we fall back to the current origin — nginx proxies /ws to the backend.
const apiUrl = (import.meta.env.VITE_API_URL as string) || window.location.origin
const token  = (import.meta.env.VITE_DASHBOARD_TOKEN ?? '') as string
const wsUrl  = apiUrl.replace(/^http/, 'ws') + `/ws?token=${token}`

export function useNodes(): { nodes: NodeRecord[]; wsStatus: WsStatus } {
  const [nodeMap, setNodeMap] = useState<Record<string, NodeRecord>>({})

  const wsStatus = useWsEvents(wsUrl, (msg) => {
    switch (msg.event) {
      case 'snapshot':
        setNodeMap(Object.fromEntries(msg.data.nodes.map((n) => [n.instanceId, n])))
        break

      case 'node:registered':
        setNodeMap((prev) => ({ ...prev, [msg.data.instanceId]: msg.data }))
        break

      case 'node:heartbeat':
        setNodeMap((prev) => {
          const existing = prev[msg.data.instanceId]
          if (!existing) return prev
          return { ...prev, [msg.data.instanceId]: { ...existing, ...msg.data } }
        })
        break

      case 'node:deregistered':
        setNodeMap((prev) => {
          const next = { ...prev }
          delete next[msg.data.instanceId]
          return next
        })
        break
    }
  })

  return { nodes: Object.values(nodeMap), wsStatus }
}
