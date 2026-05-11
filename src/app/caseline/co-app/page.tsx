// Co-App entry — server-component shim that mounts the client shell.
// The PWA manifest + service worker registration live in layout.tsx.

import CoAppShell from './CoAppShell'

export default function CoAppPage() {
  return <CoAppShell />
}
