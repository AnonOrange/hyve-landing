'use client'

// Venue viewer. Branches on scan.tier:
//  - PANO_360: equirect pano on the inside of a sphere; look around from centre.
//  - NAV_MESH: an optimized .glb you walk through (drag-look + WASD).
// Both mount the live stream (videoUrl) on the stage screen. Dynamic-imported
// ssr:false — all three/window usage stays here.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { anglesToDirection, stagePanelSize, type VenueScan } from '@/lib/attend/venues/viewer-math'

// Draco decoder from gstatic (already CSP-allowed via *.gstatic.com).
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
const SPHERE_YAW_OFFSET = -Math.PI / 2
const STAGE_RADIUS = 20
const MESH_STAGE_FALLBACK_DIST = 6

export type { VenueScan }

export default function VenueViewer({
  scan,
  videoUrl,
}: {
  scan: VenueScan
  videoUrl?: string
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

    // Shared live-video texture for the stage panel.
    let video: HTMLVideoElement | null = null
    let hls: { destroy: () => void } | null = null
    let videoTex: THREE.VideoTexture | null = null
    function makeStageMaterial(): THREE.MeshBasicMaterial {
      const mat = new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.85 })
      if (videoUrl) {
        video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.playsInline = true
        video.loop = false
        const play = () => video?.play().catch(() => {})
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = videoUrl
          video.addEventListener('loadedmetadata', play)
        } else {
          void import('hls.js').then(({ default: Hls }) => {
            if (disposed || !video) return
            if (Hls.isSupported()) {
              const h = new Hls()
              h.loadSource(videoUrl)
              h.attachMedia(video)
              hls = h
              play()
            } else {
              video.src = videoUrl
              play()
            }
          })
        }
        videoTex = new THREE.VideoTexture(video)
        videoTex.colorSpace = THREE.SRGBColorSpace
        mat.map = videoTex
        mat.color.set(0xffffff)
        mat.opacity = 1
        mat.needsUpdate = true
      }
      return mat
    }

    // Disposables we always have; the gltf/mesh path pushes its own.
    const disposables: Array<{ dispose: () => void }> = []
    const stageMat = makeStageMaterial()
    disposables.push(stageMat)

    // Camera-look state (degrees). Shared by both tiers; mesh also translates.
    let lon = 0
    let lat = 0
    const camPos = new THREE.Vector3(0, 0, 0)
    const keys = new Set<string>()
    const isMesh = scan.tier === 'NAV_MESH'

    if (isMesh) {
      const sp = scan.spawn ?? { positionM: [0, 1.6, 8], yawDeg: 0 }
      camPos.set(sp.positionM[0], sp.positionM[1], sp.positionM[2])
      lon = sp.yawDeg
      scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1))
      const amb = new THREE.AmbientLight(0xffffff, 0.4)
      scene.add(amb)

      const stageSize = scan.meshStage ?? { node: 'ANCHOR_stage_screen', widthM: 8, heightM: 4.5 }
      const draco = new DRACOLoader()
      draco.setDecoderPath(DRACO_DECODER_PATH)
      const loader = new GLTFLoader()
      loader.setDRACOLoader(draco)
      loader.setMeshoptDecoder(MeshoptDecoder)
      loader.load(
        scan.url,
        (gltf) => {
          if (disposed) return
          scene.add(gltf.scene)
          // Stage panel: at the named node if present, else in front of spawn.
          const panelGeo = new THREE.PlaneGeometry(stageSize.widthM, stageSize.heightM)
          const panel = new THREE.Mesh(panelGeo, stageMat)
          const node = gltf.scene.getObjectByName(stageSize.node)
          if (node) {
            node.getWorldPosition(panel.position)
            node.getWorldQuaternion(panel.quaternion)
          } else {
            const fwd = anglesToDirection(sp.yawDeg, 0)
            panel.position.set(
              camPos.x + fwd.x * MESH_STAGE_FALLBACK_DIST,
              camPos.y,
              camPos.z + fwd.z * MESH_STAGE_FALLBACK_DIST,
            )
            panel.lookAt(camPos.x, camPos.y, camPos.z)
          }
          scene.add(panel)
          disposables.push(panelGeo)
        },
        undefined,
        () => setFailed(true),
      )
      disposables.push(draco)
    } else {
      // PANO_360 — inward equirect sphere, camera at origin.
      const sphereGeo = new THREE.SphereGeometry(50, 64, 40)
      sphereGeo.scale(-1, 1, 1)
      const texture = new THREE.TextureLoader().load(scan.url)
      texture.colorSpace = THREE.SRGBColorSpace
      const sphereMat = new THREE.MeshBasicMaterial({ map: texture })
      const sphere = new THREE.Mesh(sphereGeo, sphereMat)
      sphere.rotation.y = SPHERE_YAW_OFFSET
      scene.add(sphere)
      disposables.push(sphereGeo, sphereMat, texture)

      const stage = scan.stage ?? { azimuthDeg: 0, elevationDeg: 0, hFovDeg: 60 }
      lon = stage.azimuthDeg
      lat = stage.elevationDeg
      const size = stagePanelSize(stage.hFovDeg, STAGE_RADIUS)
      const panelGeo = new THREE.PlaneGeometry(size.width, size.height)
      const panel = new THREE.Mesh(panelGeo, stageMat)
      const dir = anglesToDirection(stage.azimuthDeg, stage.elevationDeg)
      panel.position.set(dir.x, dir.y, dir.z).multiplyScalar(STAGE_RADIUS)
      panel.lookAt(0, 0, 0)
      scene.add(panel)
      const edgesGeo = new THREE.EdgesGeometry(panelGeo)
      const edgesMat = new THREE.LineBasicMaterial({ color: 0xe8c456 })
      const edges = new THREE.LineSegments(edgesGeo, edgesMat)
      edges.position.copy(panel.position)
      edges.quaternion.copy(panel.quaternion)
      scene.add(edges)
      disposables.push(panelGeo, edgesGeo, edgesMat)
    }

    // Input: drag to look; WASD to move (mesh only).
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
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(k)) {
        if (down) keys.add(k)
        else keys.delete(k)
      }
    }
    const kd = onKey(true)
    const ku = onKey(false)
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    if (isMesh) {
      window.addEventListener('keydown', kd)
      window.addEventListener('keyup', ku)
    }

    const target = new THREE.Vector3()
    const fwd = new THREE.Vector3()
    const right = new THREE.Vector3()
    const SPEED = 0.15
    const render = () => {
      if (disposed) return
      const d = anglesToDirection(lon, lat)
      if (isMesh && keys.size) {
        fwd.set(d.x, 0, d.z).normalize()
        right.set(fwd.z, 0, -fwd.x)
        if (keys.has('w')) camPos.addScaledVector(fwd, SPEED)
        if (keys.has('s')) camPos.addScaledVector(fwd, -SPEED)
        if (keys.has('a')) camPos.addScaledVector(right, SPEED)
        if (keys.has('d')) camPos.addScaledVector(right, -SPEED)
      }
      camera.position.copy(camPos)
      target.set(camPos.x + d.x, camPos.y + d.y, camPos.z + d.z)
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
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      hls?.destroy()
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      videoTex?.dispose()
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      if (el.parentNode === mount) mount.removeChild(el)
    }
  }, [scan, videoUrl])

  if (failed) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center rounded-lg border border-[#2a2135] bg-black text-sm text-[#9e8a55]">
        3D view needs WebGL, which isn&rsquo;t available here.
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
