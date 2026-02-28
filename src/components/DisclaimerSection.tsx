export default function DisclaimerSection() {
  return (
    <section id="disclaimer" className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-amber/20 bg-amber/5 p-8 md:p-10">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber mb-1">Beta Software Disclaimer</h3>
              <p className="text-white/50 text-sm">Please read before downloading and using HYVE.</p>
            </div>
          </div>

          {/* Disclaimer points */}
          <ul className="space-y-4 text-sm text-white/70 leading-relaxed">
            <li className="flex gap-3">
              <span className="text-amber font-bold mt-0.5 flex-shrink-0">01</span>
              <span>
                <strong className="text-white/90">This is pre-release software.</strong> HYVE Beta may contain bugs, crashes, or unexpected behavior. It is not yet recommended for communications where your safety depends on absolute security.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber font-bold mt-0.5 flex-shrink-0">02</span>
              <span>
                <strong className="text-white/90">Data may be reset.</strong> Between beta versions, your account, identity keys, and message history may be wiped as we update the protocol. Always have a backup plan for critical information.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber font-bold mt-0.5 flex-shrink-0">03</span>
              <span>
                <strong className="text-white/90">No formal security audit yet.</strong> The cryptographic protocols described on this page are fully implemented in the beta build. However, they have not yet undergone a formal third-party security audit. An independent audit is planned before v1.0.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber font-bold mt-0.5 flex-shrink-0">04</span>
              <span>
                <strong className="text-white/90">Features may change.</strong> Protocol parameters, UI, and functionality are subject to change without notice during the beta period.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber font-bold mt-0.5 flex-shrink-0">05</span>
              <span>
                <strong className="text-white/90">Report problems.</strong> Found a bug or security concern? Use the form below. For sensitive security disclosures, email{' '}
                <a href="mailto:vibesoftwaresolutions@gmail.com" className="text-amber hover:underline">
                  vibesoftwaresolutions@gmail.com
                </a>{' '}
                directly.
              </span>
            </li>
          </ul>

          <div className="mt-8 pt-6 border-t border-amber/15">
            <p className="text-xs text-white/30 leading-relaxed">
              By downloading and using HYVE Beta, you acknowledge that this is experimental software and agree to use it at your own risk.
              HYVE / Vibe Software Solutions is not liable for data loss, service interruptions, or any damages arising from use of beta software.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
