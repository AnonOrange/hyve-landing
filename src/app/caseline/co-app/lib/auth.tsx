// Auth state hook — anonymous-on-first-load, optional Google upgrade.
// Anonymous accounts upgrade to permanent ones via linkWithPopup so the
// user's case data stays attached to the same uid across sign-in methods.

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  type User,
} from 'firebase/auth'
import { ensureFirebase } from './firebase'

interface AuthState {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { auth } = ensureFirebase()
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        setLoading(false)
        return
      }
      // No user yet — start as anonymous so the app is usable immediately.
      try {
        const cred = await signInAnonymously(auth)
        setUser(cred.user)
      } catch (err) {
        console.error('[co-app] anonymous sign-in failed', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  async function signInWithGoogle() {
    const { auth } = ensureFirebase()
    const provider = new GoogleAuthProvider()
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      // Upgrade the anonymous account so existing case data stays under same uid.
      try {
        await linkWithPopup(auth.currentUser, provider)
      } catch (err: unknown) {
        // If the Google account is already linked to another uid, fall back to fresh sign-in.
        const code = (err as { code?: string }).code
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
          await signInWithPopup(auth, provider)
        } else {
          throw err
        }
      }
    } else {
      await signInWithPopup(auth, provider)
    }
  }

  async function signOut() {
    const { auth } = ensureFirebase()
    await fbSignOut(auth)
  }

  return <Ctx.Provider value={{ user, loading, signInWithGoogle, signOut }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth used outside AuthProvider')
  return v
}
