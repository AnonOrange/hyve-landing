import type { Metadata } from 'next'
import AppShell from '@/components/app/AppShell'

export const metadata: Metadata = {
  title: 'HYVE — Encrypted Messenger',
  description: 'Send end-to-end encrypted messages directly in your browser.',
}

export default function AppPage() {
  return <AppShell />
}
