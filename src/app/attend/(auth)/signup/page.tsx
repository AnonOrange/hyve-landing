import SignupForm from './signup-form'

export const metadata = { title: 'Sign up — HYVE Attend' }

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-black">Create your HYVE Attend account</h1>
      <p className="mt-2 text-sm text-[#9e8a55]">
        One account to discover shows, hold tickets, and host live events.
      </p>
      <SignupForm />
    </section>
  )
}
