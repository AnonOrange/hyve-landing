import Image from 'next/image'
import LoginForm from './login-form'

export const metadata = { title: 'Log in — HYVE Attend' }

export default function LoginPage() {
  return (
    <section className="grid gap-8 py-8 lg:grid-cols-2 lg:gap-12 lg:py-12">
      <div className="relative h-[260px] overflow-hidden rounded-2xl border border-[#2a2135] lg:h-auto lg:min-h-[480px]">
        <Image
          src="/attend/backgrounds/bg-5.png"
          alt=""
          width={1200}
          height={1600}
          priority
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#08111e] via-[#08111e]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E8C456]">
            HYVE ATTEND
          </p>
          <p className="mt-2 text-xl font-black text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-2xl">
            Welcome back to the stage.
          </p>
        </div>
      </div>
      <div className="max-w-md">
        <h1 className="text-2xl font-black md:text-3xl">Log in</h1>
        <p className="mt-2 text-sm text-[#9e8a55]">
          Discover shows, manage your tickets, and host live events.
        </p>
        <LoginForm />
      </div>
    </section>
  )
}
