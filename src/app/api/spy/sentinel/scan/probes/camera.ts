// Camera vendor detection probes. Checks the canonical paths for each major
// IP-camera vendor and flags exposed/auth-misconfigured devices.
import type { ProbeFinding } from './dns'

type VendorProbe = {
  vendor: string
  port: number
  path: string
  signature: RegExp | string
  /** What HTTP status indicates the cam is exposed (200 = no auth required;
   *  401 with default-creds risk = different finding). */
  exposedStatus: number[]
  exposureType: string
  severity: ProbeFinding['severity']
  remediation: { title: string; steps: string[] }
}

// Minimal but real probes for the major IP camera vendors.
const PROBES: VendorProbe[] = [
  {
    vendor: 'Hikvision',
    port: 80,
    path: '/doc/page/login.asp',
    signature: /Hikvision|Hik-?Connect|webs.*login/i,
    exposedStatus: [200],
    exposureType: 'unauthenticated_web_ui',
    severity: 'critical',
    remediation: {
      title: 'Hikvision DVR/NVR exposed without authentication',
      steps: [
        'Log into your Hikvision device locally (192.168.x.x via web browser).',
        'Configuration → System → Maintenance → Security Service. Disable Hik-Connect if unused.',
        'Configuration → Network → Advanced → Disable HTTP entirely (use HTTPS only).',
        'Set a strong admin password (12+ chars, mixed case + numbers + symbols).',
        'On your router, REMOVE the port-forward rule sending external traffic to the DVR.',
        'Use a VPN (WireGuard / Tailscale) for remote access instead.',
      ],
    },
  },
  {
    vendor: 'Hikvision',
    port: 8000,
    path: '/',
    signature: /Hikvision-Webs|Hikvision/i,
    exposedStatus: [200, 401], // 401 still leaks the vendor
    exposureType: 'hikvision_management_port_exposed',
    severity: 'high',
    remediation: {
      title: 'Hikvision management port (8000) reachable from the internet',
      steps: [
        'Port 8000 is the SDK/RTSP management port for Hikvision devices.',
        'Even if password-protected, exposure increases risk of brute force + known CVEs.',
        'On your firewall: block external access to port 8000 entirely.',
        'Use a VPN for remote access.',
      ],
    },
  },
  {
    vendor: 'Dahua',
    port: 80,
    path: '/cgi-bin/global.login.lua',
    signature: /Dahua|ipcamera|Login/i,
    exposedStatus: [200, 401],
    exposureType: 'dahua_default_credentials_risk',
    severity: 'high',
    remediation: {
      title: 'Dahua web UI exposed — likely default credentials',
      steps: [
        'Dahua devices ship with admin/admin or admin (no password).',
        'Log in and immediately change the admin password (Setup → System → Account).',
        'Setup → System → General → Date/Time → enable NTP (broken time weakens auth tokens).',
        'Setup → Network → UPnP → DISABLE (this is what auto-exposed the device).',
        'On your router: remove any UPnP-created port mappings.',
        'Update firmware (Setup → System → Maintain → Upgrade) — older firmware has known auth bypasses.',
      ],
    },
  },
  {
    vendor: 'Foscam',
    port: 88,
    path: '/cgi-bin/CGIProxy.fcgi?cmd=getDevState',
    signature: /Foscam|IPCam|getDevState/i,
    exposedStatus: [200],
    exposureType: 'foscam_unauthenticated',
    severity: 'high',
    remediation: {
      title: 'Foscam camera responding without authentication',
      steps: [
        'Open Foscam app or web UI and change admin password.',
        'Disable UPnP (Settings → Network → UPnP).',
        'Disable DDNS unless you specifically need remote access.',
        'Update firmware — Foscam patches several RCE vulns yearly.',
        'Disable ONVIF if you don\'t use external NVR software.',
      ],
    },
  },
  {
    vendor: 'Axis',
    port: 80,
    path: '/mjpg/video.mjpg',
    signature: /Server: Axis|axis/i,
    exposedStatus: [200],
    exposureType: 'axis_unauthenticated_video',
    severity: 'high',
    remediation: {
      title: 'Axis camera streaming MJPEG video without authentication',
      steps: [
        'Log into the Axis web UI as root.',
        'System → Users & Roles → confirm only authorized accounts exist.',
        'System → Network → HTTPS → enable and require HTTPS.',
        'System → Plain Config → search "AlwaysSendAuth" → set to "yes".',
        'System → Plain Config → search "AnonymousAccess" → disable.',
        'On your firewall: restrict access to the camera\'s IP or move it behind a VPN.',
      ],
    },
  },
  {
    vendor: 'Generic IP Cam',
    port: 554,
    path: '/',
    signature: /RTSP/i,
    exposedStatus: [200],
    exposureType: 'rtsp_no_auth',
    severity: 'medium',
    remediation: {
      title: 'RTSP stream port (554) reachable from the internet',
      steps: [
        'Most IP cameras expose RTSP on port 554. If reachable externally, anyone can attempt to stream.',
        'Log into your camera and require RTSP auth (Settings → Network → RTSP → Authentication: Digest).',
        'Change the RTSP port from 554 to a non-standard one (e.g. 8554).',
        'On your router: remove the port forward for 554/TCP.',
        'For remote viewing, use the camera vendor\'s app (encrypted) or VPN.',
      ],
    },
  },
]

export async function probeCameraVendors(host: string): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = []
  for (const probe of PROBES) {
    const url = `http://${host}:${probe.port}${probe.path}`
    try {
      const r = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
        redirect: 'manual',
      })
      if (!probe.exposedStatus.includes(r.status)) continue
      const body = await r.text().catch(() => '')
      const headerStr = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n')
      const haystack = `${body.slice(0, 4000)}\n${headerStr}`
      const sigRe = typeof probe.signature === 'string' ? new RegExp(probe.signature, 'i') : probe.signature
      if (sigRe.test(haystack)) {
        findings.push({
          severity: probe.severity,
          vendor: probe.vendor,
          exposure_type: probe.exposureType,
          port: probe.port,
          endpoint_path: probe.path,
          signature: r.headers.get('server') || sigRe.source,
          remediation_title: probe.remediation.title,
          remediation_steps: probe.remediation.steps,
        })
      }
    } catch { /* unreachable, skip */ }
  }
  return findings
}
