'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-start gap-4 mb-6 mt-14 first:mt-0">
      <span className="font-mono text-3xl font-black text-gold/30 leading-none select-none pt-1">
        {num}
      </span>
      <h2 className="text-2xl md:text-3xl font-black text-white leading-tight border-l-2 border-gold pl-4">
        {title}
      </h2>
    </div>
  )
}

function SubSection({ title, id }: { title: string; id?: string }) {
  return (
    <h3 id={id} className="text-lg font-bold text-gold mt-8 mb-3">
      {title}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/65 text-[15px] leading-relaxed mb-4">{children}</p>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-gold bg-gold/5 rounded-r-xl px-5 py-4 mb-5">
      <div className="text-white/75 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-amber-400 bg-amber-400/5 rounded-r-xl px-5 py-4 mb-5">
      <div className="text-white/75 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function ITTBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-neon/30 bg-neon/5 rounded-2xl p-6 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-neon inline-block" />
        <span className="text-neon text-xs font-bold tracking-widest uppercase">
          Security Guarantee
        </span>
      </div>
      <p className="text-white font-semibold mb-1">{title}</p>
      <div className="text-white/65 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function QuantumCard({
  property,
  quantum,
  hyve,
  protocol,
}: {
  property: string
  quantum: string
  hyve: string
  protocol: string
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-white/10 mb-5">
      <div className="bg-white/5 p-5">
        <p className="text-xs font-bold tracking-widest text-white/30 uppercase mb-2">
          Quantum ({property})
        </p>
        <p className="text-white/70 text-sm leading-relaxed">{quantum}</p>
      </div>
      <div className="bg-gold/5 border-t md:border-t-0 md:border-l border-gold/20 p-5">
        <p className="text-xs font-bold tracking-widest text-gold uppercase mb-2">
          HYVE Analog — {protocol}
        </p>
        <p className="text-white/75 text-sm leading-relaxed">{hyve}</p>
      </div>
    </div>
  )
}

function CompareRow({
  label,
  qkd,
  hyve,
  hyveGood,
}: {
  label: string
  qkd: string
  hyve: string
  hyveGood?: boolean
}) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 pr-4 text-white/50 text-sm font-medium">{label}</td>
      <td className="py-3 pr-4 text-white/60 text-sm">{qkd}</td>
      <td className={`py-3 text-sm font-semibold ${hyveGood !== false ? 'text-neon' : 'text-amber-400'}`}>
        {hyve}
      </td>
    </tr>
  )
}

// ─── TOC data ─────────────────────────────────────────────────────────────────

const TOC = [
  { id: 'sec-1',  label: '1. Introduction' },
  { id: 'sec-2',  label: '2. Cryptographic Primitives' },
  { id: 'sec-3',  label: '3. The HYVE Cell' },
  { id: 'sec-4',  label: '4. Five Protocol Innovations' },
  { id: 'sec-4-1',label: '   4.1 HYVE-CST', sub: true },
  { id: 'sec-4-2',label: '   4.2 HYVE-BRT', sub: true },
  { id: 'sec-4-3',label: '   4.3 HYVE-UT',  sub: true },
  { id: 'sec-4-4',label: '   4.4 HYVE-Ratchet', sub: true },
  { id: 'sec-4-5',label: '   4.5 HYVE-Vault', sub: true },
  { id: 'sec-5',  label: '5. HYVEGuard VPN' },
  { id: 'sec-6',  label: '6. Quantum-Analogous Properties' },
  { id: 'sec-7',  label: '7. Comparison Table' },
  { id: 'sec-8',  label: '8. Security Analysis' },
  { id: 'sec-9',  label: '9. Replicable Advantage' },
  { id: 'sec-10', label: '10. Conclusion' },
  { id: 'app-a',  label: 'Appendix: Primitives' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WhitepaperPage() {
  const [activeId, setActiveId] = useState('sec-1')
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver to track active section
  useEffect(() => {
    const ids = TOC.map((t) => t.id)
    const observers: IntersectionObserver[] = []

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(id)
        },
        { rootMargin: '-20% 0px -70% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setMobileTocOpen(false)
    }
  }

  const handlePrint = () => window.print()

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-white { background: white !important; color: black !important; }
          pre { background: #f4f4f4 !important; color: #222 !important; border: 1px solid #ddd !important; }
          a { color: #1a56db !important; }
        }
      `}</style>

      <div className="min-h-screen bg-surface text-white">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="no-print sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <a
              href="/"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              hyveapp.co
            </a>

            {/* Mobile TOC toggle */}
            <button
              className="md:hidden text-white/60 hover:text-white text-sm font-medium flex items-center gap-2"
              onClick={() => setMobileTocOpen((v) => !v)}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Contents
            </button>

            <div className="flex items-center gap-3">
              <span className="hidden sm:block font-mono text-[11px] text-white/30 tracking-widest uppercase">
                HYVE Architecture Overview · v1.0 · March 2026
              </span>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print / Save
              </button>
            </div>
          </div>

          {/* Mobile TOC dropdown */}
          {mobileTocOpen && (
            <div className="md:hidden border-t border-white/10 bg-black/95 max-h-60 overflow-y-auto">
              {TOC.map((t) => (
                <button
                  key={t.id}
                  onClick={() => scrollTo(t.id)}
                  className={`w-full text-left px-6 py-2.5 text-sm font-mono transition-colors ${
                    t.sub ? 'pl-10 text-[12px]' : ''
                  } ${activeId === t.id ? 'text-gold' : 'text-white/50 hover:text-white'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="hex-bg relative py-20 px-6 border-b border-white/10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-8">
              <Image src="/HYVEComIcon.png" alt="HYVE" width={72} height={72} className="rounded-2xl" />
            </div>

            <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/40 bg-gold/10 text-gold text-xs font-bold tracking-widest uppercase">
                Architecture Overview
              </span>
              <span className="font-mono text-xs text-white/30 px-3 py-1.5 rounded-full border border-white/10">
                Version 1.0 · March 2026
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
              <span className="gradient-gold-green">HYVE Encryption:</span>
              <br />
              <span className="text-white">Quantum-Inspired Security</span>
              <br />
              <span className="text-white/50 text-3xl md:text-4xl font-bold">on Classical Hardware</span>
            </h1>

            {/* Author */}
            <div className="inline-flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-gold font-black text-lg">
                A
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">Anthony S. Owens</p>
                <p className="text-white/40 text-xs">Vibe Software Solutions Inc.</p>
              </div>
              <div className="w-px h-10 bg-white/10 mx-2" />
              <div className="text-left">
                <p className="text-white/40 text-xs">Contact</p>
                <p className="text-gold text-xs font-mono">vibesoftwaresolutions@gmail.com</p>
              </div>
            </div>

            {/* Abstract */}
            <div className="max-w-2xl mx-auto bg-gold/5 border border-gold/20 rounded-2xl p-6 mb-10 text-left">
              <p className="text-xs font-bold tracking-widest text-gold uppercase mb-3">Abstract</p>
              <p className="text-white/70 text-sm leading-relaxed">
                We present HYVE — an architecture designed to approximate selected privacy and
                compartmentalization outcomes often associated with quantum key distribution,
                implemented entirely on commodity Android hardware. HYVE achieves this through
                five layered protocol innovations: Cellular Shamir Transport (HYVE-CST), Blind
                Routing Tokens (HYVE-BRT), Uniform Traffic (HYVE-UT), a Cell-Aware Double
                Ratchet (HYVE-Ratchet), and a Hardware-Backed Vault (HYVE-Vault). The
                architecture is extended to full-device VPN through HYVEGuard, which tunnels
                all IP traffic through the same fixed-size cell format. One component of the
                system — threshold secret sharing of message key material — provides an
                information-theoretic secrecy property below the reconstruction threshold.
                This document provides an architectural overview of both products and
                explains the design rationale behind each layer.
              </p>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { v: '5', l: 'Protocol Innovations' },
                { v: 'Fixed', l: 'Uniform Cell Size' },
                { v: 'K-of-N', l: 'Threshold Key Sharding' },
                { v: '1 ITT', l: 'Info-Theoretic Guarantee' },
              ].map((s) => (
                <div key={s.l} className="hyve-card rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-gold mb-1">{s.v}</div>
                  <div className="text-white/40 text-[11px] leading-tight">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main layout ───────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex gap-10">

          {/* Sidebar TOC — desktop only */}
          <aside className="no-print hidden md:block w-56 xl:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-[10px] font-bold tracking-widest text-white/25 uppercase mb-4 px-2">
                Table of Contents
              </p>
              <nav className="flex flex-col gap-0.5">
                {TOC.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => scrollTo(t.id)}
                    className={`text-left rounded-lg px-2 py-2 font-mono text-[12px] transition-all ${
                      t.sub ? 'pl-5 text-[11px]' : 'font-semibold'
                    } ${
                      activeId === t.id
                        ? 'text-gold bg-gold/10'
                        : 'text-white/35 hover:text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main ref={contentRef} className="flex-1 min-w-0 max-w-3xl">

            {/* ── Section 1 ─────────────────────────────────────────────── */}
            <div id="sec-1">
              <SectionHeader num="01" title="Introduction" />

              <SubSection title="1.1 The Problem Space" />
              <P>
                Modern communications face adversaries operating at scale. State actors, corporate
                espionage networks, and automated threat systems share three primary attack vectors:
                (1) intercept traffic in transit, (2) compromise endpoints to read plaintext before
                encryption or after decryption, and (3) subpoena infrastructure providers who hold
                server-side keys.
              </P>
              <P>
                Existing end-to-end encrypted solutions address (1) but systematically fail on (3)
                through centralized key management and server-side identity registries. More
                subtly, all current solutions fail on a fourth vector: (4) traffic analysis. Even
                when message content is encrypted, the size, timing, and frequency of packets
                reveals conversation patterns, active contacts, and communication behavior.
              </P>

              <SubSection title="1.2 Scope of This Document" />
              <P>
                This document describes the architectural design of two products built on the
                HYVE protocol:
              </P>
              <P>
                <strong className="text-white">HYVE</strong> — a secure communications app for
                Android providing encrypted messaging, media transfer, and voice/video calls.
                No server holds any encryption key material at any time. All key generation
                occurs on-device.
              </P>
              <P>
                <strong className="text-white">HYVEGuard</strong> — a full-device VPN for Android
                that captures all IP traffic, fragments it into HYVE cells, and routes it
                through the HYVE relay to a trusted peer exit node. The relay sees only ciphertext.
              </P>

              <SubSection title="1.3 Quantum-Inspired Architecture" />
              <P>
                Quantum Key Distribution (QKD) provides security rooted in the laws of physics:
                any eavesdropper disturbs the quantum state, making interception detectable.
                However, QKD requires dedicated fiber-optic infrastructure, specialized hardware,
                operates only over short distances, and costs orders of magnitude more than
                classical systems.
              </P>
              <P>
                HYVE does not use quantum mechanics and does not provide quantum-physical
                guarantees. HYVE is inspired by certain security properties associated with
                quantum systems, and seeks to approximate selected privacy outcomes through
                a layered classical architecture. It is not a substitute for QKD where
                quantum-physical guarantees are required. One component — threshold secret
                sharing of message key material — provides an unconditional
                information-theoretic secrecy property below the reconstruction threshold.
                All other privacy and forward-secrecy properties rely on standard cryptographic
                assumptions and implementation discipline.
              </P>
            </div>

            {/* ── Section 2 ─────────────────────────────────────────────── */}
            <div id="sec-2">
              <SectionHeader num="02" title="Cryptographic Primitives" />
              <P>
                HYVE uses only well-audited, standardized primitives. No novel or proprietary
                cryptographic algorithms are employed. The security of the system depends entirely
                on the composition of these primitives, not on any single algorithm.
              </P>

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/15">
                      <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">Primitive</th>
                      <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">Algorithm</th>
                      <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">Key Size</th>
                      <th className="text-left py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">Use in HYVE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Asymmetric KX', 'X25519 (Curve25519)', '256-bit', 'X3DH key agreement, DH ratchet steps'],
                      ['Digital Signing', 'Ed25519', '256-bit', 'Identity verification, prekey signing'],
                      ['Key Derivation', 'HKDF-SHA256', '—', 'All KDF operations (root, chain, message, routing)'],
                      ['Cell AEAD', 'ChaCha20-Poly1305', '256-bit', 'Cell payload encryption'],
                      ['Message AEAD', 'AES-256-GCM', '256-bit', 'Message-level encryption (inner layer)'],
                      ['Secret Sharing', 'Shamir over GF(2⁸)', '—', 'Key sharding — HYVE-CST'],
                      ['Vault KDF', 'PBKDF2-SHA256', '—', 'PIN-to-KEK derivation'],
                      ['Hardware Enc.', 'Android Keystore', '256-bit', 'Biometric key wrapping (TEE / StrongBox)'],
                    ].map(([p, a, k, u]) => (
                      <tr key={p} className="border-b border-white/5">
                        <td className="py-3 pr-4 text-gold font-mono text-xs font-bold whitespace-nowrap">{p}</td>
                        <td className="py-3 pr-4 text-white/70 font-mono text-xs">{a}</td>
                        <td className="py-3 pr-4 text-white/50 text-xs">{k}</td>
                        <td className="py-3 text-white/55 text-xs">{u}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <InfoBox>
                <strong className="text-gold">Note on algorithm selection:</strong> X25519 and Ed25519
                are resistant to invalid-curve attacks by construction. ChaCha20-Poly1305 is selected
                for cell encryption as it is immune to timing side-channels on platforms lacking
                hardware AES acceleration. AES-256-GCM is used at the message layer where hardware
                acceleration is available. All ephemeral key material is zeroed immediately after use.
              </InfoBox>
            </div>

            {/* ── Section 3 ─────────────────────────────────────────────── */}
            <div id="sec-3">
              <SectionHeader num="03" title="The HYVE Cell" />
              <P>
                The fundamental unit of HYVE is the <strong className="text-white">cell</strong> —
                a fixed-size packet carrying exactly one fragment of one message (or cover noise).
                Every packet transmitted through the HYVE relay is the same size, regardless
                of content type.
              </P>

              <SubSection title="3.1 Cell Structure" />
              <P>
                Each cell is composed of three logical regions: an unencrypted header, an
                encrypted payload, and an authentication tag. The header fields are authenticated
                but not encrypted — they carry the information a relay needs to forward the
                cell (a one-time routing token) without being able to read the payload. Any
                modification to the header causes the authentication tag to fail, and the cell
                is silently dropped.
              </P>
              <P>
                The header encodes: protocol version, cell-type flags, a random swarm identifier
                grouping a message&apos;s cells together, the current ratchet epoch, the cell&apos;s
                position within the swarm, the threshold reconstruction parameters, and the
                one-time routing token. All remaining bytes are the AEAD-encrypted payload and
                authentication tag.
              </P>

              <SubSection title="3.2 Authentication" />
              <P>
                The header is used as AEAD additional data (AAD). This means the relay-visible
                fields are authenticated but not encrypted. A relay can read the routing token
                to forward the cell without being able to decrypt the payload. Any modification
                to the header causes the Poly1305 tag to fail and the cell is silently dropped.
              </P>

              <SubSection title="3.3 Cover Cells" />
              <P>
                Cover cells are added to every message swarm. A cover cell carries a special
                flag, a zeroed share field, and a cryptographically random payload. The cell
                key for cover cells is derived from the same chain key as real data cells —
                making cover cells computationally indistinguishable from real data without
                knowledge of the chain key.
              </P>
            </div>

            {/* ── Section 4 ─────────────────────────────────────────────── */}
            <div id="sec-4">
              <SectionHeader num="04" title="Five Protocol Innovations" />

              <div id="sec-4-1">
                <SubSection title="4.1 HYVE-CST — Cellular Shamir Transport" id="sec-4-1" />
                <P>
                  The message encryption key (MK) is never transmitted whole. Before any message
                  is sent, the MK is split using Shamir Secret Sharing over a finite field into
                  N shares with a K-of-N reconstruction threshold. Each share is placed in the
                  encrypted payload of one data cell. No single cell — and no subset of cells
                  smaller than the threshold — carries enough information to reconstruct the key.
                </P>
                <ITTBox title="Guarantee: Fewer Than K Shares Yield Zero Information">
                  By the information-theoretic property of Shamir Secret Sharing, any set of
                  fewer than K shares reveals exactly zero bits of information about the secret,
                  regardless of the computational power of the adversary. This is not a
                  computational assumption — it is a mathematical consequence of polynomial
                  evaluation in a finite field. An attacker who captures fewer than the threshold
                  number of cells cannot extract any information about the message key, even with
                  unlimited time and compute.
                </ITTBox>
              </div>

              <div id="sec-4-2">
                <SubSection title="4.2 HYVE-BRT — Blind Routing Tokens" id="sec-4-2" />
                <P>
                  Every cell carries a unique routing token in its header. The relay uses a
                  prefix of this token as a session lookup key to forward the cell to the
                  correct inbox. The relay never holds a decryption key.
                </P>
                <P>
                  Tokens are derived from the ratchet chain key shared exclusively between
                  sender and recipient — so the relay cannot reproduce, predict, or link them.
                  Tokens are single-use and forward-secret: the token for one cell cannot be
                  derived from any information available after the chain key advances.
                </P>
                <P>
                  The relay is architecturally excluded from the communication channel. Even
                  with full logs of all routing tokens seen, the relay cannot link any two
                  messages to the same conversation, identify the participants, or determine
                  conversation frequency — provided the chain key is not separately compromised.
                </P>
              </div>

              <div id="sec-4-3">
                <SubSection title="4.3 HYVE-UT — Uniform Traffic" id="sec-4-3" />
                <P>
                  All traffic — text messages, image fragments, video chunks, signaling data,
                  and cover noise — is transmitted as fixed-size cells. There is no
                  distinguishing feature in cell size, structure, or timing pattern that
                  reveals whether a cell carries real data or noise.
                </P>
                <P>
                  This defeats traffic analysis attacks: an observer on the network cannot
                  determine from packet metadata alone whether a user is actively messaging
                  or the device is generating cover traffic.
                </P>
                <InfoBox>
                  <strong className="text-gold">Cover traffic injection:</strong> Each swarm
                  includes randomly generated cover cells. In periods of silence, the HYVE
                  client may inject additional standalone cover swarms to maintain a uniform
                  traffic baseline. The relay cannot distinguish cover swarms from real swarms.
                </InfoBox>
              </div>

              <div id="sec-4-4">
                <SubSection title="4.4 HYVE-Ratchet — Cell-Aware Double Ratchet" id="sec-4-4" />
                <P>
                  HYVE uses a modified Signal Double Ratchet where key derivation occurs
                  per-swarm rather than per-message. The chain key seed is also used in
                  routing token derivation, tightly coupling confidentiality and routing
                  privacy. Epoch tracking creates explicit forward-secrecy boundaries.
                </P>
                <P>
                  The session is initialized from an X3DH shared secret. Each outgoing swarm
                  derives a fresh message key and immediately advances the chain key, zeroing
                  the previous value. Periodic Diffie-Hellman ratchet steps rotate the root
                  key, providing break-in recovery alongside forward secrecy.
                </P>
                <ITTBox title="Forward Secrecy Under Cryptographic Assumptions">
                  HKDF-SHA256 is a one-way construction: given the output, an adversary
                  cannot feasibly invert it to recover the input. When a chain key is zeroed
                  and its memory freed, recovery of the prior key requires inverting the
                  underlying hash function — which is computationally infeasible under
                  standard assumptions. Assuming correct implementation, secure deletion,
                  and the security of the underlying hash function, compromise of later
                  ratchet state should not enable recovery of earlier message keys.
                </ITTBox>
              </div>

              <div id="sec-4-5">
                <SubSection title="4.5 HYVE-Vault — Hardware-Backed Key Storage" id="sec-4-5" />
                <P>
                  HYVE uses a two-layer key hierarchy to protect the master Data Encryption
                  Key (DEK) at rest. The DEK encrypts all conversation keys stored on device.
                  The DEK is itself encrypted under two independent Key Encryption Keys (KEKs)
                  that must both be present for decryption.
                </P>
                <P>
                  One KEK is derived from the user&apos;s PIN through a deliberately slow
                  key derivation function, making brute-force attacks expensive. The other KEK
                  is generated and stored inside the Android Keystore hardware security module,
                  gated behind biometric authentication. It never leaves the Trusted Execution
                  Environment (TEE) or StrongBox secure enclave.
                </P>
                <P>
                  An offline attacker with a rooted device cannot extract the hardware-bound
                  KEK. Without both keys, the DEK is inaccessible and all stored conversation
                  data remains encrypted.
                </P>
              </div>
            </div>

            {/* ── Section 5 ─────────────────────────────────────────────── */}
            <div id="sec-5">
              <SectionHeader num="05" title="HYVEGuard — Full-Device VPN" />
              <P>
                HYVEGuard extends the HYVE cell architecture to the network layer. Using
                Android&apos;s VPN API, HYVEGuard captures all IP traffic from all applications
                on the device, encrypts it into HYVE cells, and tunnels it through the HYVE
                relay to a trusted peer device acting as the exit node.
              </P>

              <SubSection title="5.1 Traffic Capture" />
              <P>
                Android&apos;s VPN service API creates a virtual tunnel network interface. By
                routing all IPv4 traffic through this interface, HYVEGuard captures packets
                from every application on the device — including apps that are not HYVE-aware.
                The raw IP packets are then fragmented and encrypted into HYVE cells for
                transmission.
              </P>

              <SubSection title="5.2 Cell Encapsulation" />
              <P>
                Raw IP packets from the tunnel interface are fragmented into chunks fitting
                within the HYVE cell payload. Each chunk is wrapped in a HYVEGuard cell —
                a simplified variant of the standard HYVE messaging cell sharing the same
                fixed total size and AEAD authentication structure. The relay cannot
                distinguish HYVEGuard cells from messaging cells.
              </P>

              <SubSection title="5.3 Key Agreement" />
              <P>
                Both peers independently derive the same symmetric session keys from their
                shared HYVE identities, without transmitting the key itself. The derivation
                is deterministic and symmetric regardless of which peer initiates, and
                produces separate keys for each traffic direction.
              </P>

              <SubSection title="5.4 Peer Exit Node Model" />
              <P>
                Unlike commercial VPNs where the VPN provider operates the exit servers,
                HYVEGuard&apos;s exit node is the trusted peer&apos;s own device. The relay sees only
                HYVE cells (ciphertext) and routes them to the peer&apos;s inbox. The peer device
                decrypts the IP packet and forwards it to the public internet on behalf of the
                originating device, then returns the response through the same path.
              </P>
              <WarningBox>
                <strong>Availability note:</strong> Because the exit node is the peer&apos;s device,
                HYVEGuard VPN is only active when both the local device and the trusted peer device
                are simultaneously online and running HYVEGuard. This is a deliberate architectural
                choice: it eliminates the trusted third party (VPN provider) entirely at the cost
                of requiring peer availability.
              </WarningBox>
              <WarningBox>
                <strong>Exit node trust:</strong> Your trusted peer exit node can see your
                outbound internet traffic in plaintext as they are forwarding it on your behalf.
                This is the same trust model as any VPN, except the exit node is a person you
                trust rather than a corporation. Use HYVEGuard only with genuinely trusted peers.
              </WarningBox>
            </div>

            {/* ── Section 6 ─────────────────────────────────────────────── */}
            <div id="sec-6">
              <SectionHeader num="06" title="Quantum-Inspired Properties" />
              <P>
                The following table maps security properties often associated with quantum key
                distribution to their HYVE classical analogs. HYVE does not provide
                quantum-physical guarantees and is not equivalent to QKD. For each property,
                we describe the quantum mechanism and the HYVE architectural element designed
                to pursue a similar operational privacy goal.
              </P>

              <QuantumCard
                property="Superposition"
                quantum="A qubit exists in a superposition of states until measured. Any eavesdropper must collapse the superposition, producing a detectable disturbance."
                hyve="HYVE-UT: Every cell is identical in size. Messages, files, video fragments, and random noise are computationally indistinguishable. An observer cannot determine whether they are observing real communication or cover traffic without access to the shared chain key."
                protocol="HYVE-UT"
              />

              <QuantumCard
                property="No-Cloning Theorem"
                quantum="Quantum states cannot be copied. An eavesdropper cannot intercept a quantum key without possessing it exclusively — the act of copying destroys the original."
                hyve="HYVE-CST: Any set of fewer than the K threshold of cells is information-theoretically useless for reconstructing the message key. An adversary who intercepts fewer cells than required has captured fragments that reveal zero bits about the key — an unconditional guarantee independent of computational power."
                protocol="HYVE-CST"
              />

              <QuantumCard
                property="State Collapse"
                quantum="Once a quantum state is measured, it collapses irreversibly. Past quantum states are unrecoverable."
                hyve="HYVE-Ratchet: Every chain key is immediately zeroed after advancing. HKDF is a one-way construction — given current ratchet state, an adversary who cannot invert the underlying hash function cannot recover past message keys. Correct implementation and secure deletion are required for this property to hold."
                protocol="HYVE-Ratchet"
              />

              <QuantumCard
                property="Quantum Entanglement"
                quantum="Entangled particles share state instantaneously without a classical channel. No intermediary can observe the correlation without disrupting it."
                hyve="HYVE-BRT + Blind Relay: The sender and receiver share ratchet state. The relay sees only one-time tokens derived from that shared state. The relay is architecturally excluded from the communication channel — it cannot correlate messages to the same conversation or identify participants."
                protocol="HYVE-BRT"
              />

              <QuantumCard
                property="Heisenberg Uncertainty"
                quantum="Measuring one quantum property with precision necessarily disturbs the complementary property. Precise eavesdropping necessarily corrupts the transmission."
                hyve="HYVE-BRT + HYVE-UT: An observer who intercepts and modifies cells gains nothing — any modification causes AEAD authentication failure at the receiver. An observer who does not modify cells captures only: a one-time routing token that expires with the message, and a fixed-size ciphertext with no metadata."
                protocol="HYVE-BRT + HYVE-UT"
              />

              <QuantumCard
                property="Quantum Noise"
                quantum="Quantum channels introduce irreducible noise that is indistinguishable from eavesdropping noise, making passive observation statistically undetectable only for legitimate parties."
                hyve="HYVEGuard: All VPN traffic is normalized to fixed-size cells regardless of the original IP packet size. Real packets and padding are computationally indistinguishable. Traffic analysis reveals nothing about application behavior, destination servers, or data types."
                protocol="HYVEGuard"
              />
            </div>

            {/* ── Section 7 ─────────────────────────────────────────────── */}
            <div id="sec-7">
              <SectionHeader num="07" title="Comparison: QKD vs. HYVE" />

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/15">
                      <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider w-44">Property</th>
                      <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">QKD</th>
                      <th className="text-left py-3 text-gold font-semibold text-xs uppercase tracking-wider">HYVE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label="Eavesdrop detection" qkd="Physical (quantum state disturbance)" hyve="Cryptographic (AEAD authentication failure)" />
                    <CompareRow label="Forward secrecy" qkd="Per-key (new QKD session per key)" hyve="Per-swarm (ratchet advances per message group)" />
                    <CompareRow label="Key interception" qkd="Physically impossible (no-cloning)" hyve="Information-theoretically impossible below threshold (Shamir guarantee)" />
                    <CompareRow label="Traffic analysis" qkd="Inherent quantum noise floor" hyve="Fixed-size uniform cells + cover traffic injection" />
                    <CompareRow label="Relay trust" qkd="Classical infrastructure required" hyve="Architectural — relay holds no keys and sees only one-time tokens" />
                    <CompareRow label="Quantum-safe" qkd="By definition" hyve="Partial — Shamir threshold guarantee holds; key agreement susceptible to Shor's algorithm" hyveGood={false} />
                    <CompareRow label="Hardware required" qkd="Dedicated quantum hardware, fiber" hyve="Any Android 8.0+ device" />
                    <CompareRow label="Range" qkd="~100km fiber (without repeaters)" hyve="Global (internet)" />
                    <CompareRow label="Cost" qkd="$100,000+ per endpoint" hyve="Free (open source)" />
                    <CompareRow label="Deployability" qkd="Specialized infrastructure" hyve="App install, minutes" />
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 8 ─────────────────────────────────────────────── */}
            <div id="sec-8">
              <SectionHeader num="08" title="Security Analysis" />

              <SubSection title="8.1 What HYVE Protects Against" />
              <P>
                <strong className="text-white">Network-level interception:</strong> All traffic
                is AEAD-encrypted. The relay sees only ciphertext and routing tokens.
                A network observer sees only fixed-size cells with no content or metadata.
              </P>
              <P>
                <strong className="text-white">Relay compromise:</strong> The relay holds no keys
                and cannot decrypt any cell. A compromised relay can observe routing token usage
                (which is unlinkable across messages) and can attempt to drop or delay cells.
                It cannot read, modify (AEAD prevents undetected modification), or replay messages.
              </P>
              <P>
                <strong className="text-white">Server subpoena:</strong> No HYVE server holds
                any user encryption key, message content, or conversation data. The identity
                server holds only public keys and push notification tokens. A legal order to
                produce encryption keys against HYVE servers would produce nothing usable.
              </P>
              <P>
                <strong className="text-white">Offline device theft:</strong> The data encryption
                key is protected by two independent hardware- and software-based keys. An
                attacker without the user&apos;s biometric cannot extract the hardware-bound key
                from the secure enclave.
              </P>

              <SubSection title="8.2 What HYVE Does NOT Protect Against" />
              <WarningBox>
                <strong>Endpoint compromise:</strong> If an attacker installs malware on the
                user&apos;s device before encryption, they can read plaintext from the application
                layer. HYVE, like all E2E systems, cannot protect against a compromised endpoint.
              </WarningBox>
              <WarningBox>
                <strong>Large-scale timing correlation:</strong> A global passive adversary
                observing both ends of every connection simultaneously may correlate message
                timing patterns across the relay. Cover traffic reduces but does not eliminate
                this attack surface.
              </WarningBox>
              <WarningBox>
                <strong>Quantum computers (partial):</strong> The elliptic-curve key agreement
                and signing schemes used in HYVE are vulnerable to Shor&apos;s algorithm on a
                cryptographically relevant quantum computer. The Shamir threshold guarantee is
                unaffected. Post-quantum key exchange migration is on the HYVE roadmap.
              </WarningBox>

              <SubSection title="8.3 Security Guarantee Summary" />
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {[
                  {
                    num: 'G-1',
                    title: 'Shamir Threshold Guarantee',
                    body: 'Any attacker with fewer than the K reconstruction threshold of Shamir shares has zero information about the message key, regardless of computational resources. This is an unconditional information-theoretic guarantee derived from the mathematical properties of polynomial evaluation in a finite field.',
                  },
                  {
                    num: 'G-2',
                    title: 'Computational Forward Secrecy',
                    body: 'Assuming correct implementation, secure memory deletion, and the security of the underlying hash function, an adversary who compromises ratchet state at time T cannot recover message keys from before T. This is a computational guarantee that relies on standard cryptographic assumptions.',
                  },
                ].map((g) => (
                  <div key={g.num} className="border border-neon/20 bg-neon/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-mono text-xs font-black text-neon px-2 py-0.5 rounded bg-neon/10">{g.num}</span>
                    </div>
                    <p className="text-white font-semibold text-sm mb-2">{g.title}</p>
                    <p className="text-white/55 text-xs leading-relaxed">{g.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 9 ─────────────────────────────────────────────── */}
            <div id="sec-9">
              <SectionHeader num="09" title="Replicable Advantage" />
              <P>
                The fundamental commercial advantage of HYVE over QKD is deployability.
                Achieving quantum-inspired security properties requires:
              </P>

              <div className="grid md:grid-cols-2 gap-5 mb-6">
                <div className="hyve-card rounded-2xl p-6">
                  <p className="text-white/30 text-xs font-bold tracking-widest uppercase mb-4">QKD Requirements</p>
                  {[
                    'Dedicated single-mode fiber or line-of-sight free-space optical link',
                    'Cryogenically cooled photon detectors ($50K–$500K)',
                    'Low-loss optical switches and polarization controllers',
                    'Classical authenticated channel running in parallel',
                    'Distance limit: ~100km without quantum repeaters',
                    'Specialized technical staff for maintenance',
                  ].map((r) => (
                    <div key={r} className="flex gap-2 mb-2">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                      <p className="text-white/50 text-xs leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
                <div className="hyve-card rounded-2xl p-6 border border-neon/20">
                  <p className="text-neon text-xs font-bold tracking-widest uppercase mb-4">HYVE Requirements</p>
                  {[
                    'Any Android 8.0+ smartphone',
                    'Standard internet connection (WiFi or mobile data)',
                    'HYVE app (open source, free)',
                    'Minutes of first-time setup',
                    'Global reach — works over any internet connection',
                    'No dedicated server infrastructure required',
                  ].map((r) => (
                    <div key={r} className="flex gap-2 mb-2">
                      <span className="text-neon mt-0.5 flex-shrink-0">✓</span>
                      <p className="text-white/65 text-xs leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </div>

              <P>
                HYVE does not claim to replace QKD for high-assurance government or defense
                applications where quantum-physical guarantees are legally mandated. HYVE is
                designed to deliver similar operational privacy goals at dramatically lower
                cost and with global internet deployability — making strong layered privacy
                accessible to individuals, journalists, activists, and enterprises operating
                in adversarial environments worldwide.
              </P>
            </div>

            {/* ── Section 10 ────────────────────────────────────────────── */}
            <div id="sec-10">
              <SectionHeader num="10" title="Conclusion" />
              <P>
                HYVE demonstrates that strong layered privacy properties inspired by quantum
                systems are achievable on classical hardware through architectural innovation.
                The five-layer HYVE protocol stack — HYVE-CST, HYVE-BRT, HYVE-UT,
                HYVE-Ratchet, and HYVE-Vault — collectively addresses the key privacy
                challenges that existing E2E encrypted solutions leave unresolved: key
                interception, relay trust, and traffic analysis.
              </P>
              <P>
                The Shamir threshold component provides an unconditional information-theoretic
                guarantee below the reconstruction threshold, independent of computational
                assumptions. All other properties rely on standard cryptographic primitives
                and implementation discipline, with the strength of established algorithms
                such as ChaCha20-Poly1305, X25519, and HKDF-SHA256.
              </P>
              <P>
                HYVEGuard extends this architecture to the network layer, providing full-device
                IP traffic privacy with a trusted peer exit node model that eliminates the
                need to trust any VPN provider infrastructure.
              </P>
              <P>
                The architecture is designed to be auditable: no proprietary algorithms are used,
                no server-side key material exists, and all privacy properties are derived from
                the mathematical properties of well-understood primitives rather than security
                through obscurity.
              </P>
              <div className="border border-gold/30 bg-gold/5 rounded-2xl p-6 mt-6">
                <p className="text-gold font-bold mb-2">For security review, partnership, or licensing inquiries:</p>
                <p className="text-white/60 text-sm">Anthony S. Owens, Vibe Software Solutions Inc.</p>
                <p className="text-gold font-mono text-sm">vibesoftwaresolutions@gmail.com</p>
              </div>
            </div>

            {/* ── Appendix ──────────────────────────────────────────────── */}
            <div id="app-a" className="mt-16">
              <div className="border-t border-white/10 pt-10 mt-10 mb-16">
                <p className="font-mono text-xs font-bold tracking-widest text-white/25 uppercase mb-2">Appendix</p>
                <h2 className="text-2xl font-black text-white mb-6">Primitive Reference</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/15">
                        <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">Algorithm</th>
                        <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">Standard</th>
                        <th className="text-left py-3 pr-4 text-white/40 font-semibold text-xs uppercase tracking-wider">Security Level</th>
                        <th className="text-left py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['X25519', 'RFC 7748', '128-bit classical', 'DH over Curve25519'],
                        ['Ed25519', 'RFC 8032', '128-bit classical', 'Deterministic signatures'],
                        ['ChaCha20-Poly1305', 'RFC 8439', '256-bit', 'Constant-time; preferred where hardware AES unavailable'],
                        ['AES-256-GCM', 'NIST SP 800-38D', '256-bit', 'Hardware-accelerated on modern ARM'],
                        ['HKDF-SHA256', 'RFC 5869', '256-bit', 'Extract-then-expand key derivation'],
                        ['PBKDF2-SHA256', 'RFC 8018', '→ key space', 'High-iteration PIN-based key derivation'],
                        ['Shamir SS', 'GF(2⁸)', 'ITT below K', 'Unconditional secrecy guarantee below reconstruction threshold'],
                      ].map(([a, s, l, n]) => (
                        <tr key={a} className="border-b border-white/5">
                          <td className="py-3 pr-4 text-gold font-mono text-xs font-bold">{a}</td>
                          <td className="py-3 pr-4 text-white/50 text-xs font-mono">{s}</td>
                          <td className="py-3 pr-4 text-white/60 text-xs">{l}</td>
                          <td className="py-3 text-white/45 text-xs">{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Bottom CTA ────────────────────────────────────────────── */}
            <div className="border-t border-white/10 pt-10 pb-6 text-center no-print">
              <p className="text-white/40 text-sm mb-6">
                All products created by Anthony S. Owens · Vibe Software Solutions Inc.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <a
                  href="/"
                  className="btn-outline px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back to HYVE
                </a>
                <a
                  href="/#pricing"
                  className="btn-primary px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
                >
                  Get HYVE App
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              </div>
            </div>

          </main>
        </div>
      </div>
    </>
  )
}
