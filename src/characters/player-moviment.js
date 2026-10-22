import { resolve } from '../world/collision'
import { Height } from '../world/terrain'

const RADIUS = 0.45
const WALK = 5.6, RUN = 8.6
const GRAVITY = 24, JUMP = 9 // pulo ~1.7 de altura: passa por cerca (1.0), tronco e pedra

const angleLerp = (a, b, k) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * k
}

// input: { mx, mz, ax, az, run } — sticks analógicos (-1..1). Mira e movimento são independentes (twin-stick).
export function UpdatePlayerMovement(p, dt, colliders) {
  const { mx, mz, ax, az, run } = p.input
  const mm = Math.hypot(mx, mz), am = Math.hypot(ax, az)
  p.aiming = am > 0.25
  p.firing = p.aiming
  const k = mm > 0.12 ? Math.min(mm, 1) : 0

  // corrida gasta fôlego; se zerar, só volta a correr depois de recuperar
  p.running = !!run && k > 0.3 && !p.tired && p.stamina > 0
  p.stamina = p.running ? Math.max(0, p.stamina - 28 * dt) : Math.min(100, p.stamina + 18 * dt)
  if (p.stamina <= 0) p.tired = true
  else if (p.tired && p.stamina >= 30) p.tired = false

  const grounded = p.jy <= 0.001
  const speed = (p.running ? RUN : WALK) * (p.firing ? 0.85 : 1)
  const tx = k ? (mx / mm) * speed * k : 0
  const tz = k ? (mz / mm) * speed * k : 0
  const f = 1 - Math.exp(-(grounded ? 18 : 7) * dt)
  p.vx += (tx - p.vx) * f
  p.vz += (tz - p.vz) * f

  // pulo
  p.vy -= GRAVITY * dt
  p.jy += p.vy * dt
  if (p.jy <= 0) { p.jy = 0; p.vy = 0 }

  p.x += p.vx * dt
  p.z += p.vz * dt
  resolve(p, RADIUS, colliders, p.jy)

  if (p.aiming) p.aimAngle = Math.atan2(ax, az)
  else if (k) p.aimAngle = Math.atan2(mx, mz)
  p.facing = angleLerp(p.facing, p.aimAngle, Math.min(1, dt * 22))

  p.gy = Height(p.x, p.z)
  p.y = p.gy + p.jy
  p.model.root.position.set(p.x, p.y, p.z)
  p.model.root.rotation.y = p.facing
  p.speed = Math.hypot(p.vx, p.vz)
}
