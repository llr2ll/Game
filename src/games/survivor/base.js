import * as THREE from 'three'
import { BuildingAt, HasBuilding } from '../../shared/worldgen/buildings-registry'
import { BALANCE } from './config/balance'

// Rádio e base (J5a): dentro de uma casa (térreo), Usar num lugar livre → "📻 Pôr o rádio aqui": essa casa vira a base.
// Usar perto do rádio → pega de volta (para levar a outra casa). O cerco noturno (J5b) vai atrás da base.
const R = BALANCE.radio
const BODY = new THREE.BoxGeometry(0.42, 0.26, 0.2).translate(0, 0.13, 0)
const ANT = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4).translate(0.14, 0.5, 0)
const BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x4a4f45 })
const ANT_MAT = new THREE.MeshBasicMaterial({ color: 0x222222 })
const RING_GEO = new THREE.RingGeometry(0.55, 0.7, 32).rotateX(-Math.PI / 2)
const RING_MAT = new THREE.MeshBasicMaterial({ color: 0x7aff9a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })

// ctx: { scene, say(texto, s), sfx(nome, opções) }
export function CreateBase({ scene, say, sfx }) {
  let radio = null // { x, z, y, b, mesh } · null = rádio com o grupo (sem base)
  let t = 0
  function show() {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(BODY, BODY_MAT), new THREE.Mesh(ANT, ANT_MAT))
    const ring = new THREE.Mesh(RING_GEO, RING_MAT)
    ring.position.y = 0.04; ring.renderOrder = 3
    g.add(ring)
    g.position.set(radio.x, radio.y, radio.z)
    scene.add(g)
    radio.mesh = g; radio.ring = ring
  }
  function hide() { if (radio && radio.mesh) { scene.remove(radio.mesh); radio.mesh = null } }
  const near = (p) => radio && Math.hypot(radio.x - p.x, radio.z - p.z) < R.reach
  const canPlace = (p) => !radio && (p.lv || 0) === 0 && BuildingAt(p.x, p.z)

  return {
    // Usar: pegar o rádio (perto dele) ou pôr o rádio (dentro de uma casa, sem rádio posto). false = nada a fazer
    use(p) {
      if (p.dead || p.vehicle || p.task) return false
      if (near(p)) { hide(); radio = null; say(`${p.name} pegou o rádio 📻 (ponha em outra casa)`, 2); sfx('swap', { x: p.x, z: p.z }); return true }
      const b = canPlace(p)
      if (!b) return false
      radio = { x: p.x, z: p.z, y: p.gy ?? b.y, b }
      show()
      say(`📻 ${p.name} pôs o rádio: esta casa é a base`, 2.5)
      sfx('supply')
      return true
    },
    label(p) { return p.dead || p.vehicle ? '' : near(p) ? '📻 Pegar rádio' : canPlace(p) ? '📻 Pôr rádio' : '' },
    // base atual: { x, z, b } ou null
    at: () => (radio ? { x: radio.x, z: radio.z, b: radio.b } : null),
    update(dt) {
      t += dt
      if (!radio) return
      if (radio.mesh && !HasBuilding(radio.b)) hide() // a casa saiu da memória
      if (!radio.mesh) { const b = BuildingAt(radio.x, radio.z); if (b) { radio.b = b; show() } } // voltou
      if (radio.ring) { const k = 1 + Math.sin(t * 3) * 0.12; radio.ring.scale.set(k, 1, k) } // pulsa: dá para achar a base de longe
    },
    clear() { hide(); radio = null },
  }
}
