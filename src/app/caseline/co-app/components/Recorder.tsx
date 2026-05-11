// Foreground audio recorder using MediaRecorder. Works on iOS Safari and
// Android Chrome. Records as audio/webm (Chrome) or audio/mp4 (Safari) —
// the browser picks based on what it supports. Returns the Blob + duration.

'use client'

import { useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'finalizing' | 'denied' | 'error'

export interface RecordingResult {
  blob: Blob
  durationSec: number
  mimeType: string
}

export interface RecorderHandle {
  state: RecorderState
  error: string | null
  durationSec: number
  start: () => Promise<void>
  stop: () => Promise<RecordingResult | null>
  cancel: () => void
}

// Pick a MIME type the browser can record. iOS Safari only supports mp4.
function pickMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
}

export function useRecorder(): RecorderHandle {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [durationSec, setDurationSec] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const streamRef   = useRef<MediaStream | null>(null)
  const startTsRef  = useRef<number>(0)
  const tickRef     = useRef<number | null>(null)
  const resolveRef  = useRef<((r: RecordingResult | null) => void) | null>(null)
  const mimeRef     = useRef<string>('')

  function cleanup() {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }

  async function start() {
    setError(null)
    setDurationSec(0)
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      mimeRef.current = mime
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' })
        const dur = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000))
        const result: RecordingResult = { blob, durationSec: dur, mimeType: blob.type }
        cleanup()
        setState('idle')
        if (resolveRef.current) { resolveRef.current(result); resolveRef.current = null }
      }
      recorder.start(1000) // request data every second so big recordings don't lose tail on crash
      startTsRef.current = Date.now()
      tickRef.current = window.setInterval(() => {
        setDurationSec(Math.floor((Date.now() - startTsRef.current) / 1000))
      }, 250)
      setState('recording')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setState(msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('not allowed') ? 'denied' : 'error')
      cleanup()
    }
  }

  function stop(): Promise<RecordingResult | null> {
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      setState('finalizing')
      recorderRef.current.stop()
    })
  }

  function cancel() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch { /* ignore */ }
    }
    cleanup()
    setState('idle')
    setDurationSec(0)
  }

  // Defensive cleanup if the component unmounts mid-recording.
  useEffect(() => () => cleanup(), [])

  return { state, error, durationSec, start, stop, cancel }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
