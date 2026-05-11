// /caseline/server-docs — CaseLine Server installation + admin guide.
// Replaces the previous broken link to docs.hyveapp.co/caseline/server.

import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'CaseLine Server — Installation & Admin Guide',
  description:
    'Self-host the Hyve CaseLine Server inside your firm. Four install paths (Docker, Windows service, Linux systemd, bare-metal) plus first-admin bootstrap, TLS, and troubleshooting.',
}

const ACCENT = '#00B4D8'

export default function ServerDocsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070a] font-sans text-[#ede8d8]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 100' fill='none' stroke='%23C8A227' stroke-width='1'><polygon points='28,2 54,16 54,46 28,60 2,46 2,16'/><polygon points='28,42 54,56 54,86 28,100 2,86 2,56'/></svg>\")",
          backgroundSize: '56px 100px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-25"
        style={{ background: 'radial-gradient(ellipse at top, rgba(0,180,216,0.30), transparent 70%)' }}
      />

      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/hyve-logo/hyve-messenger-emblem.png" alt="Hyve" width={64} height={64} className="h-9 w-9" priority />
          <span
            className="text-sm font-black tracking-[0.3em]"
            style={{
              background: 'linear-gradient(135deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: 'transparent',
            }}
          >
            HYVE / CASELINE / DOCS
          </span>
        </Link>
        <nav className="hidden gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55] md:flex">
          <Link href="/caseline" className="transition hover:text-[#00B4D8]">← CASELINE</Link>
          <Link href="/caseline/download" className="transition hover:text-[#00B4D8]">DOWNLOAD</Link>
          <a href="#docker" className="transition hover:text-[#00B4D8]">DOCKER</a>
          <a href="#windows" className="transition hover:text-[#00B4D8]">WINDOWS</a>
          <a href="#linux" className="transition hover:text-[#00B4D8]">LINUX</a>
          <a href="#firstadmin" className="transition hover:text-[#00B4D8]">FIRST ADMIN</a>
          <a href="#tls" className="transition hover:text-[#00B4D8]">TLS</a>
          <a href="#troubleshoot" className="transition hover:text-[#00B4D8]">TROUBLESHOOT</a>
        </nav>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-12 md:py-16">
        <div className="font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>
          CASELINE SERVER · SETUP &amp; ADMIN GUIDE
        </div>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">Self-host the firm hub.</h1>
        <p className="mt-4 text-base leading-relaxed text-[#9e8a55]">
          CaseLine Server is the on-premises sync hub for a firm&rsquo;s CaseLine workstations.
          It exposes a REST + WebSocket API on port 8443 backed by a single-file SQLite
          database, and proxies LLM requests to a local Ollama instance so every workstation
          shares one model and one set of weights.
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-black">What you get</h2>
          <ul className="mt-4 space-y-2 text-sm text-[#ede8d8]">
            <li>▸ Central case storage (SQLite at <code className="text-[#00B4D8]">/data/caseline.sqlite</code>)</li>
            <li>▸ Real-time WebSocket sync — every case change broadcasts to connected workstations</li>
            <li>▸ JWT auth with first-user-becomes-admin bootstrap</li>
            <li>▸ Optional LLM proxy to a local Ollama (one model, every seat queries it)</li>
            <li>▸ Audit log endpoint for ABA Model Rule 1.6 documentation</li>
            <li>▸ Binary file storage for case attachments (MIME-allowlisted)</li>
          </ul>
        </section>

        <section id="docker" className="mt-12">
          <h2 className="text-2xl font-black">A. Docker — recommended</h2>
          <p className="mt-2 text-sm text-[#9e8a55]">
            Easiest path. The bundled <code className="text-[#00B4D8]">docker-compose.yml</code> brings up
            CaseLine Server <em>and</em> Ollama on the same internal network.
          </p>
          <pre className="mt-4 overflow-auto rounded border border-[#2a2135] bg-black/60 p-4 text-xs text-[#ede8d8]">
{`# 1. Get the server bundle (request the build at majixx@vibesoftwaresolutions.com)
unzip caseline-server.zip && cd caseline-server

# 2. Set CASELINE_SECRET — required in production
cp .env.example .env
# Linux/macOS:
openssl rand -hex 32 | xargs -I {} sed -i 's/CASELINE_SECRET=$/CASELINE_SECRET={}/' .env

# 3. Bring it up
docker compose up -d

# 4. Pull a model into the bundled Ollama
docker compose exec ollama ollama pull llama3.1:8b`}
          </pre>
          <p className="mt-3 text-xs text-[#6b5e3a]">
            Workstations point at <code className="text-[#00B4D8]">http://&lt;server-ip&gt;:8443</code>.
          </p>
        </section>

        <section id="windows" className="mt-12">
          <h2 className="text-2xl font-black">B. Windows service (NSSM)</h2>
          <p className="mt-2 text-sm text-[#9e8a55]">
            Prereqs: Node.js 20+, <a href="https://nssm.cc" target="_blank" rel="noopener noreferrer" className="text-[#00B4D8] underline">NSSM</a> on PATH (<code>choco install nssm</code>).
          </p>
          <pre className="mt-4 overflow-auto rounded border border-[#2a2135] bg-black/60 p-4 text-xs text-[#ede8d8]">
{`# From an elevated PowerShell
.\\install-windows-service.ps1
# Service registers as HyveCaseLineServer, auto-starts on boot,
# restarts on failure, logs rotated at 16 MB to data\\logs\\

# Open the firewall
New-NetFirewallRule -DisplayName 'CaseLine Server' \`
  -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow

# Uninstall:    .\\install-windows-service.ps1 -Uninstall
# Restart:      .\\install-windows-service.ps1 -Restart`}
          </pre>
        </section>

        <section id="linux" className="mt-12">
          <h2 className="text-2xl font-black">C. Linux systemd</h2>
          <p className="mt-2 text-sm text-[#9e8a55]">
            Security-hardened systemd unit ships in the bundle as <code className="text-[#00B4D8]">caseline-server.service</code>.
          </p>
          <pre className="mt-4 overflow-auto rounded border border-[#2a2135] bg-black/60 p-4 text-xs text-[#ede8d8]">
{`sudo cp caseline-server.service /etc/systemd/system/
sudo useradd --system --shell /usr/sbin/nologin --home-dir /opt/caseline-server caseline
sudo mkdir -p /opt/caseline-server /var/lib/caseline-server
sudo cp -r ./* /opt/caseline-server/
sudo chown -R caseline:caseline /opt/caseline-server /var/lib/caseline-server
sudo -u caseline npm --prefix /opt/caseline-server install --omit=dev

# Required JWT secret
echo "CASELINE_SECRET=$(openssl rand -hex 32)" | sudo tee /etc/caseline-server.env
sudo chmod 600 /etc/caseline-server.env

# Start it
sudo systemctl daemon-reload
sudo systemctl enable --now caseline-server
sudo systemctl status caseline-server

# View logs:    journalctl -u caseline-server -f
# Firewall:     sudo firewall-cmd --permanent --add-port=8443/tcp && sudo firewall-cmd --reload`}
          </pre>
        </section>

        <section id="firstadmin" className="mt-12">
          <h2 className="text-2xl font-black">First admin bootstrap</h2>
          <p className="mt-2 text-sm text-[#9e8a55]">
            The first user to register becomes the admin. After that, additional users require an admin token to register.
          </p>
          <pre className="mt-4 overflow-auto rounded border border-[#2a2135] bg-black/60 p-4 text-xs text-[#ede8d8]">
{`# Bootstrap (first user → admin role)
curl -X POST http://<server-ip>:8443/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@firm.com","password":"min-8-chars"}'

# Returns a JWT in {token,role}. Save it.

# Register additional users:
curl -X POST http://<server-ip>:8443/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"paralegal@firm.com","password":"min-8-chars","adminToken":"<paste admin JWT>"}'`}
          </pre>
          <p className="mt-3 text-xs text-[#6b5e3a]">
            In the desktop app: <strong className="text-[#ede8d8]">WORKSPACE → SETTINGS → SERVER</strong> →
            enter the URL + email + password.
          </p>
        </section>

        <section id="tls" className="mt-12">
          <h2 className="text-2xl font-black">TLS / reverse proxy</h2>
          <p className="mt-2 text-sm text-[#9e8a55]">
            The server speaks plain HTTP on 8443. For anything outside the local firm network, terminate TLS at a reverse proxy:
          </p>
          <pre className="mt-4 overflow-auto rounded border border-[#2a2135] bg-black/60 p-4 text-xs text-[#ede8d8]">
{`# nginx
server {
  listen 443 ssl http2;
  server_name caseline.firm.example.com;
  ssl_certificate     /etc/ssl/firm/fullchain.pem;
  ssl_certificate_key /etc/ssl/firm/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:8443;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}`}
          </pre>
        </section>

        <section id="ollama" className="mt-12">
          <h2 className="text-2xl font-black">Optional — local LLM via Ollama</h2>
          <p className="mt-2 text-sm text-[#9e8a55]">
            The Docker compose stack already includes Ollama. For non-Docker installs:
          </p>
          <pre className="mt-4 overflow-auto rounded border border-[#2a2135] bg-black/60 p-4 text-xs text-[#ede8d8]">
{`# Install Ollama: https://ollama.com (single-line installer)
ollama pull llama3.1:8b

# Server reads OLLAMA_URL (default http://127.0.0.1:11434)
# and OLLAMA_MODEL (default llama3.1:8b). Override via env vars.
OLLAMA_MODEL=hermes3:8b npm start`}
          </pre>
        </section>

        <section id="troubleshoot" className="mt-12">
          <h2 className="text-2xl font-black">Troubleshooting</h2>
          <dl className="mt-4 space-y-4 text-sm text-[#ede8d8]">
            <div>
              <dt className="font-bold">Server won&rsquo;t start: &quot;CASELINE_SECRET is required in production&quot;</dt>
              <dd className="mt-1 text-[#9e8a55]">
                Generate a 32-byte hex secret and pass it via env. The server refuses to use an ephemeral auto-generated value in production mode.
              </dd>
            </div>
            <div>
              <dt className="font-bold">Workstation says &quot;Connecting…&quot; forever</dt>
              <dd className="mt-1 text-[#9e8a55]">
                Confirm the firm&rsquo;s firewall allows TCP 8443 from workstation subnet → server. Test with{' '}
                <code className="text-[#00B4D8]">curl http://&lt;server-ip&gt;:8443/health</code> — should return JSON.
              </dd>
            </div>
            <div>
              <dt className="font-bold">CaSeY says &quot;LLM unreachable&quot; on the workstation</dt>
              <dd className="mt-1 text-[#9e8a55]">
                Ollama is either not running or the model isn&rsquo;t pulled. Run{' '}
                <code className="text-[#00B4D8]">ollama list</code> on the server to confirm.
              </dd>
            </div>
            <div>
              <dt className="font-bold">Audit log on the desktop is empty</dt>
              <dd className="mt-1 text-[#9e8a55]">
                You&rsquo;re running in stand-alone (Firebase) mode. The audit log endpoint is only populated when the workstation is configured to use a CaseLine Server.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-12 rounded-xl border-2 p-6" style={{ borderColor: ACCENT, background: `${ACCENT}10` }}>
          <h3 className="text-base font-black text-[#ede8d8]">Need a build?</h3>
          <p className="mt-2 text-sm text-[#9e8a55]">
            CaseLine Server is currently shipped on request — email{' '}
            <a href="mailto:majixx@vibesoftwaresolutions.com?subject=CaseLine%20Server%20-%20request%20build"
               className="font-bold text-[#00B4D8] underline-offset-4 hover:underline">
              majixx@vibesoftwaresolutions.com
            </a>{' '}
            with your firm size + preferred deployment path (Docker / Windows / Linux) and we&rsquo;ll send the bundle and license.
          </p>
        </section>
      </article>

      <footer className="relative z-10 mt-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-col items-center gap-2 border-b border-[#2a2135] pb-6 text-center">
            <div className="font-mono text-[9px] tracking-[0.4em] text-[#6b5e3a]">CREATED BY</div>
            <p className="text-sm font-bold tracking-[0.15em] text-[#ede8d8]">ANTHONY S. OWENS</p>
            <p className="text-[11px] text-[#9e8a55]">
              c/o{' '}
              <a href="https://www.vibesoftwaresolutions.com" target="_blank" rel="noopener noreferrer"
                 className="text-[#E8C456] underline-offset-4 hover:underline">
                Vibe Software Solutions
              </a>
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">© 2026 HYVE CASELINE</span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a]">
              <Link href="/caseline" className="hover:text-[#00B4D8]">CASELINE</Link>
              <Link href="/caseline/download" className="hover:text-[#00B4D8]">DOWNLOAD</Link>
              <Link href="/caseline/buy" className="hover:text-[#00B4D8]">BUY</Link>
              <a href="mailto:majixx@vibesoftwaresolutions.com" className="hover:text-[#E8C456]">SALES</a>
              <a href="mailto:support@hyveapp.co" className="hover:text-[#E8C456]">SUPPORT</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
