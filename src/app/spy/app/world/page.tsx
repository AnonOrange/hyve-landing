import nextDynamic from 'next/dynamic'

// Leaflet only renders client-side
const WorldMapView = nextDynamic(() => import('./WorldMapView'), { ssr: false })

export const metadata = { title: 'Hyve Spy — Global Surveillance' }

export default function WorldMapPage() {
  return <WorldMapView />
}
