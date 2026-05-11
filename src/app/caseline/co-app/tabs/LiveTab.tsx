// Live courtroom recording — long-form, single recording per hearing.
// Same MediaRecorder pipeline as voice notes but UX assumes a 30-min-to-2-hr
// continuous recording. Auto-uploads in one shot at the end.
//
// IMPORTANT consent note (rendered to the user): recording legal
// proceedings is heavily jurisdiction-dependent. Some federal courts
// permit it for transcription; many state courts require prior leave of
// court. The app surfaces the warning and assumes the user has done due
// diligence — we do NOT enable recording without the user starting it.

'use client'

import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { ensureFirebase } from '../lib/firebase'
import { writeVoiceNote, type CoCase } from '../lib/cases'
import { useRecorder, formatDuration } from '../components/Recorder'

const ACCENT = '#00B4D8'

export default function LiveTab({ user, active }: { user: User; active: CoCase | null }) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const rec = useRecorder()

  // Keep the screen awake while recording — courtroom recordings can run
  // for hours and we don't want the device to sleep mid-capture.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    async function acquire() {
      try {
        if ('wakeLock' in navigator && rec.state === 'recording') {
          lock = await (navigator as { wakeLock: WakeLock }).wakeLock.request('screen')
        }
      } catch { /* ignore — Safari may reject */ }
    }
    if (rec.state === 'recording') acquire()
    return () => {
      cancelled = true
      if (lock) lock.release().catch(() => {})
      void cancelled
    }
  }, [rec.state])

  if (!active) {
    return (
      <div className="co-empty">
        <div className="co-empty-title">Pick a case first.</div>
        <p className="co-empty-help">Recordings get filed under the active case.</p>
        <style jsx>{`
          .co-empty { padding: 32px 8px; text-align: center; color: var(--co-muted); }
          .co-empty-title { font-size: 18px; font-weight: 900; color: var(--co-text); margin-bottom: 8px; }
          .co-empty-help { font-size: 13px; line-height: 1.5; }
        `}</style>
      </div>
    )
  }

  async function stopAndUpload() {
    const result = await rec.stop()
    if (!result || !active) return
    setUploading(true)
    setFeedback('Uploading…')
    const id = `live_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const ext = result.mimeType.includes('mp4') ? 'm4a' : 'webm'
    const path = `co-app-live-recordings/${user.uid}/${active.id}/${id}.${ext}`
    try {
      const { storage } = ensureFirebase()
      const sRef = ref(storage, path)
      await uploadBytes(sRef, result.blob, { contentType: result.mimeType })
      const url = await getDownloadURL(sRef)
      await writeVoiceNote(user.uid, {
        id,
        caseId: active.id,
        storagePath: path,
        url,
        durationSec: result.durationSec,
        createdAt: Date.now(),
        label: `Live recording · ${formatDuration(result.durationSec)} · ${new Date().toLocaleDateString()}`,
      })
      setFeedback(`Saved · ${formatDuration(result.durationSec)} · synced to desktop`)
    } catch (e) {
      setFeedback(`Upload failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
    }
  }

  const isRecording = rec.state === 'recording'
  const isBusy = rec.state === 'requesting' || rec.state === 'finalizing' || uploading

  return (
    <div className="co-live">
      <div className="co-live-warn">
        <strong>⚠ Check your courtroom&rsquo;s recording policy.</strong> Many state and federal courts prohibit
        audio recording without prior leave of court. You — not Hyve — are responsible for confirming this is legal in
        your jurisdiction before pressing record.
        <label className="co-live-ack">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.currentTarget.checked)} />
          <span>I have authorization to record in this proceeding.</span>
        </label>
      </div>

      <button
        type="button"
        className={`co-live-btn ${isRecording ? 'co-live-btn--on' : ''}`}
        onClick={isRecording ? stopAndUpload : () => rec.start()}
        disabled={!acknowledged || (isBusy && !isRecording)}
      >
        {isRecording ? (
          <>
            <span className="co-live-dot" />
            <span>STOP · {formatDuration(rec.durationSec)}</span>
          </>
        ) : rec.state === 'requesting' ? (
          'OPENING MIC…'
        ) : rec.state === 'finalizing' || uploading ? (
          'UPLOADING…'
        ) : (
          'START LIVE RECORDING'
        )}
      </button>

      {feedback && <p className="co-live-feedback">{feedback}</p>}
      {rec.state === 'denied' && (
        <p className="co-live-err">Mic permission denied. Enable in browser settings, then reload.</p>
      )}
      {rec.error && rec.state === 'error' && (
        <p className="co-live-err">Mic error: {rec.error}</p>
      )}

      <p className="co-live-hint">
        While recording: keep the app foregrounded (the screen wake-lock fires automatically). The recording
        uploads when you press STOP — don&rsquo;t quit the app first.
      </p>

      <style jsx>{`
        .co-live { display: grid; gap: 14px; }
        .co-live-warn {
          border: 1px solid #f59e0b;
          background: rgba(245,158,11,0.08);
          color: #fef3c7;
          padding: 14px;
          border-radius: 10px;
          font-size: 13px; line-height: 1.5;
        }
        .co-live-ack {
          display: flex; align-items: center; gap: 8px;
          margin-top: 10px;
          font-size: 13px;
          color: var(--co-text);
        }
        .co-live-ack input { transform: scale(1.2); }
        .co-live-btn {
          padding: 22px;
          background: ${ACCENT}; color: #000;
          border: none; border-radius: 12px;
          font-family: 'Courier New', monospace;
          font-weight: 800; letter-spacing: 0.18em; font-size: 14px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          box-shadow: 0 0 24px rgba(0,180,216,0.4);
        }
        .co-live-btn--on {
          background: #ef4444;
          box-shadow: 0 0 24px rgba(239,68,68,0.55);
        }
        .co-live-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .co-live-dot {
          display: inline-block; width: 10px; height: 10px; border-radius: 50%;
          background: #000;
          animation: co-blink 1s ease-in-out infinite;
        }
        @keyframes co-blink { 50% { opacity: 0.3 } }
        .co-live-feedback {
          color: ${ACCENT};
          font-family: 'Courier New', monospace;
          font-size: 12px; letter-spacing: 0.15em;
          text-align: center;
        }
        .co-live-err { color: #fca5a5; font-size: 13px; }
        .co-live-hint { color: var(--co-muted); font-size: 12px; line-height: 1.5; }
      `}</style>
    </div>
  )
}

// Type stub so the wake-lock cast doesn't make TS yelp.
type WakeLockSentinel = { release: () => Promise<void> }
type WakeLock = { request: (kind: 'screen') => Promise<WakeLockSentinel> }
