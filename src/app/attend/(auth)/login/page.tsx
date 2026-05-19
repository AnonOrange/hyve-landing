import LoginForm from './login-form'

export const metadata = { title: 'Log in — HYVE Attend' }

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-black">Log in to HYVE Attend</h1>
      <p className="mt-2 text-sm text-[#9e8a55]">
        Discover shows, manage your tickets, and host live events.
      </p>
      <LoginForm />
    </section>
  )
}
