// Notes tab — quick voice notes that auto-attach to the active case.
// Records short captures (target <2 min each), uploads to Firebase
// Storage, writes a Firestore metadata doc in the case's voiceNotes
// subcollection. Real-time list of prior notes for the active case.

'use client'

import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { ensureFirebase } from '../lib/firebase'
import { subscribeToVoiceNotes, writeVoiceNote, type CoCase, type VoiceNote } from '../lib/cases'
import { useRecorder, formatDuration } from '../components/Recorder'

const ACCENT = '#00B4D8'

export default function NotesTab({ user, active }: { user: User; active: CoCase | null }) {
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const rec = useRecorder()

  useEffect(() => {
    if (!active) { setNotes([]); return }
    const unsub = subscribeToVoiceNotes(user.uid, active.id, setNotes)
    return () => unsub()
  }, [user.uid, active])

  if (!active) {
    return <NoCaseEmpty title="Pick a case first." help="Switch to the Cases tab to choose which case voice notes should attach to." />
  }

  async function stopAndUpload() {
    const result = await rec.stop()
    if (!result || !active) return
    setUploading(true)
    setFeedback(null)
    const noteId = `vn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const ext = result.mimeType.includes('mp4') ? 'm4a' : result.mimeType.includes('ogg') ? 'ogg' : 'webm'
    const storagePath = `co-app-voice-notes/${user.uid}/${active.id}/${noteId}.${ext}`

    try {
      const { storage } = ensureFirebase()
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, result.blob, { contentType: result.mimeType })
      const url = await getDownloadURL(storageRef)

      await writeVoiceNote(user.uid, {
        id: noteId,
        caseId: active.id,
        storagePath,
        url,
        durationSec: result.durationSec,
        createdAt: Date.now(),
        label: defaultLabel(),
      })
      setFeedback(`Saved · ${formatDuration(result.durationSec)}`)
      setTimeout(() => setFeedback(null), 2400)
    } catch (e) {
      setFeedback(`Upload failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
    }
  }

  const isBusy = rec.state === 'requesting' || rec.state === 'finalizing' || uploading
  const isRecording = rec.state === 'recording'

  return (
    <div className="co-notes">
      <section className="co-rec">
        <button
          type="button"
          className={`co-rec-btn ${isRecording ? 'co-rec-btn--on' : ''}`}
          onClick={isRecording ? stopAndUpload : () => rec.start()}
          disabled={isBusy && !isRecording}
        >
          {isRecording ? `■  STOP · ${formatDuration(rec.durationSec)}` :
           rec.state === 'requesting' ? 'OPENING MIC…' :
           rec.state === 'finalizing' ? 'SAVING…' :
           uploading ? 'UPLOADING…' :
           '●  RECORD NOTE'}
        </button>
        {rec.state === 'denied' && (
          <p className="co-rec-err">
            Mic permission denied. Enable it in your browser settings, then reload.
          </p>
        )}
        {rec.error && rec.state === 'error' && (
          <p className="co-rec-err">Mic error: {rec.error}</p>
        )}
        {feedback && <p className="co-rec-feedback">{feedback}</p>}
        <p className="co-rec-hint">
          Notes are private to your account, stored in Firebase, and visible on the desktop in real time.
        </p>
      </section>

      <section className="co-notes-list">
        <div className="co-section-title">
          {notes.length === 0 ? 'NO NOTES YET' : `${notes.length} NOTE${notes.length === 1 ? '' : 'S'}`}
        </div>
        {notes.map((n) => (
          <article key={n.id} className="co-note">
            <div className="co-note-meta">
              <span className="co-note-time">{formatTimestamp(n.createdAt)}</span>
              <span className="co-note-dur">{formatDuration(n.durationSec)}</span>
            </div>
            {n.label && <div className="co-note-label">{n.label}</div>}
            {n.url && (
              <audio controls preload="none" src={n.url} className="co-note-audio" />
            )}
            {n.transcript && (
              <p className="co-note-transcript">{n.transcript}</p>
            )}
          </article>
        ))}
      </section>

      <style jsx>{`
        .co-notes { display: grid; gap: 16px; }
        .co-rec {
          background: var(--co-panel);
          border: 1px solid var(--co-border);
          border-radius: 12px;
          padding: 18px 16px;
          text-align: center;
        }
        .co-rec-btn {
          width: 100%; max-width: 320px; margin: 0 auto;
          display: block;
          padding: 16px;
          background: ${ACCENT}; color: #000;
          border: none; border-radius: 60px;
          font-family: 'Courier New', monospace;
          font-weight: 800; letter-spacing: 0.2em; font-size: 13px;
          cursor: pointer;
          box-shadow: 0 0 24px rgba(0,180,216,0.4);
        }
        .co-rec-btn--on {
          background: #ef4444;
          box-shadow: 0 0 24px rgba(239,68,68,0.55);
          animation: co-rec-pulse 1.2s ease-in-out infinite;
        }
        @keyframes co-rec-pulse { 50% { transform: scale(1.02) } }
        .co-rec-btn:disabled { opacity: 0.5; cursor: wait; }
        .co-rec-err {
          color: #fca5a5;
          font-size: 12px; margin-top: 12px;
        }
        .co-rec-feedback {
          color: ${ACCENT};
          font-family: 'Courier New', monospace;
          font-size: 11px;
          letter-spacing: 0.2em;
          margin-top: 12px;
        }
        .co-rec-hint {
          color: var(--co-muted);
          font-size: 11px; margin-top: 14px;
        }

        .co-section-title {
          font-family: 'Courier New', monospace;
          letter-spacing: 0.3em;
          font-size: 10px;
          color: var(--co-muted);
          margin: 10px 4px;
        }
        .co-note {
          background: var(--co-panel);
          border: 1px solid var(--co-border);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 8px;
        }
        .co-note-meta {
          display: flex; justify-content: space-between;
          font-family: 'Courier New', monospace;
          font-size: 10px; letter-spacing: 0.18em;
          color: var(--co-muted);
        }
        .co-note-dur { color: ${ACCENT}; }
        .co-note-label { margin-top: 6px; font-size: 13px; color: var(--co-text); }
        .co-note-audio { display: block; width: 100%; margin-top: 10px; }
        .co-note-transcript { margin: 8px 0 0; font-size: 13px; color: var(--co-text); line-height: 1.5; }
      `}</style>
    </div>
  )
}

function NoCaseEmpty({ title, help }: { title: string; help: string }) {
  return (
    <div className="co-empty">
      <div className="co-empty-title">{title}</div>
      <p className="co-empty-help">{help}</p>
      <style jsx>{`
        .co-empty { padding: 32px 8px; text-align: center; color: var(--co-muted); }
        .co-empty-title { font-size: 18px; font-weight: 900; color: var(--co-text); margin-bottom: 8px; }
        .co-empty-help { font-size: 13px; line-height: 1.5; }
      `}</style>
    </div>
  )
}

function defaultLabel(): string {
  const d = new Date()
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}
