// TCP port-open probes. Detects exposed database ports, common admin ports,
// etc — using bare TCP connect (no SYN scan, just open/close like any client).
import * as net from 'node:net'
import type { ProbeFinding } from './dns'

const DB_PORTS: Array<{ port: number; service: string; product: string }> = [
  { port: 3306,  service: 'MySQL',     product: 'MySQL' },
  { port: 5432,  service: 'Postgres',  product: 'PostgreSQL' },
  { port: 6379,  service: 'Redis',     product: 'Redis' },
  { port: 27017, service: 'MongoDB',   product: 'MongoDB' },
  { port: 9200,  service: 'Elasticsearch', product: 'Elasticsearch' },
  { port: 5984,  service: 'CouchDB',   product: 'CouchDB' },
  { port: 11211, service: 'Memcached', product: 'Memcached' },
]

/**
 * Probe a host for exposed database ports. ANY of these reachable from outside
 * is a critical finding — DBs should never be on the public internet.
 */
export async function probeDatabasePorts(host: string): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = []
  // Race all probes in parallel — each is a 3s connect timeout
  const results = await Promise.all(
    DB_PORTS.map(async (p) => ({
      port: p,
      open: await tcpConnect(host, p.port, 3000),
    })),
  )
  for (const r of results) {
    if (!r.open) continue
    findings.push({
      severity: 'critical',
      vendor: 'Network',
      exposure_type: 'open_database_port',
      port: r.port.port,
      endpoint_path: r.port.service.toLowerCase(),
      signature: `${r.port.product} TCP/${r.port.port} accepting connections from public internet`,
      remediation_title: `${r.port.product} (${r.port.port}/tcp) exposed to the public internet`,
      remediation_steps: [
        `Databases should NEVER be reachable from the public internet.`,
        `On your firewall (cloud security group / ufw / iptables): block inbound ${r.port.port}/tcp.`,
        `  ufw deny ${r.port.port}/tcp`,
        `Configure ${r.port.product} to bind only to 127.0.0.1 or your private VPC subnet.`,
        `Move app-to-DB traffic over a private network or SSH tunnel.`,
        `Verify from another machine: \`nc -zv ${host} ${r.port.port}\` — should fail after the fix.`,
      ],
    })
  }
  return findings
}

function tcpConnect(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false
    const finish = (open: boolean) => { if (!resolved) { resolved = true; try { socket.destroy() } catch {}; resolve(open) } }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, host)
  })
}
