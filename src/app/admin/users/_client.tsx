'use client'

import { useState } from 'react'

interface Admin { id: string; email: string; role: string; accepted_at: string; last_login_at: string | null }
interface Invite { token: string; email: string; role: string; invited_at: string; expires_at: string }
interface AuditEntry { id: number; ts: string; actor_email: string; action: string; target_email?: string; detail?: string; ip?: string }

interface Props {
  admins: Admin[]
  invites: Invite[]
  auditLog: AuditEntry[]
  currentAdminId: string
  currentRole: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{ background: role === 'owner' ? '#FFB800' : '#1e1e1e', color: role === 'owner' ? '#000' : '#888', padding: '2px 7px', fontSize: 9, letterSpacing: '0.2em', fontWeight: 900, fontFamily: 'monospace' }}>
      {role.toUpperCase()}
    </span>
  )
}

const ACTION_COLOR: Record<string, string> = {
  sign_in: '#39FF14', sign_out: '#555', invite: '#FFB800', invite_accepted: '#39FF14',
  revoke: '#ff5555', role_change: '#a855f7', login_fail: '#ff5555',
  reset_requested: '#FFB800', password_reset: '#FFB800', scan: '#00cfff',
}

export default function UsersClient({ admins, invites, auditLog, currentAdminId, currentRole }: Props) {
  const isOwner = currentRole === 'owner'

  const [showInvite, setShowInvite]       = useState(false)
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteRole, setInviteRole]       = useState<'admin' | 'owner'>('admin')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError]     = useState('')
  const [inviteOk, setInviteOk]           = useState(false)

  const [confirmRevoke, setConfirmRevoke] = useState<Admin | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  async function sendInvite() {
    setInviteLoading(true)
    setInviteError('')
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    setInviteLoading(false)
    if (res.ok) {
      setInviteOk(true)
      setTimeout(() => { setShowInvite(false); setInviteOk(false); setInviteEmail(''); window.location.reload() }, 1500)
    } else {
      const d = await res.json().catch(() => ({}))
      setInviteError(d.error ?? 'Failed to send invite')
    }
  }

  async function doRevoke(admin: Admin) {
    setRevokeLoading(true)
    const res = await fetch('/api/admin/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: admin.id }),
    })
    setRevokeLoading(false)
    if (res.ok) {
      setConfirmRevoke(null)
      window.location.reload()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Revoke failed')
      setConfirmRevoke(null)
    }
  }

  async function promoteToOwner(admin: Admin) {
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: admin.id, role: 'owner' }),
    })
    if (res.ok) window.location.reload()
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Failed') }
  }

  const MODAL_BG: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
  const MODAL: React.CSSProperties = { background: '#131313', border: '1px solid #2a2a2a', borderRadius: 4, padding: '28px 24px', width: 380 }
  const INPUT: React.CSSProperties = { width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box', outline: 'none', borderRadius: 2 }
  const BTN = (primary?: boolean): React.CSSProperties => ({ background: primary ? '#FFB800' : 'none', color: primary ? '#000' : '#666', border: `1px solid ${primary ? '#FFB800' : '#2a2a2a'}`, padding: '7px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 2 })

  return (
    <div style={{ fontFamily: 'monospace' }}>

      {/* ── Active admins ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444' }}>ACTIVE ADMINS</div>
        {isOwner && (
          <button onClick={() => setShowInvite(true)} style={{ background: '#1a1a08', border: '1px solid #FFB800', color: '#FFB800', padding: '5px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', cursor: 'pointer' }}>
            + INVITE
          </button>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
            {['EMAIL', 'ROLE', 'JOINED', 'LAST LOGIN', isOwner ? 'ACTIONS' : ''].filter(Boolean).map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, letterSpacing: '0.2em', color: '#444', fontWeight: 400 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {admins.map(a => {
            const isMe = a.id === currentAdminId
            return (
              <tr key={a.id} style={{ borderBottom: '1px solid #111' }}>
                <td style={{ padding: '9px 10px', color: isMe ? '#e0e0e0' : '#888' }}>
                  {a.email} {isMe && <span style={{ fontSize: 9, color: '#444' }}>(you)</span>}
                </td>
                <td style={{ padding: '9px 10px' }}><RoleBadge role={a.role} /></td>
                <td style={{ padding: '9px 10px', color: '#555', fontSize: 10 }}>{fmtTime(a.accepted_at)}</td>
                <td style={{ padding: '9px 10px', color: '#444', fontSize: 10 }}>{a.last_login_at ? fmtTime(a.last_login_at) : 'never'}</td>
                {isOwner && (
                  <td style={{ padding: '9px 10px' }}>
                    {!isMe && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {a.role === 'admin' && (
                          <button onClick={() => promoteToOwner(a)} style={{ ...BTN(), fontSize: 9 }}>PROMOTE</button>
                        )}
                        <button onClick={() => setConfirmRevoke(a)} style={{ background: 'none', border: '1px solid #3a1515', color: '#ff5555', padding: '4px 10px', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 2 }}>
                          REVOKE
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Pending invites ── */}
      {invites.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>PENDING INVITES</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                {['EMAIL', 'ROLE', 'INVITED', 'EXPIRES'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, letterSpacing: '0.2em', color: '#444', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.token} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '8px 10px', color: '#888' }}>{inv.email}</td>
                  <td style={{ padding: '8px 10px' }}><RoleBadge role={inv.role} /></td>
                  <td style={{ padding: '8px 10px', color: '#555', fontSize: 10 }}>{fmtTime(inv.invited_at)}</td>
                  <td style={{ padding: '8px 10px', color: '#555', fontSize: 10 }}>{fmtTime(inv.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Audit log ── */}
      <div>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444', marginBottom: 12 }}>RECENT AUDIT LOG</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
              {['TIME', 'ACTOR', 'ACTION', 'TARGET', 'IP'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '5px 8px', fontSize: 8, letterSpacing: '0.2em', color: '#333', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditLog.map(entry => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #0d0d0d' }}>
                <td style={{ padding: '6px 8px', color: '#444', fontSize: 9 }}>{fmtTime(entry.ts)}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{entry.actor_email}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ color: ACTION_COLOR[entry.action] ?? '#888', letterSpacing: '0.1em' }}>{entry.action}</span>
                  {entry.detail && <span style={{ color: '#444', marginLeft: 6 }}>{entry.detail}</span>}
                </td>
                <td style={{ padding: '6px 8px', color: '#555' }}>{entry.target_email ?? '—'}</td>
                <td style={{ padding: '6px 8px', color: '#333', fontSize: 9 }}>{entry.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Invite modal ── */}
      {showInvite && (
        <div style={MODAL_BG} onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div style={MODAL}>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#FFB800', marginBottom: 20 }}>INVITE NEW ADMIN</div>
            {inviteOk ? (
              <div style={{ color: '#39FF14', fontSize: 11 }}>✓ Invite sent!</div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 5 }}>EMAIL</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} autoFocus style={INPUT} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 8 }}>ROLE</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['admin', 'owner'] as const).map(r => (
                      <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: inviteRole === r ? '#e0e0e0' : '#555', fontSize: 11 }}>
                        <input type="radio" checked={inviteRole === r} onChange={() => setInviteRole(r)} style={{ accentColor: '#FFB800' }} />
                        {r.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
                {inviteError && <div style={{ color: '#ff5555', fontSize: 10, marginBottom: 12 }}>{inviteError}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowInvite(false)} style={BTN()}>CANCEL</button>
                  <button onClick={sendInvite} disabled={inviteLoading || !inviteEmail} style={BTN(true)}>
                    {inviteLoading ? 'SENDING…' : 'SEND INVITE'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Revoke confirmation ── */}
      {confirmRevoke && (
        <div style={MODAL_BG} onClick={e => { if (e.target === e.currentTarget) setConfirmRevoke(null) }}>
          <div style={MODAL}>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#ff5555', marginBottom: 16 }}>CONFIRM REVOKE</div>
            <div style={{ color: '#888', fontSize: 11, lineHeight: 1.6, marginBottom: 20 }}>
              Revoke access for <span style={{ color: '#e0e0e0' }}>{confirmRevoke.email}</span>?
              Their sessions will end immediately.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRevoke(null)} style={BTN()}>CANCEL</button>
              <button onClick={() => doRevoke(confirmRevoke)} disabled={revokeLoading} style={{ background: '#3a0a0a', border: '1px solid #ff5555', color: '#ff5555', padding: '7px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 2 }}>
                {revokeLoading ? 'REVOKING…' : 'REVOKE ACCESS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
