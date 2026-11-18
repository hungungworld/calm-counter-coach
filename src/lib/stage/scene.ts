// The 3D counter: a stylised customer who faces the staff member across a department
// store desk. Everything is built from primitives at runtime (no model files), so the
// character can be re-dressed per scenario and its face driven by two numbers:
// the emotion temperature (0 to 100) and the speech level (0 to 1).
//
// Loaded lazily by <CustomerStage>; never import this file from server code.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { CustomerLook } from "../scenarios";

export type StageState = "idle" | "listening" | "thinking" | "speaking";

export type StageHandle = {
  /** Emotion temperature, 0 (calm) to 100 (furious). The face eases toward it. */
  setAnger(value: number): void;
  setState(state: StageState): void;
  /** Called every frame while speaking; returns mouth openness 0 to 1. */
  setMouthSource(source: (() => number) | null): void;
  /** One-shot body reaction when the temperature jumps or drops. */
  react(kind: "flare" | "relief"): void;
  resize(): void;
  dispose(): void;
};

const GOLD = 0xc9a86a;
const GOLD_SOFT = 0xe6d3a3;
const WALL = 0x163428;
const WALL_DEEP = 0x0e231b;
const IVORY = 0xf4ecdc;
/** Skin tint the face leans toward as the customer heats up. */
const FLUSH = new THREE.Color(0xd9695c);

const HEAD_R = 0.105;
const HEAD_SX = 0.95;
const HEAD_SY = 1.1;
const HEAD_SCALE = 1.24;
const CAMERA_DISTANCE = 1.84;
const TAU = Math.PI * 2;

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** z of the head surface at a face position, so features sit flush on the skin. */
function faceZ(x: number, y: number): number {
  const nx = x / (HEAD_R * HEAD_SX);
  const ny = y / (HEAD_R * HEAD_SY);
  return HEAD_R * Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny));
}

function matte(color: THREE.ColorRepresentation, roughness = 0.7, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function goldLines(geometry: THREE.BufferGeometry, color = GOLD, opacity = 0.9) {
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), material);
}

/* ------------------------------------------------------------------ */
/* Mouth: a small ribbon whose curve and opening are rewritten per frame */
/* ------------------------------------------------------------------ */

const MOUTH_Y = -0.047;
const MOUTH_SEGMENTS = 18;

class Mouth {
  readonly group = new THREE.Group();
  private readonly lip: THREE.BufferGeometry;
  private readonly inner: THREE.BufferGeometry;
  private readonly teeth: THREE.BufferGeometry;

  constructor(lipColor: THREE.ColorRepresentation) {
    this.lip = Mouth.ribbon();
    this.inner = Mouth.ribbon();
    this.teeth = Mouth.ribbon();
    const flat = (color: THREE.ColorRepresentation) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide });
    this.group.add(
      new THREE.Mesh(this.lip, flat(lipColor)),
      new THREE.Mesh(this.inner, flat(0x4a1a1f)),
      new THREE.Mesh(this.teeth, flat(0xf7f2ea)),
    );
  }

  private static ribbon(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const points = MOUTH_SEGMENTS + 1;
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(points * 2 * 3), 3),
    );
    const index: number[] = [];
    for (let i = 0; i < MOUTH_SEGMENTS; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(index);
    return geometry;
  }

  /** curve: -1 frown to +1 smile. open: 0 to 1. width: half width in metres. */
  update(curve: number, open: number, width: number): void {
    const lip = this.lip.getAttribute("position") as THREE.BufferAttribute;
    const inner = this.inner.getAttribute("position") as THREE.BufferAttribute;
    const teeth = this.teeth.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i <= MOUTH_SEGMENTS; i += 1) {
      const u = -1 + (2 * i) / MOUTH_SEGMENTS;
      const x = u * width;
      const arch = 1 - u * u;
      const centre = MOUTH_Y + curve * 0.0085 * (u * u - 0.45);
      const thick = 0.0031 * Math.sqrt(arch) + 0.0003;
      const gap = 0.017 * arch * open;

      const set = (attr: THREE.BufferAttribute, top: number, bottom: number, lift: number) => {
        attr.setXYZ(i * 2, x, top, faceZ(x, top) + lift);
        attr.setXYZ(i * 2 + 1, x, bottom, faceZ(x, bottom) + lift);
      };

      set(lip, centre + thick, centre - thick - gap, 0.0008);
      const innerTop = centre + thick * 0.16;
      const innerBottom = centre - thick * 0.16 - gap * 0.92;
      set(inner, innerTop, innerBottom, 0.0013);
      const bite = Math.abs(u) < 0.78 ? Math.min(0.0036, gap * 0.42) : 0;
      set(teeth, innerTop, innerTop - bite, 0.0018);
    }
    for (const attr of [lip, inner, teeth]) attr.needsUpdate = true;
  }

  dispose(): void {
    this.lip.dispose();
    this.inner.dispose();
    this.teeth.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Avatar                                                               */
/* ------------------------------------------------------------------ */

type ArmPose = { sx: number; sz: number; ex: number; ey: number };
type Arm = { shoulder: THREE.Group; elbow: THREE.Group; pose: ArmPose };

type Eye = { group: THREE.Group; iris: THREE.Object3D; lash: THREE.Mesh; baseY: number };

type Avatar = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  skin: THREE.MeshStandardMaterial;
  skinBase: THREE.Color;
  cheeks: THREE.MeshBasicMaterial;
  mouth: Mouth;
  eyes: [Eye, Eye];
  brows: [THREE.Group, THREE.Group];
  armR: Arm;
  armL: Arm;
  sway: THREE.Object3D[];
};

const POSES: Record<"down" | "counter" | "crossed" | "point", { R: ArmPose; L: ArmPose }> = {
  down: {
    R: { sx: 0.03, sz: -0.1, ex: -0.18, ey: 0.1 },
    L: { sx: 0.03, sz: 0.1, ex: -0.18, ey: -0.1 },
  },
  counter: {
    R: { sx: -0.56, sz: -0.06, ex: -0.86, ey: 0.34 },
    L: { sx: -0.56, sz: 0.06, ex: -0.86, ey: -0.34 },
  },
  crossed: {
    R: { sx: -0.34, sz: -0.08, ex: -1.78, ey: 1.22 },
    L: { sx: -0.5, sz: 0.08, ex: -1.5, ey: -1.3 },
  },
  point: {
    R: { sx: -0.92, sz: -0.16, ex: -1.22, ey: 0.22 },
    L: { sx: -0.5, sz: 0.06, ex: -0.9, ey: -0.36 },
  },
};

function buildArm(
  side: 1 | -1,
  shoulderWidth: number,
  sleeve: THREE.Material,
  skin: THREE.Material,
): Arm {
  const upperLength = 0.27;
  const foreLength = 0.24;

  const shoulder = new THREE.Group();
  shoulder.position.set(side * shoulderWidth, 1.352, 0);

  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.041, upperLength - 0.05, 6, 14), sleeve);
  upper.position.y = -upperLength / 2;
  upper.castShadow = true;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -upperLength;
  elbow.rotation.order = "YXZ";
  shoulder.add(elbow);

  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, foreLength - 0.05, 6, 14), sleeve);
  fore.position.y = -foreLength / 2;
  fore.castShadow = true;
  elbow.add(fore);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.039, 20, 16), skin);
  hand.scale.set(0.82, 1.08, 0.56);
  hand.position.y = -foreLength - 0.03;
  hand.castShadow = true;
  elbow.add(hand);

  return { shoulder, elbow, pose: { sx: 0, sz: side * 0.1, ex: -0.18, ey: 0 } };
}

function buildHair(look: CustomerLook, material: THREE.Material): THREE.Group {
  const hair = new THREE.Group();

  // A spherical cap tipped backwards: `reach` minus `tilt` is where the hairline sits on
  // the forehead, `reach` plus `tilt` is how far the hair runs down the back of the head.
  const cap = (radius: number, reach: number, tilt: number) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 32, 0, TAU, 0, reach),
      material,
    );
    mesh.scale.set(HEAD_SX * 1.03, HEAD_SY * 1.0, 1.05);
    mesh.rotation.x = -tilt;
    mesh.castShadow = true;
    return mesh;
  };
  // A side-swept lock across one temple, so the hairline is not a hard arc.
  const sweep = (x: number, lean: number, size = 1) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), material);
    mesh.scale.set(1.25 * size, 0.42 * size, 0.5);
    mesh.position.set(x, 0.086, 0.066);
    mesh.rotation.set(0.5, 0, lean);
    return mesh;
  };
  const lock = (x: number, length: number, depth: number) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, length, 6, 14), material);
    mesh.scale.set(0.66, 1, 1.15);
    mesh.position.set(x, -length / 2 + 0.035, depth);
    mesh.castShadow = true;
    return mesh;
  };

  if (look.hair === "short") {
    hair.add(cap(HEAD_R * 1.05, 1.36, 0.7), sweep(0.02, -0.16, 0.92));
    return hair;
  }

  hair.add(cap(HEAD_R * 1.075, look.hair === "updo" ? 1.5 : 1.62, 0.76), sweep(-0.03, 0.34));

  if (look.hair === "bob") {
    hair.add(lock(-0.098, 0.085, 0.0), lock(0.098, 0.085, 0.0));
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.108, 28, 20), material);
    back.scale.set(1.02, 1.0, 0.7);
    back.position.set(0, -0.035, -0.048);
    hair.add(back);
  } else if (look.hair === "long") {
    hair.add(lock(-0.1, 0.2, 0.012), lock(0.1, 0.2, 0.012));
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.104, 0.17, 8, 20), material);
    back.scale.set(1.03, 1, 0.6);
    back.position.set(0, -0.115, -0.056);
    hair.add(back);
  } else if (look.hair === "updo") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 18), material);
    bun.position.set(0, 0.112, -0.062);
    bun.castShadow = true;
    hair.add(bun, lock(-0.099, 0.02, 0.0), lock(0.099, 0.02, 0.0));
  } else {
    // ponytail
    hair.add(lock(-0.099, 0.03, 0.0), lock(0.099, 0.03, 0.0));
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.17, 6, 14), material);
    tail.position.set(0.062, -0.06, -0.098);
    tail.rotation.z = -0.32;
    tail.name = "sway";
    hair.add(tail);
  }
  return hair;
}

function buildAvatar(look: CustomerLook): Avatar {
  const male = look.gender === "m";
  const shoulderWidth = male ? 0.196 : 0.168;

  const skinBase = new THREE.Color(look.skin);
  const skin = matte(look.skin, 0.58);
  skin.emissive = new THREE.Color(0x5a2416);
  skin.emissiveIntensity = 0.1;
  const outfit = matte(look.outfit, 0.82);
  const accent = matte(look.outfitAccent, 0.7);
  const hairMaterial = matte(look.hairColor, 0.5);
  const gold = matte(GOLD, 0.3, 0.85);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const sway: THREE.Object3D[] = [];

  // Torso: a lathe profile squashed front to back gives sloping shoulders and a waist.
  const w = shoulderWidth;
  const profile = [
    [w * 0.84, 0.86],
    [w * 0.8, 1.0],
    [w * 0.9, 1.14],
    [w * 1.02, 1.26],
    [w * 1.06, 1.33],
    [w * 0.94, 1.378],
    [w * 0.62, 1.405],
    [0.05, 1.425],
    [0.0, 1.43],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), outfit);
  torso.scale.z = male ? 0.6 : 0.56;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Collar or neckline in the accent colour.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.014, 12, 36), accent);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.08, 0.84, 1);
  collar.position.set(0, 1.408, 0.006);
  body.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.047, 0.11, 24), skin);
  neck.position.y = 1.445;
  body.add(neck);

  if (look.accessory === "tie") {
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.03, 4), matte(0x7a2f38, 0.6));
    knot.position.set(0, 1.385, 0.092);
    knot.rotation.set(Math.PI, Math.PI / 4, 0);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 4), matte(0x7a2f38, 0.6));
    blade.scale.z = 0.3;
    blade.position.set(0, 1.27, 0.108);
    blade.rotation.set(Math.PI, Math.PI / 4, 0);
    const shirt = new THREE.Mesh(new THREE.CircleGeometry(0.05, 3), accent);
    shirt.position.set(0, 1.352, 0.1);
    shirt.rotation.z = Math.PI;
    shirt.scale.set(1, 1.9, 1);
    body.add(shirt, knot, blade);
  }
  if (look.accessory === "scarf") {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.026, 14, 36), gold);
    wrap.rotation.x = Math.PI / 2;
    wrap.scale.set(1.1, 0.9, 0.8);
    wrap.position.set(0, 1.41, 0.004);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 6, 12), gold);
    tail.scale.z = 0.5;
    tail.position.set(0.036, 1.31, 0.098);
    tail.rotation.z = 0.12;
    body.add(wrap, tail);
  }

  const armR = buildArm(-1, shoulderWidth, outfit, skin);
  const armL = buildArm(1, shoulderWidth, outfit, skin);
  body.add(armR.shoulder, armL.shoulder);

  /* ----- head ----- */
  const head = new THREE.Group();
  head.position.y = 1.598;
  head.scale.setScalar(HEAD_SCALE);
  body.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 56, 40), skin);
  skull.scale.set(HEAD_SX, HEAD_SY, 1);
  skull.castShadow = true;
  head.add(skull);

  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), skin);
    ear.scale.set(0.5, 1, 0.72);
    ear.position.set(side * 0.099, -0.004, 0.004);
    head.add(ear);
    if (look.accessory === "earrings") {
      const earring = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), gold);
      earring.position.set(side * 0.104, -0.036, 0.008);
      head.add(earring);
    }
  }

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.0085, 16, 12),
    matte(skinBase.clone().multiplyScalar(0.94), 0.6),
  );
  nose.scale.set(1, 1.3, 0.9);
  nose.position.set(0, -0.016, HEAD_R);
  head.add(nose);

  const cheeks = new THREE.MeshBasicMaterial({
    color: 0xd9655a,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  for (const side of [-1, 1] as const) {
    const x = side * 0.054;
    const y = -0.022;
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.0145, 24), cheeks);
    cheek.position.set(x, y, faceZ(x, y) + 0.0012);
    cheek.rotation.y = side * 0.5;
    head.add(cheek);
  }

  const eyeWhite = matte(0xfbf7f0, 0.35);
  const irisMaterial = matte(0x2b1a12, 0.3);
  const lashMaterial = matte(0x1c1410, 0.6);
  const browMaterial = matte(new THREE.Color(look.hairColor).multiplyScalar(0.8), 0.7);

  const makeEye = (side: 1 | -1): Eye => {
    const x = side * 0.039;
    const y = 0.014;
    const group = new THREE.Group();
    group.position.set(x, y, faceZ(x, y) - 0.004);
    group.rotation.y = side * 0.2;

    const white = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 24, 18), eyeWhite);
    white.scale.set(1.16, 0.98, 0.42);
    const iris = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.SphereGeometry(0.0108, 20, 16), irisMaterial);
    disc.scale.z = 0.36;
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.0024, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    glint.position.set(0.0036, 0.004, 0.0042);
    iris.add(disc, glint);
    iris.position.z = 0.0058;
    group.add(white, iris);

    const lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.002, 0.034, 4, 10), lashMaterial);
    lash.rotation.z = Math.PI / 2;
    lash.position.set(0, 0.0162, 0.0066);
    group.add(lash);

    head.add(group);
    return { group, iris, lash, baseY: y };
  };
  const eyes: [Eye, Eye] = [makeEye(-1), makeEye(1)];

  const makeBrow = (side: 1 | -1) => {
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(male ? 0.0046 : 0.0034, 0.03, 4, 10),
      browMaterial,
    );
    brow.rotation.z = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(brow);
    holder.userData["side"] = side;
    head.add(holder);
    return holder;
  };
  const brows: [THREE.Group, THREE.Group] = [makeBrow(-1), makeBrow(1)];

  const lipColor = male
    ? skinBase.clone().multiplyScalar(0.78)
    : new THREE.Color(0xb4575a).lerp(skinBase, 0.25);
  const mouth = new Mouth(lipColor);
  head.add(mouth.group);

  if (look.accessory === "glasses") {
    const frame = matte(0x2a2622, 0.35, 0.4);
    for (const side of [-1, 1] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0262, 0.0021, 8, 32), frame);
      ring.position.set(side * 0.039, 0.013, HEAD_R + 0.005);
      ring.rotation.y = side * 0.16;
      ring.scale.y = 0.86;
      head.add(ring);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.09, 6), frame);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(side * 0.071, 0.012, 0.062);
      arm.rotation.y = side * -0.5;
      head.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.026, 6), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.014, HEAD_R + 0.006);
    head.add(bridge);
  }

  if (look.accessory === "cap") {
    const capMaterial = matte(look.outfitAccent, 0.8);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R * 1.09, 40, 24, 0, TAU, 0, 1.36),
      capMaterial,
    );
    crown.scale.set(HEAD_SX * 1.02, HEAD_SY, 1.04);
    crown.rotation.x = -0.34;
    crown.castShadow = true;
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.086, 0.086, 0.008, 32, 1, false, -1.25, 2.5),
      capMaterial,
    );
    brim.scale.set(1, 1, 1.25);
    brim.position.set(0, 0.066, 0.07);
    brim.rotation.x = 0.16;
    head.add(crown, brim);
    const hair = buildHair({ ...look, hair: "short" }, hairMaterial);
    hair.scale.setScalar(0.97);
    head.add(hair);
  } else {
    const hair = buildHair(look, hairMaterial);
    hair.traverse((node) => {
      if (node.name === "sway") sway.push(node);
    });
    head.add(hair);
  }

  return { root, body, head, skin, skinBase, cheeks, mouth, eyes, brows, armR, armL, sway };
}

/* ------------------------------------------------------------------ */
/* Environment                                                          */
/* ------------------------------------------------------------------ */

function buildProp(kind: CustomerLook["prop"]): THREE.Group {
  const prop = new THREE.Group();
  const gold = matte(GOLD, 0.3, 0.85);
  const cast = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  if (kind === "bag") {
    const bodyMesh = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.1, 4, 4, 4), matte(0x9a6b45, 0.55)),
    );
    bodyMesh.position.y = 0.085;
    const flap = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.07, 0.105), matte(0x86593a, 0.5)),
    );
    flap.position.y = 0.14;
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.012), gold);
    clasp.position.set(0, 0.108, 0.056);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.008, 10, 28, Math.PI),
      matte(0x86593a, 0.5),
    );
    handle.position.y = 0.17;
    prop.add(bodyMesh, flap, clasp, handle);
  } else if (kind === "ticket") {
    const card = cast(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.07), matte(IVORY, 0.8)));
    card.position.y = 0.003;
    card.rotation.y = 0.3;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.0045, 0.014), gold);
    stripe.position.set(0, 0.0034, 0);
    stripe.rotation.y = 0.3;
    const purse = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.05), matte(0x2b1f2e, 0.4)),
    );
    purse.position.set(0.2, 0.05, 0.01);
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), gold);
    lock.position.set(0.2, 0.1, 0.01);
    prop.add(card, stripe, purse, lock);
  } else if (kind === "basket") {
    const basket = new THREE.Group();
    const shell = new THREE.BoxGeometry(0.3, 0.15, 0.2);
    const wall = cast(
      new THREE.Mesh(
        shell,
        new THREE.MeshStandardMaterial({
          color: 0x2f4a3d,
          roughness: 0.6,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );
    wall.position.y = 0.075;
    const edges = goldLines(shell, GOLD_SOFT, 0.8);
    edges.position.y = 0.075;
    const colours = [0xd9b976, 0xc9706a, 0xf1ede2, 0x6f8f7c];
    colours.forEach((colour, i) => {
      const item = cast(
        new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1 + (i % 2) * 0.04, 0.06), matte(colour, 0.7)),
      );
      item.position.set(-0.1 + i * 0.066, 0.1 + (i % 2) * 0.02, (i % 2) * 0.04 - 0.02);
      item.rotation.y = i * 0.5;
      basket.add(item);
    });
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.006, 8, 24, Math.PI),
      matte(0x1f2f28, 0.5),
    );
    handle.position.y = 0.15;
    basket.add(wall, edges, handle);
    prop.add(basket);
  } else if (kind === "foodbox") {
    const tray = cast(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14), matte(0x23201d, 0.6)));
    tray.position.y = 0.025;
    const food = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), matte(0xb9763a, 0.9));
    food.position.y = 0.05;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.03, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        transparent: true,
        opacity: 0.28,
      }),
    );
    lid.position.set(0.05, 0.062, 0.02);
    lid.rotation.set(0, 0.25, 0.06);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.001, 0.045), matte(IVORY, 0.8));
    label.position.set(-0.04, 0.0785, 0.01);
    label.rotation.y = 0.25;
    prop.add(tray, food, lid, label);
  } else if (kind === "garment") {
    const cover = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22), matte(0x20242b, 0.75)),
    );
    cover.position.y = 0.015;
    cover.rotation.y = -0.14;
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.031, 0.22), gold);
    zip.position.y = 0.0155;
    zip.rotation.y = -0.14;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 20, Math.PI * 1.4), gold);
    hook.position.set(0.016, 0.03, -0.12);
    hook.rotation.set(Math.PI / 2, 0, 0.4);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, 0.035), matte(IVORY, 0.8));
    tag.position.set(0.1, 0.032, 0.05);
    prop.add(cover, zip, hook, tag);
  } else if (kind === "phone") {
    const phone = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.009, 0.155), matte(0x16181c, 0.3, 0.3)),
    );
    phone.position.y = 0.0045;
    phone.rotation.y = 0.35;
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.066, 0.001, 0.142),
      new THREE.MeshStandardMaterial({
        color: 0xdfe8e2,
        emissive: 0xbfd6c8,
        emissiveIntensity: 0.7,
        roughness: 0.2,
      }),
    );
    screen.position.y = 0.0096;
    screen.rotation.y = 0.35;
    const gift = cast(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.002, 0.09), matte(IVORY, 0.9)));
    gift.position.set(0.19, 0.001, -0.02);
    gift.rotation.y = -0.2;
    prop.add(phone, screen, gift);
  } else if (kind === "cup") {
    const cup = cast(
      new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.11, 24), matte(IVORY, 0.7)),
    );
    cup.position.y = 0.055;
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0355, 0.031, 0.05, 24),
      matte(0x8a6a48, 0.9),
    );
    sleeve.position.y = 0.05;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.01, 24),
      matte(0x2a2622, 0.5),
    );
    lid.position.y = 0.114;
    const cloth = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.024, 0.15), matte(0xe9dcc3, 0.95)),
    );
    cloth.position.set(0.2, 0.012, 0);
    cloth.rotation.y = 0.2;
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), matte(0x7a5232, 0.95));
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(0.21, 0.0245, 0.01);
    stain.scale.set(1.3, 0.8, 1);
    prop.add(cup, sleeve, lid, cloth, stain);
  } else {
    // passport with a few receipts
    const book = cast(
      new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.125), matte(0x1d3557, 0.6)),
    );
    book.position.y = 0.004;
    book.rotation.y = -0.3;
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.016, 20), gold);
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.y = 0.0085;
    [0.12, 0.16, 0.2].forEach((x, i) => {
      const slip = cast(
        new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.001, 0.13), matte(0xfbf8f1, 0.9)),
      );
      slip.position.set(x, 0.001 + i * 0.0012, 0.01 * i);
      slip.rotation.y = 0.2 + i * 0.22;
      prop.add(slip);
    });
    prop.add(book, emblem);
  }
  return prop;
}

function archLine(
  width: number,
  height: number,
  y: number,
  z: number,
  color = GOLD,
  opacity = 0.9,
) {
  const half = width / 2;
  const points: THREE.Vector3[] = [new THREE.Vector3(-half, y, z)];
  const straight = height - half;
  points.push(new THREE.Vector3(-half, y + straight, z));
  for (let i = 0; i <= 32; i += 1) {
    const a = Math.PI - (Math.PI * i) / 32;
    points.push(new THREE.Vector3(Math.cos(a) * half, y + straight + Math.sin(a) * half, z));
  }
  points.push(new THREE.Vector3(half, y, z));
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

function buildEnvironment(
  backdrop: CustomerLook["backdrop"],
  silhouettes: THREE.Object3D[],
): THREE.Group {
  const env = new THREE.Group();
  const backZ = -1.9;

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.4), matte(WALL, 0.92));
  wall.position.set(0, 2.1, backZ);
  wall.receiveShadow = true;
  env.add(wall);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), matte(WALL_DEEP, 0.32, 0.1));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -0.4;
  floor.receiveShadow = true;
  env.add(floor);

  // Wall mouldings: a chair rail and tall panels drawn as gold hairlines.
  const z = backZ + 0.012;
  for (const y of [0.92, 0.98, 3.05]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.006, 0.004),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 }),
    );
    rail.position.set(0, y, z);
    env.add(rail);
  }
  for (const x of [-2.9, -1.75, 1.75, 2.9]) {
    const panel = goldLines(new THREE.PlaneGeometry(0.78, 1.72), GOLD, 0.42);
    panel.position.set(x, 2.0, z);
    env.add(panel);
  }

  const sconce = (x: number) => {
    const group = new THREE.Group();
    const glow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.22, 6, 14),
      new THREE.MeshStandardMaterial({
        color: 0xfff1cf,
        emissive: 0xffd58a,
        emissiveIntensity: 1.8,
        roughness: 0.4,
      }),
    );
    const cage = goldLines(new THREE.BoxGeometry(0.11, 0.42, 0.09), GOLD_SOFT, 0.9);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.012), matte(GOLD, 0.35, 0.8));
    plate.position.z = -0.05;
    const light = new THREE.PointLight(0xffd9a0, 1.1, 3.2, 2);
    light.position.z = 0.25;
    group.add(glow, cage, plate, light);
    group.position.set(x, 2.02, backZ + 0.09);
    return group;
  };

  if (backdrop === "lounge") {
    // The arched niche from the start screen illustration.
    env.add(
      archLine(1.7, 2.7, 0.98, z),
      archLine(1.46, 2.52, 0.98, z, GOLD, 0.6),
      archLine(0.98, 2.2, 0.98, z, GOLD_SOFT, 0.75),
    );
    const niche = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.7), matte(0x1d4233, 0.9));
    niche.position.set(0, 1.83, z - 0.004);
    env.add(niche);
    for (let i = 0; i < 9; i += 1) {
      const a = (Math.PI * (i + 0.5)) / 9;
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 2.69, z),
          new THREE.Vector3(Math.cos(a) * 0.47, 2.69 + Math.sin(a) * 0.47, z),
        ]),
        new THREE.LineBasicMaterial({ color: GOLD_SOFT, transparent: true, opacity: 0.6 }),
      );
      env.add(ray);
    }
    env.add(sconce(-1.32), sconce(1.32));
  } else if (backdrop === "boutique") {
    // Lit shelving with a few products on it.
    for (const x of [-1.05, 1.05]) {
      const bay = goldLines(new THREE.BoxGeometry(1.5, 2.1, 0.3), GOLD, 0.7);
      bay.position.set(x, 2.02, backZ + 0.16);
      env.add(bay);
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), matte(0x1d4233, 0.9));
      inside.position.set(x, 2.02, z - 0.004);
      env.add(inside);
      for (let row = 0; row < 3; row += 1) {
        const shelfY = 1.3 + row * 0.62;
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.014, 0.3), matte(GOLD, 0.4, 0.7));
        shelf.position.set(x, shelfY, backZ + 0.16);
        env.add(shelf);
        for (let i = 0; i < 3; i += 1) {
          const tones = [0xb99a6b, 0x7a2f38, 0xf1ede2, 0x3c2a3f, 0x4d6a8a];
          const tone = tones[(row * 3 + i + (x > 0 ? 2 : 0)) % tones.length] ?? 0xb99a6b;
          const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.2 + ((row + i) % 2) * 0.08, 0.12),
            matte(tone, 0.6),
          );
          item.position.set(
            x - 0.46 + i * 0.46,
            shelfY + 0.11 + ((row + i) % 2) * 0.04,
            backZ + 0.18,
          );
          env.add(item);
          if ((row + i) % 2 === 0) {
            const strap = new THREE.Mesh(
              new THREE.TorusGeometry(0.06, 0.006, 8, 20, Math.PI),
              matte(tone, 0.5),
            );
            strap.position.set(item.position.x, shelfY + 0.21, backZ + 0.18);
            env.add(strap);
          }
        }
        const strip = new THREE.PointLight(0xffe2b0, 0.35, 1.3, 2);
        strip.position.set(x, shelfY + 0.5, backZ + 0.3);
        env.add(strip);
      }
    }
    env.add(archLine(0.5, 2.5, 0.98, z, GOLD, 0.5));
  } else {
    // checkout: other shoppers wait behind as soft silhouettes
    env.add(sconce(-2.3), sconce(2.3));
    const tones = [0x24443a, 0x2a4b40, 0x1f3d33, 0x2d4f43];
    [
      [-0.95, -0.95, 1.02],
      [0.82, -1.2, 0.97],
      [-0.35, -1.5, 0.94],
      [1.5, -1.55, 1.0],
    ].forEach(([x, depth, scale], i) => {
      const person = new THREE.Group();
      const material = matte(tones[i % tones.length] ?? 0x24443a, 0.95);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.5, 6, 16), material);
      torso.scale.z = 0.62;
      torso.position.y = 1.12;
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), material);
      headMesh.position.y = 1.6;
      person.add(torso, headMesh);
      person.position.set(x ?? 0, 0, depth ?? -1);
      person.scale.setScalar(scale ?? 1);
      silhouettes.push(person);
      env.add(person);
    });
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1.0, 12),
      matte(GOLD, 0.35, 0.8),
    );
    post.position.set(1.15, 0.5, -0.45);
    const rope = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.01), matte(0x7a2f38, 0.8));
    rope.position.set(1.85, 0.93, -0.45);
    env.add(post, rope);
  }

  /* ----- the counter between customer and staff ----- */
  const counter = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.0, 0.52), matte(0x1a3a2d, 0.6));
  base.position.set(0, 0.5, 0.58);
  base.receiveShadow = true;
  const topGeometry = new THREE.BoxGeometry(3.0, 0.045, 0.62);
  const top = new THREE.Mesh(topGeometry, matte(0x102a20, 0.22, 0.15));
  top.position.set(0, 1.0225, 0.58);
  top.receiveShadow = true;
  const trim = goldLines(topGeometry, GOLD_SOFT, 0.95);
  trim.position.copy(top.position);
  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(2.86, 0.004, 0.004),
    new THREE.MeshBasicMaterial({ color: GOLD }),
  );
  inlay.position.set(0, 1.046, 0.31);
  counter.add(base, top, trim, inlay);
  env.add(counter);

  return env;
}

/* ------------------------------------------------------------------ */
/* Stage                                                                */
/* ------------------------------------------------------------------ */

export function createStage(
  canvas: HTMLCanvasElement,
  look: CustomerLook,
  options: { reducedMotion?: boolean } = {},
): StageHandle {
  const calmMotion = options.reducedMotion ? 0.35 : 1;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WALL_DEEP);
  scene.fog = new THREE.Fog(WALL_DEEP, 3.2, 7.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  const cameraHome = new THREE.Vector3(0, 1.55, CAMERA_DISTANCE);
  const lookTarget = new THREE.Vector3(0, 1.37, 0);

  scene.add(new THREE.HemisphereLight(0xfff3dc, 0x12281f, 0.75));
  const key = new THREE.DirectionalLight(0xffeccf, 2.5);
  key.position.set(-1.2, 2.9, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 8;
  key.shadow.camera.left = -1.4;
  key.shadow.camera.right = 1.4;
  key.shadow.camera.top = 2.4;
  key.shadow.camera.bottom = 0.4;
  key.shadow.bias = -0.0015;
  key.shadow.radius = 6;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe3da, 0.75);
  fill.position.set(1.8, 1.6, 2.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf2cf8a, 1.5);
  rim.position.set(1.4, 2.4, -1.6);
  scene.add(rim);

  const silhouettes: THREE.Object3D[] = [];
  scene.add(buildEnvironment(look.backdrop, silhouettes));

  const avatar = buildAvatar(look);
  scene.add(avatar.root);

  const prop = buildProp(look.prop);
  prop.position.set(look.prop === "basket" ? 0.52 : 0.46, 1.045, 0.5);
  scene.add(prop);

  /* ----- animation state ----- */
  let disposed = false;
  let frame = 0;
  let last = performance.now();
  let time = 0;

  let angerTarget = 0.76;
  let anger = 0.76;
  let state: StageState = "idle";
  let mouthSource: (() => number) | null = null;
  let mouthOpen = 0;
  let speakEnergy = 0;
  let flare = 0;
  let relief = 0;
  let enter = 0;
  let blink = 0;
  let nextBlink = 1.4;
  let gazeX = 0;
  let gazeY = 0;
  let gazeTargetX = 0;
  let gazeTargetY = 0;
  let nextGaze = 2;
  let lookAway = 0;

  const applyArm = (arm: Arm, target: ArmPose, extraFlex: number, dt: number) => {
    const p = arm.pose;
    p.sx = damp(p.sx, target.sx, 5, dt);
    p.sz = damp(p.sz, target.sz, 5, dt);
    p.ex = damp(p.ex, target.ex, 5, dt);
    p.ey = damp(p.ey, target.ey, 5, dt);
    arm.shoulder.rotation.set(p.sx, 0, p.sz);
    arm.elbow.rotation.set(p.ex + extraFlex, p.ey, 0);
  };

  const tick = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    anger = damp(anger, angerTarget, 2.2, dt);
    flare = damp(flare, 0, 2.6, dt);
    relief = damp(relief, 0, 1.6, dt);
    enter = Math.min(1, enter + dt / 1.25);
    const heat = clamp01(anger + flare * 0.25);

    /* speech */
    const speaking = state === "speaking";
    const level = speaking && mouthSource ? clamp01(mouthSource()) : 0;
    mouthOpen = damp(mouthOpen, level, level > mouthOpen ? 32 : 16, dt);
    speakEnergy = damp(speakEnergy, speaking ? 1 : 0, 6, dt);

    /* entrance: the customer walks up to the counter */
    const eased = 1 - Math.pow(1 - enter, 3);
    const walking = 1 - eased;
    avatar.root.position.x = walking * 1.25;
    avatar.root.position.z = walking * -0.25;
    avatar.root.rotation.y = walking * -0.6;

    /* body */
    const breathRate = lerp(1.25, 2.5, heat);
    const breath = Math.sin(time * breathRate);
    avatar.body.position.y =
      breath * 0.0032 * calmMotion +
      Math.abs(Math.sin(enter * Math.PI * 4)) * walking * 0.02 -
      relief * 0.012;
    avatar.body.rotation.x = lerp(-0.012, 0.085, heat) + flare * 0.07 + mouthOpen * 0.016 * heat;
    avatar.body.rotation.z = Math.sin(time * 0.6) * 0.012 * calmMotion * lerp(0.6, 1.6, heat);
    avatar.body.rotation.y = Math.sin(time * 0.37) * 0.03 * calmMotion + lookAway * 0.1;

    /* arms: posture carries the mood, speech adds emphasis */
    let pose = POSES.counter;
    if (heat > 0.6) pose = speaking ? POSES.point : POSES.crossed;
    else if (heat < 0.3) pose = speaking ? POSES.counter : POSES.down;
    const chop = speaking ? mouthOpen * 0.34 + Math.sin(time * 7) * 0.05 * speakEnergy : 0;
    applyArm(avatar.armR, pose.R, heat > 0.6 ? chop : chop * 0.3, dt);
    applyArm(avatar.armL, pose.L, 0, dt);

    /* head */
    if (time > nextGaze) {
      nextGaze = time + 1.2 + Math.random() * 2.6;
      const away = state === "listening" || state === "thinking";
      // An irritated listener keeps glancing away; a calm one holds eye contact.
      const wander = away ? lerp(0.15, 0.85, heat) : 0.2;
      lookAway = Math.random() < wander * 0.5 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      gazeTargetX = lookAway * 0.55 + (Math.random() - 0.5) * 0.25;
      gazeTargetY = state === "thinking" ? -0.3 : (Math.random() - 0.5) * 0.2;
    }
    if (speaking) {
      lookAway = damp(lookAway, 0, 6, dt);
      gazeTargetX = 0;
      gazeTargetY = 0;
    }
    gazeX = damp(gazeX, gazeTargetX, 9, dt);
    gazeY = damp(gazeY, gazeTargetY, 9, dt);

    const nod =
      state === "listening" && heat < 0.45 ? Math.max(0, Math.sin(time * 2.4)) * 0.035 : 0;
    const emphasis = mouthOpen * lerp(0.03, 0.075, heat);
    avatar.head.rotation.x = lerp(0.015, 0.11, heat) + nod + emphasis - relief * 0.06;
    avatar.head.rotation.y = gazeX * 0.22 + Math.sin(time * 0.9) * 0.02 * calmMotion;
    avatar.head.rotation.z =
      Math.sin(time * 0.5 + 1) * 0.02 * calmMotion +
      lerp(0.035, -0.02, heat) +
      relief * 0.06 +
      (speaking ? Math.sin(time * 5.2) * 0.022 * heat * speakEnergy : 0);

    /* eyes */
    if (time > nextBlink) {
      blink = 1;
      nextBlink = time + 1.8 + Math.random() * 3.4;
    }
    blink = damp(blink, 0, 14, dt);
    const squint = lerp(0, 0.3, heat);
    const openness = Math.max(0.08, (1 - squint) * (1 - blink));
    for (const eye of avatar.eyes) {
      eye.group.scale.y = openness;
      eye.iris.position.x = gazeX * 0.006;
      eye.iris.position.y = gazeY * 0.0045 - heat * 0.0014;
      eye.lash.position.y = 0.0162 - squint * 0.0045;
    }

    /* brows: the clearest signal of the three moods */
    for (const brow of avatar.brows) {
      const side = brow.userData["side"] as number;
      const x = side * lerp(0.041, 0.0365, heat);
      const y = lerp(0.054, 0.0425, heat) + relief * 0.004 - flare * 0.003;
      brow.position.set(x, y, faceZ(x, y) + 0.002);
      brow.rotation.y = side * 0.24;
      brow.rotation.z = side * (lerp(-0.1, 0.48, heat) + flare * 0.14);
    }

    /* mouth and skin */
    const curve = lerp(0.62, -1, clamp01(heat * 1.15)) + relief * 0.3;
    avatar.mouth.update(curve, mouthOpen, lerp(0.0245, 0.0215, heat) + mouthOpen * 0.002);
    avatar.cheeks.opacity = lerp(0.14, 0.4, heat);
    avatar.skin.color.copy(avatar.skinBase).lerp(FLUSH, heat * 0.08);

    for (const node of avatar.sway) node.rotation.z = -0.32 + Math.sin(time * 1.7) * 0.07;
    silhouettes.forEach((person, i) => {
      person.rotation.z = Math.sin(time * 0.5 + i * 1.7) * 0.02;
      person.position.y = Math.sin(time * 0.8 + i) * 0.006;
    });

    /* camera: a slow drift, plus a small jolt when the customer flares up */
    camera.position.set(
      cameraHome.x +
        Math.sin(time * 0.23) * 0.012 * calmMotion +
        Math.sin(time * 41) * flare * 0.004,
      cameraHome.y + Math.sin(time * 0.31) * 0.006 * calmMotion,
      cameraHome.z - flare * 0.05,
    );
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    // Narrow (phone) stages pull the camera back so the shoulders stay in frame, and
    // aim higher so the face sits below the title and gauge laid over the top.
    const pull = Math.max(1, Math.min(1.3, 0.92 / aspect));
    const tall = clamp01((1 - aspect) / 0.35);
    cameraHome.set(0, 1.55 + tall * 0.05, CAMERA_DISTANCE * pull);
    lookTarget.y = lerp(1.37, 1.58, tall);
    camera.updateProjectionMatrix();
  };

  const onVisibility = () => {
    cancelAnimationFrame(frame);
    if (!document.hidden && !disposed) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  frame = requestAnimationFrame(tick);

  return {
    setAnger(value) {
      angerTarget = clamp01(value / 100);
    },
    setState(next) {
      state = next;
      nextGaze = 0;
    },
    setMouthSource(source) {
      mouthSource = source;
    },
    react(kind) {
      if (kind === "flare") flare = 1;
      else relief = 1;
    },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      avatar.mouth.dispose();
      scene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
