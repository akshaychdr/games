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
  tex.repeat.set(5, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

/** Canvas pixel coords → world (board plane XZ, Y up). */
function toWorld(x, y, L, lift = 0) {
  return new THREE.Vector3(x - L.w * 0.5, lift, y - L.h * 0.5);
}

function buildTaperedTube(curve, tubularSegments, radialSegments, radiusAt) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const r = radiusAt(t);
    const P = curve.getPoint(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(v);
      const sin = Math.sin(v);
      positions.push(
        P.x + (N.x * cos + B.x * sin) * r,
        P.y + (N.y * cos + B.y * sin) * r,
        P.z + (N.z * cos + B.z * sin) * r,
      );
      uvs.push(t * 5, j / radialSegments);
    }
  }
  const stride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

class Snake3D {
  constructor(snake, api) {
    this.snake = snake;
    this.api = api;
    this.root = new THREE.Group();
    this.head = new THREE.Group();
    this.jaw = new THREE.Group();
    this.bodyMesh = null;
    this.tongue = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.08, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xb85a58, flatShading: true }),
    );
    this.root.add(this.head);
    this.bodyMat = new THREE.MeshStandardMaterial({
      map: makeScaleTexture(snake.color, snake.scale),
      flatShading: true,
      roughness: 0.72,
      metalness: 0.04,
    });
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
    const jawMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
      this.headMat,
    );
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
      this.eyes.push(eye);
      this.head.add(eye);
    }
    this.head.add(this.skull);
    this.head.add(this.jaw);
    this.tongue.position.set(0, -0.05, 0.85);
    this.tongue.castShadow = true;
    this.head.add(this.tongue);
  }

  disposeBody() {
    if (this.bodyMesh) {
      this.root.remove(this.bodyMesh);
      this.bodyMesh.geometry.dispose();
      this.bodyMesh = null;
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
    const slither = L.cell * 0.022;
    const curvePts = [];
    const n = pts2d.length;
    for (let i = 0; i < n; i++) {
      const tt = i / (n - 1);
      const nrm = normalAt(pts2d, i);
      const wave = Math.sin(t * 2.4 + tt * 9 + this.snake.head * 0.3) * slither * (1 - tt * 0.35);
      const lift = L.cell * (0.035 + 0.025 * Math.sin(tt * Math.PI));
      curvePts.push(toWorld(pts2d[i].x + nrm.x * wave, pts2d[i].y + nrm.y * wave, L, lift));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts, false, "centripetal");
    const radiusAt = (t) => {
      let r = L.cell * (0.175 - t * 0.1);
      if (bulge >= 0) r += Math.exp(-((t - bulge) ** 2) / 0.012) * L.cell * 0.08;
      return Math.max(L.cell * 0.05, r);
    };
    this.disposeBody();
    const geo = buildTaperedTube(curve, 72, 8, radiusAt);
    this.bodyMesh = new THREE.Mesh(geo, this.bodyMat);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.root.add(this.bodyMesh);
    this.root.remove(this.head);
    this.root.add(this.head);

    const tang = curve.getTangent(0).normalize();
    const headPos = curve.getPoint(0).add(tang.clone().multiplyScalar(-L.cell * 0.06));
    this.head.position.copy(headPos);
    const yaw = Math.atan2(tang.x, tang.z);
    this.head.rotation.set(0, yaw, 0);
    const hr = L.cell * 0.19;
    this.skull.scale.set(hr * 1.2, hr * 0.82, hr);
    this.jaw.rotation.x = lunge * 0.85 + swallow * 0.4;
    const blink = Math.sin(t * 2.1 + this.snake.head * 0.7) > 0.94;
    for (const eye of this.eyes) eye.scale.y = blink ? 0.12 : 1;
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
    this.facing = new THREE.Group();
    this.root.add(this.facing);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 24),
      new THREE.MeshBasicMaterial({
        color: hexColor(api.KURTA[player.kurta]),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.01;
    this.body = new THREE.Group();
    this.facing.add(this.ring);
    this.facing.add(this.body);
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
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.1), girl ? this.cloth : this.white);
    const legR = legL.clone();
    legL.position.set(-0.07, 0.1, 0.02);
    legR.position.set(0.07, 0.1, 0.02);
    legL.castShadow = true;
    legR.castShadow = true;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.16), this.cloth);
    torso.position.set(0, 0.38, 0.04);
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), this.skin);
    head.position.set(0, 0.66, 0.1);
    head.scale.set(1.05, 1, 1.08);
    head.castShadow = true;
    this.head = head;
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfffaf2, flatShading: true });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeWhiteMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.09, 0.68, 0.24);
    eyeR.position.set(0.09, 0.68, 0.24);
    eyeL.scale.set(1, 1.15, 0.7);
    eyeR.scale.set(1, 1.15, 0.7);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a14 }));
    const pupilR = pupilL.clone();
    pupilL.position.set(-0.09, 0.67, 0.28);
    pupilR.position.set(0.09, 0.67, 0.28);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshStandardMaterial({ color: 0xe8a090, transparent: true, opacity: 0.45 }));
    cheek.position.set(0, 0.6, 0.22);
    cheek.scale.set(2.2, 1, 0.6);
    this.eyes = [eyeL, eyeR, pupilL, pupilR];
    this.parts = [legL, legR, torso, head, eyeL, eyeR, pupilL, pupilR, cheek];
    for (const part of this.parts) this.body.add(part);
    if (girl) {
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 12), this.cloth);
      skirt.position.set(0, 0.24, 0.02);
      skirt.castShadow = true;
      this.body.add(skirt);
      const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.7), this.hairMat);
      hairBack.position.set(0, 0.72, -0.06);
      const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.09), this.hairMat);
      hairL.position.set(-0.17, 0.6, -0.02);
      const hairR = hairL.clone();
      hairR.position.x = 0.17;
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.1), this.hairMat);
      bangs.position.set(0, 0.78, 0.12);
      this.body.add(skirt, hairBack, hairL, hairR, bangs);
    } else {
      const topi = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.07, 10), this.cloth);
      topi.position.set(0, 0.86, 0.08);
      topi.castShadow = true;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), this.hairMat);
      hair.position.set(0, 0.74, -0.02);
      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.02), this.white);
      placket.position.set(0, 0.4, 0.12);
      this.body.add(topi, hair, placket);
    }
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.09), this.skin);
    const lowerArm = upperArm.clone();
    upperArm.position.y = 0.07;
    lowerArm.position.y = -0.09;
    for (const g of [this.armL, this.armR]) {
      g.add(upperArm.clone());
      g.add(lowerArm.clone());
    }
    this.armL.position.set(-0.18, 0.46, 0.06);
    this.armR.position.set(0.18, 0.46, 0.06);
  }

  setArms(pose) {
    let left = 0.5;
    let right = -0.5;
    if (pose.arm === 1 || pose.arm === 2 || pose.panic) {
      left = -2.35;
      right = -2.35;
    } else if (pose.climb) {
      left = pose.climbSide ? -2.0 : -0.4;
      right = pose.climbSide ? 0.4 : -2.0;
    }
    this.armL.rotation.z = left;
    this.armR.rotation.z = right;
    const eyeScale = pose.panic ? 1.2 : 1;
    this.eyes[0].scale.set(eyeScale, eyeScale * 1.15, eyeScale * 0.7);
    this.eyes[1].scale.set(eyeScale, eyeScale * 1.15, eyeScale * 0.7);
    if (pose.dizzy) this.head.rotation.z = Math.sin(pose.spin) * 0.25;
    else this.head.rotation.z = 0;
  }

  update(L, pose, t, camera) {
    if (!pose || pose.gulp < 0.04) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const cell = L.cell * pose.gulp;
    this.body.scale.set(pose.sx * cell, pose.sy * cell, cell);
    const pos = toWorld(pose.x, pose.y, L, 0);
    this.root.position.copy(pos);
    const dx = camera.position.x - pos.x;
    const dz = camera.position.z - pos.z;
    this.facing.rotation.y = Math.atan2(dx, dz) + (pose.rot || 0);
    this.ring.scale.set(cell * 0.42, cell * 0.42, 1);
    this.ring.material.color.set(hexColor(this.api.KURTA[this.player.kurta]));
    this.setArms(pose);
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
  renderer.setScissorTest(true);

  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  scene.add(pivot);
  const world = new THREE.Group();
  pivot.add(world);

  const ambient = new THREE.AmbientLight(0xfff3e4, 0.58);
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.92);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0006;
  sun.target = new THREE.Object3D();
  scene.add(ambient);
  scene.add(sun);
  scene.add(sun.target);

  let shadowPlane = null;
  const camera = new THREE.PerspectiveCamera(34, 1, 8, 5000);
  const snakes = [];
  const kids = new Map();

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
      new THREE.PlaneGeometry(L.size, L.size),
      new THREE.ShadowMaterial({ opacity: 0.2 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(cx, 0.4, cz);
    shadowPlane.receiveShadow = true;
    world.add(shadowPlane);
  }

  function fitCamera(L) {
    const w = Math.max(1, L.w);
    const h = Math.max(1, L.h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false);
    }
    renderer.setPixelRatio(dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const boardCx = L.ox + L.size * 0.5 - L.w * 0.5;
    const boardCz = L.oy + L.size * 0.5 - L.h * 0.5;
    const look = new THREE.Vector3(boardCx, L.cell * 0.12, boardCz);
    const tilt = (48 * Math.PI) / 180;
    const dist = L.size * 1.18;
    camera.position.set(
      boardCx,
      dist * Math.cos(tilt),
      boardCz + dist * Math.sin(tilt),
    );
    camera.lookAt(look);
    sun.position.set(boardCx - L.size * 0.35, dist * 0.9, boardCz + dist * 0.5);
    sun.target.position.copy(look);
    sun.target.updateMatrixWorld();
    sun.shadow.camera.left = -L.size * 0.55;
    sun.shadow.camera.right = L.size * 0.55;
    sun.shadow.camera.top = L.size * 0.55;
    sun.shadow.camera.bottom = -L.size * 0.55;
  }

  function applyBoardScissor(L) {
    const sx = Math.floor(L.ox);
    const sy = Math.floor(L.h - L.oy - L.size);
    const sw = Math.max(1, Math.floor(L.size));
    const sh = Math.max(1, Math.floor(L.size));
    renderer.setScissor(sx, sy, sw, sh);
    renderer.setViewport(0, 0, L.w, L.h);
  }

  return {
    ready: true,
    frame(L, cam) {
      const api = apiFactory();
      const G = api.getG();
      ensureSnakes(api);
      if (!shadowPlane || shadowPlane.geometry.parameters.width !== L.size) layoutShadow(L);
      fitCamera(L);
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
          kids.get(p.id)?.update(L, pose, t, camera);
        }
      } else {
        for (const k of kids.values()) k.root.visible = false;
      }
      applyBoardScissor(L);
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
    },
  };
}
