// Files tab — read-only view of the active case's attachments.
// Tap to open in the OS default viewer. Future v2: capture + upload from
// camera or photo library on mobile.

'use client'

import type { CoCase } from '../lib/cases'

export default function FilesTab({ active }: { active: CoCase | null }) {
  if (!active) {
    return (
      <div className="co-empty">
        <div className="co-empty-title">Pick a case first.</div>
        <p className="co-empty-help">Switch to the Cases tab to choose one.</p>
        <style jsx>{`
          .co-empty { padding: 32px 8px; text-align: center; color: var(--co-muted); }
          .co-empty-title { font-size: 18px; font-weight: 900; color: var(--co-text); margin-bottom: 8px; }
          .co-empty-help { font-size: 13px; line-height: 1.5; }
        `}</style>
      </div>
    )
  }

  const files = active.attachments ?? []

  return (
    <div className="co-files">
      <div className="co-section-title">{files.length} ATTACHMENT{files.length === 1 ? '' : 'S'}</div>
      {files.length === 0 && (
        <p className="co-files-empty">
          No files on this case yet. Add them from the desktop CaseLine app
          (<strong>FILES</strong> tab) — they&rsquo;ll sync here automatically.
        </p>
      )}
      {files.map((f) => (
        <a
          key={f.id}
          className="co-file-row"
          href={f.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="co-file-icon">{guessIcon(f.name)}</div>
          <div className="co-file-info">
            <div className="co-file-name">{f.name}</div>
            <div className="co-file-meta">
              {f.addedAt ? new Date(f.addedAt).toLocaleDateString() : ''}
              {f.url ? ' · tap to open' : ' · not synced yet'}
            </div>
          </div>
          <div className="co-file-arrow">↗</div>
        </a>
      ))}

      <style jsx>{`
        .co-files { display: grid; gap: 8px; }
        .co-section-title {
          font-family: 'Courier New', monospace;
          letter-spacing: 0.3em;
          font-size: 10px;
          color: var(--co-muted);
          margin: 6px 4px;
        }
        .co-files-empty {
          color: var(--co-muted);
          font-size: 13px; line-height: 1.5;
          padding: 16px 8px;
        }
        .co-file-row {
          display: flex; align-items: center; gap: 12px;
          background: var(--co-panel);
          border: 1px solid var(--co-border);
          border-radius: 10px;
          padding: 12px 14px;
          color: inherit; text-decoration: none;
        }
        .co-file-icon { font-size: 22px; }
        .co-file-info { flex: 1; min-width: 0; }
        .co-file-name {
          font-size: 14px; font-weight: 700;
          color: var(--co-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .co-file-meta {
          margin-top: 2px;
          font-family: 'Courier New', monospace;
          font-size: 10px; letter-spacing: 0.08em;
          color: var(--co-muted);
        }
        .co-file-arrow { color: var(--co-muted); font-size: 16px; }
      `}</style>
    </div>
  )
}

function guessIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return '📄'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return '🖼'
  if (['mp3', 'm4a', 'wav', 'ogg', 'webm'].includes(ext)) return '🎙'
  if (['mp4', 'mov'].includes(ext)) return '🎞'
  if (['doc', 'docx'].includes(ext)) return '📝'
  return '📎'
}
