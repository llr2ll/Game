import { resolve } from '../../engine/world/collision'
import { GroundAt, BaseGround, WaterDepth, SWIM_DEPTH } from '../worldgen/sidewalk'
import { WATER_Y } from '../worldgen/water'
import { FloorAt } from '../worldgen/buildings-registry'

const RADIUS = 0.45
// Ritmo "Project Zomboid": andar firme, correr gasta fôlego, mirando anda devagar (e não corre).
// Números padrão; cada jogo pode passar os seus em UpdatePlayerMovement (o survivor usa config/balance.js).
export const DEFAULT_MOVE = { walk: 4.4, run: 7.6, aim: 3.1, swim: 3.1, staminaRun: 28, staminaSwim: 9, staminaRegen: 18, tiredUntil: 30, heldSlow: [0.35, 0.12], buffSpeed: 1.25 }
const GRAVITY = 24, JUMP = 9 // pulo ~1.7 de altura: passa por cerca (1.0), tronco e pedra
const HEAD = 1.95, STEP_DOWN = 0.6

const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI }
// gira em direção ao alvo com velocidade máxima (rad/s): o corpo "vira" de verdade, não estala
const turnTo = (a, b, rate, dt) => { const d = wrap(b - a); return a + Math.sign(d) * Math.min(Math.abs(d), rate * dt) }

// input: { mx, mz, ax, az, run } — sticks analógicos (-1..1). Mira e movimento são independentes (twin-stick).
export function UpdatePlayerMovement(p, dt, colliders, tune = DEFAULT_MOVE) {
  const { mx, mz, ax, az, run, fire } = p.input
  const mm = Math.hypot(mx, mz), am = Math.hypot(ax, az)
  p.aiming = am > 0.25
  p.firing = p.aiming && fire !== 0 // celular: mirar = atacar; mouse: botão direito só mira
  const k = mm > 0.12 ? Math.min(mm, 1) : 0
  // água: wade = profundidade sob os pés; nadando não atira nem corre e gasta fôlego (fôlego zerado = afogando)
  const wade = WaterDepth(p.x, p.z)
  if (p.swim) p.firing = false

  // corrida gasta fôlego; se zerar, só volta a correr depois de recuperar
  p.running = !!run && k > 0.3 && !p.tired && p.stamina > 0 && wade < 0.3 && !p.aiming && !p.held
  p.stamina = p.swim ? Math.max(0, p.stamina - tune.staminaSwim * dt) : p.running ? Math.max(0, p.stamina - tune.staminaRun * dt) : Math.min(100, p.stamina + tune.staminaRegen * dt)
  p.drown = p.swim && p.stamina <= 0
  if (p.stamina <= 0) p.tired = true
  else if (p.tired && p.stamina >= tune.tiredUntil) p.tired = false

  const grounded = p.jy <= 0.001
  // agarrado por zumbi: quase não sai do lugar (um segura = 35%, dois ou mais = 12%)
  const held = p.held ? (p.held === 1 ? tune.heldSlow[0] : tune.heldSlow[1]) : 1
  const mul = (p.cls ? p.cls.speed : 1) * (p.buffT > 0 ? tune.buffSpeed : 1) * (p.slowAct || 1) * held
  let speed = (p.swim ? tune.swim : (p.aiming ? tune.aim : p.running ? tune.run : tune.walk)) * mul * (1 - Math.min(wade, SWIM_DEPTH) * 0.6) // a água freia
  // virar de costas correndo: freia para girar (o corpo não muda de direção instantaneamente)
  const moveAng = Math.atan2(mx, mz)
  if (k && !p.aiming) speed *= 1 - 0.55 * Math.max(0, Math.abs(wrap(moveAng - p.facing)) - 1.2) / (Math.PI - 1.2)
  let tx = k ? (mx / mm) * speed * k : 0
  let tz = k ? (mz / mm) * speed * k : 0
  // investida do samurai: velocidade fixa na direção do golpe
  if (p.dashT > 0) { p.dashT -= dt; tx = Math.sin(p.dashA) * p.dashV; tz = Math.cos(p.dashA) * p.dashV }
  const accel = p.dashT > 0 ? 40 : !grounded ? 3 : k ? 9 : 12 // acelera com peso; para um pouco mais rápido
  const f = 1 - Math.exp(-accel * dt)
  p.vx += (tx - p.vx) * f
  p.vz += (tz - p.vz) * f

  // pulo
  p.vy -= GRAVITY * dt
  p.jy += p.vy * dt
  if (p.jy <= 0) { p.jy = 0; p.vy = 0 }

  const px = p.x, pz = p.z
  p.x += p.vx * dt
  p.z += p.vz * dt
  resolve(p, RADIUS, colliders, p.jy)
  // dentro de casa: escada, andares e teto. Algo sólido na altura do corpo (lateral da escada, borda da laje) barra o passo
  const feet = (p.gy ?? 0) + p.jy
  let fl = FloorAt(p.x, p.z, feet)
  if (fl && fl.blocked) {
    const a = FloorAt(p.x, pz, feet), b = FloorAt(px, p.z, feet)
    if (!a || !a.blocked) { p.z = pz; fl = a } else if (!b || !b.blocked) { p.x = px; fl = b } else { p.x = px; p.z = pz; fl = FloorAt(px, pz, feet) }
  }
  p.lv = fl ? fl.lv : 0

  // tronco: mirando gira rápido para a mira; andando vira (com limite) para onde está indo
  const prev = p.facing
  if (p.aiming) { p.aimAngle = Math.atan2(ax, az); p.facing = turnTo(p.facing, p.aimAngle, 11, dt) }
  else if (p.dashT > 0) p.facing = turnTo(p.facing, p.dashA, 30, dt)
  else if (Math.hypot(p.vx, p.vz) > 0.4) { p.aimAngle = Math.atan2(p.vx, p.vz); p.facing = turnTo(p.facing, p.aimAngle, p.running ? 6 : 8.5, dt) }
  p.turn = wrap(p.facing - prev) / Math.max(dt, 1e-4)

  // chão: no fundo (raso) ou boiando na superfície (fundo); a transição é suavizada para não dar tranco
  // quem está nadando passa POR BAIXO do píer/ponte; para subir neles precisa pular
  p.t = (p.t || 0) + dt
  if (fl) {
    // piso da casa: subir é direto (degrau a degrau); descer um pouco gruda no chão; cair no vão da escada vira queda de verdade
    const drop = (p.gy ?? fl.y) - fl.y
    if (drop > 0 && (p.jy > 0.02 || drop > STEP_DOWN)) p.jy += drop
    else if (drop < 0) p.jy = Math.max(0, p.jy + drop)
    p.gy = fl.y
    if (p.gy + p.jy + HEAD > fl.ceil) { p.jy = Math.max(0, fl.ceil - HEAD - p.gy); if (p.vy > 0) p.vy = 0 } // cabeça no teto
    p.swim = false
  } else {
    const ground = p.swim && p.jy < 0.6 ? BaseGround(p.x, p.z) : GroundAt(p.x, p.z), depth = Math.max(0, WATER_Y - ground)
    p.swim = depth > SWIM_DEPTH && p.jy < 0.3
    const target = p.swim ? WATER_Y - 1.0 + Math.sin(p.t * 3.2) * 0.05 : ground
    p.gy = p.gy === undefined || Math.abs(p.gy - target) > 2 ? target : p.gy + (target - p.gy) * Math.min(1, dt * 12)
  }
  p.y = p.gy + p.jy
  p.model.root.position.set(p.x, p.y, p.z)
  p.model.root.rotation.y = p.facing
  p.speed = Math.hypot(p.vx, p.vz)
}
