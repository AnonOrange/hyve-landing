// Register the service worker on the Co-App's first paint so installs
// work and offline cache populates.

'use client'

import { useEffect } from 'react'

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/caseline-co-app/sw.js', { scope: '/caseline/co-app/' })
      .catch((err) => console.warn('[co-app] sw register failed', err))
  }, [])
  return null
}
