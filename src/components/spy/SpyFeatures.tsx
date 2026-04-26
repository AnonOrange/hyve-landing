const features = [
  {
    color: '#00D4FF',
    icon: '◉',
    title: 'Live Scanner Audio',
    body:
      'Real-time police, fire, EMS, aviation and aircraft feeds from every state. Powered by OpenMHz + 4,000 verified Broadcastify direct streams. Tap any pin, audio plays.',
    stats: ['4,335 feeds', '50 states + DC', 'Police · Fire · EMS · Aviation'],
  },
  {
    color: '#FF2D2D',
    icon: '▲',
    title: 'Public Cameras Everywhere',
    body:
      'NYC TMC traffic, every state DOT (Caltrans, FL511, GA511, NY511, UT, PA, AZ, NV, AK, IA, HI, OR, NC, MD, VA & more), USGS volcanoes, NWS sky cams, EarthCam, NPS, ski resorts, Cornell wildlife, NASA ISS — all clickable, all live.',
    stats: ['~26,800 cameras', 'HLS · YouTube · MJPEG · Snapshot', 'Auto-refresh every 2s'],
  },
  {
    color: '#A855F7',
    icon: '✦',
    title: 'FOIA Request Generator',
    body:
      'Any incident you witness, hit "Generate FOIA" and download a fully-formatted, agency-specific Freedom of Information Act request as a fillable PDF. Includes incident timestamp, dispatch window, and exact records to demand.',
    stats: ['Fillable PDF', 'Incident-stamped', 'Per-agency contacts'],
  },
  {
    color: '#F59E0B',
    icon: '◈',
    title: 'Real-Time Crime Data',
    body:
      'Direct city open-data feeds — NYPD, Chicago, LAPD, SFPD, Boston PD, Philadelphia, Seattle. Last-7-days incidents per area, color-coded by intensity. FBI baseline coverage for 200+ smaller cities.',
    stats: ['7 city APIs live', '5,700+ incidents tracked', 'Refreshed every 30 min'],
  },
  {
    color: '#22C55E',
    icon: '◐',
    title: 'Tactical Dark Map',
    body:
      'Pinch-zoomable CARTO Dark Matter base layer — no Google Maps API key needed. 800+ pin clusters render smoothly. US-bounded so you stay on mission.',
    stats: ['CONUS + AK + HI', 'OSM-licensed', 'Offline-capable tiles'],
  },
  {
    color: '#00D4FF',
    icon: '⌖',
    title: 'Built-In Audio Pipeline',
    body:
      'Whisper STT auto-transcribes every transmission, scans for trigger keywords, raises burst alerts when a feed goes hot. Listener-spike detection finds breaking news before mainstream picks it up.',
    stats: ['Whisper-tiny.en on-device', 'Burst + spike + STT alerts', 'WebSocket push'],
  },
]

export default function SpyFeatures() {
  return (
    <section id="features" className="border-b border-[#0D2235] py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <span className="text-[#00D4FF] text-[10px] font-bold tracking-[0.2em] uppercase">
            ── Capabilities
          </span>
          <h2 className="text-4xl md:text-5xl font-black mt-3 leading-tight">
            Six tools.<br />One app.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#0D2235]">
          {features.map((f) => (
            <div key={f.title} className="bg-[#020D14] p-8 md:p-10">
              <div className="flex items-start gap-4 mb-4">
                <span
                  className="text-2xl font-black mt-1"
                  style={{ color: f.color }}
                >
                  {f.icon}
                </span>
                <h3 className="text-2xl md:text-3xl font-black">{f.title}</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-6">{f.body}</p>
              <div className="flex flex-wrap gap-2">
                {f.stats.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-mono tracking-wide px-2 py-1 border border-[#0D2235] rounded text-white/50"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
