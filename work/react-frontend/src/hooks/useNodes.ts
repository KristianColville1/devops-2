import { useState } from 'react'
import { useWsEvents, type WsStatus } from './useWsEvents'
import type { NodeRecord, ChatMessage } from '../types'

const apiUrl = (import.meta.env.VITE_API_URL as string) || window.location.origin
const token  = (import.meta.env.VITE_DASHBOARD_TOKEN ?? '') as string
const wsUrl  = apiUrl.replace(/^http/, 'ws') + `/ws?token=${token}`

export function useNodes(): {
  nodes: NodeRecord[]
  wsStatus: WsStatus
  messages: ChatMessage[]
  sendMessage: (username: string, text: string) => Promise<void>
} {
  const [nodeMap, setNodeMap] = useState<Record<string, NodeRecord>>({})
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const wsStatus = useWsEvents(wsUrl, (msg) => {
    switch (msg.event) {
      case 'snapshot':
        setNodeMap(Object.fromEntries(msg.data.nodes.map((n) => [n.instanceId, n])))
        setMessages(msg.data.messages ?? [])
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

      case 'chat:message':
        setMessages((prev) => {
          const filtered = prev.filter((m) => !(m.pending && m.clientId === msg.data.clientId))
          return [...filtered, msg.data]
        })
        break
    }
  })

  async function sendMessage(username: string, text: string) {
    const clientId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: clientId, clientId, username, text, timestamp: Date.now(), pending: true },
    ])
    await fetch(`${apiUrl}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username, text, clientId }),
    }).catch(() => {})
  }

  return { nodes: Object.values(nodeMap), wsStatus, messages, sendMessage }
}
