'use client'

import { useEffect, useState } from 'react'

const VAPID_PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

export default function AlertsCard() {
  const [perm, setPerm] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState(false)
  const [radius, setRadius] = useState(10)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission)
    try {
      const saved = JSON.parse(localStorage.getItem('hyve_alert_prefs') || '{}')
      if (saved.enabled) setEnabled(true)
      if (typeof saved.radius === 'number') setRadius(saved.radius)
      if (typeof saved.lat === 'number') setLat(saved.lat)
      if (typeof saved.lng === 'number') setLng(saved.lng)
    } catch {}
  }, [])

  const captureLocation = () =>
    new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000 },
      )
    })

  const enable = async () => {
    setBusy(true)
    setStatus(null)
    try {
      // 1. Permission
      if (typeof Notification === 'undefined') throw new Error('Notifications not supported on this browser')
      const p = await Notification.requestPermission()
      setPerm(p)
      if (p !== 'granted') throw new Error('Notification permission denied')

      // 2. Location (required for radius filter)
      let coords = lat != null && lng != null ? { lat, lng } : null
      if (!coords) {
        coords = await captureLocation()
        if (!coords) throw new Error('Location required for nearby alerts')
        setLat(coords.lat)
        setLng(coords.lng)
      }

      // 3. Service worker push subscription
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        if (!VAPID_PUB) throw new Error('VAPID public key missing in env')
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUB),
        })
      }
      const json: any = sub.toJSON()

      // 4. Save to backend
      const r = await fetch('/api/spy/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          lat: coords.lat,
          lng: coords.lng,
          radiusMi: radius,
          enabled: true,
        }),
      })
      if (!r.ok) throw new Error('Subscription save failed')

      setEnabled(true)
      localStorage.setItem('hyve_alert_prefs', JSON.stringify({ enabled: true, radius, lat: coords.lat, lng: coords.lng }))
      setStatus('Alerts on. We will notify you about incidents within ' + radius + ' miles.')
    } catch (e: any) {
      setStatus(e?.message || 'Failed to enable alerts')
    } finally {
      setBusy(false)
    }
  }

  const updateRadius = async (newRadius: number) => {
    setRadius(newRadius)
    if (!enabled || lat == null || lng == null) return
    try {
      await fetch('/api/spy/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lat, lng, radiusMi: newRadius, enabled: true }),
      })
      localStorage.setItem('hyve_alert_prefs', JSON.stringify({ enabled: true, radius: newRadius, lat, lng }))
    } catch {}
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setEnabled(false)
      localStorage.setItem('hyve_alert_prefs', JSON.stringify({ enabled: false, radius, lat, lng }))
      setStatus('Alerts off')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-[#0D2235] bg-black/30">
      <div className="border-b border-[#0D2235] px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#FF2D2D]">🚨 Alerts near me</div>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-[#94A3B8]">
          Get a push notification when a major incident (police chase, structure fire, mass-casualty event) is detected
          within your chosen radius. Powered by our real-time STT + listener-spike detection across all 6,500+ scanner feeds.
        </p>

        {!enabled ? (
          <button
            onClick={enable}
            disabled={busy}
            className="w-full rounded bg-[#FF2D2D] px-4 py-3 text-xs font-black tracking-widest text-white transition hover:bg-[#FF5555] disabled:opacity-50"
          >
            {busy ? 'ENABLING…' : '🚨 ENABLE ALERTS'}
          </button>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between rounded border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span className="font-mono text-[11px] text-[#22C55E]">ALERTS ON</span>
              </div>
              <button onClick={disable} disabled={busy} className="text-[10px] font-bold text-[#94A3B8] hover:text-[#FF2D2D]">
                Turn off
              </button>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <label className="font-mono text-[11px] text-[#94A3B8]">Radius</label>
              <span className="font-mono text-xs text-[#00D4FF]">{radius} mi</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={radius}
              onChange={(e) => updateRadius(parseInt(e.target.value, 10))}
              className="w-full accent-[#00D4FF]"
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-[#475569]">
              <span>1 mi</span>
              <span>25 mi</span>
              <span>50 mi</span>
            </div>
            {lat != null && lng != null && (
              <div className="mt-3 font-mono text-[10px] text-[#475569]">
                Location: {lat.toFixed(3)}, {lng.toFixed(3)}
              </div>
            )}
          </>
        )}
        {status && <p className="mt-3 font-mono text-[11px] text-[#64748B]">{status}</p>}
        {perm === 'denied' && (
          <p className="mt-3 rounded border border-[#FF2D2D]/40 bg-[#FF2D2D]/10 p-2 font-mono text-[11px] text-[#FF2D2D]">
            Notifications blocked. Enable in your browser site settings.
          </p>
        )}
      </div>
    </div>
  )
}
