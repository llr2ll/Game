import * as THREE from 'three'

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, ...o })
const M = {
  skin: mat(0xf0c3a0), hair: mat(0x5a3527), eye: new THREE.MeshBasicMaterial({ color: 0x9a7bff }),
  pants: mat(0x3b4252), boot: mat(0x3a2a20), leather: mat(0x5b4030), pack: mat(0x5f6b3a), roll: mat(0xc9b27c),
  glove: mat(0x2b2b2b), metal: mat(0x2a2d33, { metalness: 0.4, roughness: 0.5 }), wood: mat(0x7a4a2b), band: mat(0xd64550),
  flash: new THREE.MeshBasicMaterial({ color: 0xffd37a }),
}
const JACKETS = [0xc85b72, 0x4a86c8, 0xe0b23c, 0x57a773]

const B = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  o.position.set(x, y, z)
  return o
}

// Sobrevivente low poly (olha para +Z, pés em y=0)
export function CreatePlayerModel(idx = 0) {
  const jacket = mat(JACKETS[idx % 4])
  const root = new THREE.Group()
  const tilt = new THREE.Group() // usado na animação de queda
  const body = new THREE.Group()
  root.add(tilt)
  tilt.add(body)

  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group()
    p.position.set(s * 0.14, 0.85, 0)
    p.add(B(0.2, 0.6, 0.22, M.pants, 0, -0.3), B(0.24, 0.2, 0.34, M.boot, 0, -0.72, 0.05))
    tilt.add(p)
    return p
  })

  // tronco, cinto, mochila e rolo de dormir
  body.add(B(0.56, 0.6, 0.32, jacket, 0, 1.15), B(0.58, 0.1, 0.34, M.leather, 0, 0.86), B(0.4, 0.5, 0.2, M.pack, 0, 1.2, -0.26))
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.46, 6), M.roll)
  roll.rotation.z = Math.PI / 2
  roll.position.set(0, 1.55, -0.28)
  body.add(roll)

  // cabeça: rosto, cabelo, rabo de cavalo, faixa e olhos roxos
  const head = new THREE.Group()
  head.position.y = 1.72
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 5), M.skin)
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), M.hair)
  hairCap.position.y = 0.02
  const pony = B(0.14, 0.14, 0.36, M.hair, 0, -0.02, -0.33)
  pony.rotation.x = 0.5
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 7), M.band)
  band.position.y = 0.09
  head.add(skull, hairCap, pony, band, B(0.06, 0.09, 0.04, M.eye, -0.09, 0, 0.24), B(0.06, 0.09, 0.04, M.eye, 0.09, 0, 0.24))
  body.add(head)

  // braços
  const arm = (s, yaw) => {
    const p = new THREE.Group()
    p.rotation.order = 'YXZ'
    p.position.set(s * 0.36, 1.38, 0)
    p.rotation.set(-1.35, yaw, 0)
    p.add(B(0.15, 0.5, 0.15, jacket, 0, -0.25), B(0.17, 0.17, 0.17, M.glove, 0, -0.56))
    body.add(p)
    return p
  }
  const gunArm = arm(1, -0.25)
  const offArm = arm(-1, 0.4)

  // armas na mão
  const holder = new THREE.Group()
  holder.position.set(0.2, 1.26, 0.58)
  body.add(holder)

  const muzzleOf = (z) => { const o = new THREE.Object3D(); o.position.z = z; return o }
  const flashOf = (z) => { const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), M.flash); f.position.z = z + 0.1; f.visible = false; return f }

  const pistol = new THREE.Group()
  pistol.add(B(0.07, 0.1, 0.32, M.metal, 0, 0, 0.1), B(0.07, 0.17, 0.09, M.metal, 0, -0.12, -0.02))
  const pMuz = muzzleOf(0.28), pFlash = flashOf(0.28)
  pistol.add(pMuz, pFlash)

  const carbine = new THREE.Group()
  carbine.add(B(0.08, 0.12, 0.62, M.metal, 0, 0, 0.1), B(0.08, 0.14, 0.26, M.wood, 0, -0.01, -0.4), B(0.09, 0.1, 0.3, M.wood, 0, -0.01, 0.3),
    B(0.04, 0.04, 0.3, M.metal, 0, 0.01, 0.55), B(0.06, 0.2, 0.1, M.metal, 0, -0.15, 0.08), B(0.03, 0.05, 0.04, M.metal, 0, 0.09, 0.55))
  const cMuz = muzzleOf(0.72), cFlash = flashOf(0.72)
  carbine.add(cMuz, cFlash)

  holder.add(pistol, carbine)

  let cur = 'carbine', recoil = 0, flashT = 0, phase = 0
  function setWeapon(w) {
    cur = w
    pistol.visible = w === 'pistol'
    carbine.visible = w === 'carbine'
    offArm.rotation.set(w === 'carbine' ? -1.2 : -0.15, w === 'carbine' ? 0.5 : 0.1, 0)
  }
  setWeapon('carbine')

  return {
    root,
    setWeapon,
    muzzle: (v) => (cur === 'pistol' ? pMuz : cMuz).getWorldPosition(v),
    kick() { recoil = 1; flashT = 0.05; (cur === 'pistol' ? pFlash : cFlash).visible = true },
    animate(dt, speed, dead) {
      phase += dt * (3 + speed * 1.6)
      const k = Math.min(speed / 4, 1)
      legs[0].rotation.x = Math.sin(phase) * 0.8 * k
      legs[1].rotation.x = -Math.sin(phase) * 0.8 * k
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * k
      recoil = Math.max(0, recoil - dt * 9)
      holder.position.z = 0.58 - recoil * 0.1
      gunArm.rotation.x = -1.35 + recoil * 0.12
      if (flashT > 0 && (flashT -= dt) <= 0) pFlash.visible = cFlash.visible = false
      const target = dead ? -Math.PI / 2 : 0
      tilt.rotation.x += (target - tilt.rotation.x) * Math.min(1, dt * 8)
      tilt.position.y = dead ? 0.25 * Math.abs(tilt.rotation.x / (Math.PI / 2)) : 0
    },
  }
}
