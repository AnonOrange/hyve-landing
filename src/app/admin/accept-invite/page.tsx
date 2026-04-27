import { redirect } from 'next/navigation'
import { lookupInvite } from '@/lib/admin/invite'
import AcceptInviteForm from './_form'

export const dynamic = 'force-dynamic'

type Props = { searchParams: { token?: string } }

export default async function AcceptInvitePage({ searchParams }: Props) {
  const token = searchParams.token
  if (!token) redirect('/admin/login')

  const invite = await lookupInvite(token).catch(() => null)
  if (!invite) {
    return (
      <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <div style={{ color: '#FFB800', fontSize: 11, letterSpacing: '0.4em', fontWeight: 900, marginBottom: 32 }}>HYVE · ADMIN</div>
        <div style={{ background: '#131313', border: '1px solid #2a2a2a', borderRadius: 4, padding: '32px 28px', width: 380 }}>
          <div style={{ color: '#ff5555', fontSize: 12, letterSpacing: '0.1em', marginBottom: 12 }}>INVALID OR EXPIRED INVITE</div>
          <div style={{ color: '#888', fontSize: 11, lineHeight: 1.6, marginBottom: 20 }}>
            This invite link is invalid or has expired. Ask an owner to send a new one.
          </div>
          <a href="/admin/login" style={{ fontSize: 10, color: '#444', textDecoration: 'none' }}>← back to sign in</a>
        </div>
      </main>
    )
  }

  return <AcceptInviteForm token={token} email={invite.email} role={invite.role} />
}
