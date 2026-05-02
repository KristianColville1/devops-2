import { useEffect, useRef, useState } from 'react'
import type { WsEvent } from '../types'

export type WsStatus = 'connecting' | 'connected' | 'reconnecting'

export function useWsEvents(url: string, onEvent: (msg: WsEvent) => void): WsStatus {
  const handlerRef = useRef(onEvent)
  useEffect(() => { handlerRef.current = onEvent })

  const [status, setStatus] = useState<WsStatus>('connecting')

  useEffect(() => {
    let ws: WebSocket
    let delay = 1000
    let cancelled = false

    function connect() {
      ws = new WebSocket(url)

      ws.onopen = () => {
        setStatus('connected')
        delay = 1000
      }

      ws.onmessage = (e) => {
        try { handlerRef.current(JSON.parse(e.data)) } catch {}
      }

      ws.onclose = () => {
        setStatus('reconnecting')
        if (!cancelled) setTimeout(connect, delay)
        delay = Math.min(delay * 2, 30_000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      cancelled = true
      ws?.close()
    }
  }, [url])

  return status
}
