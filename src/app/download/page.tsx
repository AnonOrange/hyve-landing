import { redirect } from 'next/navigation'
import ActivateForm from './ActivateForm'

interface PageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function DownloadPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams

  // If no Stripe configured yet, redirect to direct APK
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || !session_id) {
    const apkUrl = process.env.NEXT_PUBLIC_APK_URL
    if (apkUrl && apkUrl !== '#') redirect(apkUrl)
    redirect('/#download')
  }

  // Verify session is paid
  let paid = false
  let hyveIdFromSession: string | null = null
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey)
    const session = await stripe.checkout.sessions.retrieve(session_id)
    paid = session.payment_status === 'paid' || session.status === 'complete'
    hyveIdFromSession = session.client_reference_id || null
  } catch {
    redirect('/#pricing')
  }

  if (!paid) redirect('/#pricing')

  const apkUrl = process.env.NEXT_PUBLIC_APK_URL || '#'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-black">
      <div className="max-w-md w-full text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-black text-white mb-3">You&apos;re In.</h1>
        <p className="text-white/50 mb-10">
          Payment confirmed. Download HYVE and activate your Pro subscription below.
        </p>

        {/* APK download */}
        <a
          href={apkUrl}
          download
          className="btn-primary px-8 py-4 rounded-2xl text-base font-bold flex items-center gap-2 justify-center mb-8"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 16l-4-4h3V4h2v8h3l-4 4zm-7 4v-2h14v2H5z" />
          </svg>
          Download HYVE APK
        </a>

        {/* Activate Pro */}
        <ActivateForm sessionId={session_id} prefillHyveId={hyveIdFromSession} />

        {/* Install instructions */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-left mt-8">
          <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-3">
            Installation Steps
          </p>
          <ol className="text-sm text-white/60 space-y-2 list-decimal list-inside">
            <li>Download the APK file above</li>
            <li>Go to <strong className="text-white/80">Settings → Security</strong></li>
            <li>Enable <strong className="text-white/80">Install unknown apps</strong></li>
            <li>Open the APK and tap <strong className="text-white/80">Install</strong></li>
            <li>Launch HYVE and create your encrypted identity</li>
            <li>Activate Pro using the form above</li>
          </ol>
        </div>

        <p className="text-xs text-white/30 mt-8">
          Requires Android 8.0+ · Questions?{' '}
          <a href="mailto:vibesoftwaresolutions@gmail.com" className="text-gold hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  )
}
