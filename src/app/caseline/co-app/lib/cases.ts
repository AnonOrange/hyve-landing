// Real-time case sync against the SAME Firestore schema the desktop uses:
//   caseline/{uid}/cases/{caseId}
//   caseline/{uid}/firm/profile
// Plus the Co-App-specific subcollection for voice notes & captures:
//   caseline/{uid}/cases/{caseId}/voiceNotes/{noteId}

import {
  collection, doc, onSnapshot, query, orderBy, setDoc, updateDoc, type Unsubscribe,
} from 'firebase/firestore'
import { ensureFirebase } from './firebase'

// Mirrors the desktop's CaseFile schema closely enough for the Co-App's needs.
// We use loose typing here because the desktop owns the canonical type — the
// Co-App reads a permissive shape and only writes specific fields.
export interface CoCase {
  id: string
  caseTitle?: string
  caseNumber?: string
  client?: string
  court?: string
  phase?: string
  updatedAt?: number
  attachments?: Array<{ id: string; name: string; url?: string; storagePath?: string; addedAt?: number }>
  timeEntries?: Array<{ id: string; minutes: number; description: string; date: number }>
  voiceNoteCount?: number
}

export interface VoiceNote {
  id: string
  caseId: string
  storagePath: string
  url?: string
  durationSec: number
  createdAt: number
  createdByUid: string
  transcript?: string | null
  label?: string
}

const ACTIVE_CASE_KEY = 'caseline-co-app-active-case-v1'

export function getActiveCaseId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_CASE_KEY)
}

export function setActiveCaseId(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) window.localStorage.setItem(ACTIVE_CASE_KEY, id)
  else    window.localStorage.removeItem(ACTIVE_CASE_KEY)
}

export function subscribeToCases(uid: string, cb: (cases: CoCase[]) => void): Unsubscribe {
  const { db } = ensureFirebase()
  const colRef = collection(db, `caseline/${uid}/cases`)
  return onSnapshot(colRef, (snap) => {
    const cases: CoCase[] = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<CoCase, 'id'>) }))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    cb(cases)
  }, (err) => {
    console.warn('[co-app] case subscription error', err)
    cb([])
  })
}

export function subscribeToVoiceNotes(uid: string, caseId: string, cb: (notes: VoiceNote[]) => void): Unsubscribe {
  const { db } = ensureFirebase()
  const q = query(
    collection(db, `caseline/${uid}/cases/${caseId}/voiceNotes`),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoiceNote, 'id'>) })))
  }, (err) => {
    console.warn('[co-app] voice-note subscription error', err)
    cb([])
  })
}

// Write a voice note metadata doc. The audio bytes themselves live in
// Firebase Storage at /co-app-voice-notes/{uid}/{caseId}/{noteId}.webm
export async function writeVoiceNote(
  uid: string,
  note: Omit<VoiceNote, 'id' | 'createdByUid'> & { id: string },
): Promise<void> {
  const { db } = ensureFirebase()
  await setDoc(
    doc(db, `caseline/${uid}/cases/${note.caseId}/voiceNotes/${note.id}`),
    { ...note, createdByUid: uid },
  )
  // Bump the case's updatedAt so the desktop sees fresh activity.
  await updateDoc(doc(db, `caseline/${uid}/cases/${note.caseId}`), {
    updatedAt: Date.now(),
    voiceNoteCount: (note as VoiceNote & { voiceNoteCount?: number }).voiceNoteCount ?? undefined,
  }).catch(() => { /* case doc may have stricter rules; ignore */ })
}
