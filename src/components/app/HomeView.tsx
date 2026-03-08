'use client'

import { useState } from 'react'
import { Identity } from '@/lib/hyve/identity'
import { lookupBundle } from '@/lib/hyve/network/hyve_id'

export interface WebConversation {
  peerId: string
  peerIkPub: string
  lastMessage?: string
  lastTs?: number
}

interface Props {
  identity: Identity
  conversations: WebConversation[]
  onOpenChat: (conv: WebConversation) => void
  onAddConversation: (conv: WebConversation) => void
  onLock: () => void
}

export default function HomeView({ identity, conversations, onOpenChat, onAddConversation, onLock }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newId, setNewId] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  async function startConversation() {
    const clean = newId.trim().replace(/^@/, '')
    if (!clean) return
    if (clean === identity.hyveId) { setSearchError("That's your own ID"); return }
    setSearching(true)
    setSearchError('')
    const bundle = await lookupBundle(clean)
    setSearching(false)
    if (!bundle) { setSearchError('HYVE ID not found'); return }
    const conv: WebConversation = { peerId: clean, peerIkPub: bundle.ikPub }
    onAddConversation(conv)
    setShowNew(false)
    setNewId('')
    onOpenChat(conv)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pb-3 pt-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src="/HYVEComIcon.png" alt="HYVE" className="w-8 h-8" />
          <div>
            <p className="text-white font-bold text-sm">HYVE</p>
            <p className="text-white/30 text-xs">@{identity.hyveId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-gold text-lg font-light"
            title="New conversation"
          >
            +
          </button>
          <button
            onClick={onLock}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
            title="Lock"
          >
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
        </div>
      </div>

      {/* New conversation modal */}
      {showNew && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-end" onClick={() => setShowNew(false)}>
          <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg mb-4">New Conversation</h2>
            <input
              type="text"
              value={newId}
              onChange={e => { setNewId(e.target.value); setSearchError('') }}
              onKeyDown={e => e.key === 'Enter' && startConversation()}
              placeholder="Enter HYVE ID (e.g. @username)"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors mb-2"
            />
            {searchError && <p className="text-xs text-red-400 mb-3">{searchError}</p>}
            <button
              onClick={startConversation}
              disabled={searching || !newId.trim()}
              className="btn-primary w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {searching ? 'Looking up…' : 'Start Chat'}
            </button>
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24">
            <div className="text-4xl mb-4 opacity-20">💬</div>
            <p className="text-white/30 text-sm">No conversations yet</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-4 text-gold text-sm hover:underline"
            >
              Start one →
            </button>
          </div>
        ) : (
          conversations.map(conv => (
            <button
              key={conv.peerId}
              onClick={() => onOpenChat(conv)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors border-b border-white/5 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
                {conv.peerId.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">@{conv.peerId}</p>
                {conv.lastMessage && (
                  <p className="text-white/30 text-xs truncate mt-0.5">{conv.lastMessage}</p>
                )}
              </div>
              {conv.lastTs && (
                <p className="text-white/20 text-xs flex-shrink-0">
                  {new Date(conv.lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </button>
          ))
        )}
      </div>

      <div className="text-center text-xs text-white/10 pb-4 pt-2">
        Text messaging only · HYVE Web
      </div>
    </div>
  )
}
