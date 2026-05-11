// Firebase init for the Co-App. Same project as the desktop CaseLine app
// (hyve-7892f) so cases written from the desktop sync in real-time to the
// Co-App and vice versa.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

export const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyC7w6MdJRYmjgc0qUvAb3jH--YZguq-t4w',
  authDomain:        'hyve-7892f.firebaseapp.com',
  projectId:         'hyve-7892f',
  storageBucket:     'hyve-7892f.firebasestorage.app',
  messagingSenderId: '840449602443',
  appId:             '1:840449602443:web:79f5ba2dfde490239d758e',
} as const

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

export function ensureFirebase() {
  if (!app) {
    const existing = getApps().find((a) => a.options.projectId === FIREBASE_CONFIG.projectId)
    app = existing ?? initializeApp(FIREBASE_CONFIG, 'caseline-co-app')
  }
  if (!auth)    auth    = getAuth(app)
  if (!db)      db      = getFirestore(app)
  if (!storage) storage = getStorage(app)
  return { app, auth, db, storage }
}
