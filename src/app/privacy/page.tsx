import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — HYVE',
  description: 'HYVE Privacy Policy — how we handle (or don\'t handle) your data.',
}

export default function PrivacyPage() {
  const updated = 'March 16, 2026'

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            hyveapp.co
          </a>
          <span className="font-mono text-[11px] text-white/30 tracking-widest uppercase">Privacy Policy</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="inline-block px-3 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-[11px] font-bold tracking-widest uppercase mb-4">
            Legal
          </span>
          <h1 className="text-4xl font-black text-white mb-3">Privacy Policy</h1>
          <p className="text-white/40 font-mono text-sm">
            Vibe Software Solutions Inc. · Last updated: {updated}
          </p>
        </div>

        <div className="space-y-10 text-white/65 text-[15px] leading-relaxed">

          {/* TL;DR */}
          <div className="border border-neon/30 bg-neon/5 rounded-2xl p-6">
            <p className="text-neon text-xs font-bold tracking-widest uppercase mb-3">The Short Version</p>
            <p className="text-white/80">
              HYVE is built to collect as little as possible. Your messages are encrypted on your device and
              we never have access to them. The relay server routes encrypted cells without being able to
              read them. The only personal data we store is your chosen HYVE ID and your public keys —
              both of which you intentionally publish when you register.
            </p>
          </div>

          <Section title="1. Who We Are">
            <P>
              HYVE is developed and operated by <strong className="text-white">Vibe Software Solutions Inc.</strong>,
              a software company. Questions about this policy can be directed to{' '}
              <a href="mailto:vibesoftwaresolutions@gmail.com" className="text-gold hover:underline">
                vibesoftwaresolutions@gmail.com
              </a>.
            </P>
          </Section>

          <Section title="2. What We Collect">
            <P>
              <strong className="text-white">HYVE ID and public keys.</strong> When you create an account,
              you choose a HYVE ID (username). We store your HYVE ID and the associated public key bundle
              (identity key, signed prekey, one-time prekeys) on the HYVE identity server. This information
              is intentionally public — it is what allows other users to find you and initiate encrypted
              conversations. No name, phone number, email address, or payment information is required or
              stored.
            </P>
            <P>
              <strong className="text-white">FCM push token.</strong> If you enable push notifications,
              we store a Firebase Cloud Messaging (FCM) token associated with your HYVE ID. This token is
              used only to send data-only wake-up notifications when someone sends you a message. We do not
              use it for marketing or analytics.
            </P>
            <P>
              <strong className="text-white">Nothing else.</strong> We do not collect your IP address,
              device identifiers, location (unless you use the optional location-sharing feature — see §5),
              usage analytics, crash reports, or any message content.
            </P>
          </Section>

          <Section title="3. What We Do NOT Collect">
            <ul className="space-y-2">
              {[
                'Message content — all messages are end-to-end encrypted on your device. We never have access to plaintext.',
                'Encryption keys — all key generation happens on your device. Private keys never leave your device.',
                'Contact lists or social graph — we do not know who you talk to.',
                'IP addresses — the relay server does not log IP addresses.',
                'Device identifiers — we do not collect IMEI, Android ID, or advertising IDs.',
                'Location data — unless you explicitly use the location-sharing feature.',
                'Biometric data — biometric authentication is handled entirely by the Android operating system.',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-neon mt-1 flex-shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="4. How the HYVE Relay Works">
            <P>
              The HYVE relay server routes encrypted cells from sender to recipient. The relay
              sees only: (1) a one-time routing token used to forward the cell to the correct inbox,
              and (2) the encrypted cell content. The relay cannot decrypt any cell, link any two cells
              to the same conversation, or identify who is communicating with whom. Routing tokens are
              single-use and derived from cryptographic key material shared exclusively between you and
              your conversation partner — the relay has no access to this material.
            </P>
          </Section>

          <Section title="5. Location Sharing (Optional Feature)">
            <P>
              HYVE includes an optional real-time location sharing feature. If you enable this feature,
              your device periodically encrypts your GPS coordinates and sends them to your conversation
              partner via the HYVE relay. Location data is encrypted end-to-end — we cannot read it.
              Location sharing is disabled by default and can be stopped at any time from within the app.
              We do not retain any location history on our servers.
            </P>
          </Section>

          <Section title="6. HYVEGuard VPN">
            <P>
              HYVEGuard is a full-device VPN that routes your internet traffic through the HYVE relay to
              a trusted peer device. When using HYVEGuard, all traffic is encrypted into HYVE cells before
              reaching the relay. The relay cannot read your traffic. Your trusted peer exit node can see
              your outbound internet traffic in plaintext (as they are forwarding it on your behalf) —
              this is the same trust model as any VPN, except the exit node is a person you trust rather
              than a corporation. Use HYVEGuard only with trusted peers.
            </P>
          </Section>

          <Section title="7. Data Storage and Retention">
            <P>
              All message data is stored locally on your device, encrypted under your HYVE Vault keys.
              We do not back up your messages to any server. If you delete the app or reset your device,
              your messages are gone — we cannot recover them.
            </P>
            <P>
              Your HYVE ID and public keys remain on the identity server until you request deletion.
              To delete your account and public key bundle, contact us at{' '}
              <a href="mailto:vibesoftwaresolutions@gmail.com" className="text-gold hover:underline">
                vibesoftwaresolutions@gmail.com
              </a>{' '}
              with your HYVE ID.
            </P>
          </Section>

          <Section title="8. Third-Party Services">
            <P>
              <strong className="text-white">Firebase (Google).</strong> We use Firebase Cloud Messaging
              for push notifications. FCM tokens are transmitted to Google servers as part of the FCM
              protocol. See{' '}
              <a href="https://firebase.google.com/support/privacy" className="text-gold hover:underline" target="_blank" rel="noopener noreferrer">
                Google&apos;s privacy policy
              </a>.
            </P>
            <P>
              <strong className="text-white">Stripe.</strong> If you purchase a HYVE Pro subscription,
              payment is processed by Stripe. We do not store payment card data. See{' '}
              <a href="https://stripe.com/privacy" className="text-gold hover:underline" target="_blank" rel="noopener noreferrer">
                Stripe&apos;s privacy policy
              </a>.
            </P>
            <P>
              <strong className="text-white">STUN servers (WebRTC).</strong> Voice and video calls use
              Google&apos;s public STUN servers to negotiate peer-to-peer connections. STUN servers see
              your IP address during call setup. If IP address privacy is critical to you, do not use
              the call feature.
            </P>
          </Section>

          <Section title="9. Children's Privacy">
            <P>
              HYVE is not directed to children under 13. We do not knowingly collect personal information
              from children under 13. If you believe a child under 13 has provided us with personal
              information, contact us and we will delete it.
            </P>
          </Section>

          <Section title="10. Your Rights">
            <P>
              You may request deletion of your HYVE ID and public keys at any time by contacting{' '}
              <a href="mailto:vibesoftwaresolutions@gmail.com" className="text-gold hover:underline">
                vibesoftwaresolutions@gmail.com
              </a>.
              Since we hold minimal data, fulfillment is typically immediate.
            </P>
          </Section>

          <Section title="11. Changes to This Policy">
            <P>
              We may update this policy as the app evolves. Material changes will be noted with an
              updated &quot;Last updated&quot; date at the top of this page. Continued use of the app
              after changes constitutes acceptance of the updated policy.
            </P>
          </Section>

          <Section title="12. Contact">
            <P>
              Vibe Software Solutions Inc.<br />
              <a href="mailto:vibesoftwaresolutions@gmail.com" className="text-gold hover:underline">
                vibesoftwaresolutions@gmail.com
              </a>
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-3 border-l-2 border-gold pl-4">{title}</h2>
      <div className="pl-4">{children}</div>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 last:mb-0">{children}</p>
}
