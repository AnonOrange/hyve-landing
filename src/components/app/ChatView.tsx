'use client'

import { useState, useRef, useEffect } from 'react'
import { HyveMessage } from '@/lib/hyve/message_service'
import { Identity } from '@/lib/hyve/identity'
import { WebConversation } from './HomeView'

interface Props {
  identity: Identity
  conversation: WebConversation
  messages: HyveMessage[]
  onSend: (body: string) => Promise<void>
  onBack: () => void
}

export default function ChatView({ identity, conversation, messages, onSend, onBack }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    await onSend(text)
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center flex-shrink-0"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
          {conversation.peerId.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-white font-bold text-sm">@{conversation.peerId}</p>
          <p className="text-white/30 text-xs">End-to-end encrypted</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-white/20 text-xs py-8">
            Say hello with full HYVE encryption ↓
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.sent
                  ? 'bg-gold text-black font-medium rounded-br-sm'
                  : 'bg-white/8 text-white rounded-bl-sm'
              }`}
            >
              {msg.body}
              <div className={`text-xs mt-1 ${msg.sent ? 'text-black/40' : 'text-white/20'}`}>
                {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 border-t border-white/5 flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message…"
          rows={1}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors resize-none max-h-32"
          style={{ minHeight: '42px' }}
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:brightness-110 transition-all"
        >
          <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-4-4l4 4-4 4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
