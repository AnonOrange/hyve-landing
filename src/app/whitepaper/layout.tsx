import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HYVE Encryption White Paper — Quantum-Analogous Security on Classical Hardware',
  description:
    'Technical white paper by Anthony S. Owens (Vibe Software Solutions Inc.) describing the HYVE Quantum-Analogous Cryptographic (QAC) architecture: five protocol innovations achieving quantum-class security properties on any Android device.',
  openGraph: {
    title: 'HYVE Technical White Paper',
    description:
      'Five protocol innovations. Two information-theoretic guarantees. Quantum-analogous security on any Android device.',
    type: 'article',
    authors: ['Anthony S. Owens'],
  },
}

export default function WhitepaperLayout({ children }: { children: React.ReactNode }) {
  return children
}
