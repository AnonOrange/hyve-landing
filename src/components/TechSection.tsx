'use client'

import { useEffect, useRef } from 'react'

const innovations = [
  {
    id: 'HYVE-CST',
    name: 'Key Sharding',
    subtitle: "Shamir's Secret Sharing",
    color: '#FFB800',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    body: 'Your encryption key is never stored whole. It\'s split into 5 fragments using Shamir\'s Secret Sharing — any 3 can reconstruct it. No single server, device, or attacker ever holds the complete key.',
    detail: '3-of-5 threshold · split on-device · never transmitted whole',
  },
  {
    id: 'HYVE-BRT',
    name: 'Blind Routing',
    subtitle: 'Zero-Knowledge Message Delivery',
    color: '#FF8C00',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    ),
    body: 'Every message cell carries a one-time blind routing token derived from your ratchet chain key. The relay servers route your data without knowing who sent it or who receives it — blind by design.',
    detail: 'HKDF-derived tokens · per-cell · relay is cryptographically blind',
  },
  {
    id: 'HYVE-UT',
    name: 'Uniform Traffic',
    subtitle: 'Traffic Analysis Defense',
    color: '#39FF14',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    body: 'Every packet — message, photo, video, or cover noise — is exactly 512 bytes. Messages and random noise are indistinguishable. Traffic analysis, timing attacks, and metadata surveillance all fail.',
    detail: '512B cells · cover traffic injected · zero metadata leakage',
  },
  {
    id: 'HYVE-Ratchet',
    name: 'Forward Secrecy',
    subtitle: 'Cell-Aware Double Ratchet',
    color: '#FFB800',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    body: 'HYVE\'s ratchet derives a unique encryption key for every single 512-byte cell. Compromise one — lose nothing else. Your past messages stay protected even if a session key is ever exposed.',
    detail: 'X3DH init · per-cell key derivation · epoch tracking',
  },
  {
    id: 'HYVE-Vault',
    name: 'Hardware Vault',
    subtitle: 'Android Keystore + Biometrics',
    color: '#FF8C00',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    body: 'Your master key lives inside Android\'s hardware security enclave — never accessible in plaintext. Protected by biometric authentication + PBKDF2 PIN derivation. An offline attacker with your device cannot brute-force their way in.',
    detail: 'DEK/KEK hierarchy · PBKDF2 100k iter · Android Keystore HW enclave',
  },
]

export default function TechSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = entry.target.querySelectorAll<HTMLElement>('.reveal')
            items.forEach((item, i) => {
              setTimeout(() => item.classList.add('visible'), i * 80)
            })
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="technology" ref={sectionRef} className="py-28 px-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-16 reveal">
        <span className="inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold tracking-widest uppercase mb-4">
          HYVE Protocol
        </span>
        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
          Five Layers of{' '}
          <span className="gradient-gold-green">Unbreakable Security</span>
        </h2>
        <p className="text-white/50 text-lg max-w-xl mx-auto">
          Each innovation solves a problem no single protocol addresses alone.
          Together, they form the HYVE encryption stack.
        </p>
      </div>

      {/* Cards grid — 2 cols + 1 centered on last row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {innovations.map((item, i) => (
          <div
            key={item.id}
            className={`hyve-card rounded-2xl p-7 reveal ${
              i === innovations.length - 1 ? 'md:col-span-2 md:max-w-[calc(50%-10px)] md:mx-auto' : ''
            }`}
          >
            {/* Icon + badge */}
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: `${item.color}18`, color: item.color }}
              >
                {item.icon}
              </div>
              <span
                className="text-[11px] font-bold tracking-widest px-2 py-1 rounded-md"
                style={{ background: `${item.color}18`, color: item.color }}
              >
                {item.id}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-1">{item.name}</h3>
            <p className="text-xs font-medium mb-3" style={{ color: item.color }}>
              {item.subtitle}
            </p>

            {/* Body */}
            <p className="text-white/60 text-sm leading-relaxed mb-4">{item.body}</p>

            {/* Technical detail */}
            <div className="border-t border-white/5 pt-3">
              <p className="text-[11px] font-mono text-white/30 tracking-wide">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
