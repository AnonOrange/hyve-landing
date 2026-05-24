'use client'

// Tier-1 venue viewer: renders an equirectangular pano on the inside of a
// sphere with the stage screen marked at the placement from sub-plan #3.
// Dynamic-imported with ssr:false (Three.js needs WebGL/window). All three +
// window usage stays inside this file.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { anglesToDirection, stagePanelSize } from '@/lib/attend/venues/viewer-math'

// Image centre (azimuth 0) should face -Z. Three's SphereGeometry (after the
// standard scale(-1,1,1) inward flip) puts texture u=0 at +X; rotating -90°
// about Y lands the image centre at -Z to match our azimuth convention. If a
// real pano renders rotated, this is the one knob to tune (0, ±π/2, π).
const SPHERE_YAW_OFFSET = -Math.PI / 2
const STAGE_RADIUS = 20

export interface ViewerStage {
  azimuthDeg: number
  elevationDeg: number
  hFovDeg: number
}

export default function VenueViewer({
  panoUrl,
  stage,
}: {
  panoUrl: string
  stage: ViewerStage
  // videoUrl?: string — sub-plan #5 seam: live Mux video on the stage panel.
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let raf = 0
    let disposed = false

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setFailed(true)
      return
    }

    const getW = () => mount.clientWidth || 640
    const getH = () => mount.clientHeight || 360

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(getW(), getH())
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    const el = renderer.domElement
    el.style.touchAction = 'none'
    el.style.cursor = 'grab'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, getW() / getH(), 0.1, 1000)
    camera.position.set(0, 0, 0)

    // Inward-facing sphere with the equirect pano.
    const sphereGeo = new THREE.SphereGeometry(50, 64, 40)
    sphereGeo.scale(-1, 1, 1)
    const texture = new THREE.TextureLoader().load(panoUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    const sphereMat = new THREE.MeshBasicMaterial({ map: texture })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.rotation.y = SPHERE_YAW_OFFSET
    scene.add(sphere)

    // Stage placeholder panel at the placement (live video arrives in #5).
    const size = stagePanelSize(stage.hFovDeg, STAGE_RADIUS)
    const panelGeo = new THREE.PlaneGeometry(size.width, size.height)
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x05070d,
      transparent: true,
      opacity: 0.85,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)
    const dir = anglesToDirection(stage.azimuthDeg, stage.elevationDeg)
    panel.position.set(dir.x, dir.y, dir.z).multiplyScalar(STAGE_RADIUS)
    panel.lookAt(0, 0, 0)
    scene.add(panel)

    // Gold edge so the placeholder reads as "the screen goes here".
    const edgesGeo = new THREE.EdgesGeometry(panelGeo)
    const edgesMat = new THREE.LineBasicMaterial({ color: 0xe8c456 })
    const edges = new THREE.LineSegments(edgesGeo, edgesMat)
    edges.position.copy(panel.position)
    edges.quaternion.copy(panel.quaternion)
    scene.add(edges)

    // Drag-to-look. lon/lat (deg) reuse anglesToDirection for the aim, so the
    // camera and the stage panel share one convention. Start facing the stage.
    let lon = stage.azimuthDeg
    let lat = stage.elevationDeg
    let dragging = false
    let px = 0
    let py = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      px = e.clientX
      py = e.clientY
      el.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      lon -= (e.clientX - px) * 0.2
      lat = Math.max(-85, Math.min(85, lat + (e.clientY - py) * 0.2))
      px = e.clientX
      py = e.clientY
    }
    const onUp = () => {
      dragging = false
      el.style.cursor = 'grab'
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    const target = new THREE.Vector3()
    const render = () => {
      if (disposed) return
      const d = anglesToDirection(lon, lat)
      target.set(d.x, d.y, d.z)
      camera.lookAt(target)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }
    render()

    const ro = new ResizeObserver(() => {
      camera.aspect = getW() / getH()
      camera.updateProjectionMatrix()
      renderer.setSize(getW(), getH())
    })
    ro.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      sphereGeo.dispose()
      sphereMat.dispose()
      texture.dispose()
      panelGeo.dispose()
      panelMat.dispose()
      edgesGeo.dispose()
      edgesMat.dispose()
      renderer.dispose()
      if (el.parentNode === mount) mount.removeChild(el)
    }
  }, [panoUrl, stage.azimuthDeg, stage.elevationDeg, stage.hFovDeg])

  if (failed) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center rounded-lg border border-[#2a2135] bg-black text-sm text-[#9e8a55]">
        3D preview needs WebGL, which isn&rsquo;t available here.
      </div>
    )
  }

  return (
    <div
      ref={mountRef}
      className="h-[360px] w-full overflow-hidden rounded-lg border border-[#2a2135] bg-black"
    />
  )
}
