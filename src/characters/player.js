import * as THREE from "three";
import { playerMoviment } from "./player-moviment";

export function CreatePlayer(scene, colliders) {
  const player = new THREE.Group();

  // ===== Materiais =====

  const skin = new THREE.MeshStandardMaterial({
    color: 0xffd5bd,
    roughness: 0.8,
  });

  const hair = new THREE.MeshStandardMaterial({
    color: 0x5a3527,
  });

  const shirt = new THREE.MeshStandardMaterial({
    color: 0xf9efe9,
  });

  const skirt = new THREE.MeshStandardMaterial({
    color: 0xc85b72,
  });

  const leather = new THREE.MeshStandardMaterial({
    color: 0x5b4030,
  });

  const eyes = new THREE.MeshBasicMaterial({
    color: 0x7758ff,
  });

  // ===== CABEÇA =====

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 32), skin);

  head.position.y = 2;

  // ===== CABELO =====

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    hair,
  );

  hairCap.scale.y = 0.7;
  hairCap.position.y = 2.18;

  // Rabo lateral

  const pony = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.6, 6, 12),
    hair,
  );

  pony.rotation.z = Math.PI / 5;

  pony.position.set(0.45, 2, -0.2);

  // ===== OLHOS =====

  function eye(x) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), eyes);

    g.scale.y = 1.4;

    g.position.set(x, 2, 0.36);

    return g;
  }

  // ===== CORPO =====

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 8, 16),
    shirt,
  );

  body.scale.x = 1.15;

  body.position.y = 1.1;

  // ===== CINTURA =====

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 0.18, 24),
    leather,
  );

  belt.position.y = 0.95;

  // ===== SAIA =====

  const skirtMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.35, 0.5, 32),
    skirt,
  );

  skirtMesh.position.y = 0.55;

  // ===== BRAÇOS =====

  function arm(x) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55), shirt);

    arm.rotation.z = Math.PI / 12;

    arm.position.set(x, 1.2, 0);

    return arm;
  }

  // ===== PERNAS =====

  function leg(x) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.65), leather);

    leg.position.set(x, -0.1, 0);

    return leg;
  }

  // ===== BOTAS =====

  function boot(x) {
    const boot = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 20),
      leather,
    );

    boot.scale.z = 1.6;

    boot.position.set(x, -0.55, 0.08);

    return boot;
  }

  player.add(
    head,
    hairCap,
    pony,
    eye(-0.15),
    eye(0.15),
    body,
    belt,
    skirtMesh,
    arm(-0.42),
    arm(0.42),
    leg(-0.16),
    leg(0.16),
    boot(-0.16),
    boot(0.16),
  );

  player.position.y = 0.55;

  scene.add(player);

  const move = playerMoviment(player, colliders);

  return {
    mesh: player,
    move,
  };
}
