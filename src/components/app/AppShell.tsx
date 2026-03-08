'use client'

import { useState, useEffect, useCallback } from 'react'
import { isSetup } from '@/lib/hyve/storage/vault'
import { messageService, HyveMessage } from '@/lib/hyve/message_service'
import { Identity } from '@/lib/hyve/identity'
import SetupView from './SetupView'
import LockView from './LockView'
import HomeView, { WebConversation } from './HomeView'
import ChatView from './ChatView'
import { dbGet, dbPut } from '@/lib/hyve/storage/db'

type View = 'loading' | 'setup' | 'locked' | 'home' | 'chat'

const CONVERSATIONS_KEY = 'list'

export default function AppShell() {
  const [view, setView] = useState<View>('loading')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [currentPin, setCurrentPin] = useState('')
  const [conversations, setConversations] = useState<WebConversation[]>([])
  const [activeConv, setActiveConv] = useState<WebConversation | null>(null)
  const [messages, setMessages] = useState<Record<string, HyveMessage[]>>({})

  // Check if vault is set up on mount
  useEffect(() => {
    isSetup().then(setup => setView(setup ? 'locked' : 'setup'))
  }, [])

  // Wire message service callback
  useEffect(() => {
    messageService.onMessage = (msg) => {
      setMessages(prev => {
        const existing = prev[msg.convId] || []
        return { ...prev, [msg.convId]: [...existing, msg] }
      })
      setConversations(prev =>
        prev.map(c =>
          c.peerId === msg.convId
            ? { ...c, lastMessage: msg.body, lastTs: msg.ts }
            : c
        )
      )
    }
    return () => { messageService.onMessage = null }
  }, [])

  // Load persisted conversations
  async function loadConversations() {
    const saved = await dbGet<WebConversation[]>('conversations', CONVERSATIONS_KEY)
    if (saved) setConversations(saved)
  }

  async function saveConversations(convs: WebConversation[]) {
    await dbPut('conversations', CONVERSATIONS_KEY, convs)
  }

  // After setup completes
  async function handleSetupComplete(newIdentity: Identity, pin: string) {
    setIdentity(newIdentity)
    setCurrentPin(pin)
    await loadConversations()
    await messageService.start(newIdentity)
    setView('home')
  }

  // After PIN unlock
  async function handleUnlock(unlockedIdentity: Identity, pin: string) {
    setIdentity(unlockedIdentity)
    setCurrentPin(pin)
    await loadConversations()
    await messageService.start(unlockedIdentity)
    setView('home')
  }

  function handleLock() {
    messageService.stop()
    setIdentity(null)
    setCurrentPin('')
    setConversations([])
    setView('locked')
  }

  function handleOpenChat(conv: WebConversation) {
    setActiveConv(conv)
    setView('chat')
  }

  async function handleAddConversation(conv: WebConversation) {
    setConversations(prev => {
      const already = prev.find(c => c.peerId === conv.peerId)
      if (already) return prev
      const next = [conv, ...prev]
      saveConversations(next)
      return next
    })
  }

  async function handleSend(body: string) {
    if (!activeConv) return
    const ok = await messageService.sendText(activeConv.peerId, body)
    if (ok && identity) {
      const msg: HyveMessage = {
        id: `${Date.now()}-out-${Math.random()}`,
        convId: activeConv.peerId,
        from: identity.hyveId,
        body,
        ts: Date.now(),
        sent: true,
      }
      setMessages(prev => {
        const existing = prev[activeConv.peerId] || []
        return { ...prev, [activeConv.peerId]: [...existing, msg] }
      })
      setConversations(prev =>
        prev.map(c =>
          c.peerId === activeConv.peerId
            ? { ...c, lastMessage: body, lastTs: Date.now() }
            : c
        )
      )
    }
  }

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (view === 'setup') return <SetupView onComplete={handleSetupComplete} />
  if (view === 'locked') return <LockView onUnlock={handleUnlock} />

  if (view === 'chat' && activeConv && identity) {
    return (
      <ChatView
        identity={identity}
        conversation={activeConv}
        messages={messages[activeConv.peerId] || []}
        onSend={handleSend}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'home' && identity) {
    return (
      <HomeView
        identity={identity}
        conversations={conversations}
        onOpenChat={handleOpenChat}
        onAddConversation={handleAddConversation}
        onLock={handleLock}
      />
    )
  }

  return null
}
