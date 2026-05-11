// CaSeY tab — quick legal lookup against the curated essentials KB.
// Pure client-side keyword matching, no LLM. For deep questions, the
// answer points users to the desktop's full CaSeY chat (full KB + WebLLM).

'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import type { CoCase } from '../lib/cases'
import { searchCaseyKB, type SearchHit } from '../lib/caseyKB'
import { renderMd } from '../lib/renderMd'
import s from './CaseyTab.module.css'

export default function CaseyTab({ user: _user, active: _active }: { user: User; active: CoCase | null }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searched, setSearched] = useState(false)

  function go(q?: string) {
    const text = (q ?? query).trim()
    if (!text) { setHits([]); setSearched(false); return }
    setHits(searchCaseyKB(text, 3))
    setSearched(true)
  }

  return (
    <div className={s.casey}>
      <div className={s.input}>
        <input
          type="text"
          inputMode="search"
          placeholder="Ask CaSeY… (e.g. hearsay, Brady, Miranda)"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }}
        />
        <button type="button" onClick={() => go()}>ASK</button>
      </div>

      {!searched && (
        <div>
          <div className={s.suggestTitle}>Try one:</div>
          <div className={s.suggestGrid}>
            {['Miranda', 'Brady', 'Hearsay', 'Leading objection', 'Speedy Trial Act', 'Suppress', 'Bail factors', 'USSG range'].map((label) => (
              <button key={label} type="button" className={s.chip} onClick={() => { setQuery(label); go(label) }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && hits.length === 0 && (
        <div className={s.empty}>
          <div className={s.emptyTitle}>No match in the pocket KB.</div>
          <p className={s.emptyHelp}>
            The Co-App carries an essentials slice of CaSeY. Open the desktop app for the
            full ~80-entry knowledge base + WebLLM Heavy Mode.
          </p>
        </div>
      )}

      {hits.map((h) => (
        <article key={h.entry.id} className={s.card}>
          <div className={s.cardCat}>{h.entry.category.toUpperCase()}</div>
          <h3 className={s.cardQ}>{h.entry.question}</h3>
          <div className={s.cardA} dangerouslySetInnerHTML={{ __html: renderMd(h.entry.answer) }} />
          {h.entry.citations && h.entry.citations.length > 0 && (
            <div className={s.cardCites}>
              {h.entry.citations.map((c) => <span key={c} className={s.cite}>{c}</span>)}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
