import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { FiMessageSquare, FiSend, FiUser } from 'react-icons/fi'
import type { ChatMessage } from '../types'
import styles from './ChatPanel.module.css'

function initUsername() {
  return localStorage.getItem('chat:username') || 'anon'
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Bubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  return (
    <div className={`${styles.msg} ${isOwn ? styles.own : styles.other} ${msg.pending ? styles.pending : ''}`}>
      {!isOwn && <span className={styles.sender}>{msg.username}</span>}
      <div className={styles.bubble}>{msg.text}</div>
      <span className={styles.time}>{formatTime(msg.timestamp)}</span>
    </div>
  )
}

interface Props {
  messages: ChatMessage[]
  onSend: (username: string, text: string) => Promise<void>
}

export function ChatPanel({ messages, onSend }: Props) {
  const [username, setUsername] = useState(initUsername)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem('chat:username', username)
  }, [username])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function submit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(username || 'anon', trimmed)
    setText('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <FiMessageSquare size={13} color="var(--accent-blue)" />
          <span>Operations</span>
        </div>
        <span className={styles.count}>{messages.length} msg{messages.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>No messages yet</div>
        )}
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} isOwn={msg.username === username} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.footer}>
        <div className={styles.userRow}>
          <FiUser size={10} />
          <input
            className={styles.usernameInput}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your name"
            maxLength={32}
          />
        </div>
        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder="Message…"
            maxLength={500}
          />
          <button className={styles.sendBtn} onClick={submit} disabled={!text.trim()}>
            <FiSend size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
