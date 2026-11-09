"use client";
// A real 3D graphics card on a turntable, built from code (no model files): rounded shroud, raised
// lip, swept fan blades, gold edge connector, slotted bracket, violet LED strip. Each machine tier
// is a different card, and each one moves differently, so the tier reads before its spec does.
// It turns by itself; drag to turn it by hand. Reduced motion keeps it still.
import { useEffect, useRef } from "react";
import type * as T from "three";

type Motion = "steady" | "stutter" | "surge" | "scan";
type Spec = { fans: number; shroud: number; metalness: number; roughness: number; fanSpeed: number; motion: Motion; len: number };

// RTX cards are consumer coolers with open fans; the A100 is a sealed blower; the H100 is passive
// fins with a light bar running its length.
const SPECS: Record<string, Spec> = {
  rtx3060: { fans: 2, shroud: 0x6a22ff, metalness: 0.25, roughness: 0.55, fanSpeed: 7, motion: "stutter", len: 2.5 },
  rtx4090: { fans: 3, shroud: 0x7a2cff, metalness: 0.35, roughness: 0.45, fanSpeed: 11, motion: "steady", len: 3.1 },
  a100: { fans: 1, shroud: 0x4a14c8, metalness: 0.55, roughness: 0.35, fanSpeed: 16, motion: "scan", len: 2.9 },
  h100: { fans: 0, shroud: 0x2e0c8f, metalness: 0.7, roughness: 0.28, fanSpeed: 0, motion: "surge", len: 3.0 },
};

const DEPTH = 1.25;
const BLADES = 11;

function buildCard(THREE: typeof T, RoundedBox: typeof import("three/examples/jsm/geometries/RoundedBoxGeometry.js").RoundedBoxGeometry, spec: Spec) {
  const group = new THREE.Group();
  const own: T.BufferGeometry[] = [];
  const LEN = spec.len;
  const mats = {
    shroud: new THREE.MeshStandardMaterial({ color: spec.shroud, metalness: spec.metalness, roughness: spec.roughness }),
    rim: new THREE.MeshStandardMaterial({ color: 0xe8e4f2, metalness: 0.85, roughness: 0.25 }),
    blade: new THREE.MeshStandardMaterial({ color: 0xe2d1ff, metalness: 0.2, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1e1534, metalness: 0.2, roughness: 0.75 }),
    board: new THREE.MeshStandardMaterial({ color: 0x241a3d, metalness: 0.1, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0a33c, metalness: 0.95, roughness: 0.3 }),
    led: new THREE.MeshBasicMaterial({ color: 0xc9a7ff, transparent: true, opacity: 0.9 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  const add = (geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) => {
    own.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

  // board and edge connector with its keying notch
  box(LEN - 0.12, 0.05, DEPTH - 0.06, mats.board, 0, -0.05, 0);
  box(0.26, 0.115, 0.17, mats.gold, -0.62, -0.13, 0.12);
  box(1.05, 0.115, 0.17, mats.gold, 0.1, -0.13, 0.12);

  // shroud, with a raised lip framing the top so the middle reads as recessed
  add(new RoundedBox(LEN, 0.3, DEPTH, 3, 0.085), mats.shroud, 0, 0.15, 0);
  const LIP = 0.313;
  box(LEN - 0.16, 0.038, 0.07, mats.rim, 0, LIP, DEPTH / 2 - 0.075);
  box(LEN - 0.16, 0.038, 0.07, mats.rim, 0, LIP, -(DEPTH / 2 - 0.075));
  box(0.07, 0.038, DEPTH - 0.16, mats.rim, LEN / 2 - 0.075, LIP, 0);
  box(0.07, 0.038, DEPTH - 0.16, mats.rim, -(LEN / 2 - 0.075), LIP, 0);

  // bracket, slotted
  box(0.05, 0.62, DEPTH - 0.02, mats.rim, -LEN / 2 - 0.03, 0.06, 0);
  for (let i = 0; i < 4; i++) box(0.07, 0.055, 0.36, mats.dark, -LEN / 2 - 0.03, -0.12 + i * 0.12, 0.18);

  // fans, or (passive card) a field of fins
  const spinners: T.Group[] = [];
  if (spec.fans > 0) {
    const radius = Math.min((DEPTH - 0.3) / 2, (LEN - 0.38) / (2 * spec.fans));
    const span = spec.fans > 1 ? LEN - 0.4 - radius * 2 : 0;
    for (let i = 0; i < spec.fans; i++) {
      const f = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.034, 8, 30), mats.rim);
      own.push(ring.geometry);
      ring.rotation.x = Math.PI / 2;
      f.add(ring);
      const well = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.02, radius - 0.02, 0.02, 26), mats.dark);
      own.push(well.geometry);
      well.position.y = -0.012;
      f.add(well);
      const spinner = new THREE.Group();
      const blade = new THREE.BoxGeometry(radius * 0.72, 0.013, radius * 0.3);
      own.push(blade);
      for (let b = 0; b < BLADES; b++) {
        const m = new THREE.Mesh(blade, mats.blade);
        m.position.x = radius * 0.47;
        m.rotation.z = 0.36;
        m.rotation.y = 0.22;
        const arm = new THREE.Group();
        arm.rotation.y = (b / BLADES) * Math.PI * 2;
        arm.add(m);
        spinner.add(arm);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, 0.055, 20), mats.led);
      own.push(hub.geometry);
      hub.position.y = 0.014;
      spinner.add(hub);
      f.add(spinner);
      f.position.set(spec.fans > 1 ? -span / 2 + (i / (spec.fans - 1)) * span : 0, 0.312, 0);
      group.add(f);
      spinners.push(spinner);
    }
  } else {
    for (let i = 0; i < 18; i++) box(0.035, 0.07, DEPTH - 0.3, mats.rim, -LEN / 2 + 0.35 + i * ((LEN - 0.7) / 17), 0.33, 0);
  }

  // LED strip along the front edge, plus a spark that runs it on the surge card
  const strip = box(LEN - 0.5, 0.045, 0.05, mats.led, 0, 0.19, DEPTH / 2 + 0.012);
  const spark = spec.motion === "surge" || spec.motion === "scan" ? box(0.32, 0.062, 0.07, mats.spark, 0, 0.19, DEPTH / 2 + 0.012) : null;

  let t = 0;
  let spin = 0;
  return {
    group,
    update(dt: number, running: boolean) {
      t += dt;
      let rate = running ? spec.fanSpeed : spec.fanSpeed * 0.12;
      if (spec.motion === "stutter") {
        const phase = t % 3.4;
        rate *= phase < 0.26 ? 0.1 : Math.min(1, (phase - 0.26) / 0.85);
      }
      if (spec.motion === "surge" && running) group.position.y = Math.sin(t * 44) * 0.004;
      spin += rate * dt;
      for (const s of spinners) s.rotation.y = spin;
      if (spec.motion === "steady") (strip.material as T.MeshBasicMaterial).opacity = 0.55 + 0.35 * (1 - Math.cos(t * 1.9)) / 2;
      if (spark) spark.position.x = ((t * (running ? 1.25 : 0.3)) % 1) * (LEN - 0.56) - (LEN - 0.56) / 2;
    },
    dispose() {
      own.forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
}

export function Gpu3D({ tier, running, label }: { tier: string; running: boolean; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ tier, running });
  state.current = { tier, running };

  useEffect(() => {
    const canvas = canvasRef.current!;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      // a soft studio to reflect, or every metal surface renders as flat grey
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.55;
      scene.add(new THREE.HemisphereLight(0xe8dcff, 0x1a0b3a, 2.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.9);
      key.position.set(1.5, 3, 2.5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x8f4dff, 1.6);
      fill.position.set(-2.5, 1.2, -1.5);
      scene.add(fill);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
      let last = performance.now();

      let card: ReturnType<typeof buildCard> | null = null;
      let built = "";
      let spin = -0.6, drag: { x: number; spin: number } | null = null, auto = !still;

      const frame = () => {
        const r = canvas.parentElement!.getBoundingClientRect();
        if (!r.width || !r.height) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
        // frame the widest a turning card ever gets, read from above
        const across = 3.4;
        const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect);
        const dist = Math.max(1.1 / Math.tan(THREE.MathUtils.degToRad(15)), across / 2 / Math.tan(hFov / 2)) * 1.12;
        camera.position.set(0, dist * 0.62, dist);
        camera.lookAt(0, 0.1, 0);
      };
      const ro = new ResizeObserver(frame);
      ro.observe(canvas.parentElement!);

      const down = (e: PointerEvent) => { drag = { x: e.clientX, spin }; auto = false; canvas.setPointerCapture(e.pointerId); };
      const move = (e: PointerEvent) => { if (drag) spin = drag.spin + (e.clientX - drag.x) * 0.012; };
      const up = () => { drag = null; };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);

      // only draw while on screen
      let visible = true;
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
      io.observe(canvas);

      let raf = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const t = performance.now();
        const dt = Math.min((t - last) / 1000, 0.05);
        last = t;
        const { tier: want, running: run } = state.current;
        if (want !== built) {
          if (card) { scene.remove(card.group); card.dispose(); }
          card = buildCard(THREE, RoundedBoxGeometry, SPECS[want] ?? SPECS.rtx3060);
          scene.add(card.group);
          built = want;
          frame();
        }
        if (!visible) return;
        if (!still) card!.update(dt, run);
        if (auto && !drag) spin += dt * 0.35;
        card!.group.rotation.y = spin;
        renderer.render(scene, camera);
      };
      loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
        card?.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className="gpu3d">
      <canvas ref={canvasRef} role="img" aria-label={`${label ?? tier} graphics card, 3D. Drag to turn it.`} />
      <span className="gpu3d__hint" aria-hidden="true">drag to turn</span>
    </div>
  );
}
