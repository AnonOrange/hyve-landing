// Curated catalog of public broadcasts that stream 24/7 (or the closest
// thing to it). Each entry is an official, free, publicly-accessible stream
// — typically the broadcaster's own YouTube Live channel.
//
// Editorial policy:
//   - Only OFFICIAL channels.
//   - Streams must be 24/7 OR scheduled-recurring (legislatures in session).
//   - State-aligned broadcasters labelled with the country `flag` so users
//     see editorial control at a glance.
//   - lat/lng = broadcaster's primary studio HQ city (or filming location
//     for webcams). The TV map plots a marker at exactly this point.
//
// This is the "highlights" layer. The TV page also bulk-loads iptv-org's
// open dataset (~10k free channels worldwide) and plots them at country
// centroid, giving genuine global coverage.

export type BroadcastCategory =
  | 'news'
  | 'government'
  | 'space'
  | 'events'
  | 'nature'
  | 'music'

export type Broadcast = {
  id: string
  name: string
  agency: string
  category: BroadcastCategory
  description: string
  flag?: string
  // Geographic location to plot the pin. For news this is the studio HQ
  // city (NBC at 30 Rock, BBC at Broadcasting House etc); for webcams it's
  // the filming location.
  lat: number
  lng: number
  // ONE of these must be set:
  youtubeChannelId?: string
  youtubeVideoId?: string
  hlsUrl?: string
  iframeUrl?: string
  schedule: 'continuous' | 'when-in-session' | 'recurring'
  tags?: string[]
}

export const BROADCASTS: Broadcast[] = [
  // ───── 24/7 NEWS — US ─────
  {
    id: 'abc-news-live',
    name: 'ABC News Live',
    agency: 'ABC News',
    category: 'news',
    flag: '🇺🇸',
    description: '24/7 US national + breaking news from ABC.',
    lat: 40.7644, lng: -73.9846, // 7 W 66th St, NYC
    youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fU18Q',
    schedule: 'continuous',
    tags: ['us', 'national'],
  },
  {
    id: 'nbc-news-now',
    name: 'NBC News NOW',
    agency: 'NBC News',
    category: 'news',
    flag: '🇺🇸',
    description: '24/7 streaming news from NBC.',
    lat: 40.7595, lng: -73.9794, // 30 Rockefeller Plaza, NYC
    youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
    schedule: 'continuous',
    tags: ['us'],
  },
  {
    id: 'cbs-news',
    name: 'CBS News 24/7',
    agency: 'CBS News',
    category: 'news',
    flag: '🇺🇸',
    description: 'CBS streaming news network.',
    lat: 40.7674, lng: -73.9819, // CBS Broadcast Center, NYC
    youtubeChannelId: 'UC8p1vwvWtl6T73JiExfWs1g',
    schedule: 'continuous',
    tags: ['us'],
  },
  {
    id: 'bloomberg-tv',
    name: 'Bloomberg Television',
    agency: 'Bloomberg',
    category: 'news',
    flag: '🇺🇸',
    description: 'Global business + markets, live.',
    lat: 40.7614, lng: -73.9716, // 731 Lexington Ave, NYC
    youtubeChannelId: 'UCIALMKvObZNtJ6AmdCLP7Lg',
    schedule: 'continuous',
    tags: ['markets'],
  },
  {
    id: 'forbes-talks',
    name: 'Forbes Live',
    agency: 'Forbes',
    category: 'news',
    flag: '🇺🇸',
    description: 'Forbes business news + interviews live.',
    lat: 40.7536, lng: -73.9832,
    youtubeChannelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    schedule: 'recurring',
    tags: ['business'],
  },
  {
    id: 'pbs-newshour',
    name: 'PBS NewsHour',
    agency: 'PBS',
    category: 'news',
    flag: '🇺🇸',
    description: 'US public broadcaster nightly news + live coverage.',
    lat: 38.8951, lng: -77.0364, // Arlington, VA HQ
    youtubeChannelId: 'UC6ZFN9Tx6xh-skXCuRHCDpQ',
    schedule: 'recurring',
    tags: ['us', 'public-media'],
  },
  {
    id: 'newsmax',
    name: 'Newsmax',
    agency: 'Newsmax',
    category: 'news',
    flag: '🇺🇸',
    description: '24/7 conservative news network.',
    lat: 26.6964, lng: -80.0506, // Boca Raton, FL
    youtubeChannelId: 'UCx6h-dWzJ5NpAlja1YsApdg',
    schedule: 'continuous',
    tags: ['us'],
  },

  // ───── 24/7 NEWS — UK / EUROPE ─────
  {
    id: 'sky-news',
    name: 'Sky News',
    agency: 'Sky News (UK)',
    category: 'news',
    flag: '🇬🇧',
    description: 'UK 24/7 news, often first on European breaking stories.',
    lat: 51.4843, lng: -0.2229, // Osterley, London
    youtubeChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
    schedule: 'continuous',
    tags: ['uk'],
  },
  {
    id: 'gb-news',
    name: 'GB News',
    agency: 'GB News',
    category: 'news',
    flag: '🇬🇧',
    description: 'UK news + opinion network, 24/7.',
    lat: 51.4986, lng: -0.1235, // Westminster, London
    youtubeChannelId: 'UC8GIFZPYO5OflG_KeYMHBcg',
    schedule: 'continuous',
    tags: ['uk'],
  },
  {
    id: 'france-24-english',
    name: 'France 24 English',
    agency: 'France Médias Monde',
    category: 'news',
    flag: '🇫🇷',
    description: 'French public broadcaster, English service.',
    lat: 48.8255, lng: 2.2674, // Issy-les-Moulineaux, Paris
    youtubeChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    schedule: 'continuous',
    tags: ['europe'],
  },
  {
    id: 'dw-english',
    name: 'DW News',
    agency: 'Deutsche Welle',
    category: 'news',
    flag: '🇩🇪',
    description: 'German public broadcaster, English service.',
    lat: 50.9215, lng: 6.9822, // Bonn HQ
    youtubeChannelId: 'UCknLrEdhRCp1aegoMqRaCZg',
    schedule: 'continuous',
    tags: ['europe'],
  },
  {
    id: 'euronews',
    name: 'Euronews',
    agency: 'Euronews',
    category: 'news',
    flag: '🇪🇺',
    description: 'Pan-European news, English service.',
    lat: 45.7822, lng: 4.8794, // Lyon HQ
    youtubeChannelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q',
    schedule: 'continuous',
    tags: ['europe'],
  },
  {
    id: 'rt-news',
    name: 'RT News',
    agency: 'RT (Russia state-affiliated)',
    category: 'news',
    flag: '🇷🇺',
    description: 'Russian state-funded broadcaster. Listed for OSINT comparison.',
    lat: 55.7611, lng: 37.6273, // Moscow HQ
    youtubeChannelId: 'UCpwvZwUam-URkxB7g4USKpg',
    schedule: 'continuous',
    tags: ['state-media'],
  },
  {
    id: 'tvp-world',
    name: 'TVP World',
    agency: 'TVP (Polish public TV)',
    category: 'news',
    flag: '🇵🇱',
    description: 'Polish public TV, English-language international service.',
    lat: 52.2169, lng: 20.9908, // Woronicza, Warsaw
    youtubeChannelId: 'UCvEixI4ehl8JCeSgWWSeXuQ',
    schedule: 'continuous',
    tags: ['europe'],
  },
  {
    id: 'tldr-newsdaily',
    name: 'TLDR News Daily Live',
    agency: 'TLDR News',
    category: 'news',
    flag: '🇬🇧',
    description: 'Daily news digest live from London.',
    lat: 51.5074, lng: -0.1278,
    youtubeChannelId: 'UCSMqateX8OA8YFRuSzaywmQ',
    schedule: 'recurring',
    tags: ['uk', 'digest'],
  },

  // ───── 24/7 NEWS — MIDDLE EAST ─────
  {
    id: 'al-jazeera-english',
    name: 'Al Jazeera English',
    agency: 'Al Jazeera',
    category: 'news',
    flag: '🇶🇦',
    description: 'Global news with strong Middle East + Global South coverage.',
    lat: 25.3261, lng: 51.5223, // Doha HQ
    youtubeChannelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
    schedule: 'continuous',
    tags: ['middle-east'],
  },
  {
    id: 'i24-english',
    name: 'i24 News English',
    agency: 'i24NEWS',
    category: 'news',
    flag: '🇮🇱',
    description: 'Israeli international news, English service.',
    lat: 32.0853, lng: 34.7818, // Tel Aviv HQ
    youtubeChannelId: 'UCwhg0HdoWjxhglb_dW9C3Fw',
    schedule: 'continuous',
    tags: ['middle-east'],
  },
  {
    id: 'kan-english',
    name: 'KAN English',
    agency: 'Kan / Israeli Public Broadcasting',
    category: 'news',
    flag: '🇮🇱',
    description: 'Israeli public broadcaster English news service.',
    lat: 31.7683, lng: 35.2137, // Jerusalem HQ
    youtubeChannelId: 'UCN-DwIBoyxOSF_5g3VxXp9w',
    schedule: 'recurring',
    tags: ['middle-east'],
  },
  {
    id: 'press-tv',
    name: 'Press TV',
    agency: 'Press TV (Iran state)',
    category: 'news',
    flag: '🇮🇷',
    description: 'Iranian state-run English-language news. Listed for OSINT comparison.',
    lat: 35.6892, lng: 51.3890, // Tehran HQ
    youtubeChannelId: 'UCmZEryDIeqBXl1KuWO2I8Pw',
    schedule: 'continuous',
    tags: ['state-media'],
  },

  // ───── 24/7 NEWS — ASIA / PACIFIC ─────
  {
    id: 'nhk-world',
    name: 'NHK World-Japan',
    agency: 'NHK',
    category: 'news',
    flag: '🇯🇵',
    description: 'Japanese public broadcaster, English service.',
    lat: 35.6648, lng: 139.6940, // Shibuya, Tokyo
    youtubeChannelId: 'UCSPEjw8F2nQDtmUKPFNF7_A',
    schedule: 'continuous',
    tags: ['asia'],
  },
  {
    id: 'cna-singapore',
    name: 'CNA (Channel News Asia)',
    agency: 'Mediacorp',
    category: 'news',
    flag: '🇸🇬',
    description: 'Singapore-based pan-Asia news.',
    lat: 1.3318, lng: 103.7768, // Mediacorp Campus
    youtubeChannelId: 'UCkM5j0UJG7suHQYHrChVptw',
    schedule: 'continuous',
    tags: ['asia'],
  },
  {
    id: 'cgtn',
    name: 'CGTN',
    agency: 'CGTN (China state-media)',
    category: 'news',
    flag: '🇨🇳',
    description: 'China state-run international broadcaster. Listed for OSINT comparison.',
    lat: 39.9163, lng: 116.3972, // Beijing HQ
    youtubeChannelId: 'UCM5w6XGeYMa1VRTSvz3iJgg',
    schedule: 'continuous',
    tags: ['state-media'],
  },
  {
    id: 'wion',
    name: 'WION',
    agency: 'World Is One News (India)',
    category: 'news',
    flag: '🇮🇳',
    description: 'Indian English-language international news.',
    lat: 28.5012, lng: 77.0824, // Gurgaon HQ
    youtubeChannelId: 'UC_gUM8rL-Lrg6O3adPW9K1g',
    schedule: 'continuous',
    tags: ['asia'],
  },
  {
    id: 'tasi-tv-australia',
    name: 'ABC News Australia',
    agency: 'Australian Broadcasting Corporation',
    category: 'news',
    flag: '🇦🇺',
    description: 'Australian public broadcaster live news.',
    lat: -33.8568, lng: 151.2093, // Ultimo, Sydney
    youtubeChannelId: 'UCVgO39Bk5sMo66-6o6Spn6Q',
    schedule: 'continuous',
    tags: ['oceania'],
  },

  // ───── 24/7 NEWS — AFRICA / LATAM ─────
  {
    id: 'tvc-news',
    name: 'TVC News',
    agency: 'TVC News (Nigeria)',
    category: 'news',
    flag: '🇳🇬',
    description: 'Nigeria-based pan-African news.',
    lat: 6.4474, lng: 3.4138, // Lagos
    youtubeChannelId: 'UCkVZRRBI0bkz5_jZjLJZNUg',
    schedule: 'continuous',
    tags: ['africa'],
  },
  {
    id: 'sabc-news',
    name: 'SABC News',
    agency: 'South African Broadcasting Corporation',
    category: 'news',
    flag: '🇿🇦',
    description: 'South Africa public broadcaster live news.',
    lat: -26.1764, lng: 28.0392, // Auckland Park, Johannesburg
    youtubeChannelId: 'UCb6n_xb_g-Sjly7Bn3I2WTw',
    schedule: 'continuous',
    tags: ['africa'],
  },

  // ───── GOVERNMENT / LEGISLATIVE ─────
  {
    id: 'cspan',
    name: 'C-SPAN Live',
    agency: 'C-SPAN',
    category: 'government',
    flag: '🇺🇸',
    description: 'US Congress floor proceedings + government events.',
    lat: 38.9072, lng: -77.0369, // DC
    youtubeChannelId: 'UCb--64Gl51jIEVE-GLDAVTg',
    schedule: 'when-in-session',
    tags: ['us', 'congress'],
  },
  {
    id: 'whitehouse',
    name: 'The White House',
    agency: 'White House',
    category: 'government',
    flag: '🇺🇸',
    description: 'Official White House briefings + events.',
    lat: 38.8977, lng: -77.0365,
    youtubeChannelId: 'UCYxRlFDqcWM4y7FfpiAN3KQ',
    schedule: 'recurring',
    tags: ['us'],
  },
  {
    id: 'uk-parliament',
    name: 'UK Parliament',
    agency: 'UK Parliament',
    category: 'government',
    flag: '🇬🇧',
    description: 'House of Commons + Lords live coverage.',
    lat: 51.4995, lng: -0.1248, // Westminster
    youtubeChannelId: 'UCNVfeqd2rGyqgXxiGE1qOZA',
    schedule: 'when-in-session',
    tags: ['uk'],
  },
  {
    id: 'eu-council',
    name: 'EU Council Newsroom',
    agency: 'European Council',
    category: 'government',
    flag: '🇪🇺',
    description: 'EU Council press conferences + summits.',
    lat: 50.8424, lng: 4.3819, // Brussels
    youtubeChannelId: 'UCXi3FeTFKnIqYhyhixwPFFA',
    schedule: 'recurring',
    tags: ['europe'],
  },
  {
    id: 'un-web-tv',
    name: 'United Nations',
    agency: 'United Nations',
    category: 'government',
    flag: '🇺🇳',
    description: 'UN Security Council, General Assembly, press briefings.',
    lat: 40.7489, lng: -73.9680, // UN HQ NYC
    youtubeChannelId: 'UC8hgUtVlGdJzJaaPK5MVgPA',
    schedule: 'recurring',
    tags: ['international'],
  },
  {
    id: 'european-parliament',
    name: 'European Parliament',
    agency: 'European Parliament',
    category: 'government',
    flag: '🇪🇺',
    description: 'EU Parliament plenary sessions + committee hearings.',
    lat: 49.5310, lng: 8.6739, // Strasbourg
    youtubeChannelId: 'UCv8N6L1S-YxIxe7Lavd1OOQ',
    schedule: 'when-in-session',
    tags: ['europe'],
  },

  // ───── SPACE ─────
  {
    id: 'nasa-tv',
    name: 'NASA TV Public',
    agency: 'NASA',
    category: 'space',
    flag: '🇺🇸',
    description: 'NASA mission control, launches, press briefings.',
    lat: 29.5587, lng: -95.0905, // Johnson Space Center, Houston
    youtubeChannelId: 'UCLA_DiR1FfKNvjuUpBHmylQ',
    schedule: 'continuous',
    tags: ['nasa'],
  },
  {
    id: 'iss-live',
    name: 'ISS High-Definition Earth Viewing',
    agency: 'NASA',
    category: 'space',
    flag: '🇺🇸',
    description: 'Live cameras aboard the International Space Station.',
    lat: 0, lng: 0, // ISS orbits — placed at equator/prime meridian symbolically
    youtubeVideoId: 'jPMakQDmcBM',
    schedule: 'continuous',
    tags: ['iss', 'orbit'],
  },
  {
    id: 'spacex-live',
    name: 'SpaceX',
    agency: 'SpaceX',
    category: 'space',
    flag: '🇺🇸',
    description: 'SpaceX launches + Starship test flights.',
    lat: 25.9968, lng: -97.1572, // Starbase Boca Chica
    youtubeChannelId: 'UCtI0Hodo5o5dUb67FeUjDeA',
    schedule: 'recurring',
    tags: ['spacex'],
  },
  {
    id: 'esa',
    name: 'European Space Agency',
    agency: 'ESA',
    category: 'space',
    flag: '🇪🇺',
    description: 'ESA mission coverage + briefings.',
    lat: 48.8295, lng: 2.3197, // ESA HQ Paris
    youtubeChannelId: 'UCIBaDdAbGlFDeS33shmlD0A',
    schedule: 'recurring',
    tags: ['esa'],
  },

  // ───── EVENTS / WEBCAMS ─────
  {
    id: 'times-square-cam',
    name: 'Times Square (NYC)',
    agency: 'EarthCam',
    category: 'events',
    flag: '🇺🇸',
    description: 'Live view of Times Square, New York City.',
    lat: 40.7580, lng: -73.9855,
    youtubeVideoId: 'AdUw5RdyZxI',
    schedule: 'continuous',
    tags: ['nyc'],
  },
  {
    id: 'abbey-road',
    name: 'Abbey Road Crossing',
    agency: 'Abbey Road Studios',
    category: 'events',
    flag: '🇬🇧',
    description: 'Live cam of the famous Beatles album crossing in London.',
    lat: 51.5320, lng: -0.1779,
    youtubeVideoId: 'kTd2sMyyORQ',
    schedule: 'continuous',
    tags: ['london'],
  },
  {
    id: 'shibuya-crossing',
    name: 'Shibuya Crossing (Tokyo)',
    agency: 'Live from Tokyo',
    category: 'events',
    flag: '🇯🇵',
    description: 'World\'s busiest pedestrian crossing, live.',
    lat: 35.6595, lng: 139.7004,
    youtubeVideoId: '3kPH7kTphnE',
    schedule: 'continuous',
    tags: ['tokyo'],
  },
  {
    id: 'venice-st-marks',
    name: "St Mark's Square (Venice)",
    agency: 'SkylineWebcams',
    category: 'events',
    flag: '🇮🇹',
    description: "Live view of St Mark's Square, Venice.",
    lat: 45.4341, lng: 12.3388,
    youtubeVideoId: 'B9twzDuT58c',
    schedule: 'continuous',
    tags: ['venice'],
  },
  {
    id: 'eiffel-tower',
    name: 'Eiffel Tower Live',
    agency: 'SkylineWebcams',
    category: 'events',
    flag: '🇫🇷',
    description: 'Live cam pointed at the Eiffel Tower.',
    lat: 48.8584, lng: 2.2945,
    youtubeVideoId: 'ZO-BEUI6F1k',
    schedule: 'continuous',
    tags: ['paris'],
  },
  {
    id: 'dubai-skyline',
    name: 'Dubai Skyline / Burj Khalifa',
    agency: 'EarthCam',
    category: 'events',
    flag: '🇦🇪',
    description: 'Live view of the Dubai skyline.',
    lat: 25.1972, lng: 55.2744,
    youtubeVideoId: 'fOUYM6BQUUQ',
    schedule: 'continuous',
    tags: ['dubai'],
  },

  // ───── NATURE ─────
  {
    id: 'old-faithful',
    name: 'Old Faithful Geyser',
    agency: 'NPS / Yellowstone',
    category: 'nature',
    flag: '🇺🇸',
    description: 'Yellowstone Old Faithful geyser webcam.',
    lat: 44.4605, lng: -110.8281,
    youtubeVideoId: 'fOrl-Q14WSc',
    schedule: 'continuous',
    tags: ['yellowstone'],
  },
  {
    id: 'african-watering-hole',
    name: 'Tembe Elephant Park',
    agency: 'WildEarth',
    category: 'nature',
    flag: '🇿🇦',
    description: 'Live African wildlife at a Tembe watering hole.',
    lat: -27.0333, lng: 32.4167,
    youtubeVideoId: 'ydYDqZQpim8',
    schedule: 'continuous',
    tags: ['wildlife'],
  },
  {
    id: 'aurora-cam',
    name: 'Northern Lights Live',
    agency: 'Explore.org',
    category: 'nature',
    flag: '🇨🇦',
    description: 'Aurora borealis cam from Churchill, Manitoba.',
    lat: 58.7684, lng: -94.1650,
    youtubeVideoId: 'qaJyHWnxiTg',
    schedule: 'continuous',
    tags: ['aurora'],
  },
  {
    id: 'katmai-bears',
    name: 'Brooks Falls Bears',
    agency: 'Explore.org / Katmai NP',
    category: 'nature',
    flag: '🇺🇸',
    description: 'Brown bears fishing at Brooks Falls, Alaska (seasonal but live in season).',
    lat: 58.5571, lng: -155.7780,
    youtubeVideoId: 'lyFm3WfzKZQ',
    schedule: 'recurring',
    tags: ['alaska', 'wildlife'],
  },
  {
    id: 'monterey-bay',
    name: 'Monterey Bay Aquarium',
    agency: 'Monterey Bay Aquarium',
    category: 'nature',
    flag: '🇺🇸',
    description: 'Live aquarium tank cams.',
    lat: 36.6182, lng: -121.9018,
    youtubeChannelId: 'UCNCZN3lWtJSLNMD2zmtKxBg',
    schedule: 'continuous',
    tags: ['ocean'],
  },

  // ───── MUSIC / AMBIENT ─────
  {
    id: 'lofi-girl',
    name: 'lofi hip hop radio',
    agency: 'Lofi Girl',
    category: 'music',
    flag: '🇫🇷',
    description: '24/7 chill beats to relax/study to.',
    lat: 48.8566, lng: 2.3522, // Paris
    youtubeChannelId: 'UCSJ4gkVC6NrvII8umztf0Ow',
    schedule: 'continuous',
    tags: ['ambient'],
  },
  {
    id: 'chillhop',
    name: 'Chillhop Radio',
    agency: 'Chillhop Music',
    category: 'music',
    flag: '🇳🇱',
    description: '24/7 jazzy + lofi hip hop beats.',
    lat: 51.9244, lng: 4.4777, // Rotterdam
    youtubeChannelId: 'UCEcrRXW3oEYfUctetZTAWLw',
    schedule: 'continuous',
    tags: ['ambient'],
  },
  {
    id: 'classical-radio',
    name: 'Halidon Music (Classical)',
    agency: 'Halidon',
    category: 'music',
    flag: '🇮🇹',
    description: '24/7 classical music livestream.',
    lat: 45.4642, lng: 9.1900, // Milan
    youtubeChannelId: 'UC7iVe9_ckqfb7-A8ZdoMW2A',
    schedule: 'continuous',
    tags: ['classical'],
  },
]

export const CATEGORIES: { id: BroadcastCategory | 'all'; label: string; emoji: string; accent: string }[] = [
  { id: 'all', label: 'All', emoji: '📺', accent: '#00D4FF' },
  { id: 'news', label: 'News', emoji: '🗞️', accent: '#EF4444' },
  { id: 'government', label: 'Gov', emoji: '🏛️', accent: '#A855F7' },
  { id: 'space', label: 'Space', emoji: '🚀', accent: '#22D3EE' },
  { id: 'events', label: 'Cities', emoji: '🌆', accent: '#F59E0B' },
  { id: 'nature', label: 'Nature', emoji: '🌿', accent: '#22C55E' },
  { id: 'music', label: 'Music', emoji: '🎵', accent: '#EC4899' },
]

export const CATEGORY_COLOR: Record<BroadcastCategory, string> = {
  news: '#EF4444',
  government: '#A855F7',
  space: '#22D3EE',
  events: '#F59E0B',
  nature: '#22C55E',
  music: '#EC4899',
}

/** Resolve a Broadcast to its embeddable iframe URL. */
export function broadcastEmbedUrl(b: Broadcast): string {
  if (b.iframeUrl) return b.iframeUrl
  if (b.youtubeChannelId) {
    return `https://www.youtube.com/embed/live_stream?channel=${b.youtubeChannelId}&autoplay=1`
  }
  if (b.youtubeVideoId) {
    return `https://www.youtube.com/embed/${b.youtubeVideoId}?autoplay=1`
  }
  return ''
}

export function broadcastThumbUrl(b: Broadcast): string | null {
  if (b.youtubeVideoId) return `https://img.youtube.com/vi/${b.youtubeVideoId}/hqdefault.jpg`
  return null
}
