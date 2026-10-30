import * as THREE from 'three'

// Céu, névoa, luz de céu/chão e sol. As cores e a posição do sol mudam com a hora e o tempo (world/climate.js);
// aqui só criamos as peças e um jeito barato de repintar o gradiente do céu.
function skyCanvas() {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas')
    c.width = 4; c.height = 256
    const x = c.getContext('2d')
    if (!x) return null
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const paint = (top, mid, bottom) => {
      const g = x.createLinearGradient(0, 0, 0, 256)
      g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom)
      x.fillStyle = g
      x.fillRect(0, 0, 4, 256)
      tex.needsUpdate = true
    }
    paint('#78c8f0', '#cdeccf', '#eef6b0')
    return { tex, paint }
  } catch { return null }
}

export function Light(scene, renderer) {
  // tone mapping "Neutral": comprime os brilhos sem dessaturar as cores (custo ~zero, é só uma linha no shader)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0

  const sky = skyCanvas()
  scene.background = sky ? sky.tex : new THREE.Color(0xcdeccf) // fundo é um quad por tela: funciona no split screen
  scene.fog = new THREE.Fog(0xcfeaa0, 32, 90)

  const hemi = new THREE.HemisphereLight(0xe6f4ff, 0xaac860, 2.1) // luz de céu/chão: sombras suaves e coloridas
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.9)
  sun.position.set(13, 15, 0.5).normalize().multiplyScalar(20)
  scene.add(hemi, sun)

  return {
    hemi, sun,
    paintSky: (top, mid, bottom) => { if (sky) sky.paint(top, mid, bottom); else scene.background.set(mid) },
  }
}
