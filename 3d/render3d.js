/*
 * PTSC Cup 3D renderer. The match engine (ptsc-football.js) keeps simulating as in 2D; when this file is loaded it
 * hands each match a canvas and calls frame(dt) after every simulation step. Everything the page does around the
 * match (menus, game plan, skills, timeouts, key layouts) is the 2D game's own.
 */
(() => {
  "use strict";
  if (!window.BABYLON) return;
  const V3 = BABYLON.Vector3, Q = BABYLON.Quaternion, C3 = BABYLON.Color3;
  const LEN = 45, WID = 30;
  const W = (u, v, y = 0) => new V3((u - .5) * LEN, y, (.5 - v) * WID);
  const SKIN = ["#f3d6bd", "#d7a983", "#9e6b47", "#5d3a25"];
  const HAIR = { black: "#1c1c22", darkBrown: "#3a291f", brown: "#6a4a2e", blond: "#d9b764", ginger: "#b4562c", platinum: "#e9e2d2" };
  const FALLBACK = { "var(--art-red)": "#d8423a", "var(--art-blue)": "#2f6fbf", "var(--color-card)": "#fffdf6", "var(--art-shorts)": "#1d2a55", "var(--art-gk-r)": "#f2c13b", "var(--art-gk-b)": "#2fb36f", "var(--color-ink)": "#1d2340" };
  const hex = c => FALLBACK[c] ?? (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : "#888888");
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rad = d => d * Math.PI / 180;
  const quality = () => { try { return localStorage.getItem("ptsc3d.quality") || "high"; } catch { return "high"; } };

  /* ------------------------------ poses ------------------------------ */
  // A 3D pose: the engine's sagittal angles (hip/knee front and back legs, shoulder/elbow front and back arms,
  // lean L, jump j, pitch rot) plus what a side view cannot show: arms and legs out to the side (abd*), a sideways
  // roll of the whole body (roll) and a twist of the shoulders (twist). "F" limbs are on the left, "B" on the right.
  const BASE = { hF: 4, kF: 8, hB: -4, kB: 8, aF: 84, eF: -20, aB: 96, eB: -20, L: 4, j: 0, rot: 0, abdAF: 10, abdAB: 10, abdLF: 3, abdLB: 3, roll: 0, twist: 0 };
  const P3 = o => ({ ...BASE, ...o });
  /** Poses the 2D side view got away with but a 3D body does not; keyed by the engine's pose names. */
  const OVERRIDE = {
    ready: P3({}),
    keeper: P3({ hF: 30, kF: 48, hB: 30, kB: 48, aF: 62, eF: -38, aB: 62, eB: -38, L: 18, abdAF: 38, abdAB: 38, abdLF: 12, abdLB: 12 }),
    jockey: P3({ hF: 26, kF: 46, hB: 18, kB: 40, aF: 70, eF: -30, aB: 70, eB: -30, L: 16, abdAF: 30, abdAB: 30, abdLF: 10, abdLB: 10, twist: 18 }),
    stance: P3({ hF: 8, kF: 14, hB: -14, kB: 18, aF: 80, eF: -10, aB: 100, eB: -10, L: 6, abdAF: 18, abdAB: 18 }),
    catch: P3({ hF: 10, kF: 18, hB: 6, kB: 16, aF: 30, eF: -80, aB: 30, eB: -80, L: 8, abdAF: 16, abdAB: 16 }),
    gkChest: P3({ hF: 14, kF: 26, hB: 10, kB: 22, aF: 35, eF: -85, aB: 35, eB: -85, L: 12, abdAF: 14, abdAB: 14 }),
    gkHigh: P3({ hF: 12, kF: 34, hB: -6, kB: 30, aF: -78, eF: -8, aB: -82, eB: -8, L: -4, j: 16, abdAF: 14, abdAB: 14 }),
    gkLow: P3({ hF: 40, kF: 110, hB: 10, kB: 95, aF: 62, eF: -20, aB: 62, eB: -20, L: 40, abdAF: 14, abdAB: 14, abdLF: 16, abdLB: 16 }),
    // Diving sideways (the side is chosen per dive from where the ball is).
    dive: P3({ hF: 6, kF: 12, hB: -4, kB: 30, aF: -84, eF: -4, aB: -88, eB: -4, L: 0, j: 14, roll: 78, abdAF: 8, abdAB: 8, abdLF: 6, abdLB: 14 }),
    diveLand: P3({ hF: 10, kF: 30, hB: 0, kB: 40, aF: -60, eF: -20, aB: -70, eB: -20, L: 0, roll: 86, abdAF: 10, abdAB: 10 }),
    // Overarm throw: the throwing arm (right) goes back behind the shoulder, the other points the way, then it comes over the top.
    throwLoad: P3({ hF: 30, kF: 20, hB: -18, kB: 22, aF: 15, eF: -10, aB: 195, eB: -15, L: -8, abdAF: 12, abdAB: 10, twist: -36 }),
    throw: P3({ hF: 32, kF: 24, hB: -24, kB: 20, aF: 115, eF: -10, aB: -20, eB: -6, L: 20, abdAF: 14, abdAB: 6, twist: 26 }),
    // Underarm roll: crouched, the arm swings low from behind to in front.
    rollLoad: P3({ hF: 48, kF: 80, hB: -20, kB: 45, aF: 75, eF: -45, aB: 160, eB: -8, L: 38, abdAF: 14, abdAB: 4, twist: -14 }),
    roll: P3({ hF: 46, kF: 72, hB: -24, kB: 36, aF: 75, eF: -45, aB: 40, eB: -4, L: 36, abdAF: 14, abdAB: 2, twist: 10 }),
    // Kicking: the arms open for balance.
    kickBack: P3({ hF: -36, kF: 95, hB: 4, kB: 22, aF: 110, eF: -10, aB: 40, eB: -25, L: 8, abdAF: 40, abdAB: 46, twist: -14 }),
    kick: P3({ hF: 40, kF: 18, hB: 0, kB: 22, aF: 130, eF: -10, aB: 30, eB: -20, L: 10, abdAF: 44, abdAB: 52, twist: 16 }),
    passBack: P3({ hF: -24, kF: 60, hB: 2, kB: 18, aF: 100, eF: -15, aB: 60, eB: -25, L: 6, abdAF: 32, abdAB: 36, abdLF: 14 }),
    passKick: P3({ hF: 26, kF: 16, hB: 0, kB: 20, aF: 110, eF: -15, aB: 50, eB: -25, L: 8, abdAF: 34, abdAB: 40, abdLF: 22 }),
    // Winning the ball: a poke with the leg stretched, the body low; a slide on the hip, one hand down.
    tap: P3({ hF: 44, kF: 8, hB: -10, kB: 40, aF: 100, eF: -25, aB: 70, eB: -25, L: 18, abdAF: 34, abdAB: 34, abdLF: 12, j: 0 }),
    slide: P3({ hF: 28, kF: 4, hB: -6, kB: 100, aF: 150, eF: -10, aB: 170, eB: -10, L: -10, rot: -58, roll: 30, abdAF: 30, abdAB: 46, abdLF: 4, abdLB: 10 }),
    sitUp: P3({ hF: 80, kF: 40, hB: 60, kB: 100, aF: 160, eF: -10, aB: 140, eB: -20, L: -20, rot: -30, roll: 10, abdAF: 25, abdAB: 25 }),
    wall: P3({ hF: 2, kF: 6, hB: -2, kB: 6, aF: 20, eF: -150, aB: 20, eB: -150, L: 2, abdAF: 4, abdAB: 4 }),
    handsKnees: P3({ hF: 30, kF: 30, hB: 26, kB: 26, aF: 70, eF: -10, aB: 70, eB: -10, L: 50, abdAF: 14, abdAB: 14, abdLF: 8, abdLB: 8 }),
  };
  /** A running or walking cycle at a phase, its size from the speed (so slow steps are small, sprints long). */
  function cycle(name, phase, speed) {
    const s = Math.sin(phase), size = clamp(speed / 6.5, .28, 1.05), dribble = name === "dribble" || name === "dribbleLow" || name === "carryRun";
    const amp = (dribble ? 26 : 38) * size, lift = (dribble ? 40 : 56) * size;
    return P3({ hF: amp * s + 4, kF: 16 + lift * Math.max(0, -s), hB: -amp * s + 4, kB: 16 + lift * Math.max(0, s),
      aF: 92 + 44 * size * s, eF: -60 - 30 * size, aB: 92 - 44 * size * s, eB: -60 - 30 * size, L: 6 + 10 * size + (dribble ? 4 : 0),
      j: 2.5 * size * Math.abs(Math.cos(phase)), abdAF: 12, abdAB: 12, abdLF: 2, abdLB: 2, twist: -8 * size * s });
  }
  const CYCLES = new Set(["run", "carryRun", "dribble", "dribbleLow", "walkSad"]);
  const STATIC = new Set(["ready", "keeper", "jockey", "stance", "handsKnees", "hipsHands", "slump"]);

  /* ------------------------------ the body ------------------------------ */
  // Segment lengths for a man of 1.80 m (metres).
  const BODY = { TH: .44, SH: .44, TORSO: .5, NECK: .07, HR: .125, UA: .29, FA: .27, HIP: .1, SHOULDER: .19 };
  /**
   * Joints in the body's own frame, metres: x forward, y up, z to the left. Sagittal angles as the engine's rig,
   * abduction carries a limb out sideways, roll and pitch turn the whole body, then it rests on the ground.
   */
  function rig3d(q, sc, leg, arm) {
    const TH = BODY.TH * sc * leg, SH = BODY.SH * sc * leg, UA = BODY.UA * sc * arm, FA = BODY.FA * sc * arm, TORSO = BODY.TORSO * sc, HR = BODY.HR * sc, NECK = BODY.NECK * sc;
    const hipW = BODY.HIP * sc, shW = BODY.SHOULDER * sc;
    const v = (x, y, z) => ({ x, y, z });
    const add = (a, b, k) => v(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
    const legDir = (a, abd, side) => { const c = Math.cos(rad(abd)); return v(Math.sin(rad(a)) * c, -Math.cos(rad(a)) * c, Math.sin(rad(abd)) * side); };
    // The engine's arm angle: 0 straight forward, 90 hanging down, 180 straight back, -90 straight up.
    const armDir = (a, abd, side) => { const c = Math.cos(rad(abd)); return v(Math.cos(rad(a)) * c, -Math.sin(rad(a)) * c, Math.sin(rad(abd)) * side); };
    const lean = rad(q.L), up = v(Math.sin(lean), Math.cos(lean), 0);
    const tw = rad(q.twist ?? 0), twist = p => v(p.x * Math.cos(tw) - p.z * Math.sin(tw), p.y, p.x * Math.sin(tw) + p.z * Math.cos(tw));
    const hip = v(0, 0, 0), hipF = v(0, 0, hipW), hipB = v(0, 0, -hipW);
    const kneeF = add(hipF, legDir(q.hF, q.abdLF ?? 0, 1), TH), footF = add(kneeF, legDir(q.hF - q.kF, q.abdLF ?? 0, 1), SH);
    const kneeB = add(hipB, legDir(q.hB, q.abdLB ?? 0, -1), TH), footB = add(kneeB, legDir(q.hB - q.kB, q.abdLB ?? 0, -1), SH);
    const top = add(hip, up, TORSO), neck = add(top, up, NECK), head = add(top, up, NECK + HR);
    const shF = add(top, twist(v(0, 0, shW)), 1), shB = add(top, twist(v(0, 0, -shW)), 1);
    const elbowF = add(shF, twist(armDir(q.aF + q.L, q.abdAF ?? 0, 1)), UA), handF = add(elbowF, twist(armDir(q.aF + q.L + q.eF, (q.abdAF ?? 0) * .6, 1)), FA);
    const elbowB = add(shB, twist(armDir(q.aB + q.L, q.abdAB ?? 0, -1)), UA), handB = add(elbowB, twist(armDir(q.aB + q.L + q.eB, (q.abdAB ?? 0) * .6, -1)), FA);
    const r = { hip, hipF, hipB, kneeF, footF, kneeB, footB, top, neck, head, shF, shB, elbowF, handF, elbowB, handB };
    // Pitch (the engine's rot: positive tips forward) then roll (positive onto the left side).
    const pr = rad(-(q.rot ?? 0)), rl = rad(q.roll ?? 0);
    for (const k in r) {
      let { x, y, z } = r[k];
      if (pr) { const nx = x * Math.cos(pr) - y * Math.sin(pr), ny = x * Math.sin(pr) + y * Math.cos(pr); x = nx; y = ny; }
      if (rl) { const ny = y * Math.cos(rl) - z * Math.sin(rl), nz = y * Math.sin(rl) + z * Math.cos(rl); y = ny; z = nz; }
      r[k] = v(x, y, z);
    }
    const low = Math.min(r.footF.y - .05, r.footB.y - .05, r.kneeF.y - .07, r.kneeB.y - .07, r.head.y - HR, r.handF.y - .05, r.handB.y - .05, r.top.y - .15, r.hip.y - .12, r.hipF.y - .1);
    const lift = -low + (q.j ?? 0) * .02;
    for (const k in r) r[k].y += lift;
    return r;
  }
  const lerpPose = (a, b, k) => { const o = {}; for (const key in b) o[key] = (a[key] ?? b[key]) + (b[key] - (a[key] ?? b[key])) * k; return o; };

  /* ------------------------------ one match ------------------------------ */
  function attach({ canvas, api, root }) {
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = BABYLON.Color4.FromHexString("#9cc9eaff");
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = .0032; scene.fogColor = C3.FromHexString("#b6d4ea");
    const hemi = new BABYLON.HemisphericLight("sky", new V3(0, 1, 0), scene); hemi.intensity = .66; hemi.groundColor = C3.FromHexString("#4e6b50");
    const sun = new BABYLON.DirectionalLight("sun", new V3(-.35, -1, .45), scene); sun.position = new V3(30, 60, -40); sun.intensity = 1.2;
    const shadows = new BABYLON.ShadowGenerator(2048, sun);
    shadows.usePercentageCloserFiltering = true; shadows.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM; shadows.bias = .002;
    const high = quality() === "high";
    const materials = new Map();
    const mat = (color, { cel = true, emissive = null, alpha = 1 } = {}) => {
      const key = color + cel + emissive + alpha;
      if (materials.has(key)) return materials.get(key);
      let m;
      if (cel && BABYLON.CellMaterial) { m = new BABYLON.CellMaterial("cel", scene); m.diffuseColor = C3.FromHexString(color); m.computeHighLevel = true; }
      else { m = new BABYLON.StandardMaterial("std", scene); m.diffuseColor = C3.FromHexString(color); m.specularColor = new C3(.05, .05, .05); }
      if (emissive) m.emissiveColor = C3.FromHexString(emissive);
      if (alpha < 1) m.alpha = alpha;
      materials.set(key, m); return m;
    };
    const outline = m => { m.renderOutline = high; m.outlineWidth = .012; m.outlineColor = C3.FromHexString("#14181f"); return m; };
    const caster = m => { shadows.addShadowCaster(m, false); return m; };

    /* stadium */
    const stadium = {};
    (() => {
      const surround = BABYLON.MeshBuilder.CreateGround("surround", { width: 120, height: 100 }, scene);
      surround.position.y = -.02; surround.material = mat("#2f7a3a", { cel: false }); surround.receiveShadows = true;
      const pitch = BABYLON.MeshBuilder.CreateGround("pitch", { width: LEN, height: WID }, scene);
      const tex = new BABYLON.DynamicTexture("pitchTex", { width: 2048, height: 1366 }, scene, true), g = tex.getContext(), px = 2048 / LEN;
      const P = (x, z) => [(x + LEN / 2) * px, (z + WID / 2) * px];
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? "#3c9446" : "#44a04e"; g.fillRect(i * 2048 / 14, 0, 2048 / 14 + 1, 1366); }
      for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < .5 ? "#ffffff09" : "#0000000b"; g.fillRect(Math.random() * 2048, Math.random() * 1366, 3, 3); }
      g.strokeStyle = "#f4f7f1"; g.lineWidth = .13 * px;
      const line = pts => { g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
      const e = .2;
      line([[-LEN / 2 + e, -WID / 2 + e], [LEN / 2 - e, -WID / 2 + e], [LEN / 2 - e, WID / 2 - e], [-LEN / 2 + e, WID / 2 - e], [-LEN / 2 + e, -WID / 2 + e]]);
      line([[0, -WID / 2 + e], [0, WID / 2 - e]]);
      const arc = (x, z, r, a0 = 0, a1 = Math.PI * 2) => { const [a, b] = P(x, z); g.beginPath(); g.arc(a, b, r * px, a0, a1); g.stroke(); };
      const spot = (x, z) => { const [a, b] = P(x, z); g.fillStyle = "#f4f7f1"; g.beginPath(); g.arc(a, b, .16 * px, 0, Math.PI * 2); g.fill(); };
      arc(0, 0, 3); spot(0, 0);
      for (const [x, dir] of [[-LEN / 2 + e, 1], [LEN / 2 - e, -1]]) { arc(x, 0, 9.5, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI * 1.5); spot(x + dir * 6, 0); }
      tex.update(); tex.anisotropicFilteringLevel = 8;
      const pm = new BABYLON.StandardMaterial("pitchMat", scene); pm.diffuseTexture = tex; pm.specularColor = new C3(.02, .02, .02);
      pitch.material = pm; pitch.receiveShadows = true;
      const boardTex = new BABYLON.DynamicTexture("boards", { width: 1024, height: 64 }, scene, true), bg = boardTex.getContext();
      for (let i = 0; i < 4; i++) { bg.fillStyle = ["#0e1726", "#dafa81", "#c4372d", "#2b74c4"][i]; bg.fillRect(i * 256, 0, 256, 64); bg.fillStyle = i === 1 ? "#0e1726" : "#ffffff"; bg.font = "bold 40px sans-serif"; bg.textAlign = "center"; bg.fillText(["PTSC CUP", "6 VS 6", "PTSC 3D", "PTSC CUP"][i], i * 256 + 128, 46); }
      boardTex.update();
      const boardMat = new BABYLON.StandardMaterial("boardMat", scene); boardMat.diffuseTexture = boardTex; boardMat.emissiveColor = new C3(.35, .35, .35);
      for (const [x, z, w, ry] of [[0, WID / 2 + 2.4, LEN + 6, 0], [LEN / 2 + 3, 0, WID + 4, Math.PI / 2], [-LEN / 2 - 3, 0, WID + 4, -Math.PI / 2]]) {
        const b = BABYLON.MeshBuilder.CreateBox("board", { width: w, height: .9, depth: .12 }, scene); b.position.set(x, .45, z); b.rotation.y = ry; b.material = boardMat;
      }
      const standMat = mat("#5d6b7d", { cel: false }), crowd = [];
      const stand = (cx, cz, length, ry, rows) => {
        for (let r = 0; r < rows; r++) {
          const step = BABYLON.MeshBuilder.CreateBox("step", { width: length, height: .8 * (r + 1), depth: 1.1 }, scene), out = 4.5 + r * 1.1;
          step.position.set(cx + Math.sin(ry) * out, .4 * (r + 1), cz + Math.cos(ry) * out); step.rotation.y = ry; step.material = standMat;
          for (let k = -length / 2 + .4; k < length / 2 - .3; k += .62) crowd.push({ x: cx + Math.cos(ry) * k + Math.sin(ry) * out, z: cz - Math.sin(ry) * k + Math.cos(ry) * out, y: .8 * (r + 1) + .35, ry });
        }
      };
      stand(0, WID / 2 + 1, 66, 0, high ? 9 : 5); stand(LEN / 2 + 2, 0, 44, Math.PI / 2, high ? 8 : 4); stand(-LEN / 2 - 2, 0, 44, -Math.PI / 2, high ? 8 : 4);
      const fan = BABYLON.MeshBuilder.CreateBox("fan", { width: .42, height: .62, depth: .3 }, scene);
      fan.material = new BABYLON.StandardMaterial("fanMat", scene); fan.material.specularColor = new C3(0, 0, 0);
      const matrices = new Float32Array(crowd.length * 16), colors = new Float32Array(crowd.length * 4);
      const colorsOf = ["#d8423a", "#2f6fbf", "#f4f4f4", "#1d2340", "#f2c13b", "#e07a3a", "#7bc96f"];
      crowd.forEach((c, i) => {
        BABYLON.Matrix.Compose(new V3(1, .9 + Math.random() * .25, 1), Q.RotationYawPitchRoll(c.ry, 0, 0), new V3(c.x, c.y, c.z)).copyToArray(matrices, i * 16);
        const col = C3.FromHexString(colorsOf[Math.floor(Math.random() * colorsOf.length)]); colors.set([col.r, col.g, col.b, 1], i * 4);
      });
      fan.thinInstanceSetBuffer("matrix", matrices, 16); fan.thinInstanceSetBuffer("color", colors, 4);
      stadium.crowd = { mesh: fan, matrices, base: crowd.map(c => c.y), count: crowd.length };
      for (const [x, z] of [[-34, 26], [34, 26], [-34, -26], [34, -26]]) {
        const mast = BABYLON.MeshBuilder.CreateCylinder("mast", { height: 26, diameter: .5 }, scene); mast.position.set(x, 13, z); mast.material = mat("#3a4352", { cel: false });
        const lamp = BABYLON.MeshBuilder.CreateBox("lamp", { width: 4, height: 2.4, depth: .4 }, scene); lamp.position.set(x, 26, z); lamp.lookAt(V3.Zero()); lamp.material = mat("#fffbe0", { cel: false, emissive: "#fff6c8" });
      }
      for (const x of [-6, 6]) {
        const roof = BABYLON.MeshBuilder.CreateBox("dugout", { width: 7, height: .15, depth: 1.6 }, scene); roof.position.set(x, 2.1, WID / 2 + 1.4); roof.material = mat("#c9d4de", { cel: false, alpha: .85 });
        const seat = BABYLON.MeshBuilder.CreateBox("bench", { width: 7, height: .45, depth: .6 }, scene); seat.position.set(x, .22, WID / 2 + 1.6); seat.material = mat("#2b3647", { cel: false });
      }
    })();

    /* goals: posts and bar, and a net of real lines (back, sides, roof) */
    const snap0 = api.snapshot(), PITCH = snap0.pitch;
    for (const dir of [1, -1]) {
      const x = dir * LEN / 2, half = (PITCH.goal[1] - PITCH.goal[0]) * WID / 2, h = PITCH.goalHeight, depth = PITCH.goalDepth * LEN, white = mat("#ffffff");
      for (const z of [-half, half]) { const post = BABYLON.MeshBuilder.CreateCylinder("post", { height: h, diameter: .12 }, scene); post.position.set(x, h / 2, z); post.material = white; outline(caster(post)); }
      const bar = BABYLON.MeshBuilder.CreateCylinder("bar", { height: half * 2 + .12, diameter: .12 }, scene); bar.rotation.x = Math.PI / 2; bar.position.set(x, h, 0); bar.material = white; outline(caster(bar));
      const back = x + dir * depth, lowBack = .35, lines = [], step = .2;
      // The net hangs from the bar back to a lower back line: the back slopes, as a real six-a-side goal's does.
      const backTop = h * .78;
      for (let z = -half; z <= half + 1e-6; z += step) { lines.push([new V3(x, h, z), new V3(back, backTop, z), new V3(back, 0, z)]); }
      for (let y = 0; y <= backTop + 1e-6; y += step) lines.push([new V3(back, y, -half), new V3(back, y, half)]);
      for (let k = 0; k <= 1 + 1e-6; k += step / depth) { const xx = x + dir * depth * k, yy = h + (backTop - h) * k; lines.push([new V3(xx, yy, -half), new V3(xx, yy, half)]); }
      for (const z of [-half, half]) {
        for (let k = 0; k <= 1 + 1e-6; k += step / depth) { const xx = x + dir * depth * k, yy = h + (backTop - h) * k; lines.push([new V3(xx, 0, z), new V3(xx, yy, z)]); }
        for (let y = 0; y <= h + 1e-6; y += step) { const k = y > backTop ? (h - y) / (h - backTop) : 1; lines.push([new V3(x, y, z), new V3(x + dir * depth * k, y, z)]); }
      }
      const net = BABYLON.MeshBuilder.CreateLineSystem("net", { lines }, scene);
      net.color = new C3(.95, .97, 1); net.alpha = .75; net.isPickable = false;
      stadium["net" + dir] = net;
      void lowBack;
    }

    /* the ball */
    const ball = (() => {
      const tex = new BABYLON.DynamicTexture("ballTex", { width: 256, height: 128 }, scene, true), g = tex.getContext();
      g.fillStyle = "#fbfbf6"; g.fillRect(0, 0, 256, 128); g.fillStyle = "#1d2340";
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const x = i * 44 + (j % 2) * 22 + 10, y = j * 44 + 16; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); } g.fill(); }
      tex.update();
      const b = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: .24, segments: 20 }, scene);
      const m = new BABYLON.StandardMaterial("ballMat", scene); m.diffuseTexture = tex; m.specularColor = new C3(.3, .3, .3); m.emissiveColor = new C3(.15, .15, .15);
      b.material = m; b.rotationQuaternion = Q.Identity(); outline(caster(b));
      return b;
    })();

    /* people */
    const capsule = (name, length, radius, material) => {
      const m = BABYLON.MeshBuilder.CreateCapsule(name, { height: Math.max(length, 2 * radius + .01), radius, tessellation: 12, subdivisions: 1, capSubdivisions: 5 }, scene);
      m.material = material; m.rotationQuaternion = Q.Identity(); return outline(caster(m));
    };
    const aim = (mesh, a, b, forward) => {
      const dir = b.subtract(a), len = dir.length() || 1e-4; dir.scaleInPlace(1 / len);
      let x = V3.Cross(dir, forward); if (x.lengthSquared() < 1e-6) x = V3.Cross(dir, V3.Right());
      x.normalize(); const z = V3.Cross(x, dir).normalize();
      mesh.position.copyFrom(a.add(b).scaleInPlace(.5)); mesh.rotationQuaternion = Q.RotationQuaternionFromAxis(x, dir, z);
    };
    const basisQuat = (up, forward) => { const y = up.clone().normalize(); let x = V3.Cross(y, forward); if (x.lengthSquared() < 1e-6) x = V3.Right(); x.normalize(); const z = V3.Cross(x, y).normalize(); return Q.RotationQuaternionFromAxis(x, y, z); };
    function dressHead(head, look, R, skinMat) {
      const hairMat = mat(HAIR[look?.hairColor] ?? HAIR.black), style = look?.hair ?? "crop", kid = [];
      const sphere = (name, d, segments = 12) => BABYLON.MeshBuilder.CreateSphere(name, { diameter: d, segments }, scene);
      const cap = (scale = 1.11, tilt = -.35, slice = .47) => { const m = BABYLON.MeshBuilder.CreateSphere("hair", { diameter: 2 * R * scale, segments: 16, slice }, scene); m.rotation.x = tilt; m.material = hairMat; kid.push(m); return m; };
      if (style === "afro") { const m = sphere("afro", 2.8 * R, 14); m.position.set(0, .45 * R, -.55 * R); m.material = hairMat; kid.push(m); }
      else if (style === "bald") { /* nothing */ }
      else if (style === "receding") cap(1.09, -.9, .5);
      else if (style === "buzz") cap(1.07, -.3, .45);
      else {
        cap(["curly", "wavy", "spiky", "quiff"].includes(style) ? 1.16 : 1.11);
        if (style === "long" || style === "braids") { const b = BABYLON.MeshBuilder.CreateBox("long", { width: 1.8 * R, height: 2.1 * R, depth: .5 * R }, scene); b.position.set(0, -.55 * R, -.75 * R); b.material = hairMat; kid.push(b); }
        if (style === "bun") { const b = sphere("bun", .8 * R, 10); b.position.set(0, .75 * R, -.75 * R); b.material = hairMat; kid.push(b); }
        if (style === "ponytail") { const b = BABYLON.MeshBuilder.CreateCylinder("tail", { height: 1.3 * R, diameter: .35 * R }, scene); b.position.set(0, -.2 * R, -1.05 * R); b.rotation.x = .4; b.material = hairMat; kid.push(b); }
        if (style === "mohawk") { const b = BABYLON.MeshBuilder.CreateBox("mohawk", { width: .32 * R, height: .55 * R, depth: 1.9 * R }, scene); b.position.set(0, 1.05 * R, -.1 * R); b.material = hairMat; kid.push(b); }
        if (style === "quiff" || style === "spiky") { const b = sphere("quiff", 1.2 * R, 10); b.scaling.set(1.15, .55, .9); b.position.set(0, .9 * R, .4 * R); b.material = hairMat; kid.push(b); }
      }
      const beard = look?.beard ?? "none";
      if (beard === "full" || beard === "short") { const b = BABYLON.MeshBuilder.CreateSphere("beard", { diameter: 1.9 * R, segments: 12, slice: .45 }, scene); b.rotation.x = Math.PI; b.position.set(0, -.05 * R, .12 * R); b.scaling.set(1, beard === "full" ? 1 : .7, 1); b.material = hairMat; kid.push(b); }
      if (beard === "goatee") { const b = sphere("goatee", .55 * R, 8); b.position.set(0, -.78 * R, .62 * R); b.material = hairMat; kid.push(b); }
      if (beard === "moustache") { const b = BABYLON.MeshBuilder.CreateBox("moustache", { width: .7 * R, height: .12 * R, depth: .2 * R }, scene); b.position.set(0, -.35 * R, .93 * R); b.material = hairMat; kid.push(b); }
      const eyeMat = mat("#0b0c10", { cel: false, emissive: "#000000" });
      for (const sx of [-1, 1]) {
        const e = sphere("eye", .3 * R, 8); e.scaling.set(.8, 1.15, .6); e.position.set(sx * .34 * R, .08 * R, .95 * R); e.material = eyeMat; kid.push(e);
        const brow = BABYLON.MeshBuilder.CreateBox("brow", { width: .38 * R, height: (look?.brows === "thick" ? .13 : .08) * R, depth: .1 * R }, scene); brow.position.set(sx * .34 * R, .32 * R, .93 * R); brow.material = hairMat; kid.push(brow);
        const ear = sphere("ear", .42 * R, 8); ear.scaling.set(.45, 1, .75); ear.position.set(sx * .98 * R, 0, 0); ear.material = skinMat; kid.push(ear);
      }
      { const nose = sphere("nose", .3 * R, 8); nose.scaling.set(.8, 1.1, .9); nose.position.set(0, -.12 * R, .98 * R); nose.material = skinMat; kid.push(nose); }
      if (look?.extras === "headband") { const t = BABYLON.MeshBuilder.CreateTorus("band", { diameter: 2.12 * R, thickness: .18 * R, tessellation: 20 }, scene); t.position.y = .45 * R; t.material = mat("#f4f4f4"); kid.push(t); }
      if (look?.extras === "glasses") for (const sx of [-1, 1]) { const t = BABYLON.MeshBuilder.CreateTorus("lens", { diameter: .42 * R, thickness: .06 * R, tessellation: 12 }, scene); t.rotation.x = Math.PI / 2; t.position.set(sx * .34 * R, .1 * R, .99 * R); t.material = eyeMat; kid.push(t); }
      // The head's own shadow covers its details.
      for (const k of kid) k.parent = head;
    }
    const numberTexture = (num, ink) => {
      const tex = new BABYLON.DynamicTexture("num", { width: 128, height: 128 }, scene, true), g = tex.getContext();
      g.clearRect(0, 0, 128, 128); g.fillStyle = ink; g.font = "bold 92px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(num ?? ""), 64, 70);
      tex.hasAlpha = true; tex.update(); return tex;
    };
    const LEGACY_LOOK = head => ({ hair: { buzz: "buzz", spiky: "spiky", curly: "curly", beard: "crop", glasses: "crop", quiff: "quiff", ref: "bald", sidepart: "sidepart" }[head] ?? "crop", hairColor: head === "sidepart" ? "brown" : "black", beard: head === "beard" ? "short" : "none", extras: head === "glasses" ? "glasses" : "none" });
    class Figure {
      constructor(p) {
        this.id = p.id; this.name = p.name; this.heading = p.team === "R" ? 0 : Math.PI; this.parts = []; this.phase = 0; this.q = { ...BASE }; this.last = null; this.diveSide = 1;
        const kit = p.kit, keeper = kit?.keeper;
        const shirt = p.ref ? "#1f2329" : p.medic ? "#f4f4f4" : hex(keeper ? kit.gk : kit?.shirt ?? "#888888");
        const shorts = p.ref ? "#15181d" : p.medic ? "#f4f4f4" : hex(keeper ? "#1d2340" : kit?.shorts ?? "#ffffff");
        const socks = p.ref ? "#15181d" : p.medic ? "#f4f4f4" : hex(keeper ? kit.gk : kit?.socks ?? shirt);
        const skin = SKIN[clamp((p.look?.skin ?? p.skin ?? 1) - 1, 0, 3)], ink = hex(keeper ? kit?.gkNumberInk : kit?.numberInk ?? "#ffffff");
        const M = { shirt: mat(shirt), shorts: mat(shorts), socks: mat(socks), skin: mat(skin), boot: mat(p.ref ? "#0d0d0d" : "#1b1d24"), glove: mat(keeper ? "#f4f4f4" : skin) };
        const sc = this.scale = (p.height ?? 180) / 180, leg = this.leg = p.leg ?? 1, arm = this.arm = p.arm ?? 1;
        const keep = m => { this.parts.push(m); return m; };
        const TH = BODY.TH * sc * leg, SH = BODY.SH * sc * leg, UA = BODY.UA * sc * arm, FA = BODY.FA * sc * arm, TORSO = BODY.TORSO * sc;
        this.torso = keep(outline(caster(BABYLON.MeshBuilder.CreateCylinder("torso", { height: TORSO * .82, diameterTop: .42 * sc, diameterBottom: .33 * sc, tessellation: 18 }, scene))));
        this.torso.material = M.shirt; this.torso.rotationQuaternion = Q.Identity(); this.torso.scaling.z = .58;
        this.yoke = keep(outline(caster(BABYLON.MeshBuilder.CreateSphere("yoke", { diameter: .42 * sc, segments: 14 }, scene))));
        this.yoke.material = M.shirt; this.yoke.rotationQuaternion = Q.Identity(); this.yoke.scaling.set(1, .42, .58);
        this.hips = keep(caster(BABYLON.MeshBuilder.CreateCylinder("hips", { height: .2 * sc, diameterTop: .34 * sc, diameterBottom: .37 * sc, tessellation: 18 }, scene)));
        this.hips.material = M.shorts; this.hips.rotationQuaternion = Q.Identity(); this.hips.scaling.z = .66;
        this.limbs = {
          sleeveF: keep(capsule("shortsLeg", .22 * sc, .092 * sc, M.shorts)), sleeveB: keep(capsule("shortsLeg", .22 * sc, .092 * sc, M.shorts)),
          thighF: keep(capsule("thigh", TH, .072 * sc, M.skin)), thighB: keep(capsule("thigh", TH, .072 * sc, M.skin)),
          shinF: keep(capsule("shin", SH, .06 * sc, M.socks)), shinB: keep(capsule("shin", SH, .06 * sc, M.socks)),
          armF: keep(capsule("arm", UA, .052 * sc, M.shirt)), armB: keep(capsule("arm", UA, .052 * sc, M.shirt)),
          foreF: keep(capsule("fore", FA, .043 * sc, M.skin)), foreB: keep(capsule("fore", FA, .043 * sc, M.skin)),
          neck: keep(capsule("neck", .13 * sc, .055 * sc, M.skin))
        };
        this.hands = [0, 1].map(() => { const h = keep(outline(caster(BABYLON.MeshBuilder.CreateSphere("hand", { diameter: (keeper ? .12 : .095) * sc, segments: 10 }, scene)))); h.material = M.glove; return h; });
        this.boots = [0, 1].map(() => { const b = keep(capsule("boot", .27 * sc, .05 * sc, M.boot)); b.scaling.set(1, 1, .75); return b; });
        this.R = BODY.HR * sc;
        this.head = keep(caster(BABYLON.MeshBuilder.CreateSphere("head", { diameter: 2 * this.R, segments: 18 }, scene)));
        this.head.material = M.skin; this.head.rotationQuaternion = Q.Identity(); this.head.scaling.set(.92, 1.06, 1);
        dressHead(this.head, p.look ?? LEGACY_LOOK(p.head), this.R, M.skin);
        if (p.num != null && !p.ref && !p.medic) {
          this.chest = new BABYLON.TransformNode("chest", scene); this.chest.rotationQuaternion = Q.Identity();
          const plate = BABYLON.MeshBuilder.CreatePlane("number", { size: .25 * sc }, scene);
          const nm = new BABYLON.StandardMaterial("numMat", scene); nm.diffuseTexture = numberTexture(p.num, ink); nm.useAlphaFromDiffuseTexture = true; nm.emissiveColor = new C3(.55, .55, .55); nm.specularColor = new C3(0, 0, 0);
          plate.material = nm; plate.parent = this.chest; plate.position.set(0, .02, -.128 * sc); keep(plate); this.numMat = nm;
        }
      }
      /** The pose to draw: the engine's, corrected for 3D, with steps that match the ground covered. */
      pose(p, dt, speed, moved, ctx) {
        const name = window.__forcePose3d?.[p.id] ?? p.poseName;   // the forced pose is a test hook
        let target;
        const cycleName = CYCLES.has(name) ? name : STATIC.has(name) && speed > .45 ? (p.hasBall ? "dribble" : "run") : null;
        if (cycleName) {
          // One full cycle is two steps; a step is as long as the swing makes it, so the feet never skate.
          const size = clamp(speed / 6.5, .28, 1.05), stepLen = 2 * BODY.TH * this.scale * 2 * Math.sin(rad((cycleName === "dribble" ? 26 : 38) * size)) + .25;
          this.phase += moved / stepLen * Math.PI;
          target = cycle(cycleName, this.phase, speed);
        } else if (name === "keeper" && p.hasBall) target = OVERRIDE.ready;   // waiting to take a goal kick
        else if (OVERRIDE[name]) target = OVERRIDE[name];
        else target = P3({ ...p.pose, abdAF: 12, abdAB: 12, abdLF: 3, abdLB: 3 });
        if (name === "dive" || name === "diveLand") target = { ...target, roll: target.roll * this.diveSide };
        const k = cycleName ? 1 : Math.min(1, dt * 14);
        this.q = lerpPose(this.q, target, k);
        return this.q;
      }
      update(p, dt, ctx) {
        const here = W(p.pos[0], p.pos[1]);
        const moved = this.last ? Math.hypot(here.x - this.last.x, here.z - this.last.z) : 0;
        this.last = here;
        const vx = p.vel[0], vz = -p.vel[1], speed = Math.hypot(vx, vz);
        let want = this.heading;
        if (speed > .6) want = Math.atan2(vz, vx);
        else if (p.faceTo) want = Math.atan2(p.faceTo.z - here.z, p.faceTo.x - here.x);
        else if (p.bench || p.medic) want = -Math.PI / 2;
        else if (ctx.ballW) want = Math.atan2(ctx.ballW.z - here.z, ctx.ballW.x - here.x);
        let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * Math.min(1, dt * 9);
        const f = new V3(Math.cos(this.heading), 0, Math.sin(this.heading)), up = V3.Up(), s = V3.Cross(up, f).normalize();
        // A keeper dives towards the ball's side.
        const diveAt = p.diveToward ?? ctx.ballW;
        if (p.poseName === "dive" && this.lastPose !== "dive" && diveAt) this.diveSide = V3.Dot(diveAt.subtract(here), s) >= 0 ? -1 : 1;
        this.lastPose = p.poseName;
        const q = this.pose(p, dt, speed, moved, ctx), r = rig3d(q, this.scale, this.leg, this.arm), sc = this.scale;
        const seat = p.poseName === "sitBench" ? .42 : 0;
        const P = o => here.add(f.scale(o.x)).addInPlace(up.scale(o.y + seat)).addInPlace(s.scale(-o.z));
        const hip = P(r.hip), top = P(r.top), neck = P(r.neck), head = P(r.head), J = {};
        for (const k of ["hipF", "hipB", "kneeF", "kneeB", "footF", "footB", "shF", "shB", "elbowF", "elbowB", "handF", "handB"]) J[k] = P(r[k]);
        const bodyUp = top.subtract(hip).normalize(), sideNow = J.shB.subtract(J.shF).normalize();
        const bodyFwd = V3.Cross(sideNow, bodyUp).normalize(), bodyQ = basisQuat(bodyUp, V3.Dot(bodyFwd, f) < -.2 ? f : bodyFwd);
        this.torso.position.copyFrom(V3.Lerp(hip, top, .5)); this.torso.rotationQuaternion = bodyQ;
        this.yoke.position.copyFrom(top.subtract(bodyUp.scale(.03 * sc))); this.yoke.rotationQuaternion = bodyQ;
        this.hips.position.copyFrom(hip.add(bodyUp.scale(.03 * sc))); this.hips.rotationQuaternion = basisQuat(bodyUp, f);
        const L = this.limbs, toward = (a, b, k) => V3.Lerp(a, b, k);
        aim(L.thighF, J.hipF, J.kneeF, f); aim(L.thighB, J.hipB, J.kneeB, f);
        aim(L.sleeveF, J.hipF, toward(J.hipF, J.kneeF, .42), f); aim(L.sleeveB, J.hipB, toward(J.hipB, J.kneeB, .42), f);
        aim(L.shinF, J.kneeF, J.footF, f); aim(L.shinB, J.kneeB, J.footB, f);
        aim(L.armF, J.shF, J.elbowF, f); aim(L.armB, J.shB, J.elbowB, f);
        aim(L.foreF, J.elbowF, J.handF, f); aim(L.foreB, J.elbowB, J.handB, f);
        aim(L.neck, top, neck, f);
        this.hands[0].position.copyFrom(J.handF); this.hands[1].position.copyFrom(J.handB);
        [[this.boots[0], J.footF, J.kneeF], [this.boots[1], J.footB, J.kneeB]].forEach(([b, foot, knee]) => {
          const shin = foot.subtract(knee).normalize(), lifted = foot.y > .12;
          const fwd = lifted ? V3.Cross(s, shin).normalize().scale(-1) : f;
          const heel = foot.subtract(fwd.scale(.04 * sc)), toe = foot.add(fwd.scale(.2 * sc));
          if (!lifted) heel.y = toe.y = Math.max(.05 * sc, foot.y);
          aim(b, heel, toe, up);
        });
        this.head.position.copyFrom(head); this.head.rotationQuaternion = basisQuat(head.subtract(top).normalize(), f);
        if (this.chest) { this.chest.position.copyFrom(V3.Lerp(hip, top, .6)); this.chest.rotationQuaternion = bodyQ; }
        this.feet = V3.Lerp(J.footF, J.footB, .5); this.f = f; this.handsAt = V3.Lerp(J.handF, J.handB, .5); this.rightFoot = J.footB; this.leftFoot = J.footF;
      }
      dispose() { for (const m of this.parts) { shadows.removeShadowCaster(m); m.dispose(); } this.chest?.dispose(); this.numMat?.diffuseTexture?.dispose(); this.numMat?.dispose(); }
    }

    /* markers: a ring with an arrow for the way he faces, under each controlled player; his name over him */
    const SLOT_COLOR = { A: "#6ef5a2", B: "#73e9ff" };
    const markers = {};
    const markerFor = slot => {
      if (markers[slot]) return markers[slot];
      const color = SLOT_COLOR[slot] ?? "#ffffff", m = mat(color, { cel: false, emissive: color });
      const ring = BABYLON.MeshBuilder.CreateTorus("ring", { diameter: 1.1, thickness: .06, tessellation: 40 }, scene); ring.material = m;
      const arrow = BABYLON.MeshBuilder.CreateDisc("arrow", { radius: .26, tessellation: 3 }, scene); arrow.material = m; arrow.rotationQuaternion = Q.Identity();
      const charge = BABYLON.MeshBuilder.CreateTorus("charge", { diameter: 1.3, thickness: .08, tessellation: 40, arc: 1 }, scene); charge.material = mat("#ffd34d", { cel: false, emissive: "#ffb800" });
      const tag = document.createElement("div"); tag.className = "tag3d"; tag.dataset.slot = slot; root.querySelector(".tv").append(tag);
      return (markers[slot] = { ring, arrow, charge, tag });
    };

    /* camera */
    const camera = new BABYLON.FreeCamera("tv", new V3(0, 15, -36), scene);
    camera.fov = .62; camera.minZ = .3; camera.maxZ = 500; camera.inputs.clear();
    const focus = new V3(0, 0, 0);
    let pipeline = null;
    if (high) {
      pipeline = new BABYLON.DefaultRenderingPipeline("post", true, scene, [camera]);
      pipeline.fxaaEnabled = true; pipeline.bloomEnabled = true; pipeline.bloomThreshold = .82; pipeline.bloomWeight = .22;
      pipeline.imageProcessingEnabled = true; pipeline.imageProcessing.contrast = 1.1; pipeline.imageProcessing.vignetteEnabled = true; pipeline.imageProcessing.vignetteWeight = 1.3;
    } else engine.setHardwareScalingLevel(1.35);

    /* each frame */
    const figures = new Map();
    let prevBall = null, ballSpin = Q.Identity();
    const resize = new ResizeObserver(() => engine.resize()); resize.observe(canvas);
    /*
     * Penalties. A shoot-out is staged at the right-hand goal from the engine's turn data: the taker runs up and
     * strikes, the keeper dives the way he chose, the ball goes in or is stopped; the rest stand round the centre
     * circle and the camera stands behind the taker. A live penalty in a match (the 3D view's) is played by the
     * engine on the pitch; here it only puts the camera behind the taker until the kick.
     */
    const pen = { key: null, t0: 0 };
    const UV = v => [v.x / LEN + .5, .5 - v.z / WID];
    const smoothstep = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    function stagePenalty(snap, now) {
      const p = snap.penalty;
      if (!p || p.kind === "live" || snap.mode !== "penalties") return null;
      const key = p.turn + ":" + p.phase;
      if (key !== pen.key) { pen.key = key; pen.t0 = now; }
      const t = p.phase === "result" ? now - pen.t0 : 0;
      const goalX = LEN / 2, spot = new V3(goalX - (snap.pitch.penaltyDistance ?? 6), 0, 0), people = new Map();
      const put = (id, pos, o = {}) => people.set(id, { pos: UV(pos), vel: [0, 0], ...o });
      const others = snap.people.filter(q => q.id !== p.takerId && q.id !== p.keeperId && !q.bench && !q.medic);
      others.forEach((q, i) => {
        if (q.ref) return put(q.id, new V3(spot.x - 2, 0, -5), { faceTo: spot, pose: "ready" });
        const a = (i + .5) / others.length * Math.PI * 2;
        put(q.id, new V3(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2), { faceTo: new V3(goalX, 0, 0), pose: "ready" });
      });
      // The taker: a short run-up, the strike, then he watches.
      const start = new V3(spot.x - 2.4, 0, -1.1), strike = new V3(spot.x - .35, 0, -.25), run = smoothstep(t / .5);
      const tp = V3.Lerp(start, strike, run), tv = t > 0 && t < .5 ? strike.subtract(start).scale(1 / .5) : V3.Zero();
      put(p.takerId, tp, { vel: [tv.x, -tv.z], faceTo: new V3(goalX, 0, 0), pose: t <= 0 ? "stance" : t < .5 ? "run" : t < .62 ? "kickBack" : t < .95 ? "kick" : "ready" });
      // Where the shot goes and where the keeper dives ("left" is the taker's left, +z here).
      const sideZ = d => d === "left" ? 2.1 : d === "right" ? -2.1 : 0;
      const last = p.phase === "result" ? p.last : null, shotZ = sideZ(last?.shot), diveZ = sideZ(last?.dive), height = .45 + ((p.turn * 37) % 10) / 10 * 1.05;
      const keeperAt = new V3(goalX - .35, 0, last && t > .5 ? diveZ * smoothstep((t - .5) / .4) : 0);
      put(p.keeperId, keeperAt, { faceTo: spot, pose: !last || t < .5 ? "keeper" : last.dive === "center" ? (height > 1.2 ? "gkHigh" : "catch") : t < 1.6 ? "dive" : "diveLand", diveToward: new V3(goalX, 0, diveZ) });
      // The ball: on the spot, then to the goal; in, or stopped and dropping away.
      let ballAt = spot.add(new V3(0, .12, 0));
      if (last && t > .55) {
        const k = clamp((t - .55) / .55, 0, 1), target = new V3(goalX + (last.goal ? .3 : -.3), height, last.goal ? shotZ : diveZ * .9);
        ballAt = V3.Lerp(spot.add(new V3(0, .12, 0)), target, k); ballAt.y += Math.sin(k * Math.PI) * .35;
        if (k >= 1) {
          const after = clamp((t - 1.1) / .6, 0, 1);
          ballAt = last.goal ? V3.Lerp(target, new V3(goalX + 1.2, .12, shotZ * 1.05), after)
            : V3.Lerp(target, new V3(goalX - 3.5, .12, diveZ * 1.4 + (p.turn % 2 ? .8 : -.8)), after);
          ballAt.y = Math.max(.12, last.goal ? target.y * (1 - after) + .12 : target.y * (1 - after) + Math.abs(Math.sin(after * 6)) * .4 * (1 - after));
        }
      }
      return { people, ball: ballAt, camera: { pos: new V3(spot.x - 8.5, 2.5, -1.4), target: new V3(goalX, 1, 0) } };
    }
    function frame(dt) {
      const snap = api.snapshot(), b = snap.ball, stage = stagePenalty(snap, performance.now() / 1000);
      const owner = b.owner && snap.people.find(p => p.id === b.owner);
      let ballW = W(b.pos[0], b.pos[1], .12 + Math.max(0, b.h));
      const ctx = { ballW, restart: snap.stoppage && snap.mode === "play" };
      // People first: the ball at a carrier's feet or in a keeper's hands goes where his body is.
      const seen = new Set();
      for (const p of snap.people) {
        seen.add(p.id);
        let f = figures.get(p.id);
        if (f && f.name !== p.name) { f.dispose(); figures.delete(p.id); f = null; }
        if (!f) { f = new Figure(p); figures.set(p.id, f); }
        const o = stage?.people.get(p.id);
        f.update(o ? { ...p, pos: o.pos, vel: o.vel, poseName: o.pose ?? p.poseName, faceTo: o.faceTo, diveToward: o.diveToward, hasBall: false } : p, dt, ctx);
      }
      for (const [id, f] of figures) if (!seen.has(id)) { f.dispose(); figures.delete(id); }
      const of = owner && figures.get(owner.id);
      if (of && b.mode === "held") ballW = of.handsAt.add(of.f.scale(.12));
      else if (of && b.mode === "carried") {
        // Dribbling: the ball runs a stride ahead of him, touched on every other step.
        const touch = .32 + .12 * Math.max(0, Math.sin(of.phase));
        ballW = W(owner.pos[0], owner.pos[1], .12).add(of.f.scale(touch * of.scale));
      }
      if (stage) ballW = stage.ball;
      ball.position.copyFrom(ballW); ball.isVisible = b.show || !!stage;
      if (prevBall) {
        const mv = ballW.subtract(prevBall); mv.y = 0; const dist = mv.length();
        if (dist > 1e-4 && dist < 3) { ballSpin = Q.RotationAxis(V3.Cross(V3.Up(), mv.normalize()), dist / .12).multiply(ballSpin); ball.rotationQuaternion = ballSpin; }
      }
      prevBall = ballW.clone();
      // Markers for every player-controlled man.
      const width = engine.getRenderWidth(), height = engine.getRenderHeight(), ratio = canvas.clientWidth / Math.max(1, width);
      for (const h of snap.humans) {
        const m = markerFor(h.slot), me = h.selected && figures.get(h.selected), person = me && snap.people.find(p => p.id === h.selected);
        const visible = !!me && ["play", "reset", "halftime"].includes(snap.mode);
        m.ring.isVisible = m.arrow.isVisible = visible; m.charge.isVisible = visible && !!h.charge; m.tag.hidden = !visible;
        if (!visible) continue;
        const at = W(person.pos[0], person.pos[1], .03);
        m.ring.position.copyFrom(at);
        const dx = (h.aim?.[0] ?? 1) * LEN, dz = -(h.aim?.[1] ?? 0) * WID, len = Math.hypot(dx, dz) || 1, dir = new V3(dx / len, 0, dz / len);
        m.arrow.position.copyFrom(at.add(dir.scale(.78))); m.arrow.position.y = .035;
        m.arrow.rotationQuaternion = Q.RotationYawPitchRoll(Math.atan2(dir.x, dir.z) - Math.PI / 2, Math.PI / 2, 0);
        if (h.charge) { m.charge.position.copyFrom(at); m.charge.scaling.setAll(.6 + .5 * h.charge.power); }
        const screen = V3.Project(me.head.position.add(new V3(0, .55, 0)), BABYLON.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
        if (m.tag.textContent !== h.slot + " · " + (person.short || person.name)) m.tag.textContent = h.slot + " · " + (person.short || person.name);
        m.tag.style.left = screen.x * ratio + "px"; m.tag.style.top = screen.y * ratio + "px";
      }
      // The crowd jumps for a goal.
      const crowd = stadium.crowd, cheering = snap.mode === "celebrate";
      if (crowd && (cheering || crowd.was)) {
        for (let i = 0; i < crowd.count; i++) crowd.matrices[i * 16 + 13] = crowd.base[i] + (cheering ? Math.abs(Math.sin(performance.now() / 160 + i)) * .35 : 0);
        crowd.mesh.thinInstanceBufferUpdated("matrix");
      }
      if (crowd) crowd.was = cheering;
      // The TV camera follows the ball along the touchline.
      // While the ball is out of sight the camera holds where it is.
      const k = 1 - Math.exp(-Math.max(dt, .016) * 2.4);
      if (b.show) { focus.x += (clamp(ballW.x, -LEN / 2 + 7, LEN / 2 - 7) - focus.x) * k; focus.z += (clamp(ballW.z * .5, -5, 5) - focus.z) * k; }
      const lock = window.__lock3d;   // a fixed camera, for tests and portraits
      const live = snap.penalty?.kind === "live" && snap.penalty.phase !== "done" ? snap.penalty : null;
      if (lock) { camera.position.set(lock.x, lock.y, lock.z); camera.setTarget(new V3(lock.tx, lock.ty, lock.tz)); }
      else if (stage) { camera.position.copyFrom(stage.camera.pos); camera.setTarget(stage.camera.target); }
      else if (live) {
        // Behind the taker, looking at the goal, until the kick has been taken.
        const spotW = W(live.spot[0], live.spot[1]), goalW = W(live.goal[0], live.goal[1]), back = spotW.subtract(goalW).normalize();
        camera.position.copyFrom(spotW.add(back.scale(8.5))).addInPlace(new V3(0, 2.5, 0)); camera.setTarget(goalW.add(new V3(0, 1, 0)));
        focus.x = goalW.x * .7; focus.z = 0;
      }
      else { camera.position.set(focus.x * .85, 13.5, focus.z - 27); camera.setTarget(new V3(focus.x, .6, focus.z)); }
      scene.render();
    }
    frame(0);
    // Tests draw extra frames on a paused match through the canvas.
    canvas.__view3d = { frame, figures };
    return {
      frame,
      dispose() { resize.disconnect(); for (const m of Object.values(markers)) m.tag.remove(); engine.stopRenderLoop(); scene.dispose(); engine.dispose(); },
      scene, figures
    };
  }

  window.PTSCRenderer3D = { attach, timeScale: .8 };
})();
