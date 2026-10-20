import * as THREE from "three";

const texCache = new Map();

function hexColor(hex) {
  return new THREE.Color(hex);
}

function makeScaleTexture(bodyHex, scaleHex) {
  const key = bodyHex + "|" + scaleHex;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bodyHex;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = scaleHex;
  for (let y = -1; y < 5; y++) {
    for (let x = -1; x < 5; x++) {
      const ox = x * 16 + (y % 2) * 8;
      const oy = y * 12;
      ctx.beginPath();
      ctx.moveTo(ox + 8, oy);
      ctx.lineTo(ox + 16, oy + 8);
      ctx.lineTo(ox + 8, oy + 16);
      ctx.lineTo(ox, oy + 8);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function orientBetween(obj, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const h = dir.length();
  if (h < 0.5) return;
  dir.normalize();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  obj.position.copy(mid);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  obj.scale.set(1, h, 1);
}

function toWorld(x, y, L, lift = 0) {
  return new THREE.Vector3(x - L.w * 0.5, lift, y - L.h * 0.5);
}

class Snake3D {
  constructor(snake, api) {
    this.snake = snake;
    this.api = api;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.head = new THREE.Group();
    this.jaw = new THREE.Group();
    this.tongue = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.08, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xb85a58, flatShading: true }),
    );
    this.bulge = -1;
    this.root.add(this.body);
    this.root.add(this.head);
    const mat = new THREE.MeshStandardMaterial({
      map: makeScaleTexture(snake.color, snake.scale),
      flatShading: true,
      roughness: 0.72,
      metalness: 0.04,
    });
    this.bodyMat = mat;
    this.headMat = new THREE.MeshStandardMaterial({
      color: hexColor(snake.color),
      flatShading: true,
      roughness: 0.68,
      metalness: 0.05,
    });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), this.headMat);
    skull.scale.set(1.2, 0.82, 1);
    skull.castShadow = true;
    this.skull = skull;
    const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), this.headMat);
    jawMesh.scale.set(1.05, 0.55, 0.95);
    jawMesh.position.y = -0.22;
    jawMesh.castShadow = true;
    this.jawMesh = jawMesh;
    this.jaw.add(jawMesh);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf7f3ea, flatShading: true }),
      );
      white.scale.set(1, 1.1, 0.55);
      white.position.set(s * 0.42, 0.12, 0.35);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a241c, flatShading: true }),
      );
      pupil.position.set(s * 0.42, 0.1, 0.48);
      eye.add(white);
      eye.add(pupil);
      eye.userData.side = s;
      this.eyes.push(eye);
      this.head.add(eye);
    }
    this.head.add(this.skull);
    this.head.add(this.jaw);
    this.tongue.position.set(0, -0.05, 0.85);
    this.tongue.castShadow = true;
    this.head.add(this.tongue);
    this.segments = [];
  }

  clearBody() {
    for (const m of this.segments) {
      m.geometry.dispose();
      this.body.remove(m);
    }
    this.segments = [];
  }

  rebuildBody(curvePts, radii, L) {
    this.clearBody();
    for (let i = 0; i < curvePts.length - 1; i++) {
      const a = curvePts[i];
      const b = curvePts[i + 1];
      const r0 = radii[i];
      const r1 = radii[i + 1];
      const h = a.distanceTo(b);
      if (h < 0.5) continue;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 8, 1), this.bodyMat);
      seg.castShadow = true;
      seg.receiveShadow = true;
      orientBetween(seg, a, b);
      this.body.add(seg);
      this.segments.push(seg);
    }
  }

  update(L, t, G) {
    const { snakePoints, normalAt } = this.api;
    const pts2d = snakePoints(this.snake, L);
    let lunge = 0;
    let bulge = -1;
    let swallow = 0;
    if (G && G.step && G.step.kind === "snake" && G.step.from === this.snake.head) {
      const u = G.step.t / G.step.dur;
      if (u < 0.5) {
        if (u < 0.12) lunge = u / 0.12;
        else if (u < 0.42) lunge = 1;
        else lunge = 1 - (u - 0.42) / 0.08;
      }
      if (u > 0.4 && u < 0.82) bulge = (u - 0.4) / 0.42;
      if (u > 0.28 && u < 0.42) swallow = (u - 0.28) / 0.14;
    }
    const slither = L.cell * 0.028;
    const curvePts = [];
    const radii = [];
    const n = pts2d.length;
    for (let i = 0; i < n; i++) {
      const tt = i / (n - 1);
      const nrm = normalAt(pts2d, i);
      const wave = Math.sin(t * 2.4 + tt * 9 + this.snake.head * 0.3) * slither * (1 - tt * 0.35);
      const lift = L.cell * (0.04 + 0.03 * Math.sin(tt * Math.PI));
      const wx = pts2d[i].x + nrm.x * wave;
      const wy = pts2d[i].y + nrm.y * wave;
      curvePts.push(toWorld(wx, wy, L, lift));
      let r = L.cell * (0.1 - tt * 0.055);
      if (bulge >= 0) {
        const bump = Math.exp(-((tt - bulge) ** 2) / 0.012) * L.cell * 0.09;
        r += bump;
      }
      radii.push(Math.max(L.cell * 0.035, r));
    }
    this.rebuildBody(curvePts, radii, L);
    const tang = new THREE.Vector3()
      .subVectors(curvePts[1] || curvePts[0], curvePts[0])
      .normalize();
    const headPos = curvePts[0].clone().add(tang.clone().multiplyScalar(-L.cell * 0.08));
    this.head.position.copy(headPos);
    const yaw = Math.atan2(tang.x, tang.z);
    this.head.rotation.set(0, yaw, 0);
    const hr = L.cell * 0.19;
    this.skull.scale.set(hr * 1.2, hr * 0.82, hr);
    this.jaw.rotation.x = lunge * 0.85 + swallow * 0.4;
    const blink = Math.sin(t * 2.1 + this.snake.head * 0.7) > 0.94;
    for (const eye of this.eyes) {
      eye.scale.y = blink ? 0.12 : 1;
    }
    const flick = Math.sin(t * 3.4 + this.snake.head);
    const tongueOut = Math.max(0.28 + (flick > 0.72 ? (flick - 0.72) / 0.28 : 0), lunge * 0.85);
    this.tongue.scale.set(1 + tongueOut * 0.8, 1, 1 + tongueOut * 1.2);
    this.tongue.visible = tongueOut > 0.08;
  }
}

class ChibiKid3D {
  constructor(player, api) {
    this.player = player;
    this.api = api;
    this.root = new THREE.Group();
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 24),
      new THREE.MeshBasicMaterial({
        color: hexColor(api.KURTA[player.kurta]),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.body = new THREE.Group();
    this.root.add(this.ring);
    this.root.add(this.body);
    const look = api.LOOK[player.kurta];
    this.look = look;
    this.skin = new THREE.MeshStandardMaterial({ color: 0xf0c09a, flatShading: true, roughness: 0.85 });
    this.cloth = new THREE.MeshStandardMaterial({ color: hexColor(look.cloth), flatShading: true, roughness: 0.8 });
    this.white = new THREE.MeshStandardMaterial({ color: 0xf7f3ea, flatShading: true, roughness: 0.9 });
    this.hairMat = new THREE.MeshStandardMaterial({ color: 0x2a160f, flatShading: true, roughness: 0.9 });
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.build(look);
    this.body.add(this.armL);
    this.body.add(this.armR);
  }

  build(look) {
    const girl = look.kind === "girl";
    const legGeo = new THREE.BoxGeometry(0.14, 0.22, 0.12);
    const legL = new THREE.Mesh(legGeo, girl ? this.cloth : this.white);
    const legR = legL.clone();
    legL.position.set(-0.08, 0.11, 0);
    legR.position.set(0.08, 0.11, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.2), this.cloth);
    torso.position.y = 0.36;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.skin);
    head.position.y = 0.62;
    head.castShadow = true;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a14 }));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.07, 0.64, 0.16);
    eyeR.position.set(0.07, 0.64, 0.16);
    this.eyes = [eyeL, eyeR];
    this.head = head;
    this.parts = [legL, legR, torso, head, eyeL, eyeR];
    for (const part of this.parts) this.body.add(part);
    if (girl) {
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 10), this.cloth);
      skirt.position.y = 0.22;
      skirt.castShadow = true;
      this.parts.push(skirt);
      this.body.add(skirt);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), this.hairMat);
      hair.position.set(0, 0.72, -0.04);
      hair.scale.set(1.05, 1.1, 0.9);
      const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.1), this.hairMat);
      hairSideL.position.set(-0.16, 0.58, -0.02);
      const hairSideR = hairSideL.clone();
      hairSideR.position.x = 0.16;
      this.parts.push(hair, hairSideL, hairSideR);
      this.body.add(hair);
      this.body.add(hairSideL);
      this.body.add(hairSideR);
    } else {
      const topi = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.08, 10), this.cloth);
      topi.position.y = 0.78;
      topi.castShadow = true;
      this.parts.push(topi);
      this.body.add(topi);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), this.hairMat);
      hair.position.set(0, 0.7, -0.02);
      this.parts.push(hair);
      this.body.add(hair);
    }
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), this.skin);
    const lowerArm = upperArm.clone();
    upperArm.position.y = 0.08;
    lowerArm.position.y = -0.1;
    const armLU = upperArm.clone();
    const armLL = lowerArm.clone();
    const armRU = upperArm.clone();
    const armRL = lowerArm.clone();
    this.armL.add(armLU);
    this.armL.add(armLL);
    this.armR.add(armRU);
    this.armR.add(armRL);
    this.armL.position.set(-0.2, 0.44, 0);
    this.armR.position.set(0.2, 0.44, 0);
  }

  setArms(pose, h) {
    let left = -0.6;
    let right = 0.6;
    if (pose.arm === 1 || pose.arm === 2 || pose.panic) {
      left = -2.4;
      right = -2.4;
    } else if (pose.climb) {
      left = pose.climbSide ? -2.1 : -0.5;
      right = pose.climbSide ? 0.5 : -2.1;
    }
    this.armL.rotation.z = left;
    this.armR.rotation.z = right;
    const eyeScale = pose.panic ? 1.35 : pose.dizzy ? 0.9 : 1;
    for (const e of this.eyes) e.scale.setScalar(eyeScale);
    if (pose.dizzy) this.head.rotation.z = Math.sin(pose.spin) * 0.35;
    else this.head.rotation.z = 0;
  }

  update(L, pose, t) {
    if (!pose || pose.gulp < 0.04) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const cell = L.cell * pose.gulp;
    this.body.scale.set(pose.sx * cell, pose.sy * cell, cell);
    const pos = toWorld(pose.x, pose.y, L, 0);
    this.root.position.copy(pos);
    this.root.rotation.y = pose.rot || 0;
    this.ring.scale.set(cell * 0.42, cell * 0.42, 1);
    (this.ring.material).color.set(hexColor(this.api.KURTA[this.player.kurta]));
    this.setArms(pose, cell);
    const bob = pose.sweat > 0 ? 0 : Math.sin(t * 2.4 + this.player.id) * 0.002 * L.cell;
    this.body.position.y = bob;
  }
}

export function attach(canvas, apiFactory) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  scene.add(pivot);
  const world = new THREE.Group();
  pivot.add(world);

  const ambient = new THREE.AmbientLight(0xfff3e4, 0.62);
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.88);
  sun.position.set(120, 280, 180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1200;
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.bias = -0.0008;
  scene.add(ambient);
  scene.add(sun);

  let shadowPlane = null;
  let camera = new THREE.PerspectiveCamera(32, 1, 10, 4000);
  const snakes = [];
  const kids = new Map();
  let ready = false;

  function ensureSnakes(api) {
    if (snakes.length) return;
    for (const sn of api.SNAKES) {
      const s = new Snake3D(sn, api);
      world.add(s.root);
      snakes.push(s);
    }
  }

  function ensureKids(G, api) {
    if (!G) return;
    for (const p of G.players) {
      if (!kids.has(p.id)) {
        const k = new ChibiKid3D(p, api);
        world.add(k.root);
        kids.set(p.id, k);
      }
    }
    for (const id of [...kids.keys()]) {
      if (!G.players.some((p) => p.id === id)) {
        world.remove(kids.get(id).root);
        kids.delete(id);
      }
    }
  }

  function layoutShadow(L) {
    if (shadowPlane) world.remove(shadowPlane);
    const cx = L.ox + L.size * 0.5 - L.w * 0.5;
    const cz = L.oy + L.size * 0.5 - L.h * 0.5;
    shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(L.size * 1.02, L.size * 1.02),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(cx, 0.5, cz);
    shadowPlane.receiveShadow = true;
    world.add(shadowPlane);
  }

  function fit(L) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(L.w));
    const h = Math.max(1, Math.round(L.h));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      renderer.setSize(w, h, false);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    renderer.setPixelRatio(dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const dist = L.size * 1.15;
    camera.position.set(0, dist * 0.92, dist * 0.78);
    camera.lookAt(0, 0, 0);
  }

  return {
    ready: true,
    frame(L, cam) {
      const api = apiFactory();
      const G = api.getG();
      ensureSnakes(api);
      if (!shadowPlane || shadowPlane.geometry.parameters.width !== L.size * 1.02) layoutShadow(L);
      fit(L);
      pivot.position.set(0, 0, 0);
      pivot.rotation.set(0, cam.rot || 0, 0);
      pivot.scale.setScalar(cam.zoom || 1);
      const t = G ? G.t : performance.now() / 1000;
      for (const s of snakes) s.update(L, t, G);
      ensureKids(G, api);
      if (G) {
        const moving = G.step && G.step.player;
        const order = G.players.filter((p) => p !== moving);
        if (moving) order.push(moving);
        for (const p of order) {
          const pose = api.poseFor(p, L);
          kids.get(p.id)?.update(L, pose, t);
        }
      } else {
        for (const k of kids.values()) k.root.visible = false;
      }
      renderer.render(scene, camera);
    },
  };
}
