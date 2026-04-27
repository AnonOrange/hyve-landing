import { redirect } from 'next/navigation'
import { lookupReset } from '@/lib/admin/reset'
import ResetPasswordForm from './_form'

export const dynamic = 'force-dynamic'

type Props = { searchParams: { token?: string } }

export default async function ResetPasswordPage({ searchParams }: Props) {
  const token = searchParams.token
  if (!token) redirect('/admin/login')

  const reset = await lookupReset(token).catch(() => null)
  if (!reset) {
    return (
      <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <div style={{ color: '#FFB800', fontSize: 11, letterSpacing: '0.4em', fontWeight: 900, marginBottom: 32 }}>HYVE · ADMIN</div>
        <div style={{ background: '#131313', border: '1px solid #2a2a2a', borderRadius: 4, padding: '32px 28px', width: 380 }}>
          <div style={{ color: '#ff5555', fontSize: 12, letterSpacing: '0.1em', marginBottom: 12 }}>INVALID OR EXPIRED LINK</div>
          <div style={{ color: '#888', fontSize: 11, lineHeight: 1.6, marginBottom: 20 }}>
            This reset link is invalid or has expired. Request a new one.
          </div>
          <a href="/admin/forgot-password" style={{ fontSize: 10, color: '#FFB800', textDecoration: 'none' }}>Request new reset link →</a>
        </div>
      </main>
    )
  }

  return <ResetPasswordForm token={token} />
}
