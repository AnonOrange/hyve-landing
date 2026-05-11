// Cases tab — real-time list of the user's cases from Firestore.
// Tap to set as active. Active case drives the rest of the Co-App.

'use client'

import type { CoCase } from '../lib/cases'

export default function CasesTab({
  cases, activeCaseId, onChoose,
}: {
  cases: CoCase[]
  activeCaseId: string | null
  onChoose: (id: string) => void
}) {
  if (cases.length === 0) {
    return (
      <div className="co-empty">
        <div className="co-empty-title">No cases yet.</div>
        <p className="co-empty-help">
          Open Hyve CaseLine on your desktop, sign in with the same account, and create
          (or sync) a case. It&rsquo;ll appear here within a second.
        </p>
        <style jsx>{`
          .co-empty { padding: 32px 8px; text-align: center; color: var(--co-muted); }
          .co-empty-title { font-size: 18px; font-weight: 900; color: var(--co-text); margin-bottom: 8px; }
          .co-empty-help { font-size: 13px; line-height: 1.5; }
        `}</style>
      </div>
    )
  }

  return (
    <ul className="co-cases">
      {cases.map((c) => {
        const isActive = c.id === activeCaseId
        return (
          <li key={c.id}>
            <button
              type="button"
              className={`co-case-row ${isActive ? 'co-case-row--active' : ''}`}
              onClick={() => onChoose(c.id)}
            >
              <div className="co-case-main">
                <div className="co-case-title">{c.caseTitle ?? '(untitled case)'}</div>
                <div className="co-case-sub">
                  {c.caseNumber ? <span>{c.caseNumber}</span> : null}
                  {c.client ? <span>· {c.client}</span> : null}
                  {c.court ? <span>· {c.court}</span> : null}
                </div>
              </div>
              {isActive && <span className="co-case-pin">ACTIVE</span>}
            </button>
          </li>
        )
      })}
      <style jsx>{`
        .co-cases { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .co-case-row {
          width: 100%; text-align: left;
          background: var(--co-panel); border: 1px solid var(--co-border);
          border-radius: 10px; padding: 14px 16px;
          color: inherit; cursor: pointer;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .co-case-row--active {
          border-color: var(--co-accent);
          background: linear-gradient(180deg, var(--co-accent-faint), transparent);
        }
        .co-case-main { min-width: 0; flex: 1; }
        .co-case-title { font-size: 15px; font-weight: 700; color: var(--co-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .co-case-sub {
          margin-top: 4px;
          font-family: 'Courier New', monospace;
          font-size: 11px; letter-spacing: 0.04em;
          color: var(--co-muted);
        }
        .co-case-sub span { margin-right: 6px; }
        .co-case-pin {
          font-family: 'Courier New', monospace;
          font-size: 9px; letter-spacing: 0.2em;
          color: var(--co-accent);
          background: rgba(0,180,216,0.12);
          padding: 4px 8px; border-radius: 4px;
        }
      `}</style>
    </ul>
  )
}
