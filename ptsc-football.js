/*!
 * PTSC Cup 6v6 — embeddable cartoon football match (SVG + vanilla JS, no dependencies).
 *
 *   <div class="ptsc-football" data-seed="7" data-caption="Sân 6 người · Đỏ gặp Xanh"></div>
 *   <script src="ptsc-football.js" defer></script>      (ptsc-football.css must sit next to it)
 *
 * Every .ptsc-football element on the page is mounted automatically; each one is an independent match,
 * drawn inside its own shadow root (the page's CSS and the widget's CSS never meet). Give the div a width;
 * the height follows (16:9).
 * Options (data attributes or PTSCFootball.mount(el, {...})):
 *   seed     a number: the same seed always plays the same match (default: random)
 *   caption  a line of text under the frame (default: none)
 *   still    render one frozen frame at that many seconds instead of animating
 *   css      URL of ptsc-football.css if it is not next to the script
 *   fonts    "none" to skip loading the Google fonts (falls back to system fonts)
 * API: const m = PTSCFootball.mount(el); m.pause(); m.play(); m.destroy();
 *      PTSCFootball.mountAll() mounts any .ptsc-football elements added later.
 */
(function () {
  "use strict";
  let count = 0;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const template = (UID, caption) => `<div class="tv" data-id="tv">
  <svg data-id="scene" viewBox="0 0 640 360" role="img" preserveAspectRatio="xMidYMid slice"
    aria-label="Trận bóng đá sân 6 người giữa đội Đỏ và đội Xanh, máy quay rộng bám theo bóng"
    fill="none" stroke="var(--color-ink)" stroke-linecap="round" stroke-linejoin="round">
    <defs>
      <pattern id="${UID}-net" width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M0 0 L5 5 M5 0 L0 5" stroke="var(--color-card)" stroke-width=".8" opacity=".85" />
      </pattern>
      <clipPath id="${UID}-ball-clip"><circle r="5.6" /></clipPath>
    </defs>
    <g data-id="world">
      <g data-id="ground"></g>
      <g data-id="crowd"></g>
      <g data-id="pitch"></g>
      <g data-id="shadows"></g>
      <g data-id="dyn"></g>
      <g data-id="wfx"></g>
    </g>
    <g data-id="sfx"></g>
  </svg>
  <div class="sb" aria-hidden="true">
    <div class="sb-bug">
      <span class="sb-cup">PTSC</span>
      <span class="sb-team" data-id="sb-R"><i class="sb-dot R"></i>ĐỎ<span class="sb-cards" data-id="cards-R"></span></span>
      <span class="sb-score"><b data-id="score-R">0</b>–<b data-id="score-B">0</b></span>
      <span class="sb-team" data-id="sb-B"><span class="sb-cards" data-id="cards-B"></span>XANH<i class="sb-dot B"></i></span>
      <span class="sb-clock" data-id="clock">1'</span>
    </div>
    <div class="sb-shape" aria-label="Sơ đồ"><b class="R" data-id="shape-R">2-1-2</b><b class="B" data-id="shape-B">2-1-2</b></div>
    <div class="sb-note" data-id="note" hidden></div>
  </div>
  <div class="live" aria-hidden="true"><i></i>TRỰC TIẾP</div>
</div>` + (caption ? `<p class="caption">${escapeHtml(caption)}</p>` : "");
  // The stylesheet sits next to this script unless data-css says otherwise; the fonts go in the page head once.
  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const FONTS = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=JetBrains+Mono:wght@700&display=swap";
  let fontsAdded = false;
  function addFonts() {
    if (fontsAdded || document.querySelector('link[href="' + FONTS + '"]')) return;
    fontsAdded = true;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONTS; document.head.appendChild(l);
  }

  function mount(host, options = {}) {
    if (!host) throw new Error("PTSCFootball.mount: no element");
    if (host.__ptscFootball) return host.__ptscFootball;
    const UID = "ptscf" + (++count);
    const settings = Object.assign({}, host.dataset, options);
    const interactive = settings.mode === "cpu" || settings.mode === "local";
    const initialSwap = settings.leftTeam === "B";
    const opts = { query: new URLSearchParams() };
    for (const k of ["seed", "still", "gif"]) if (settings[k] != null && settings[k] !== false) opts.query.set(k, settings[k] === true ? "" : settings[k]);
    if (settings.fonts !== "none") addFonts();
    const cssUrl = settings.css || (SCRIPT_URL ? new URL("ptsc-football.css", SCRIPT_URL).href : "ptsc-football.css");
    if (!host.style.display && getComputedStyle(host).display === "inline") host.style.display = "block";
    // Everything lives in a shadow root: the host page's CSS cannot reach in and ours cannot leak out.
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<link rel="stylesheet" href="' + escapeHtml(cssUrl) + '"><div class="ptsc-football" style="visibility:hidden">' + template(UID, settings.caption) + "</div>";
    const root = shadow.querySelector(".ptsc-football");
    const link = shadow.querySelector("link");
    const show = () => { root.style.visibility = ""; };
    link.addEventListener("load", show); link.addEventListener("error", show);
    setTimeout(show, 3000);
    const api = { root: host };
    host.__ptscFootball = api;
    
    
    /* ============================================================================================
     * 6-a-side cartoon football on an isometric pitch with a moving "wide" broadcast camera.
     * Court frame (u, v): u = length (0 = Đỏ's goal line, 1 = Xanh's), v = width (0 far touchline, 1 near).
     * Team frame (d, w): d = 0 own goal line … 1 the goal the team attacks; Xanh mirrors both axes.
     * A fixed-step simulation: a director picks the ball carrier's next action (skill, pass, dribble,
     * shot); everyone else runs to formation spots that follow the ball. Human teams control their carrier.
     * ========================================================================================== */
    const NS = "http://www.w3.org/2000/svg";
    const LEN = 45, WID = 30;                       // metres
    const A = [684, -387], B = [352, 231], K = 32;   // world px per court unit; K = px per metre of height
    const ground = (u, v) => [u * A[0] + v * B[0], u * A[1] + v * B[1]];
    function courtUV(g) { const det = A[0] * B[1] - A[1] * B[0]; return [(g[0] * B[1] - g[1] * B[0]) / det, (A[0] * g[1] - A[1] * g[0]) / det]; }
    const pt = v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`;
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const mul = (a, k) => [a[0] * k, a[1] * k];
    const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const smooth = x => x * x * (3 - 2 * x);
    const mdist = (a, b) => Math.hypot((a[0] - b[0]) * LEN, (a[1] - b[1]) * WID);
    const TEAMS = ["R", "B"];
    const otherTeam = t => t === "R" ? "B" : "R";
    const TEAM_NAME = { R: "Đỏ", B: "Xanh" };
    /** Screen-x direction of the goal each team attacks. */
    /** True in the second half, when the teams have changed ends. */
    let SWAP = initialSwap;
    const ATT = { get R() { return SWAP ? -1 : 1; }, get B() { return SWAP ? 1 : -1; } };
    const toW = (team, [d, w]) => (team === "R") !== SWAP ? [d, w] : [1 - d, 1 - w];
    const toT = toW;
    const GOAL_V = [0.4, 0.6], GOAL_H = 2.0, GOAL_DEPTH = 0.035;
    const S = 0.62;           // drawing scale of every person
    const VW = 640, VH = 360; // camera viewport
    
    /* ---------------------------------- seeded randomness ---------------------------------- */
    function mulberry32(seed) {
      return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    const query = opts.query;
    const SEED = Number(query.get("seed") ?? Math.floor(Math.random() * 1e9));
    const rng = mulberry32(SEED);
    const pick = list => list[Math.floor(rng() * list.length)];
    
    /* ---------------------------------- poses and rig ---------------------------------- */
    const P = o => Object.assign({ hF: 8, kF: 14, hB: -8, kB: 14, aF: 70, eF: -40, aB: 110, eB: -40, L: 6, j: 0, rot: 0 }, o);
    const POSES = {
      ready: P({}),
      jockey: P({ hF: 24, kF: 48, hB: -20, kB: 42, aF: 30, eF: -10, aB: 150, eB: 0, L: 16 }),
      keeper: P({ hF: 26, kF: 55, hB: -22, kB: 50, aF: -10, eF: -25, aB: -40, eB: -20, L: 14 }),
      // Striking the ball (front leg kicks, back leg is planted beside the ball): body over the ball, the far arm
      // out for balance, the near arm swinging back; never leaning back and never leaving the ground.
      kickBack: P({ hF: -32, kF: 95, hB: 2, kB: 22, aF: 125, eF: -10, aB: 15, eB: -25, L: 8 }),
      kick: P({ hF: 26, kF: 28, hB: 0, kB: 24, aF: 145, eF: 0, aB: -5, eB: -15, L: 10 }),
      follow: P({ hF: 55, kF: 12, hB: -2, kB: 18, aF: 120, eF: -15, aB: 25, eB: -30, L: 6 }),
      powerBack: P({ hF: -42, kF: 112, hB: 4, kB: 26, aF: 135, eF: 0, aB: 5, eB: -15, L: 11 }),
      powerKick: P({ hF: 32, kF: 22, hB: 0, kB: 28, aF: 155, eF: 0, aB: -15, eB: -5, L: 13 }),
      powerFollow: P({ hF: 68, kF: 8, hB: -4, kB: 16, aF: 125, eF: -10, aB: 20, eB: -25, L: 7, j: 2 }),
      curlBack: P({ hF: -24, kF: 70, hB: 2, kB: 22, aF: 130, eF: -10, aB: 0, eB: -20, L: 7 }),
      curlKick: P({ hF: 24, kF: 20, hB: 0, kB: 24, aF: 140, eF: 0, aB: -20, eB: -10, L: 6 }),
      curlFollow: P({ hF: 45, kF: 10, hB: -2, kB: 18, aF: 120, eF: -15, aB: 10, eB: -25, L: 4 }),
      chipKick: P({ hF: 22, kF: 45, hB: 2, kB: 26, aF: 130, eF: -10, aB: 10, eB: -20, L: 0 }),
      passBack: P({ hF: -18, kF: 50, hB: 2, kB: 20, aF: 110, eF: -20, aB: 50, eB: -30, L: 8 }),
      passKick: P({ hF: 22, kF: 20, hB: 0, kB: 20, aF: 115, eF: -20, aB: 40, eB: -30, L: 8 }),
      tap: P({ hF: 30, kF: 28, hB: -14, kB: 24, aF: 115, eF: -30, aB: 55, eB: -30, L: 10 }),
      heel: P({ hF: -30, kF: 95, hB: 10, kB: 20, aF: 120, eF: -20, aB: 50, eB: -20, L: 14 }),
      // Step-overs stay low: the foot circles just over the ball, arms out for balance, weight dropped.
      stepA: P({ hF: 26, kF: 46, hB: -14, kB: 34, aF: 150, eF: -10, aB: 40, eB: -15, L: 15 }),
      stepB: P({ hF: -6, kF: 32, hB: 24, kB: 48, aF: 40, eF: -15, aB: 150, eB: -10, L: 15 }),
      shift: P({ hF: 20, kF: 42, hB: -28, kB: 46, aF: 45, eF: -10, aB: 150, eB: 0, L: 20 }),
      spin: P({ hF: 12, kF: 30, hB: -12, kB: 30, aF: 15, eF: -15, aB: 165, eB: 15, L: 10 }),
      lunge: P({ hF: 48, kF: 8, hB: -32, kB: 70, aF: 30, eF: 0, aB: 150, eB: 0, L: 30 }),
      stance: P({ hF: 22, kF: 4, hB: -22, kB: 4, aF: 70, eF: 15, aB: 110, eB: -15, L: -7 }),
      wall: P({ hF: 5, kF: 6, hB: -5, kB: 6, aF: 75, eF: -15, aB: 100, eB: 15, L: 2 }),
      wallJump: P({ hF: 5, kF: 25, hB: -5, kB: 25, aF: 75, eF: -15, aB: 100, eB: 15, L: 0, j: 15 }),
      header: P({ hF: 8, kF: 55, hB: -14, kB: 60, aF: 25, eF: -45, aB: 155, eB: 0, L: 18, j: 14 }),
      // A rare overhead kick: lower and less inverted than a professional's, and he lands on his back.
      bicycle: P({ hF: 45, kF: 8, hB: -35, kB: 60, aF: -20, eF: 0, aB: -150, eB: 0, L: 0, rot: -120, j: 18 }),
      bicycleLand: P({ hF: 30, kF: 20, hB: -10, kB: 40, aF: -40, eF: 0, aB: -150, eB: 0, L: 0, rot: -85 }),
      // Keeper distribution: one-armed overarm throw, or an underarm roll for short ones.
      throwLoad: P({ aF: -150, eF: -30, aB: 20, eB: -10, L: -8, hF: 18, kF: 10, hB: -18, kB: 20 }),
      throw: P({ aF: -20, eF: 0, aB: 60, eB: -20, L: 14, hF: 20, kF: 10, hB: -14, kB: 20 }),
      rollLoad: P({ hF: 30, kF: 60, hB: -20, kB: 30, aF: 160, eF: 0, aB: 60, eB: -30, L: 30 }),
      roll: P({ hF: 25, kF: 40, hB: -20, kB: 25, aF: 60, eF: 0, aB: 80, eB: -30, L: 25 }),
      dive: P({ hF: -8, kF: 10, hB: -18, kB: 14, aF: -95, eF: 0, aB: -80, eB: 0, L: 0, rot: 80, j: 18 }),
      diveLand: P({ hF: -6, kF: 20, hB: -14, kB: 30, aF: -90, eF: -10, aB: -80, eB: -10, L: 0, rot: 86 }),
      catch: P({ aF: 25, eF: -75, aB: 35, eB: -75, L: 4 }),
      reachUp: P({ hF: 10, kF: 30, hB: -10, kB: 40, aF: -95, eF: 0, aB: -80, eB: 0, L: -8, j: 16 }),
      slide: P({ hF: 22, kF: 0, hB: -6, kB: 115, aF: 165, eF: 0, aB: 175, eB: -10, L: 0, rot: -60 }),
      fall: P({ hF: 50, kF: 40, hB: 25, kB: 60, aF: -130, eF: 0, aB: -60, eB: 0, L: 0, rot: -84 }),
      sitUp: P({ hF: 70, kF: 70, hB: 80, kB: 100, aF: 130, eF: 0, aB: 150, eB: 0, L: -10, rot: -30 }),
      // Arms up with both feet on the ground; cheerHop is the small jump that goes with it now and then.
      cheer: P({ hF: 10, kF: 30, hB: -10, kB: 40, aF: -105, eF: 10, aB: -78, eB: -10, j: 0 }),
      // Fatigue, injury and the bench.
      handsKnees: P({ hF: 30, kF: 40, hB: 5, kB: 35, aF: 62, eF: 12, aB: 75, eB: 12, L: 42 }),
      // Getting an injured man off: kneeling beside him, helping him along with his arm over a shoulder, the
      // stretcher-bearers' grip, and the hop of a man who cannot put weight on one leg.
      treat: P({ hF: -4, kF: 105, hB: -4, kB: 105, aF: 30, eF: -30, aB: 45, eB: -30, L: 24 }),
      helpCarry: P({ hF: 12, kF: 18, hB: -10, kB: 18, aF: 30, eF: -35, aB: 135, eB: -25, L: 6 }),
      limp: P({ hF: 14, kF: 14, hB: -26, kB: 85, aF: -5, eF: 25, aB: 185, eB: -25, L: 6 }),
      carryLow: P({ hF: 14, kF: 24, hB: -10, kB: 24, aF: 52, eF: -28, aB: 62, eB: -28, L: 10 }),
      hurt: P({ hF: 75, kF: 115, hB: 10, kB: 20, aF: 40, eF: -70, aB: 55, eB: -70, L: 0, rot: -84 }),
      sitBench: P({ hF: 88, kF: 88, hB: 82, kB: 84, aF: 55, eF: -25, aB: 65, eB: -25, L: 6 }),
      cheerHop: P({ hF: 10, kF: 34, hB: -10, kB: 40, aF: -105, eF: 10, aB: -78, eB: -10, j: 7 }),
      hug: P({ aF: -25, eF: -70, aB: -15, eB: -75, L: 6 }),
      highFive: P({ aF: 60, eF: -40, aB: -150, eB: 0, L: -2 }),
      cheerLow: P({ hF: 12, kF: 34, hB: -12, kB: 36, aF: -100, eF: 20, aB: -70, eB: -20, j: 0 }),
      kneel: P({ hF: -6, kF: 100, hB: -6, kB: 100, aF: -115, eF: 0, aB: -70, eB: 0, L: -20 }),
      siuJump: P({ hF: 14, kF: 35, hB: -14, kB: 35, aF: -40, eF: 0, aB: -140, eB: 0, L: -4, j: 14 }),
      siuLand: P({ hF: 26, kF: 6, hB: -26, kB: 6, aF: 45, eF: 0, aB: 135, eB: 0, L: -10 }),
      pointSky: P({ hF: 6, kF: 10, hB: -6, kB: 10, aF: -70, eF: -8, aB: -108, eB: 8, L: -14 }),
      slump: P({ hF: 4, kF: 8, hB: -4, kB: 8, aF: 72, eF: -12, aB: 108, eB: 10, L: 18 }),
      // Conceding: hands on hips staring at the sky, down on his knees, sat on the grass.
      hipsHands: P({ hF: 9, kF: 6, hB: -9, kB: 6, aF: 125, eF: -115, aB: 55, eB: 115, L: -8 }),
      kneelSad: P({ hF: -4, kF: 105, hB: -4, kB: 105, aF: 80, eF: -15, aB: 100, eB: 15, L: 32 }),
      sitSad: P({ hF: 70, kF: 125, hB: 62, kB: 115, aF: 25, eF: -35, aB: 45, eB: -30, L: 30, rot: -18 }),
      headHands: P({ hF: 4, kF: 8, hB: -4, kB: 8, aF: -55, eF: -125, aB: -40, eB: -135, L: -10 }),
      shrug: P({ aF: 150, eF: -70, aB: 30, eB: 70, L: -4 }),
      fistPump: P({ aF: 60, eF: -40, aB: -75, eB: -60, L: 2 }),
      clapA: P({ aF: -10, eF: -95, aB: 5, eB: -105, L: 2 }),
      clapB: P({ aF: 10, eF: -80, aB: 30, eB: -80, L: 2 }),
      trophyUp: P({ aF: -95, eF: 5, aB: -85, eB: -5, L: -2 }),
      trophyHop: P({ aF: -95, eF: 5, aB: -85, eB: -5, L: -2, j: 7 }),
      whistle: P({ aF: -55, eF: -115, aB: 100, eB: -30, L: -2 }),
      point: P({ aF: -25, eF: 0, aB: 100, eB: -30, L: -4 }),
      card: P({ aF: -88, eF: 0, aB: 100, eB: -30, L: -6 }),
      cardRed: P({ aF: -88, eF: 0, aB: 100, eB: -30, L: -6 }),
      // Keeper catches: scooping a low ball, taking it into the chest, jumping for a high one.
      gkLow: P({ hF: 40, kF: 120, hB: -10, kB: 100, aF: 65, eF: -25, aB: 75, eB: -25, L: 38 }),
      gkChest: P({ hF: 12, kF: 28, hB: -12, kB: 28, aF: 25, eF: -85, aB: 35, eB: -85, L: 4 }),
      gkHigh: P({ hF: 10, kF: 40, hB: -10, kB: 40, aF: -80, eF: -10, aB: -95, eB: -10, L: -4, j: 18 }),
      // Encouragement: a raised fist, a clap of the hands towards the team.
      // Celebrations.
      kneeSlide: P({ hF: -10, kF: 105, hB: -10, kB: 105, aF: -120, eF: 10, aB: -60, eB: -10, L: -18 }),
      kneelSky: P({ hF: -4, kF: 105, hB: -4, kB: 105, aF: -100, eF: -10, aB: -80, eB: -10, L: -15 }),
      danceA: P({ hF: 22, kF: 45, hB: -10, kB: 30, aF: -60, eF: -60, aB: 160, eB: 40, L: -8, j: 5 }),
      danceB: P({ hF: -10, kF: 30, hB: 22, kB: 45, aF: 160, eF: 40, aB: -60, eB: -60, L: 8, j: 1 }),
      shush: P({ aF: -45, eF: -118, aB: 110, eB: -20, L: -6 }),
      badge: P({ aF: -10, eF: -150, aB: -100, eB: -10, L: -4 }),
      rally: P({ hF: 12, kF: 10, hB: -12, kB: 10, aF: -30, eF: -60, aB: 110, eB: -30, L: 2 }),
      // Tempers: pointing the finger, arms wide ("what was that?"), waving him off, a shove, squaring up.
      blamePoint: P({ hF: 10, kF: 10, hB: -12, kB: 12, aF: -5, eF: 0, aB: 100, eB: -30, L: 8 }),
      armsWide: P({ hF: 9, kF: 8, hB: -9, kB: 8, aF: 40, eF: -40, aB: 140, eB: 40, L: -8 }),
      waveOff: P({ hF: 6, kF: 8, hB: -6, kB: 8, aF: 20, eF: -90, aB: 110, eB: -30, L: -4 }),
      shove: P({ hF: 25, kF: 30, hB: -25, kB: 20, aF: 5, eF: -20, aB: 0, eB: -20, L: 22 }),
      stumble: P({ hF: 30, kF: 20, hB: -10, kB: 30, aF: -60, eF: -20, aB: 200, eB: 0, L: -22 }),
      chestOut: P({ hF: 12, kF: 6, hB: -12, kB: 6, aF: 120, eF: 20, aB: 60, eB: -20, L: -10 }),
      separate: P({ hF: 14, kF: 10, hB: -14, kB: 10, aF: 0, eF: 0, aB: 180, eB: 0, L: 2 }),
    };
    /** Running legs swing with a stride phase that advances with distance covered. */
    const STRIDES = new Set(["run", "dribble", "dribbleLow", "airplane", "walkSad"]);
    function poseOf(name, phase) {
      if (!STRIDES.has(name)) return POSES[name];
      const s = Math.sin(phase), low = name === "dribbleLow", amp = name === "dribble" ? 28 : low ? 24 : 36;
      const q = P({ hF: amp * s + (low ? 10 : 0), kF: (low ? 40 : 18) + 52 * Math.max(0, -s), hB: -amp * s - (low ? 6 : 0), kB: (low ? 40 : 18) + 52 * Math.max(0, s),
        aF: 90 + 48 * s, eF: -75, aB: 90 - 48 * s, eB: -75, L: name === "dribble" ? 10 : low ? 24 : 15, j: 3 * Math.abs(Math.cos(phase)) });
      if (low) Object.assign(q, { aF: 40 + 30 * s, eF: -30, aB: 150 - 30 * s, eB: 10 });
      if (name === "airplane") Object.assign(q, { aF: -8, eF: 0, aB: 188, eB: 0, L: 18 });
      // Trudging back after conceding: short steps, arms hanging, head down.
      if (name === "walkSad") Object.assign(q, { hF: 16 * s, kF: 12 + 20 * Math.max(0, -s), hB: -16 * s, kB: 12 + 20 * Math.max(0, s), aF: 92 + 10 * s, eF: -5, aB: 88 - 10 * s, eB: -5, L: 24, j: 0 });
      return q;
    }
    const HAPPY = "M1 7 Q5 13 10 7 Z", ANGRY = "M2 9 Q5 5 9 9 Q5 13 2 9 Z";
    const MOUTH = {
      cheer: HAPPY, cheerLow: HAPPY, airplane: HAPPY, kneel: HAPPY, trophyUp: HAPPY, trophyHop: HAPPY, siuJump: "M2 6 Q5 14 9 6 Z", siuLand: "M2 6 Q5 14 9 6 Z", pointSky: HAPPY,
      fistPump: "M1 7 Q5 12 10 7 Z", kick: "M2 7 Q5 11 9 7 Z", powerKick: "M2 6 Q5 12 9 6 Z", header: "M2 7 Q5 11 9 7 Z", bicycle: "M2 7 Q5 11 9 7 Z",
      slump: "M1 10 Q5 6 9 10", hipsHands: "M1 10 Q5 6 9 10", kneelSad: "M1 10 Q5 6 9 10", sitSad: "M1 10 Q5 6 9 10", walkSad: "M1 10 Q5 7 9 10", headHands: "M2 8 Q5 12 8 8 Q5 6 2 8 Z", shrug: "M1 10 Q5 7 9 10", fall: "M2 8 Q5 12 8 8 Q5 6 2 8 Z", lunge: "M2 8 Q5 12 8 8 Q5 6 2 8 Z",
      dive: "M2 9 H8", diveLand: "M2 9 H8", whistle: "M3 8 Q5 10 7 8", slide: "M2 9 H8", stance: "M2 9 H8", wall: "M2 9 H8",
      kneeSlide: "M2 6 Q5 14 9 6 Z", kneelSky: "M2 6 Q5 14 9 6 Z", danceA: HAPPY, danceB: HAPPY, cheerHop: HAPPY, hug: HAPPY, highFive: HAPPY,
      shush: "M3 8 Q5 10 7 8", badge: HAPPY,
      rally: HAPPY, gkChest: "M2 9 H8", gkLow: "M2 9 H8", gkHigh: "M2 9 H8",
      blamePoint: ANGRY, armsWide: ANGRY, waveOff: "M1 10 Q5 7 9 10", shove: ANGRY, stumble: ANGRY, chestOut: ANGRY, separate: "M2 9 H8",
    };
    const SMILE = "M1 8 Q5 11 9 8";
    MOUTH.handsKnees = "M3 7 Q5 11 7 7 Z"; MOUTH.hurt = "M1 10 Q5 6 9 10"; MOUTH.limp = "M1 10 Q5 6 9 10"; MOUTH.onStretcher = "M2 9 H8";
    const TH = 16, SH = 17, TORSO = 27, UA = 13, FA = 12, HR = 14;
    const rad = d => d * Math.PI / 180;
    const legDir = a => [Math.sin(rad(a)), Math.cos(rad(a))];
    const armDir = a => [Math.cos(rad(a)), Math.sin(rad(a))];
    function rig(q) {
      const hip = [0, 0];
      const kneeF = add(hip, mul(legDir(q.hF), TH)), footF = add(kneeF, mul(legDir(q.hF - q.kF), SH));
      const kneeB = add(hip, mul(legDir(q.hB), TH)), footB = add(kneeB, mul(legDir(q.hB - q.kB), SH));
      const up = [Math.sin(rad(q.L)), -Math.cos(rad(q.L))];
      const waist = add(hip, mul(up, 6)), top = add(hip, mul(up, TORSO)), head = add(hip, mul(up, TORSO + HR + 1));
      const elbowF = add(top, mul(armDir(q.aF + q.L), UA)), handF = add(elbowF, mul(armDir(q.aF + q.L + q.eF), FA));
      const elbowB = add(top, mul(armDir(q.aB + q.L), UA)), handB = add(elbowB, mul(armDir(q.aB + q.L + q.eB), FA));
      const r = { hip, kneeF, footF, kneeB, footB, waist, top, head, elbowF, handF, elbowB, handB };
      if (q.rot) {
        const c = Math.cos(rad(q.rot)), s = Math.sin(rad(q.rot));
        for (const k in r) { const [x, y] = r[k]; r[k] = [x * c - y * s, x * s + y * c]; }
      }
      // Rest the lowest point (boot, knee, head, body) on the ground, then lift by the jump.
      const low = Math.max(r.footF[1] + 3.5, r.footB[1] + 3.5, r.kneeF[1] + 4, r.kneeB[1] + 4, r.head[1] + HR, r.handF[1] + 3, r.handB[1] + 3,
        r.top[1] + 11, r.waist[1] + 11, r.hip[1] + 10);
      for (const k in r) r[k] = [r[k][0], r[k][1] - low - q.j];
      r.lean = q.L; r.rot = q.rot;
      return r;
    }
    
    // Lying on the stretcher: flat on his back, raised to the height of the bearers' hands.
    POSES.onStretcher = P({ hF: 10, kF: 10, hB: 4, kB: 6, aF: 20, eF: -60, aB: 30, eB: -60, L: 0, rot: -88, j: -rig(POSES.carryLow).handF[1] - 3 });
    
    /* ---------------------------------- people ---------------------------------- */
    const ROLES = ["GK", "DF", "DF", "MF", "FW", "FW"];
    const HOME = [[0.03, 0.5], [0.2, 0.3], [0.2, 0.7], [0.37, 0.5], [0.53, 0.27], [0.53, 0.73]];
    /**
     * Team shapes, by shirt slot (keeper, left back, right back, midfielder, two forwards). The slot keeps its
     * player; what changes is where he stands and which line he belongs to.
     *  - 2-1-2: the attacking default.
     *  - 3-1-1: protecting a lead: one forward drops in as a third centre-back, the block sits deep, the lone
     *    striker stays up as the outlet for the counter.
     *  - 1-2-2: chasing the game late: one centre-back, two midfielders, everyone pushed up.
     */
    const SHAPES = {
      "2-1-2": { size: 5, name: "tấn công", call: "Đá đúng sơ đồ!", push: 0,
        home: [[0.03, 0.5], [0.2, 0.3], [0.2, 0.7], [0.37, 0.5], [0.53, 0.27], [0.53, 0.73]], lines: ["GK", "DF", "DF", "MF", "FW", "FW"] },
      "3-1-1": { size: 5, sit: true, withBall: "2-1-2", name: "phòng ngự phản công", call: "Lùi về giữ chắc!", push: -0.07,
        home: [[0.03, 0.5], [0.16, 0.24], [0.16, 0.76], [0.28, 0.5], [0.14, 0.5], [0.47, 0.5]], lines: ["GK", "DF", "DF", "MF", "DF", "FW"] },
      "1-2-2": { size: 5, name: "dồn lên tấn công", call: "Dồn lên hết!", push: 0.06,
        home: [[0.05, 0.5], [0.24, 0.5], [0.4, 0.75], [0.4, 0.25], [0.6, 0.3], [0.6, 0.7]], lines: ["GK", "DF", "MF", "MF", "FW", "FW"] },
      "1-1-3": { size: 5, name: "tổng tấn công", call: "Tổng tấn công!", push: 0.09,
        home: [[0.07, 0.5], [0.28, 0.5], [0.62, 0.84], [0.44, 0.5], [0.63, 0.18], [0.68, 0.52]], lines: ["GK", "DF", "FW", "MF", "FW", "FW"] },
      // A man down (four outfield players): the remaining players fill these spots, back to front.
      "2-1-1": { size: 4, name: "thiếu người, giữ cân bằng", call: "Bù người cho nhau!", push: -0.02,
        home: [[0.2, 0.3], [0.2, 0.7], [0.36, 0.5], [0.52, 0.5]], lines: ["DF", "DF", "MF", "FW"] },
      "3-1": { size: 4, sit: true, withBall: "2-1-1", name: "thiếu người, lùi sâu giữ tỉ số", call: "Lùi hết về, chơi chắc!", push: -0.08,
        home: [[0.15, 0.25], [0.15, 0.75], [0.13, 0.5], [0.45, 0.5]], lines: ["DF", "DF", "DF", "FW"] },
      "1-2-1": { size: 4, name: "thiếu người, đẩy cao", call: "Dâng lên, đừng sợ!", push: 0.04,
        home: [[0.24, 0.5], [0.4, 0.27], [0.4, 0.73], [0.57, 0.5]], lines: ["DF", "MF", "MF", "FW"] },
      "1-1-2": { size: 4, name: "thiếu người, tổng tấn công", call: "Liều thôi, lên hết!", push: 0.08,
        home: [[0.27, 0.5], [0.44, 0.5], [0.62, 0.3], [0.64, 0.7]], lines: ["DF", "MF", "FW", "FW"] },
      // Two men down (three outfield players).
      "2-1": { size: 3, sit: true, withBall: "1-1-1", name: "còn 4 người, phòng ngự", call: "Giữ chặt khung thành!", push: -0.06,
        home: [[0.17, 0.32], [0.17, 0.68], [0.42, 0.5]], lines: ["DF", "DF", "FW"] },
      "1-1-1": { size: 3, name: "còn 4 người, cân bằng", call: "Cố lên, còn 4 người thôi!", push: 0,
        home: [[0.22, 0.5], [0.38, 0.5], [0.55, 0.5]], lines: ["DF", "MF", "FW"] },
      "1-2": { size: 3, name: "còn 4 người, dồn lên", call: "Lên hết đi!", push: 0.07,
        home: [[0.26, 0.5], [0.58, 0.3], [0.58, 0.7]], lines: ["DF", "FW", "FW"] },
    };
    /** Where a player stands in a shape: by shirt slot at full strength, otherwise by his place in the remaining line-up. */
    function shapeSlot(p, sh) {
      if (sh.size === 5) return { home: sh.home[p.i], line: sh.lines[p.i] };
      const field = team[p.team].filter(x => x.role !== "GK" && inSquad(x)).sort((a, b) => a.i - b.i), k = Math.max(0, field.indexOf(p));
      return { home: sh.home[Math.min(k, sh.home.length - 1)], line: sh.lines[Math.min(k, sh.lines.length - 1)] };
    }
    const sitsDeep = t => !!SHAPES[game.shape[t]].sit;
    // name, hair, skin, shirt number, star (10 = the dribbler, 7 = the striker)
    const ROSTER = {
      R: [["Hùng", "buzz", 2, 1], ["Long", "spiky", 1, 2], ["Khoa", "curly", 2, 5], ["Bin", "beard", 1, 10, 10], ["Tuấn", "glasses", 1, 9], ["Quang", "quiff", 1, 7, 7]],
      B: [["Hưng", "glasses", 2, 1], ["Nam", "buzz", 1, 3], ["Phát", "sidepart", 1, 4], ["Đạt", "spiky", 2, 8], ["Quân", "curly", 1, 11], ["Vũ", "beard", 2, 9]],
    };
    const KIT = {
      R: { shirt: "var(--art-red)", shorts: "var(--color-card)", socks: "var(--art-red)", gk: "var(--art-gk-r)" },
      B: { shirt: "var(--art-blue)", shorts: "var(--art-shorts)", socks: "var(--art-blue)", gk: "var(--art-gk-b)" },
    };
    const players = [];
    const team = { R: [], B: [] };
    for (const t of TEAMS) ROSTER[t].forEach(([name, head, skin, num, star], i) => {
      const p = { id: `${t}${i}`, team: t, i, n: players.length, role: ROLES[i], home: HOME[i], name, head, skin, num, star: star ?? 0,
        pos: toW(t, HOME[i]), vel: [0, 0], face: ATT[t], faceDir: ATT[t], turnSince: null, faceLock: null, script: null, keys: [], pose: { ...POSES.ready }, poseName: "ready",
        stride: players.length * 0.7, busyUntil: 0, dribStyle: null, g: [0, 0] };
      players.push(p); team[t].push(p);
    });
    const ref = { id: "ref", team: null, i: -1, n: 12, role: "REF", name: "Trọng tài", head: "ref", skin: 1, num: null, star: 0,
      pos: [0.5, 0.75], vel: [0, 0], face: -1, faceDir: -1, turnSince: null, faceLock: null, script: null, keys: [], pose: { ...POSES.ready }, poseName: "ready", stride: 0, busyUntil: 0, g: [0, 0] };
    const people = [...players, ref];
    const GK = { R: team.R[0], B: team.B[0] };
    /** The star men, wherever they are: on the pitch (a slot) or not at all (on the bench). */
    const NOBODY = { off: true, pos: [0.5, 0.5] };
    const STAR = { get 10() { return team.R.find(p => p.star === 10) ?? NOBODY; }, get 7() { return team.R.find(p => p.star === 7) ?? NOBODY; } };
    /**
     * Substitutes: up to three a side sit on a bench by the halfway line on the far touchline; how many turn up
     * changes from match to match. Substitutions are rolling (a player who comes off can go back on), but only
     * whoever is sitting on the bench can come on.
     * A substitution swaps who a pitch slot is (name, looks, shirt, legs, cards) with a bench seat, and swaps their
     * positions at the same instant, so each figure stays exactly where it was on screen.
     */
    const BENCH_POOL = {
      R: [["Minh", "quiff", 2, 12], ["Dũng", "buzz", 1, 14], ["Huy", "sidepart", 2, 17], ["Lâm", "curly", 1, 19]],
      B: [["Sơn", "spiky", 1, 13], ["Tài", "quiff", 2, 15], ["Lộc", "beard", 1, 16], ["Kiên", "sidepart", 2, 18]],
    };
    const bench = { R: [], B: [] };
    const seatUV = b => [b.team === "R" ? 0.375 + b.seat * 0.036 : 0.553 + b.seat * 0.036, -0.045];
    for (const t of TEAMS) for (let k = 0; k < 3; k++) {
      const b = { id: `${t}s${k}`, team: t, i: -1, n: 13 + people.length, seat: k, bench: true, role: "SUB", name: "", head: "buzz", skin: 1, num: 0, star: 0,
        pos: [0, 0], vel: [0, 0], face: 1, faceDir: 1, turnSince: null, faceLock: null, script: null, keys: [], pose: { ...POSES.sitBench }, poseName: "sitBench",
        stride: 0, busyUntil: 0, g: [0, 0], off: true, energy: 1 };
      b.pos = seatUV(b); b.g = ground(...b.pos);
      bench[t].push(b); people.push(b);
    }
    /** Key men who play the whole match unless they are spent or hurt: the captain and the main striker. */
    const PILLARS = new Set(["Bin", "Quang", "Đạt", "Vũ"]);
    /** Two medics with a stretcher, waiting by the tunnel. */
    const MEDIC_POST = [[0.255, -0.058], [0.275, -0.058]];
    const medics = MEDIC_POST.map((post, k) => {
      const m = { id: `med${k}`, team: null, i: -1, n: 30 + k, medic: true, post, role: "MEDIC", name: "Y tế", head: k ? "sidepart" : "buzz", skin: k ? 2 : 1, num: "+", star: 0,
        pos: [...post], vel: [0, 0], face: 1, faceDir: 1, turnSince: null, faceLock: null, script: null, keys: [], pose: { ...POSES.ready }, poseName: "ready",
        stride: 0, busyUntil: 0, g: ground(...post) };
      people.push(m);
      return m;
    });
    const IDENT = ["name", "head", "skin", "num", "star", "pillar", "yellows", "energy", "stamina", "injured", "tiredSaid", "lastSkill", "onSince", "stintLen", "benchSince"];
    /** How long he stays on before the coach rotates him: about 20 minutes, staggered so they do not all go at once. */
    const newStint = () => 17 + rng() * 6;
    function setIdent(p, [name, head, skin, num, star]) {
      // Stamina differs from man to man (and from day to day): some are blowing after half an hour, some last.
      // Key men are the fittest: they are expected to last the whole match.
      Object.assign(p, { name, head, skin, num, star: star ?? 0, pillar: PILLARS.has(name), yellows: 0, energy: 1, stamina: PILLARS.has(name) ? 1.2 + rng() * 0.25 : 0.8 + rng() * 0.45,
        injured: false, tiredSaid: false, lastSkill: null, onSince: 0, stintLen: newStint(), benchSince: -99 });
      if (p.sprite) restyle(p);
    }
    /** A fresh line-up: the usual six on the pitch and one to three of the others on the bench. */
    function pickSquads() {
      for (const t of TEAMS) {
        team[t].forEach((p, i) => setIdent(p, ROSTER[t][i]));
        const pool = [...BENCH_POOL[t]].sort(() => rng() - 0.5), nb = 1 + Math.floor(rng() * 3);
        bench[t].forEach((b, k) => {
          b.off = k >= nb; b.script = null; b.exitTo = null; b.subbing = false; b.keys = [];
          if (!b.off) setIdent(b, pool[k]);
          b.pos = seatUV(b); b.g = ground(...b.pos); b.vel = [0, 0];
        });
      }
    }
    /** How fit he still is: 1 down to about half energy, then falling away. */
    const fit = p => clamp((p.energy ?? 1) / 0.5, 0.1, 1);
    /** In the side: not sent off (or off injured with nobody to replace him). */
    const inSquad = p => !p.off && !p.sentOff;
    /** In play: in the side and not on his way off to be substituted. */
    const on = p => inSquad(p) && !p.subbing;
    const opponents = t => team[otherTeam(t)].filter(on);
    const outfield = list => list.filter(p => p.role !== "GK" && on(p));
    function nearest(list, uv, exclude) {
      let best = null, bd = Infinity;
      for (const p of list) { if (p === exclude) continue; const d = mdist(p.pos, uv); if (d < bd) { bd = d; best = p; } }
      return { p: best, d: bd };
    }
    
    /* ---------------------------------- storylines ---------------------------------- */
    /**
     * Each match follows a storyline: who scores, from roughly which minute. The losing side always hits back at
     * some point. Story roles are randomly assigned to either shirt colour.
     */
    const STORIES = [
      { name: "2-0 → 2-2 → 3-2", goals: [["R", 9], ["R", 20], ["B", 31], ["B", 39], ["R", 48]] },
      { name: "3-0 → 3-2, ép sân không thành", goals: [["R", 8], ["R", 19], ["R", 28], ["B", 40], ["B", 49]] },
      { name: "0-1 → 2-1", goals: [["B", 10], ["R", 28], ["R", 47]] },
      { name: "0-2 → 3-2", goals: [["B", 8], ["B", 19], ["R", 29], ["R", 39], ["R", 49]] },
      { name: "giằng co 3-2", goals: [["R", 9], ["B", 21], ["R", 32], ["B", 42], ["R", 52]] },
      { name: "lội ngược 2-1", goals: [["B", 15], ["R", 33], ["R", 51]] },
      { name: "1-1 → bàn thắng muộn", goals: [["R", 17], ["B", 47], ["R", 55]] },
      { name: "2-0 → 2-1, giữ chặt", goals: [["R", 12], ["R", 27], ["B", 45]] },
      { name: "1-2 → 4-2", goals: [["R", 7], ["B", 16], ["B", 25], ["R", 35], ["R", 42], ["R", 53]] },
      { name: "0-1 → 3-1", goals: [["B", 12], ["R", 27], ["R", 38], ["R", 52]] },
      { name: "rượt đuổi 4-3", goals: [["R", 5], ["B", 13], ["R", 22], ["B", 31], ["R", 40], ["B", 47], ["R", 53]] },
    ];
    function newStory() {
      const st = pick(STORIES);
      const mirror = rng() < 0.5;
      const goals = interactive ? [] : st.goals.map(([t, m]) => [mirror ? otherTeam(t) : t, clamp(Math.round(m * 0.85) + Math.round((rng() - 0.5) * 6), 3, 47)]).sort((a, b) => a[1] - b[1]);
      return { name: interactive ? "Tự do" : st.name, goals, favourite: mirror ? "B" : "R" };
    }
    
    /* ---------------------------------- game state ---------------------------------- */
    let T = 0;
    const game = {
      mode: "reset", modeT: -1.2, poss: rng() < 0.5 ? "R" : "B", kickoffTeam: null, carrier: null, stoppage: true,
      score: { R: 0, B: 0 }, cards: { R: 0, B: 0 }, reds: { R: 0, B: 0 }, callouts: [], clock: 0, golden: false, note: null, scorer: null, celebrate: null,
      callout: null, net: null, post: null, winner: null, press: { R: null, B: null }, pressAt: 0, timers: [],
      freeKick: false, kickoffPass: false, crowdCheer: -10, cheerTeam: null, shake: -10, skillUntil: -1, dirty: true,
      shape: { R: "2-1-2", B: "2-1-2" }, shapeAt: { R: -99, B: -99 }, chainsUsed: { R: 0, B: 0 }, posts: { R: 0, B: 0 }, scuffled: false, lastCeleb: { R: null, B: null }, story: null, storyIdx: 0, momentum: null, counter: null, chain: null,
      blame: null, fight: null, stats: { corners: 0, cornerGoals: 0, kickIns: 0, shapeChanges: 0, counters: 0, chains: 0, encourages: 0, reactions: 0, sulks: 0, secondYellows: 0, catches: 0, parries: 0, goals: 0, blames: 0, scuffles: 0, reds: 0, yellows: 0, oneTwos: 0, triangles: 0, tricks: 0, shots: 0, subs: 0, injuries: 0 },
    };
    game.kickoffTeam = game.poss; game.firstKick = game.poss;
    game.story = newStory();
    const ball = { mode: "hidden", owner: null, seg: null, g: ground(0.5, 0.5), h: 0, alpha: 0, show: false, spin: 0, kind: null };
    const cam = { x: ground(0.5, 0.5)[0], y: ground(0.5, 0.5)[1], z: 0.6 };

    // Input changes only the selected player's target; camera, rigs, fatigue and rolling subs stay shared.
    const humans = interactive ? [{ slot: "A", team: settings.teamA === "B" ? "B" : "R", selected: null, x: 0, y: 0, sprint: false, tackleAt: -99 }] : [];
    if (settings.mode === "local") humans.push({ slot: "B", team: otherTeam(humans[0].team), selected: null, x: 0, y: 0, sprint: false, tackleAt: -99 });
    let support = settings.support !== false && settings.support !== "false";
    const humanFor = p => p && humans.find(h => h.team === p.team);
    const manual = p => interactive && game.mode === "play" && !game.stoppage && on(p) && (p.role !== "GK" || ball.owner === p) && humanFor(p)?.selected === p;
    function selectBallOwner(p) {
      const h = humanFor(p);
      if (h && on(p)) h.selected = p;
    }
    function aimFor(h, p = h.selected) {
      const screen = h.aim ?? (p ? add(ground(...toW(h.team, [1, 0.5])), mul(p.g, -1)) : [ATT[h.team], 0]);
      const size = Math.hypot(...screen) || 1, direction = courtUV(screen);
      const metres = Math.hypot(direction[0] * LEN, direction[1] * WID) || 1;
      return { screen: mul(screen, 1 / size), world: mul(direction, 1 / metres) };
    }
    function rayEnd(p, direction, limit = Infinity) {
      const tx = Math.abs(direction[0]) > 1e-8 ? ((direction[0] > 0 ? 1 : 0) - p.pos[0]) / direction[0] : Infinity;
      const ty = Math.abs(direction[1]) > 1e-8 ? ((direction[1] > 0 ? 1 : 0) - p.pos[1]) / direction[1] : Infinity;
      const distance = Math.max(0.1, Math.min(tx, ty, limit));
      return { position: [clamp(p.pos[0] + direction[0] * distance, 0, 1), clamp(p.pos[1] + direction[1] * distance, 0, 1)], boundary: Math.min(tx, ty) <= limit, endLine: tx <= ty, distance };
    }
    function updateControls() {
      for (const h of humans) {
        if (!h.selected || !on(h.selected) || (h.selected.role === "GK" && ball.owner !== h.selected)) h.selected = nearest(outfield(team[h.team]), ballUV()).p;
        if (ball.owner?.team === h.team && ["carried", "held"].includes(ball.mode) && on(ball.owner)) {
          h.selected = ball.owner;
          if (game.mode === "play" && !game.stoppage) game.carrier = ball.owner;
        }
        const p = h.selected;
        if (p && p.busyUntil === Infinity && !p.script && ball.owner !== p && !p.keys.some(k => k[1] > T)) p.busyUntil = T;
      }
      const c = game.carrier;
      if (game.mode !== "play" || game.stoppage || !c || !humanFor(c) || c.script || ball.mode !== "carried" || T < c.busyUntil) return;
      const d = nearest(outfield(opponents(c.team)).filter(p => !manual(p) && !p.script && T >= p.busyUntil), c.pos);
      if (d.p && d.d < 2.1 && T - (game.manualChallengeAt ?? -99) > 1.2) {
        game.manualChallengeAt = T;
        tackle(c, d.p, T + 0.3);
      }
    }
    api.setInput = (slot, input = {}) => {
      const h = humans.find(h => h.slot === slot);
      if (h) {
        Object.assign(h, { x: clamp(Number(input.x) || 0, -1, 1), y: clamp(Number(input.y) || 0, -1, 1), sprint: !!input.sprint });
        if (h.x || h.y) h.aim = [h.x, h.y];
      }
    };
    api.setSupport = enabled => { support = !!enabled; };
    api.action = (slot, action) => {
      const h = humans.find(h => h.slot === slot);
      if (!h || game.mode !== "play" || game.stoppage) return false;
      if (ball.owner?.team === h.team && ["carried", "held"].includes(ball.mode)) selectBallOwner(ball.owner);
      const p = h.selected;
      if (!p || !on(p)) return false;
      if (action === "switch" && game.poss !== h.team) {
        const choices = outfield(team[h.team]).filter(p => p !== h.selected && !p.script);
        h.selected = nearest(choices, ballUV()).p ?? h.selected;
        return true;
      }
      if (p.script || T < p.busyUntil) return false;
      if (ball.owner === p && ["carried", "held"].includes(ball.mode)) {
        game.kickoffPass = false; game.freeKick = false; game.restart = null;
        if (action === "pass" || action === "shoot") return directedKick(p, h, action);
      }
      if (action === "slide" && ball.owner !== p && T - h.tackleAt > 1.5) {
        const c = game.carrier, direction = aimFor(h, p).world;
        h.tackleAt = T; p.energy = Math.max(0.05, p.energy - 0.035);
        game.stats.slides = (game.stats.slides ?? 0) + 1;
        const towards = c ? ((c.pos[0] - p.pos[0]) * LEN * direction[0] * LEN + (c.pos[1] - p.pos[1]) * WID * direction[1] * WID) : -1;
        if (c && c.team !== h.team && ball.mode === "carried" && mdist(p.pos, c.pos) < 4.5 && towards > 0) tackle(c, p, T + 0.4, { slide: true });
        else {
          const target = inPitch(rayEnd(p, direction, 3.2 * fit(p)).position);
          mkScript(p, [T, p.pos], [T + 0.45, target], [T + 1.05, target]);
          p.keys.push([T, T + 0.55, "slide"], [T + 0.55, T + 1.05, "sitUp"]);
          p.busyUntil = T + 1.1;
        }
        return true;
      }
      if (action === "tackle" && T - h.tackleAt > 1) {
        const c = game.carrier;
        if (c && c.team !== h.team && ball.mode === "carried" && mdist(p.pos, c.pos) < 3) {
          h.tackleAt = T; tackle(c, p, T + 0.25); return true;
        }
      }
      return false;
    };
    api.status = () => ({ mode: settings.mode ?? "watch", support, phase: game.mode, stoppage: game.stoppage, note: game.note, minute: minute(), score: { ...game.score }, winner: game.winner,
      ended: ["fulltime", "ceremony", "draw"].includes(game.mode), leftTeam: SWAP ? "B" : "R", possession: game.poss,
      players: humans.map(h => ({ slot: h.slot, team: h.team, name: h.selected?.name ?? "", number: h.selected?.num ?? null,
        energy: h.selected?.energy ?? 1, hasBall: ball.owner === h.selected,
        ready: !!h.selected && manual(h.selected) && !h.selected.script && T >= h.selected.busyUntil,
        slideReady: !!h.selected && manual(h.selected) && !h.selected.script && T >= h.selected.busyUntil && ball.owner !== h.selected && T - h.tackleAt > 1.5,
        aim: aimFor(h).screen, role: h.selected?.role ?? null,
        position: h.selected ? [...h.selected.pos] : null })) });

    function directedKick(c, h, action) {
      const direction = aimFor(h, c).world, assisted = support;
      const raw = rayEnd(c, direction, action === "shoot" ? Infinity : h.sprint ? 24 : 16);
      let receiver = null, target = raw.position;
      if (action === "pass" && assisted) {
        let best = -Infinity;
        for (const teammate of team[c.team].filter(p => p !== c && on(p))) {
          const distance = mdist(c.pos, teammate.pos);
          if (distance < 1) continue;
          const dot = ((teammate.pos[0] - c.pos[0]) * LEN * direction[0] * LEN + (teammate.pos[1] - c.pos[1]) * WID * direction[1] * WID) / distance;
          const value = dot * 100 - distance * 0.04;
          if (value > best) { best = value; receiver = teammate; }
        }
        if (!receiver) return false;
        target = inPitch([receiver.pos[0] + receiver.vel[0] / LEN * 0.35, receiver.pos[1] + receiver.vel[1] / WID * 0.35]);
      }
      if (action === "shoot") {
        const goal = toW(c.team, [1, 0.5]);
        if (assisted) {
          const t = Math.abs(direction[0]) > 1e-8 ? (goal[0] - c.pos[0]) / direction[0] : -1;
          target = [goal[0], clamp(t > 0 ? c.pos[1] + direction[1] * t : 0.5, GOAL_V[0] + 0.015, GOAL_V[1] - 0.015)];
        }
        if ((assisted || raw.endLine) && Math.abs(target[0] - goal[0]) < 1e-5 && target[1] > GOAL_V[0] && target[1] < GOAL_V[1]) {
          game.lastKick = { action, assisted, origin: [...c.pos], target: [...target], receiver: null };
          return shoot(c, { style: h.sprint ? "power" : "kick", aimedW: toT(c.team, target)[1], onTarget: true, manual: true });
        }
      }
      const distance = mdist(c.pos, target), throwing = ball.mode === "held";
      const Tk = T + (action === "shoot" ? 0.3 : 0.22), flight = Math.max(0.25, distance / (action === "shoot" ? h.sprint ? 24 : 19 : PASS));
      game.lastKick = { action, assisted, origin: [...c.pos], target: [...target], receiver: receiver?.name ?? null };
      if (action === "shoot") game.stats.shots++;
      else game.stats.passes = (game.stats.passes ?? 0) + 1;
      holdStill(c, T, Tk + 0.08); kickPoses(c, Tk, throwing ? "throw" : action === "pass" ? "pass" : h.sprint ? "power" : "kick");
      lockFace(c, Tk + 0.25, faceTowards(c, ground(...target))); c.busyUntil = Infinity;
      if (!assisted && !raw.boundary && action === "pass") {
        const candidate = nearest(players.filter(p => p !== c && on(p) && !p.script), target).p;
        if (candidate && mdist(candidate.pos, target) <= RUN * flight * (0.7 + 0.3 * fit(candidate))) receiver = candidate;
      }
      if (receiver) mkScript(receiver, [T, receiver.pos], [Tk + flight, target], [Tk + flight + 0.25, target]);
      at(Tk, () => {
        if (game.mode !== "play" || ball.owner !== c) return;
        game.carrier = null;
        fly({ g: ground(...target), h: action === "shoot" ? 0.3 : 0 }, flight, action === "shoot" ? 0.15 : 0.08, { kind: action === "shoot" ? "shot" : "pass", onEnd: () => {
          if (game.mode !== "play") return;
          if (receiver && on(receiver)) return receive(receiver, null, { accurate: assisted });
          if (!raw.boundary) return looseBall(inPitch(target), { maxArc: 0.15, exclude: c });
          if (!raw.endLine) return ballOut(otherTeam(c.team), target);
          const attackingTeam = (target[0] > 0.5) !== SWAP ? "R" : "B";
          if (target[1] > GOAL_V[0] && target[1] < GOAL_V[1]) {
            const credited = attackingTeam === c.team ? c : nearest(outfield(team[attackingTeam]), c.pos).p;
            if (credited) { if (attackingTeam !== c.team) say(c, "Phản lưới!", "var(--color-coral)"); return scored(credited, toT(attackingTeam, target)[1]); }
          }
          const defendingTeam = otherTeam(attackingTeam), keeper = GK[defendingTeam];
          game.stoppage = true; game.carrier = null;
          setNote(`Ra ngoài · phát bóng ${TEAM_NAME[defendingTeam]}`);
          at(T + 1, () => {
            if (game.mode !== "play") return;
            carry(keeper); game.carrier = keeper; game.poss = defendingTeam; game.stoppage = false; keeper.busyUntil = T + 0.4; game.dirty = true;
          });
        } });
      });
      return true;
    }
    
    const at = (t, fn) => game.timers.push({ t, fn });
    const ballUV = () => courtUV(ball.g);
    /** Speech bubbles: up to three at once (a goal, a celebration and an argument can overlap); one per speaker. */
    function say(who, text, fill = "var(--color-card)", life = 1.1) {
      // After the final whistle players only say what the full-time scene gives them (sayFT).
      if ((game.mode === "fulltime" || game.mode === "ceremony") && who?.team && !say.ft) return;
      const c = { who, text, fill, t: T, life, at: who === "ball" ? [ball.g[0], ball.g[1] - ball.h * K] : null };
      game.callouts = game.callouts.filter(x => T - x.t < x.life && x.who !== who);
      game.callouts.push(c);
      if (game.callouts.length > 3) game.callouts.shift();
      game.callout = c;
    }
    const sayFT = (...a) => { say.ft = true; say(...a); say.ft = false; };
    function setNote(text) { game.note = text; game.dirty = true; }
    /** Once a free kick, corner or kick-in has been taken, its note goes. */
    const clearRestartNote = () => { if (/^(Đá phạt|Phạt góc|Đá biên|Phạm lỗi)/.test(game.note ?? "")) setNote(null); };
    /** Things players shout. A line is not reused until a dozen others have been said. */
    const LINES = {
      // After conceding: a sharp word, but about the job, not the person.
      accuse: ["Áp sát hơn nhé!", "Theo người kỹ vào!", "Bọc lót cho nhau!", "Giữ vị trí nào!", "Tập trung lên!", "Lùi về nhanh hơn!",
        "Nói chuyện với nhau đi!", "Kèm chặt số 7 vào!", "Đừng để nó xoay người!", "Phải chặn đường sút chứ!", "Sao để trống thế?!", "Kèm người kiểu gì vậy?!"],
      retort: ["Nó chạy chỗ qua mặt tôi!", "Hai đứa ập vào một lúc!", "Bóng bật lệch chân!", "Tôi đã cố chặn rồi!", "Không ai bọc lót cho tôi!",
        "Biết rồi, tôi sửa!", "Anh nhắc sớm hơn nhé!", "Ok, lần sau tôi bám chặt!", "Tại tôi, xin lỗi!", "Anh chỉ đạo đi chứ!", "Đổ hết cho tôi à?!", "Nó nhanh quá!"],
      encourage: ["Không sao, làm lại!", "Còn nhiều thời gian!", "Bình tĩnh, gỡ lại nào!", "Ngẩng đầu lên anh em!", "Chưa hết đâu!", "Cố lên, mình làm được!",
        "Quên nó đi, tập trung!", "Một bàn thôi mà!", "Đá chắc vào là gỡ được!", "Giữ đội hình, từ từ!", "Mình vẫn đá tốt mà!", "Đoàn kết lên nào!"],
      reply: ["Ok, chiến tiếp!", "Rõ rồi!", "Lên nào!", "Gỡ ngay thôi!", "Được, tập trung!", "Cùng cố gắng!"],
      // After a miss: almost always encouragement.
      missKind: ["Tiếc quá!", "Suýt nữa thì vào!", "Sút hay lắm!", "Cứ thế, sẽ có bàn!", "Lần sau chắc chắn vào!", "Không sao, tiếp tục!",
        "Vào gần rồi!", "Dám sút là tốt!", "Ý tưởng hay!", "Chỉ thiếu chút may mắn!"],
      keeperGood: ["Thủ môn hay thôi!", "Sút thế là tốt rồi!", "Thủ môn đọc trúng thôi!", "Không sao, lần sau!", "Pha đó khó mà!"],
      // Only when a team-mate really was free and the shooter was not through on his own: advice, not abuse.
      missAdvice: ["Lần sau nhìn đồng đội nhé!", "Có người trống bên này!", "Chuyền ra là ngon rồi!", "Bình tĩnh quan sát nhé!"],
      saveCheer: ["Hay lắm thủ môn!", "Tuyệt vời!", "Cứu thua rồi!", "Đẳng cấp!", "Cảm ơn anh!", "Phản xạ đỉnh quá!"],
      praise: ["Hay lắm!", "Đọc tình huống tốt!", "Chuẩn rồi!", "Cứ thế!", "Tuyệt!", "Đẹp lắm!", "Quá chất!"],
      sulk: ["Không phục!", "Về thôi!", "Chán thật!"],
      scorer: ["Vàooo!", "Vào rồi!", "Ngon!", "Yesss!"],
      mateGoal: ["Đẹp!", "Đỉnh!", "Chuẩn!", "Hay lắm!"],
      equaliser: ["Gỡ rồi anh em ơi!", "Hòa rồi!", "Chưa xong đâu!"],
      goAhead: ["Vào rồi!!", "Dẫn rồi!", "Lên nào!"],
      ouch: ["Ối!", "Á!"],
    };
    const recentLines = [];
    function line(kind) {
      const pool = LINES[kind].filter(l => !recentLines.includes(l)), l = pick(pool.length ? pool : LINES[kind]);
      recentLines.push(l); if (recentLines.length > 12) recentLines.shift();
      return l;
    }
    /** Match minutes per second of ball in play. */
    /** Match minutes per second of play: two halves of 30 minutes, about 45 s of running clock each. */
    const PACE = 0.68, HALF = 30, FULL = 60;
    /** Flight time for a ball that rises `arc` metres above its straight line: what gravity needs (t = √(8h/g)). */
    const gravFlight = arc => Math.sqrt(8 * Math.max(0, arc) / 9.8);
    /** Amateur pace: ground passes, one-touch passes and the fastest a scripted run may go (m/s). */
    const PASS = 13, ONE_TOUCH = 14, RUN = 5.5;
    const minute = () => Math.floor(game.clock * PACE) + 1;
    
    /* ---------------------------------- ball ---------------------------------- */
    function footPoint(p, close) { return [p.g[0] + p.face * (close ? 6 : 8) * S, p.g[1] + 1.5]; }
    function handPoint(p) {
      const r = rig(p.pose), hand = lerp(r.handF, r.handB, 0.5);
      return [p.g[0] + (hand[0] + 4) * S * p.face, p.g[1] + (hand[1] - 2) * S];
    }
    /** Ball flight from where it is now. `curve` bends it sideways (px), `wobble` makes a knuckleball dance. */
    function fly(b, dur, arc, opts = {}) {
      ball.mode = "fly"; ball.owner = null;
      ball.seg = { t0: T, t1: T + dur, a: { g: [...ball.g], h: ball.h }, b, arc, roll: !!opts.roll, onEnd: opts.onEnd, kind: opts.kind ?? "pass", curve: opts.curve ?? 0, wobble: opts.wobble ?? 0 };
      ball.kind = ball.seg.kind;
    }
    function carry(p) { ball.mode = "carried"; ball.owner = p; ball.seg = null; ball.kind = null; ball.show = true; selectBallOwner(p); }
    function holdBall(p) { ball.mode = "held"; ball.owner = p; ball.seg = null; ball.kind = null; selectBallOwner(p); }
    function updateBall(dt) {
      const before = [...ball.g];
      if (ball.mode === "carried" && ball.owner) {
        const o = ball.owner, sp = Math.hypot(...o.vel), close = o.dribStyle === "dribbleLow" && T < o.busyUntil;
        ball.g = footPoint(o, close); ball.h = sp > 1 ? 0.14 * Math.abs(Math.sin(o.stride * (close ? 1.6 : 0.9))) : 0;
      } else if (ball.mode === "held" && ball.owner) {
        const hp = handPoint(ball.owner); ball.g = [hp[0], ball.owner.g[1] + 1]; ball.h = (ball.g[1] - hp[1]) / K;
      } else if (ball.mode === "fly") {
        const s = ball.seg; let f = clamp((T - s.t0) / (s.t1 - s.t0 || 1), 0, 1);
        if (s.roll) f = 1 - (1 - f) * (1 - f);
        ball.g = lerp(s.a.g, s.b.g, f);
        if (s.curve || s.wobble) {
          const d = [s.b.g[0] - s.a.g[0], s.b.g[1] - s.a.g[1]], n = Math.hypot(...d) || 1, perp = [-d[1] / n, d[0] / n];
          // A curler bends evenly; a knuckleball only drifts once or twice, late in its flight.
          const off = s.curve * 4 * f * (1 - f) + s.wobble * Math.sin(f * Math.PI * 3) * f * f * 3;
          ball.g = add(ball.g, mul(perp, off));
        }
        ball.h = s.a.h + (s.b.h - s.a.h) * f + 4 * s.arc * f * (1 - f);
        if (T >= s.t1) { ball.mode = "dead"; ball.seg = null; ball.kind = null; s.onEnd?.(); }
      }
      ball.spin += Math.hypot(ball.g[0] - before[0], ball.g[1] - before[1]) * 9;
      ball.alpha += ((ball.show ? 1 : 0) - ball.alpha) * Math.min(1, dt * 7);
    }
    
    /* ---------------------------------- scripted movement ---------------------------------- */
    /** A script is a list of [time, u, v] waypoints; the person follows it exactly, then goes back to running free. */
    const mkScript = (p, ...keys) => { p.script = { keys: keys.map(([t, uv]) => [t, uv[0], uv[1]]) }; };
    const holdStill = (p, t0, t1) => mkScript(p, [t0, p.pos], [t1, p.pos]);
    function scriptPos(p, t) {
      const k = p.script.keys;
      if (t <= k[0][0]) return [k[0][1], k[0][2]];
      for (let i = 1; i < k.length; i++) {
        if (t <= k[i][0]) { const a = k[i - 1], b = k[i], f = (t - a[0]) / (b[0] - a[0] || 1), e = (f + smooth(f)) / 2; return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e]; }
      }
      const l = k[k.length - 1]; return [l[1], l[2]];
    }
    const lockFace = (p, until, dir) => { p.faceLock = { until, dir }; };
    const faceTowards = (p, g) => Math.sign(g[0] - p.g[0]) || ATT[p.team];
    const inPitch = ([u, v]) => [clamp(u, 0.03, 0.97), clamp(v, 0.05, 0.95)];
    /** A point `m` metres along the team's attack direction and `side` metres across, from a court point. */
    const along = (team, uv, m, side = 0) => toW(team, add(toT(team, uv), [m / LEN, side / WID]));
    
    /* ---------------------------------- the director ---------------------------------- */
    /** Backswing, contact (a touch before the ball leaves, so the foot meets it) and follow-through for each kind of strike. */
    /**
     * Where a body part (head, front boot) is, in world terms, for a pose struck at a court point facing `face`:
     * the ball is sent to exactly that point, so a header meets the forehead and a volley the boot.
     */
    function contactPoint(poseName, part, uv, face) {
      const r = rig(POSES[poseName]), gD = ground(...uv), pt = r[part];
      const at_ = [gD[0] + pt[0] * S * face, gD[1] + pt[1] * S];
      return { g: [at_[0], gD[1] + 1], h: (gD[1] + 1 - at_[1]) / K };
    }
    /** Sets up a header or volley at `uv` at time `Tc`: holds him there, faces him at goal, poses him in time. */
    function meetBall(p, kind, uv, Tc, face) {
      if (kind === "header") p.keys.push([Tc - 0.3, Tc + 0.35, "header"]);
      else if (kind === "bicycle") p.keys.push([Tc - 0.3, Tc + 0.3, "bicycle"], [Tc + 0.3, Tc + 0.9, "bicycleLand"], [Tc + 0.9, Tc + 1.5, "sitUp"]);
      else kickPoses(p, Tc, "kick");
      at(Tc - 0.4, () => lockFace(p, Tc + 0.45, face));
      const part = kind === "header" ? "head" : "footF", pose = kind === "header" ? "header" : kind === "bicycle" ? "bicycle" : "kick";
      return contactPoint(pose, part, uv, face);
    }
    
    function kickPoses(p, Tk, style) {
      if (style === "throw") p.keys.push([Tk - 0.4, Tk, "throwLoad"], [Tk, Tk + 0.35, "throw"]);
      else if (style === "roll") p.keys.push([Tk - 0.4, Tk, "rollLoad"], [Tk, Tk + 0.35, "roll"]);
      else if (style === "tap") p.keys.push([Tk - 0.12, Tk + 0.2, "tap"]);
      else if (style === "pass") p.keys.push([Tk - 0.22, Tk - 0.05, "passBack"], [Tk - 0.05, Tk + 0.12, "passKick"], [Tk + 0.12, Tk + 0.3, "ready"]);
      else if (style === "power") p.keys.push([Tk - 0.4, Tk - 0.07, "powerBack"], [Tk - 0.07, Tk + 0.1, "powerKick"], [Tk + 0.1, Tk + 0.5, "powerFollow"]);
      else if (style === "curl") p.keys.push([Tk - 0.3, Tk - 0.06, "curlBack"], [Tk - 0.06, Tk + 0.1, "curlKick"], [Tk + 0.1, Tk + 0.4, "curlFollow"]);
      else if (style === "chip") p.keys.push([Tk - 0.3, Tk - 0.06, "kickBack"], [Tk - 0.06, Tk + 0.12, "chipKick"], [Tk + 0.12, Tk + 0.4, "ready"]);
      else p.keys.push([Tk - 0.28, Tk - 0.06, "kickBack"], [Tk - 0.06, Tk + 0.1, "kick"], [Tk + 0.1, Tk + 0.4, "follow"]);
    }
    
    function decide(c) {
      const [d] = toT(c.team, c.pos), opp = nearest(outfield(opponents(c.team)), c.pos), mom = game.momentum;
      c.dribStyle = null;
      if (game.kickoffPass) { game.kickoffPass = false; if (pass(c, { backOk: true })) return; }
      if (game.freeKick) { game.freeKick = false; return pass(c, { long: true }) || dribble(c); }
      if (game.restart === "kickIn") { game.restart = null; return pass(c, { backOk: d > 0.7 }) || dribble(c); }
      const sitting = sitsDeep(c.team);
      if (c.role === "GK") {
        if (ball.mode === "held" && pass(c, { style: "throw", toFwd: sitting })) return;
        return pass(c, { long: true, toFwd: sitting }) || dribble(c);
      }
      // A man through on goal or breaking away: the nearest defender behind him sometimes just pulls him back.
      const breaking = d > 0.45 && throughOnGoal(c) || (game.counter && game.counter.team === c.team && T < game.counter.until);
      if (breaking && T - (game.pullAt ?? -99) > 20 && rng() < 0.35) {
        const puller = nearest(outfield(opponents(c.team)), c.pos);
        if (puller.p && puller.d < 4) {
          game.pullAt = T; game.stats.pulls = (game.stats.pulls ?? 0) + 1;
          const Tt = T + 0.35;
          const cp = c.script ? scriptPos(c, Tt) : c.pos, cd2 = mdist(cp, puller.p.pos);
          mkScript(puller.p, [T, puller.p.pos], [Tt, lerp(cp, puller.p.pos, 0.6 / Math.max(0.6, cd2))]);
          puller.p.keys.push([Tt - 0.2, Tt + 0.4, "tap"]);
          at(Tt, () => { if (game.mode === "play" && ball.owner === c) { game.pullBack = true; foul(c, puller.p, Tt); game.pullBack = false; } });
          c.busyUntil = Tt + 0.1;
          return;
        }
      }
      // Through on goal, only the keeper to beat: shoot when close, otherwise run straight at goal. Never back.
      if (d > 0.45 && throughOnGoal(c)) {
        game.stats.through = (game.stats.through ?? 0) + 1;
        if (d > 0.72) return shoot(c);
        return dribble(c, { direct: true });
      }
      // A counter-attack goes forward and fast: forward passes only, or run at goal.
      const counter = game.counter && game.counter.team === c.team && T < game.counter.until;
      if (counter) {
        if (d > 0.68) return shoot(c);
        if (rng() < 0.65 && pass(c, { forwardOnly: true, toFwd: true, long: d < 0.45 })) return;
        return dribble(c, { direct: true });
      }
      // Close to goal: shoot, or now and then square it to a team-mate who is even closer and freer. Never out wide or back.
      if (d > 0.74) {
        if (rng() < 0.15 && pass(c, { closerOnly: true })) { game.stats.squares = (game.stats.squares ?? 0) + 1; return; }
        return shoot(c);
      }
      if (d > (c.team === mom ? 0.6 : 0.66) && rng() < (c.team === mom ? 0.55 : 0.42)) return shoot(c);
      // When this side's goal is overdue they take the game to the other side: shots from the edge of the box, and
      // passing moves into it (beyond the usual couple a match).
      const next = game.story.goals[game.storyIdx];
      const due = game.golden ? 5 : next && next[0] === c.team ? minute() - next[1] : -1;
      if (due >= 2 && d > 0.55 && rng() < (d > 0.62 ? 0.75 : 0.45)) return shoot(c, { label: d < 0.66 ? "Sút xa!" : undefined });
      // Both teams seek a sudden-death winner from anywhere in range.
      if (game.golden && minute() >= FULL + 3 && d > 0.45) return shoot(c, { style: "power", label: "Sút xa!" });
      if (due >= 3 && d > 0.3 && d < 0.6 && rng() < 0.5 && (chain(c) || combo(c))) return;
      if (due >= 2 && d <= 0.55 && rng() < 0.7 && pass(c, { forwardOnly: true, toFwd: true, long: d < 0.4 })) return;
      if (due >= 3 && d >= 0.6) return dribble(c, { direct: true });
      // Now and then a flowing move: three or four players passing one-touch into the box (a couple a match at most).
      if (d > 0.3 && d < 0.72 && game.chainsUsed[c.team] < 2 && rng() < (c.team === mom ? 0.12 : 0.04) && chain(c)) return;
      // One-twos and triangles.
      if (d > 0.28 && d < 0.7 && rng() < (c.team === mom ? 0.3 : mom ? 0.08 : 0.18) && combo(c)) return;
      // A trick only when a defender is right on him, and not often.
      const trick = c.star ? 0.2 : 0.06;
      if (opp.p && opp.d < 3.5 && rng() < trick) { game.stats.tricks++; return skill(c, opp.p); }
      if (opp.d < 4.5 && rng() < 0.7) return pass(c) || dribble(c);
      return rng() < 0.6 ? (pass(c) || dribble(c)) : dribble(c);
    }
    
    function pass(c, o = {}) {
      const cT = toT(c.team, c.pos), throwing = o.style === "throw";
      let best = null;
      for (const m of team[c.team]) {
        if (m === c || m.role === "GK" || !on(m)) continue;
        const pred = inPitch([m.pos[0] + m.vel[0] / LEN * 0.6, m.pos[1] + m.vel[1] / WID * 0.6]);
        const tT = toT(c.team, pred); tT[0] = Math.min(0.9, tT[0] + 0.03);
        const tgt = inPitch(toW(c.team, tT)), dist = mdist(c.pos, tgt);
        // A keeper throws 6–22 m; outfield passes stay within 30 m.
        if (dist < (throwing ? 6 : 5) || dist > (throwing ? 22 : 30)) continue;
        if (o.forwardOnly && tT[0] < cT[0] + 0.05) continue;
        const goalUV = toW(c.team, [1, 0.5]), nearer = mdist(c.pos, goalUV) - mdist(tgt, goalUV);
        if (o.closerOnly && (nearer < 2 || nearest(opponents(c.team), tgt).d < 3)) continue;
        const open = nearest(opponents(c.team), tgt).d;
        const s = (tT[0] - cT[0]) * (o.backOk ? -1 : 2) + rng() * 0.6 + Math.min(open, 8) * 0.05 - (open < 2.5 ? 0.5 : 0) + (m.star ? 0.3 : 0)
          + (o.toFwd && shapeSlot(m, SHAPES[game.shape[c.team]]).line === "FW" ? 1.2 : 0)
          - (!o.backOk && cT[0] > 0.6 && tT[0] < cT[0] - 0.03 ? 1.2 : 0)
          // In the final third, a pass that takes the ball further from goal (out to the flank) is a last resort.
          - (!o.backOk && cT[0] > 0.66 && nearer < -1.5 ? 1.5 : 0);
        if (!best || s > best.s) best = { m, tgt, dist, s, tT };
      }
      if (!best) return false;
      let { m, tgt, dist } = best;
      // Under sudden-death pressure either side can misplace a pass.
      let misplaced = false;
      if (!throwing && game.golden && rng() < 0.15) {
        const r = nearest(outfield(opponents(c.team)), tgt);
        if (r.p && r.d < 14) { m = r.p; tgt = [...r.p.pos]; dist = mdist(c.pos, tgt); misplaced = true; at(T + 0.6, () => say(c, "Chuyền hỏng!", "var(--color-card)", 0.9)); }
      }
      const cross = !misplaced && !throwing && cT[0] > 0.6 && (cT[1] < 0.24 || cT[1] > 0.76) && best.tT[0] > 0.7;
      const lofted = !throwing && (o.long && dist > 18 || dist > 24 || cross);
      // A cross is aimed into the six-yard area, in front of the goal mouth.
      if (cross) { tgt = toW(c.team, [0.865 + rng() * 0.05, 0.4 + rng() * 0.2]); dist = mdist(c.pos, tgt); }
      // Keepers roll short ones underarm and throw longer ones overarm; outfield passes are ground balls or lofted.
      const roll = throwing && dist < 12, Tk = T + (throwing ? 0.45 : 0.3);
      const arcOf = d => lofted ? Math.min(2 + d * 0.06, 3.6) : throwing ? (roll ? 0 : 1.2) : 0.08;
      const flightOf = d => lofted ? Math.max(d / 16, gravFlight(arcOf(d))) : throwing ? (roll ? d / 9 : Math.max(d / 14, gravFlight(arcOf(d)))) : d / PASS;
      let flight = flightOf(dist);
      const need = mdist(m.pos, tgt) / (Tk + flight - T);
      if (need > RUN) { tgt = lerp(m.pos, tgt, RUN / need); dist = mdist(c.pos, tgt); flight = flightOf(dist); }
      // Headers only happen close in, in front of the posts; a low cross gets a first-time volley; an overhead kick is rare.
      const [td, tw] = toT(c.team, tgt);
      const aerial = cross && td >= 0.85 && tw > 0.3 && tw < 0.7 && rng() < 0.8
        ? (m.star && rng() < 0.05 ? "bicycle" : rng() < 0.6 ? "header" : "volley") : null;
      // A defender may read a ground pass. The side whose goal is due gets the better of it, within reason.
      let thief = null;
      const f = 0.55, mom = game.momentum, next = game.story.goals[game.storyIdx], overdue = game.golden ? 8 : next ? Math.max(0, minute() - next[1]) : 0;
      const thiefP = mom ? (c.team === mom ? 0.04 : Math.min(0.55, 0.18 + overdue * 0.05)) : 0.14;
      if (!lofted && !throwing && rng() < thiefP + 0.12 * (1 - fit(c))) {
        const mid = lerp(c.pos, tgt, f), n = nearest(outfield(opponents(c.team)), mid);
        if (n.p && n.d / RUN < Tk + flight * f - T) thief = { p: n.p, mid };
      }
      holdStill(c, T, Tk + 0.05); kickPoses(c, Tk, throwing ? (roll ? "roll" : "throw") : lofted ? "kick" : "pass");
      lockFace(c, Tk + 0.25, Math.sign(ground(...tgt)[0] - c.g[0]) || ATT[c.team]);
      c.busyUntil = Infinity;
      if (thief) mkScript(thief.p, [T, thief.p.pos], [Tk + flight * f, thief.mid]);
      mkScript(m, [T, m.pos], [Tk + flight, tgt], [Tk + flight + 0.4, tgt]);
      const goalFace = Math.sign(ground(...toW(c.team, [1, 0.5]))[0] - ground(...tgt)[0]) || ATT[c.team];
      const contact = aerial ? meetBall(m, aerial, tgt, Tk + flight, goalFace) : null;
      at(Tk, () => {
        if (ball.owner !== c) return;
        // A defender right on him catches him as he plays it: free kick.
        const late = nearest(outfield(opponents(c.team)), c.pos);
        if (!thief && !throwing && game.mode === "play" && !game.stoppage && late.p && late.d < 3 && rng() < 0.2) {
          game.stats.lateFouls = (game.stats.lateFouls ?? 0) + 1;
          mkScript(late.p, [T, late.p.pos], [T + 0.15, lerp(c.pos, late.p.pos, 0.7 / Math.max(0.7, late.d))]);
          late.p.keys.push([T - 0.05, T + 0.4, "tap"]);
          return foul(c, late.p, T + 0.15);
        }
        game.carrier = null;
        const dirX = Math.sign(ground(...tgt)[0] - ball.g[0]) || 1;
        if (thief) {
          const outAfter = rng() < 0.4;
          fly({ g: add(ground(...thief.mid), [-dirX * 6, 1]), h: 0 }, flight * f, 0.08, { onEnd: () => {
            if (outAfter) { say(thief.p, "Phá ra biên!", "var(--color-sky-soft)"); const out = touchOut(thief.mid); return fly({ g: ground(...out), h: 0 }, 0.6, 0.3, { roll: true, onEnd: () => ballOut(c.team, out) }); }
            say(thief.p, "Cắt bóng!", "var(--color-sky-soft)"); receive(thief.p); praise(thief.p);
          } });
          return;
        }
        const b = contact ?? { g: add(ground(...tgt), [-dirX * 6, 1]), h: 0 };
        if (lofted && !cross && !aerial && rng() < 0.15) {
          const out = touchOut(tgt); mkScript(m, [T, m.pos], [T + flight, lerp(m.pos, out, 0.6)]);
          fly({ g: ground(...out), h: 0 }, flight + 0.2, arcOf(dist), { onEnd: () => ballOut(otherTeam(c.team), out) });
          say(c, "Quá tay!", "var(--color-sky-soft)", 0.9);
          return;
        }
        fly(b, flight, arcOf(dist), { roll, onEnd: () => receive(m, aerial) });
        if (cross) say(c, "Tạt bóng!");
        else if (lofted && rng() < 0.5) say(c, o.toFwd ? "Vượt tuyến!" : "Chuyền dài!");
      });
      return true;
    }
    
    function receive(p, aerial, options = {}) {
      if (game.mode !== "play") return;
      const won = game.poss !== p.team;
      game.poss = p.team; game.dirty = true;
      if (won) startCounter(p);
      if (aerial === "header") return shoot(p, { style: "header" });
      if (aerial === "volley") return shoot(p, { style: "volley", windup: 0.01, noPose: true });
      if (aerial === "bicycle") { holdStill(p, T, T + 1.6); return shoot(p, { style: "bicycle" }); }
      // Near the touchline a heavy first touch sometimes runs out of play.
      if (!options.accurate && Math.abs(p.pos[1] - 0.5) > 0.38 && rng() < 0.06) {
        const out = touchOut(p.pos);
        game.carrier = null;
        fly({ g: ground(...out), h: 0 }, 0.6, 0.05, { roll: true, onEnd: () => ballOut(otherTeam(p.team), out) });
        return;
      }
      carry(p); game.carrier = p; p.busyUntil = T + 0.2 + rng() * 0.25;
      // A late challenge now and then, from a defender who can actually get there.
      if (rng() < (p.team === game.momentum ? 0.16 : 0.26)) {
        const opp = nearest(outfield(opponents(p.team)), p.pos);
        if (opp.p && opp.d < 4.5) { const Tt = T + Math.max(0.5, opp.d / RUN); p.busyUntil = Tt + 0.1; tackle(p, opp.p, Tt); }
      }
    }
    
    function dribble(c, o = {}) {
      const cT = toT(c.team, c.pos), opp = nearest(outfield(opponents(c.team)), c.pos), mom = game.momentum;
      let dd = 0.07 + rng() * 0.07, dw = (rng() - 0.5) * 0.14, speed = 4.3;
      if (o.direct) { dd = 0.12 + rng() * 0.04; dw = (0.5 - cT[1]) * 0.35; speed = 5.3; }
      else if (opp.p && opp.d < 7) dw += Math.sign(cT[1] - toT(c.team, opp.p.pos)[1] || 1) * 0.1;
      speed *= 0.75 + 0.25 * fit(c);
      if (cT[0] > 0.8) { dd = 0.02; dw = (0.5 - cT[1]) * 0.5; }
      const tgt = inPitch(toW(c.team, [Math.min(0.88, cT[0] + dd), clamp(cT[1] + dw, 0.07, 0.93)]));
      const dur = Math.max(0.5, mdist(c.pos, tgt) / speed);
      mkScript(c, [T, c.pos], [T + dur, tgt]);
      c.busyUntil = T + dur;
      // A challenge comes from a nearby defender who can reach him (about 6 m/s), and is usually clean.
      const tackleP = o.direct ? 0.25 : mom ? (c.team === mom ? 0.3 : 0.55) : 0.55;
      if (opp.p && opp.d < 7 && rng() < tackleP * (1 + 0.6 * (1 - fit(c)))) {
        const Tt = T + Math.max(dur * 0.6, (opp.d - 0.6) / 6);
        if (Tt < T + dur) tackle(c, opp.p, Tt);
      }
      return true;
    }
    
    /** Beyond the last defender: no outfield opponent ahead of him in his corridor towards goal. */
    function throughOnGoal(c) {
      const t = c.team, [cd, cw] = toT(t, c.pos);
      return !outfield(opponents(t)).some(p => { const [pd, pw] = toT(t, p.pos); return pd > cd - 0.01 && Math.abs(pw - cw) * WID < 10; });
    }
    /** A side sitting deep (3-1-1) that wins the ball breaks at speed for a few seconds. */
    function startCounter(p) {
      if (!sitsDeep(p.team) || toT(p.team, p.pos)[0] > 0.62) return;
      game.counter = { team: p.team, until: T + 6 }; game.stats.counters++; game.skillUntil = T + 3;
      say(p, "Phản công!", "var(--color-pear)", 1.0);
    }
    
    /**
     * A loose ball (parry, rebound off the post or the wall, a headed clearance) travels to `spot` at ball speed;
     * whoever is nearest runs to it at a realistic pace and collects it when he gets there, however long that takes.
     */
    function looseBall(spot, { speed = 9, maxArc = 1.0, exclude } = {}) {
      const who = nearest(players.filter(p => p.role !== "GK" && on(p) && p !== exclude), spot).p;
      const ballDur = Math.max(0.5, mdist(ballUV(), spot) / speed), arc = Math.min(maxArc, 1.2 * ballDur * ballDur);
      if (!who) { fly({ g: ground(...spot), h: 0 }, ballDur, arc); return; }
      const runDur = Math.max(0.6, mdist(who.pos, spot) / RUN), t0 = T;
      mkScript(who, [T, who.pos], [T + runDur, spot]);
      fly({ g: add(ground(...spot), [ATT[who.team] * 6, 1]), h: 0 }, ballDur, arc, { onEnd: () => {
        if (runDur <= ballDur + 0.05) return receive(who);
        at(t0 + runDur, () => { if (game.mode === "play" && ball.mode === "dead" && !ball.owner) receive(who); });
      } });
    }
    
    /* ---------------------------------- restarts: kick-ins and corners ---------------------------------- */
    /** Nearest touchline point just off the pitch, for a ball heading out from `uv`. */
    const touchOut = uv => [clamp(uv[0], 0.05, 0.95), uv[1] < 0.5 ? -0.04 : 1.04];
    /**
     * The ball has gone out over a touchline at `outUV`: a kick-in for side `t` (in this game, as in most
     * small-sided football, the ball is kicked back in rather than thrown). The nearest player walks to the line,
     * places it and plays it in to a team-mate.
     */
    function ballOut(t, outUV) {
      game.stoppage = true; game.carrier = null; game.counter = null; game.chain = null; game.stats.kickIns++;
      const spot = [clamp(outUV[0], 0.04, 0.96), outUV[1] < 0.5 ? 0 : 1], stand = [spot[0], spot[1] ? 1.03 : -0.03];
      setNote(`Đá biên · ${TEAM_NAME[t]}`);
      say("ball", "Ra biên!", "var(--color-sky-soft)", 1.0);
      ref.keys.push([T + 0.2, T + 1.1, "point"]);
      at(T + 0.5, () => { ball.show = false; });
      at(T + 0.8, () => {
        if (game.mode !== "play") return;
        ball.mode = "dead"; ball.seg = null; ball.g = ground(...spot); ball.h = 0;
        const taker = nearest(outfield(team[t]), spot).p;
        if (!taker) return;
        const dur = Math.max(0.6, mdist(taker.pos, stand) / 4.5);
        at(T + dur - 0.3, () => { ball.show = true; });
        mkScript(taker, [T, taker.pos], [T + dur, stand], [T + dur + 0.5, stand]);
        taker.busyUntil = Infinity;
        at(T + dur, () => lockFace(taker, T + 1.2, Math.sign(ground(0.5, 0.5)[0] - taker.g[0]) || ATT[t]));
        at(T + dur + 0.5, () => {
          if (game.mode !== "play") return;
          carry(taker); game.carrier = taker; game.poss = t; game.stoppage = false; clearRestartNote(); game.restart = "kickIn"; taker.busyUntil = T; game.dirty = true;
        });
      });
    }
    
    /**
     * A corner for side `att` from the corner on world side `sideV` (0 far, 1 near). The taker goes to the
     * flag, two or three team-mates take up spots in the box with a marker each, a defender guards the near post,
     * the keeper stays on his line; then the cross comes in: a header, a defender heading it clear, or the keeper
     * claiming it.
     */
    function corner(att, sideV) {
      const def = otherTeam(att), gk = GK[def], endU = toW(att, [1, 0.5])[0] > 0.5 ? 1 : 0;   // the end he attacks (ends change at half time)
      game.stoppage = true; game.carrier = null; game.counter = null; game.chain = null; game.stats.corners++;
      setNote(`Phạt góc · ${TEAM_NAME[att]}`);
      const spot = [endU ? 0.995 : 0.005, sideV ? 0.995 : 0.005], stand = [endU ? 1.02 : -0.02, sideV ? 1.025 : -0.025];
      const goal = toW(att, [1, 0.5]);
      game.fk = { spot, goal, until: T + 6, direct: true, att };
      at(T + 0.4, () => { ball.show = false; });
      at(T + 0.9, () => { if (game.mode === "play") { ball.mode = "dead"; ball.seg = null; ball.g = ground(...spot); ball.h = 0; ball.show = true; } });
      const field = outfield(team[att]);
      const taker = (on(STAR[10]) && att === "R" ? STAR[10] : null) ?? [...field].sort((a, b) => mdist(a.pos, spot) - mdist(b.pos, spot))[0];
      if (!taker) return;
      // The corner is taken once the taker has walked over to the flag.
      const takerArr = T + 0.3 + Math.max(1.2, mdist(taker.pos, stand) / 4.5), Tc = Math.max(T + 4.2, takerArr + 1.2);
      game.fk.until = Tc + 1.6;
      mkScript(taker, [T + 0.3, taker.pos], [takerArr, stand], [Tc + 0.2, stand]);
      taker.busyUntil = Infinity;
      // Attackers into the box, markers goal-side of them, one defender on the near post.
      const nearW = sideV ? 0.58 : 0.42;
      // Half the time a cross; otherwise a worked routine: short to a man who comes over, a short one-two, or
      // along the ground to a man waiting at the edge of the box.
      const runners = field.filter(p => p !== taker).sort((a, b) => toT(att, b.pos)[0] - toT(att, a.pos)[0]).slice(0, 3);
      const cw = toT(att, spot)[1] < 0.5 ? 0 : 1, rr = rng();
      const routine = runners.length < 3 ? "cross" : rr < 0.5 ? "cross" : rr < 0.7 ? "short" : rr < 0.85 ? "oneTwo" : "edge";
      const third = routine === "short" || routine === "oneTwo" ? [0.925, cw ? 0.85 : 0.15] : routine === "edge" ? [0.73, cw ? 0.6 : 0.4] : [0.8, 0.5];
      const spots = [[0.88, 0.44], [0.86, 0.57], third].map(([d, w]) => toW(att, [d + (rng() - 0.5) * 0.02, w + (rng() - 0.5) * 0.04]));
      runners.forEach((p, i) => { mkScript(p, [T + 0.3, p.pos], [T + 0.3 + Math.max(1.3, mdist(p.pos, spots[i]) / 5.5), spots[i]], [Tc + 0.4, spots[i]]); p.busyUntil = Infinity; });
      const markers = [...outfield(team[def])];
      runners.forEach((r, i) => {
        const m = markers.sort((a, b) => mdist(a.pos, spots[i]) - mdist(b.pos, spots[i])).shift();
        if (!m) return;
        const at_ = lerp(spots[i], goal, 1.0 / Math.max(1, mdist(spots[i], goal)));
        mkScript(m, [T + 0.3, m.pos], [T + 0.3 + Math.max(1.3, mdist(m.pos, at_) / 5.5), at_], [Tc + 0.4, at_]);
        m.keys.push([T + 2.2, Tc + 0.2, "jockey"]);
      });
      const post = markers.shift();
      if (post) { const ps = toW(att, [0.97, nearW]); mkScript(post, [T + 0.3, post.pos], [T + 0.3 + Math.max(1.9, mdist(post.pos, ps) / 4.5), ps], [Tc + 0.4, ps]); }
      const gkSpot = toW(att, [0.985, 0.5 + (nearW < 0.5 ? 0.02 : -0.02)]);
      mkScript(gk, [T, gk.pos], [T + 1.6, gkSpot], [Tc + 0.3, gkSpot]);
      gk.keys.push([T + 1.6, Tc + 0.3, "keeper"]);
      game.refPlan = [{ until: Tc + 0.6, uv: toW(att, [0.68, sideV ? 0.25 : 0.75]) }];
    
      if (routine === "cross") kickPoses(taker, Tc, "kick");
      at(Tc - 0.5, () => lockFace(taker, Tc + 0.4, Math.sign(ground(...goal)[0] - taker.g[0]) || ATT[att]));
      at(Tc, () => {
        if (game.mode !== "play") return;
        game.stoppage = false; game.refPlan = null; clearRestartNote();
        if (routine !== "cross" && runners.every(on)) return cornerRoutine(routine, att, taker, runners, cw);
        const roll = rng(), target = runners.length ? pick(runners) : null, dist = target ? mdist(ballUV(), target.pos) : 15;
        const flight = Math.max(0.35 + dist / 15, gravFlight(2.0));
        if (!target || roll < 0.2) {
          // The keeper comes out and claims it.
          const claim = toW(att, [0.95, 0.5]);
          mkScript(gk, [T, gk.pos], [T + flight, claim], [T + flight + 1.2, claim]);
          gk.keys.push([T + flight - 0.3, T + flight + 0.3, "gkHigh"]);
          const r = rig(POSES.gkHigh), hands = lerp(r.handF, r.handB, 0.5), gD = ground(...claim), face = Math.sign(ground(...spot)[0] - gD[0]) || 1;
          const hs = [gD[0] + (hands[0] + 4) * S * face, gD[1] + (hands[1] - 2) * S];
          lockFace(gk, T + flight + 1.2, face);
          fly({ g: [hs[0], gD[1] + 1], h: (gD[1] + 1 - hs[1]) / K }, flight, 2.2, { onEnd: () => {
            holdBall(gk); game.poss = def; game.dirty = true; say(gk, "Bắt bóng bổng!", "var(--color-sky-soft)", 1.2);
            gk.keys.push([T + 0.3, T + 1.2, "catch"]);
            at(T + 1.3, () => { if (game.mode === "play" && ball.owner === gk) { game.carrier = gk; gk.busyUntil = T; startCounter(gk); } });
          } });
          return;
        }
        const marker = nearest(outfield(team[def]), target.pos).p;
        if (roll < 0.55 && marker) {
          // A defender gets his head to it first and clears (facing out, towards the corner); sometimes it flies out for a kick-in.
          const mSpot = [...marker.pos];
          mkScript(marker, [T, mSpot], [T + flight + 0.4, mSpot]);
          const hit = meetBall(marker, "header", mSpot, T + flight, Math.sign(ball.g[0] - ground(...mSpot)[0]) || -ATT[att]);
          fly(hit, flight, 2.0, { onEnd: () => {
            say(marker, "Phá bóng!", "var(--color-sky-soft)", 1.0);
            if (rng() < 0.3) {
              const out = touchOut(toW(att, [0.62 + rng() * 0.15, rng()]));
              fly({ g: ground(...out), h: 0 }, 0.9, 2.2, { onEnd: () => ballOut(att, out) });
              return;
            }
            looseBall(inPitch(toW(att, [0.45 + rng() * 0.15, 0.2 + rng() * 0.6])), { speed: 12, maxArc: 2.4 });
          } });
          return;
        }
        // Met by an attacker's head.
        const tSpot = [...target.pos];
        mkScript(target, [T, tSpot], [T + flight + 0.4, tSpot]);
        const hit = meetBall(target, "header", tSpot, T + flight, Math.sign(ground(...goal)[0] - ground(...tSpot)[0]) || ATT[att]);
        fly(hit, flight, 2.0, { onEnd: () => { target.cornerAt = T; receive(target, "header"); } });
      });
    }
    
    /**
     * Worked corners, all along the ground:
     *  - short: to the man who came over, he carries it to the corner of the box and cuts it back for a team-mate
     *    arriving at the edge of the area, who hits it first time;
     *  - oneTwo: short and straight back to the taker, who has stepped inside along the byline, and he drives it
     *    low across the six-yard box for the near-post runner;
     *  - edge: straight to the man waiting at the edge of the area, first time.
     * The nearest defender comes out to close the ball down each time.
     */
    function cornerRoutine(kind, att, taker, runners, cw) {
      game.stats.cornerRoutines = (game.stats.cornerRoutines ?? 0) + 1;
      const [r0, r1, mate] = runners, side = w => cw ? 1 - w : w, def = otherTeam(att);
      const closeDown = (who, until) => {
        const d = nearest(outfield(team[def]), who.pos).p;
        if (d) mkScript(d, [T + 0.2, d.pos], [until, lerp(d.pos, who.pos, Math.max(0, 1 - 1.5 / Math.max(1.5, mdist(d.pos, who.pos))))]);
      };
      if (kind === "edge") {
        const t1 = playBall(taker, mate, toW(att, [0.76, side(0.38)]), { windup: 0.02, speed: 13, label: "Bài phối hợp!", then: () => finishMove(mate) });
        closeDown(mate, t1 + 0.1);
        return;
      }
      const short = toW(att, [0.92, side(0.17)]);
      const t1 = playBall(taker, mate, short, { windup: 0.02, speed: 11, label: "Đá ngắn!", then: () => {
        if (kind === "short") {
          // Carries it to the corner of the box, then cuts it back to the edge for the late runner.
          const to = toW(att, [0.87, side(0.3)]), dur = Math.max(0.8, mdist(mate.pos, to) / 4.3);
          game.carrier = null; mate.busyUntil = Infinity;
          mkScript(mate, [T, mate.pos], [T + dur, to]);
          closeDown(mate, T + dur);
          at(T + dur, () => {
            if (game.mode !== "play" || ball.owner !== mate) return;
            playBall(mate, r1, toW(att, [0.79, side(0.48)]), { windup: 0.15, speed: 13, label: "Trả ngược!", then: () => finishMove(r1) });
          });
          return;
        }
        // One-two: straight back to the taker, who has stepped inside along the byline (timed to his arrival)...
        const back = toW(att, [0.95, side(0.25)]), fl = Math.max(0.3, mdist(mate.pos, back) / ONE_TOUCH);
        playBall(mate, taker, back, { windup: Math.max(0.12, (taker.backAt ?? 0) - T - fl), run: false, label: "Đập nhả!", then: () => {
          // ...and he drives it low across the six-yard box for the near-post runner.
          playBall(taker, r0, toW(att, [0.9, side(0.44)]), { windup: 0.15, speed: 15, then: () => finishMove(r0) });
        } });
      } });
      closeDown(mate, t1 + 0.2);
      if (kind === "oneTwo") {
        // The taker sets off inside along the byline as soon as he has played it short.
        const back = toW(att, [0.95, side(0.25)]);
        taker.backAt = T + 0.25 + Math.max(0.6, mdist(taker.pos, back) / 5);
        mkScript(taker, [T + 0.25, taker.pos], [taker.backAt, back]);
      }
    }
    
    /* ---------------------------------- combination play ---------------------------------- */
    /** A one-touch ground pass from c to a point, timed so `m` gets there with it; `then` runs on arrival. */
    function playBall(c, m, tgt, { windup = 0.25, speed = ONE_TOUCH, then, label, run = true } = {}) {
      const Tk = T + windup, flight = Math.max(0.3, mdist(courtUV(ball.g), tgt) / speed);
      holdStill(c, T, Tk + 0.05); kickPoses(c, Tk, "pass");
      lockFace(c, Tk + 0.25, Math.sign(ground(...tgt)[0] - c.g[0]) || ATT[c.team]);
      c.busyUntil = Infinity;
      if (run) mkScript(m, [T, m.pos], [Tk + flight, tgt]);
      at(Tk, () => {
        if (game.mode !== "play" || game.stoppage) return;
        game.carrier = null;
        const dirX = Math.sign(ground(...tgt)[0] - ball.g[0]) || 1;
        fly({ g: add(ground(...tgt), [-dirX * 6, 1]), h: 0 }, flight, 0.08, { onEnd: () => {
          if (game.mode !== "play" || game.stoppage) return;
          game.poss = m.team; game.dirty = true;
          if (then) { carry(m); then(); } else receive(m);
        } });
        if (label) say(c, label, "var(--color-pear)", 1.0);
      });
      return Tk + flight;
    }
    /** The man who made the run gets it back in stride: a first-time finish near goal, otherwise he carries on. */
    function finishMove(c) {
      if (toT(c.team, c.pos)[0] > 0.7) { game.carrier = c; game.finishing = c; shoot(c, { windup: 0.18, label: "Dứt điểm!" }); game.finishing = null; return; }
      game.carrier = c; c.busyUntil = T + 0.15;
    }
    /** Run length that a player can cover (at RUN m/s) between `from` and `until`. */
    const reachable = (want, from, until) => Math.min(want, Math.max(3, RUN * (until - from)));
    function combo(c) {
      const cT = toT(c.team, c.pos), mates = outfield(team[c.team]).filter(m => m !== c && !m.script);
      const near = mates.filter(m => { const dd = mdist(m.pos, c.pos); return dd > 5 && dd < 15 && toT(c.team, m.pos)[0] > cT[0] - 0.06; });
      if (!near.length) return false;
      const A = near.sort((x, y) => toT(c.team, y.pos)[0] - toT(c.team, x.pos)[0])[0];
      const toCentre = cT[1] < 0.5 ? 1 : -1;
      // The wall player checks a step towards the ball to receive.
      const aSpot = inPitch(lerp(A.pos, c.pos, 1 / Math.max(1, mdist(A.pos, c.pos))));
      const third = mates.filter(m => m !== A && toT(c.team, m.pos)[0] > cT[0] - 0.02 && mdist(m.pos, A.pos) < 18);
      game.skillUntil = T + 2.5;
      if (third.length && rng() < 0.45) {
        // Triangle: c → A, A → B running into space, B → c who has gone on a run beyond them (or B finishes).
        const Bm = third.sort((x, y) => toT(c.team, y.pos)[0] - toT(c.team, x.pos)[0])[0];
        const t1 = T + 0.25 + mdist(c.pos, aSpot) / ONE_TOUCH;
        let bRun = inPitch(along(c.team, Bm.pos, 7, -toCentre * 1.5));
        const t2 = t1 + 0.12 + mdist(aSpot, bRun) / ONE_TOUCH;
        bRun = inPitch(along(c.team, Bm.pos, reachable(7, T + 0.3, t2), -toCentre * 1.5));
        let cRun = inPitch(along(c.team, c.pos, 12, toCentre * 3));
        const t3 = t2 + 0.12 + mdist(bRun, cRun) / ONE_TOUCH;
        cRun = inPitch(along(c.team, c.pos, reachable(12, T + 0.45, t3), toCentre * 3));
        mkScript(Bm, [T + 0.3, Bm.pos], [t2, bRun]);
        game.stats.triangles++;
        playBall(c, A, aSpot, { then: () => {
          if (toT(A.team, A.pos)[0] > 0.74) return finishMove(A);
          playBall(A, Bm, bRun, { windup: 0.12, run: false, label: "Một chạm!", then: () => {
            if (toT(c.team, Bm.pos)[0] > 0.74) return finishMove(Bm);
            playBall(Bm, c, cRun, { windup: 0.12, run: false, label: "Phối hợp tam giác!", then: () => finishMove(c) });
          } });
        } });
        at(T + 0.3, () => mkScript(c, [T, c.pos], [t3, cRun]));
        return true;
      }
      // One-two: c → A, then he spins off and runs; A lays it straight back into his path.
      const t1 = T + 0.25 + mdist(c.pos, aSpot) / ONE_TOUCH;
      let cRun = inPitch(along(c.team, c.pos, 11, toCentre * 2.5));
      const t2 = t1 + 0.12 + mdist(aSpot, cRun) / ONE_TOUCH;
      cRun = inPitch(along(c.team, c.pos, reachable(11, T + 0.45, t2), toCentre * 2.5));
      game.stats.oneTwos++;
      playBall(c, A, aSpot, { then: () => toT(A.team, A.pos)[0] > 0.74 ? finishMove(A)
        : playBall(A, c, cRun, { windup: 0.12, run: false, label: "Đập nhả!", then: () => finishMove(c) }) });
      at(T + 0.3, () => mkScript(c, [T, c.pos], [t2, cRun]));
      return true;
    }
    
    /**
     * A flowing move: three or four players set off on runs into the box in their own lanes, and the ball is
     * played one-touch from one to the next until someone is through on goal. Defenders chase but arrive late.
     */
    function chain(c) {
      const t = c.team, cT = toT(t, c.pos);
      const mates = outfield(team[t]).filter(m => m !== c && !m.script && toT(t, m.pos)[0] > cT[0] - 0.1)
        .sort((a, b) => mdist(a.pos, c.pos) - mdist(b.pos, c.pos)).slice(0, 3);
      if (mates.length < 2) return false;
      const crew = [c, ...mates], lanes = cT[1] > 0.5 ? [0.66, 0.5, 0.36] : [0.34, 0.5, 0.64];
      mates.forEach((m, i) => {
        const end = toW(t, [0.82 + rng() * 0.05, lanes[i] + (rng() - 0.5) * 0.06]);
        mkScript(m, [T + 0.1, m.pos], [T + 0.1 + Math.max(1.5, mdist(m.pos, end) / 5.2), end]);
        m.busyUntil = Infinity;
      });
      game.chain = { team: t, crew, passes: 0, last: null, max: Math.min(4, crew.length) };
      game.stats.chains++; game.chainsUsed[t]++; game.skillUntil = T + 5;
      chainPass(c, 0.25);
      return true;
    }
    function chainPass(c, windup) {
      const ch = game.chain, t = c.team, Tk = T + windup, from = courtUV(ball.g);
      // Once the ball is this close to goal, the move ends with a shot.
      if (toT(t, c.pos)[0] > 0.74) { game.chain = null; return finishMove(c); }
      const goalUV = toW(t, [1, 0.5]);
      let best = null;
      for (const m of ch.crew) {
        if (m === c || !on(m)) continue;
        let spot = m.script ? scriptPos(m, Tk + 0.5) : m.pos;
        let dist = mdist(from, spot), flight = Math.max(0.3, dist / ONE_TOUCH);
        spot = m.script ? scriptPos(m, Tk + flight) : m.pos; dist = mdist(from, spot);
        if (dist < 4 || dist > 17) continue;
        if (toT(t, from)[0] > 0.66 && mdist(spot, goalUV) > mdist(from, goalUV) + 1) continue;
        const score = toT(t, spot)[0] + rng() * 0.05 - (m === ch.last ? 0.25 : 0);
        if (!best || score > best.score) best = { m, spot, flight, score };
      }
      if (!best) { game.chain = null; return finishMove(c); }
      ch.last = c; ch.passes++;
      // Not every move comes off: now and then a defender reads it and cuts the pass out.
      const reader = nearest(outfield(opponents(t)), lerp(from, best.spot, 0.5));
      if (ch.passes >= 2 && reader.p && reader.d < 4 && rng() < 0.15) {
        game.chain = null;
        const mid = lerp(from, best.spot, 0.5);
        holdStill(c, T, Tk + 0.05); kickPoses(c, Tk, "pass"); c.busyUntil = Infinity;
        mkScript(reader.p, [T, reader.p.pos], [Tk + best.flight * 0.5, mid]);
        at(Tk, () => { if (game.mode !== "play") return; game.carrier = null; fly({ g: ground(...mid), h: 0 }, best.flight * 0.5, 0.05, { onEnd: () => { say(reader.p, "Cắt bóng!", "var(--color-sky-soft)"); receive(reader.p); praise(reader.p); } }); });
        return;
      }
      const labels = ["Một chạm!", "Đan bật!", "Đẹp!"];
      playBall(c, best.m, best.spot, { windup, run: false, label: ch.passes >= 2 ? labels[Math.min(2, ch.passes - 2)] : null, then: () => {
        const m = best.m;
        if (ch.passes >= ch.max || toT(t, m.pos)[0] > 0.84) { game.chain = null; return finishMove(m); }
        chainPass(m, 0.12);
      } });
      // The passer goes on into the box himself.
      at(Tk + 0.1, () => {
        if (!on(c) || game.mode !== "play") return;
        const end = toW(t, [0.79 + rng() * 0.06, 0.36 + rng() * 0.28]);
        mkScript(c, [T, c.pos], [T + Math.max(1.2, mdist(c.pos, end) / 5.2), end]);
      });
      // Sometimes a defender sticks a leg out and misses.
      if (rng() < 0.2) {
        const dfd = nearest(outfield(opponents(t)).filter(x => !x.script), best.spot).p;
        if (dfd && mdist(dfd.pos, best.spot) < 7) beaten(dfd, Tk + best.flight, inPitch(lerp(dfd.pos, best.spot, 0.7)), 0.15);
      }
    }
    
    /* ---------------------------------- tricks ---------------------------------- */
    function skill(c, d) {
      // Moves an amateur actually tries; and a good share of the time the defender simply wins it.
      if (rng() < 0.35) {
        const reach = Math.max(0.4, mdist(d.pos, c.pos) / 5), Tt = T + reach;
        holdStill(c, T, Tt + 0.4); c.keys.push([T, T + 0.3, "tap"], [Tt + 0.05, Tt + 0.5, "shrug"]); c.busyUntil = Infinity;
        mkScript(d, [T, d.pos], [Tt, lerp(c.pos, d.pos, 0.7 / Math.max(0.7, mdist(c.pos, d.pos)))]);
        d.keys.push([Tt - 0.15, Tt + 0.25, "tap"]);
        at(Tt, () => {
          if (game.mode !== "play" || ball.owner !== c) return;
          game.carrier = null;
          fly({ g: footPoint(d), h: 0 }, 0.25, 0.05, { onEnd: () => { receive(d); praise(d); } });
        });
        return true;
      }
      const moves = c.star === 10 ? ["slalom", "nutmeg", "dragBack"]
        : c.star === 7 ? ["stepover", "cut", "slalom"]
        : ["stepover", "nutmeg", "cut", "dragBack"];
      // Never the same trick twice in a row by the same player.
      const fresh = moves.filter(m => m !== c.lastSkill), move = pick(fresh.length ? fresh : moves);
      c.lastSkill = move;
      game.skillUntil = T + 1.4;
      return SKILLS[move](c, d);
    }
    /** Make a defender lunge at `uv` at time `t` and come off worse: a stumble, sometimes a fall. */
    function beaten(d, t, uv, fallP = 0.3) {
      // He cannot get there faster than about 6 m/s; a slide is rare, and only a slide ends on the floor.
      t = Math.max(t, T + mdist(d.pos, uv) / 6);
      mkScript(d, [T, d.pos], [t, uv], [t + 0.9, uv]);
      const slide = rng() < 0.1;
      d.keys.push([t - 0.22, t + 0.35, slide ? "slide" : "lunge"]);
      if (slide && rng() < fallP) d.keys.push([t + 0.35, t + 1.0, "fall"], [t + 1.0, t + 1.5, "sitUp"]);
      else d.keys.push([t + 0.35, t + 0.75, "shift"], [t + 0.75, t + 1.1, "shrug"]);
      d.busyUntil = t + 1.2;
      return t;
    }
    const SKILLS = {
      /** Running past one or two defenders with close control (at a dribbler's pace, not a sprinter's). */
      slalom(c) {
        const cT0 = toT(c.team, c.pos), n = 3, keys = [[T, c.pos]];
        let t = T, cur = cT0, side = rng() < 0.5 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const next = [Math.min(0.86, cur[0] + 0.05), clamp(cur[1] + side * 0.06, 0.1, 0.9)];
          side *= -1; t += mdist(toW(c.team, cur), toW(c.team, next)) / 4.8;
          keys.push([t, toW(c.team, next)]); cur = next;
        }
        mkScript(c, ...keys); c.busyUntil = t; c.dribStyle = "dribbleLow";
        say(c, "Đi bóng qua người!", "var(--color-pear)", 1.1);
        const ahead = outfield(opponents(c.team)).filter(p => toT(c.team, p.pos)[0] > cT0[0] - 0.03)
          .sort((a, b) => mdist(a.pos, c.pos) - mdist(b.pos, c.pos)).slice(0, 2);
        const lunges = ahead.map(d => {
          let k = 1, bd = Infinity;
          for (let i = 1; i < keys.length; i++) { const dd = mdist(keys[i][1], d.pos); if (dd < bd) { bd = dd; k = i; } }
          const tk = keys[k][0], miss = toW(c.team, add(toT(c.team, keys[k][1]), [0.012, (toT(c.team, keys[k][1])[1] > 0.5 ? -1 : 1) * 0.05]));
          return { d, tk, miss };
        }).filter(l => mdist(l.d.pos, l.miss) / (l.tk - T) <= 6).sort((a, b) => a.tk - b.tk);
        lunges.forEach(({ d, tk, miss }, j) => {
          const at_ = beaten(d, tk, miss);
          if (lunges.length > 1) at(at_ + 0.05, () => { if (ball.owner === c) say(c, `Qua ${j + 1} người!`, "var(--color-pear)", 0.8); });
        });
        c.busyUntil = Math.max(t, ...lunges.map(l => l.tk + 0.15));
        return true;
      },
      /** Step-overs: two quick, low circles over the ball while still moving in, then a push the other way. */
      stepover(c, d) {
        const side = rng() < 0.5 ? -1 : 1;
        const p1 = inPitch(along(c.team, c.pos, 1.0, -side * 0.3)), p2 = inPitch(along(c.team, c.pos, 1.9, -side * 0.5));
        const cut = inPitch(along(c.team, c.pos, 2.5, side * 0.5)), away = inPitch(along(c.team, c.pos, 5.0, side * 2.0));
        mkScript(c, [T, c.pos], [T + 0.36, p1], [T + 0.7, p2], [T + 0.9, cut], [T + 1.6, away]);
        c.keys.push([T + 0.04, T + 0.32, "stepA"], [T + 0.38, T + 0.66, "stepB"], [T + 0.7, T + 0.9, "tap"]);
        lockFace(c, T + 0.7, ATT[c.team]);
        c.busyUntil = T + 1.6;
        say(c, "Đảo chân!", "var(--color-pear)", 1.0);
        const front = inPitch(along(c.team, c.pos, 3.4)), lean = inPitch(along(c.team, c.pos, 3.3, -side * 0.9));
        const arrive = T + Math.max(0.45, mdist(d.pos, front) / 5), shift = Math.max(arrive, T + 0.7);
        mkScript(d, [T, d.pos], [arrive, front], [shift, front], [shift + 0.3, lean], [shift + 0.5, lean]);
        d.keys.push([arrive - 0.1, shift, "jockey"], [shift, shift + 0.45, "shift"]);
        d.busyUntil = shift + 0.5;
        return true;
      },
      /** A simple inside cut: a touch across his body and away at an angle. */
      cut(c, d) {
        const side = toT(c.team, d.pos)[1] > toT(c.team, c.pos)[1] ? -1 : 1;
        mkScript(c, [T, c.pos], [T + 0.3, inPitch(along(c.team, c.pos, 0.6))], [T + 1.0, inPitch(along(c.team, c.pos, 2.0, side * 2.6))]);
        c.keys.push([T + 0.15, T + 0.4, "tap"]);
        c.busyUntil = T + 1.0;
        beaten(d, T + 0.4, inPitch(along(c.team, c.pos, 0.9)), 0.15);
        return true;
      },
      /** A sole drag-back: rolls the ball back under his foot, turns and goes the other way. */
      dragBack(c, d) {
        const side = rng() < 0.5 ? -1 : 1;
        mkScript(c, [T, c.pos], [T + 0.45, inPitch(along(c.team, c.pos, -0.6, side * 0.3))], [T + 1.2, inPitch(along(c.team, c.pos, 0.4, side * 3.0))]);
        c.keys.push([T, T + 0.45, "heel"]);
        c.busyUntil = T + 1.2;
        say(c, "Kéo bóng!", "var(--color-pear)", 1.0);
        beaten(d, T + 0.45, inPitch(along(c.team, c.pos, 0.3)), 0.15);
        return true;
      },
      /** Through the legs of a defender who is right on him, then round him to collect it. */
      nutmeg(c, d) {
        const behind = inPitch(along(c.team, d.pos, 2.0));
        const side = toT(c.team, d.pos)[1] > 0.5 ? -1 : 1, round = inPitch(along(c.team, d.pos, 0.3, side * 1.4));
        const t1 = T + 0.25 + Math.max(0.5, mdist(c.pos, round) / 5), t2 = t1 + Math.max(0.4, mdist(round, behind) / 5);
        mkScript(c, [T, c.pos], [T + 0.25, c.pos], [t1, round], [t2, behind]);
        c.keys.push([T + 0.1, T + 0.32, "tap"]);
        c.busyUntil = Infinity; game.carrier = null;
        at(T + 0.25, () => {
          if (ball.owner !== c) return;
          fly({ g: add(ground(...behind), [ATT[c.team] * 6, 1]), h: 0 }, t2 - T - 0.25, 0.02, { roll: true, onEnd: () => receive(c) });
          say(c, "Xỏ háng!", "var(--color-pear)", 1.0);
        });
        holdStill(d, T, t2); d.keys.push([T + 0.2, T + 0.55, "jockey"], [T + 0.55, t2, "shrug"]);
        return true;
      },
    };
    
    function tackle(c, d, Tt, options = {}) {
      const target = c.script ? scriptPos(c, Tt) : c.pos, slide = options.slide ?? rng() < 0.15;
      mkScript(d, [T, d.pos], [Tt, lerp(target, d.pos, 0.6 / Math.max(0.6, mdist(target, d.pos)))]);
      d.busyUntil = Tt + 0.8;
      if (slide) d.keys.push([Tt - 0.3, Tt + 0.6, "slide"], [Tt + 0.6, Tt + 1.1, "sitUp"]);
      else d.keys.push([Tt - 0.12, Tt + 0.25, "tap"]);
      at(Tt, () => {
        if (game.mode !== "play" || ball.owner !== c || ball.mode !== "carried") return;
        // A spent defender is a step slow: he often just misses, and when he does get there it is more often late.
        if (rng() < 0.4 * (1 - fit(d)) - 0.2 * (1 - fit(c))) {
          // A step late: sometimes he only catches the man.
          if (rng() < 0.4) return foul(c, d, Tt, false);
          d.keys.push([Tt, Tt + 0.6, "shrug"]);
          if (rng() < 0.5) say(d, pick(["Không theo kịp…", "Hụt hơi rồi…"]), "var(--color-card)", 0.9);
          return;
        }
        // Most challenges are clean. A defender already on a yellow is careful.
        const counter = game.counter && game.counter.team === c.team && T < game.counter.until;
        const foulP = ((d.yellows ?? 0) >= 1 ? 0.45 : counter ? 0.65 : d.team === game.momentum ? 0.32 : 0.48) + 0.25 * (1 - fit(d));
        if (rng() < foulP) foul(c, d, Tt, slide);
        else {
          praise(d);
          holdStill(c, Tt, Tt + 0.45); c.keys.push([Tt + 0.05, Tt + 0.6, "shrug"]); c.busyUntil = Infinity;
          game.carrier = null;
          if (rng() < 0.3) { const out = touchOut(c.pos); fly({ g: ground(...out), h: 0 }, 0.6, 0.2, { roll: true, onEnd: () => ballOut(c.team, out) }); }
          else fly({ g: footPoint(d), h: 0 }, 0.22, 0.05, { onEnd: () => receive(d) });
        }
      });
    }
    /** Whistle, a yellow card, then a free kick; for Đỏ near goal, the striker comes over to take it. */
    function foul(c, d, Tt, slide = false) {
      game.stoppage = true; game.carrier = null;
      setNote(`Phạm lỗi · ${d.name} (${TEAM_NAME[d.team]})`);
      game.refFocus = { uv: [...c.pos], until: Tt + 2.8 };
      holdStill(c, Tt, Tt + 2.5);
      c.keys.push([Tt, Tt + 1.2, "fall"], [Tt + 1.2, Tt + 1.8, "sitUp"]);
      at(Tt + 0.1, () => say(c, line("ouch"), "var(--color-card)", 0.8));
      // The free kick is taken where the foul happened.
      const spot = inPitch([...c.pos]);
      fly({ g: ground(...spot), h: 0 }, 0.4, 0.05, { roll: true });
      ref.keys.push([Tt + 0.15, Tt + 0.8, "whistle"]); at(Tt + 0.2, () => say(ref, "TUÝTTT!"));
      // Now and then he does not get up (once a match at most); otherwise, very rarely, it boils over.
      const hurtUntil = !game.injured && c.role !== "GK" && rng() < (slide ? 0.2 : 0.07) ? injure(c, Tt) : 0;
      if (!hurtUntil && !game.scuffled && rng() < (slide ? 0.3 : 0.1) && scuffle(c, d, Tt, spot, slide)) return;
      // A card for a reckless slide or for stopping a counter-attack (a slide from behind, rarely, a straight red);
      // otherwise a word from the referee.
      const tactical = game.pullBack || (game.counter && game.counter.team === c.team && T < game.counter.until + 1);
      if (game.pullBack) at(Tt + 0.3, () => say(ref, "Kéo áo!", "var(--color-card)", 1.0));
      // The last man bringing down a player clean through on goal: a straight red.
      const [cd, cw] = toT(c.team, c.pos);
      const lastMan = cd > 0.55 && !outfield(team[d.team]).some(p => { const [pd, pw] = toT(c.team, p.pos); return p !== d && pd > cd - 0.01 && Math.abs(pw - cw) * WID < 10; });
      // The last man: a straight red, unless the referee is lenient (then yellow). For a card the referee jogs
      // over to the man first and shows it from a couple of metres away.
      let refWalk = 0, argues = false;
      if (lastMan || tactical || rng() < (slide ? 0.95 : (d.yellows ?? 0) >= 1 ? 0.85 : 0.8)) {
        const rd = mdist(ref.pos, d.pos);
        refWalk = Math.max(0, (rd - 3) / 5.5);
        game.refFocus = { uv: inPitch(lerp(d.pos, ref.pos, Math.min(1, 2.5 / Math.max(2.5, rd)))), until: Tt + 2.6 + refWalk };
        const red = (lastMan && rng() < 0.7) || (slide && rng() < 0.3);
        at(Tt + 1.3 + refWalk, () => book(d, red));
      } else {
        ref.keys.push([Tt + 1.0, Tt + 1.6, "point"]);
        at(Tt + 1.05, () => say(ref, "Nhẹ chân thôi!", "var(--color-card)", 1.0));
        d.keys.push([Tt + 0.9, Tt + 1.6, "shrug"]);
        // ...and sometimes he argues the call and gets booked for it (once the referee has had his say, and never
        // while a man is down injured).
        if (!hurtUntil && rng() < 0.25) {
          argues = true;
          d.keys.push([Tt + 2.1, Tt + 2.9, "armsWide"]);
          at(Tt + 2.15, () => say(d, pick(["Tôi chạm bóng mà!", "Phạt gì mà phạt!", "Thổi kiểu gì thế?!"]), "var(--color-coral)", 1.1));
          at(Tt + 3.0, () => { if (game.mode === "play") { book(d, false); game.stats.dissent = (game.stats.dissent ?? 0) + 1; } });
        }
      }
      // The free kick waits for the referee, for a man going off and for an injured man to be off the pitch.
      const go = () => {
        if (game.mode !== "play") return;
        if ((game.redPending ?? 0) > T) return at(game.redPending + 0.2, go);
        setPiece(c, spot);
      };
      at(Math.max(Tt + 2.6 + refWalk, argues ? Tt + 4.0 : 0, hurtUntil), go);
    }
    
    /** A card: yellow (a second one turns red) or a straight red. Keepers only ever see yellow. */
    function book(p, wantRed) {
      // A straight red at most once a match, and never for a keeper; a second yellow is always a red.
      if (wantRed && p.role !== "GK" && game.reds.R + game.reds.B === 0) return showRed(p, "THẺ ĐỎ!");
      p.yellows = (p.yellows ?? 0) + 1; game.cards[p.team]++; game.stats.yellows++; game.dirty = true;
      ref.keys.push([T, T + 1.2, "card"]); say(ref, "Thẻ vàng!", "var(--art-card-yellow)", 1.2);
      setNote(`Thẻ vàng · ${p.name} (${TEAM_NAME[p.team]})`);
      p.keys.push([T + 0.1, T + 1.2, "shrug"]);
      if (p.yellows >= 2 && p.role !== "GK") {
        game.stats.secondYellows++; game.redPending = T + 2.2;
        at(T + 0.9, () => showRed(p, "Thẻ vàng thứ 2 · THẺ ĐỎ!"));
      }
    }
    function showRed(p, text) {
      ref.keys.push([T, T + 1.4, "cardRed"]); say(ref, text, "var(--art-card-red)", 1.6);
      game.reds[p.team]++; game.stats.reds++; game.dirty = true;
      setNote(`Thẻ đỏ · ${p.name} (${TEAM_NAME[p.team]})`);
      // A moment with his head in his hands, then off at a jog by the nearest touchline; his side plays on a man short.
      const exit = [clamp(p.pos[0], 0.1, 0.9), p.pos[1] < 0.5 ? -0.06 : 1.09], dur = Math.max(1.5, mdist(p.pos, exit) / 3.5);
      p.sentOff = true;
      mkScript(p, [T + 0.6, p.pos], [T + 0.6 + dur, exit]);
      p.keys.push([T, T + 0.6, "headHands"]);
      at(T + 0.65 + dur, () => { p.off = true; });
    }
    
    const offset = (uv, [mx, my]) => [uv[0] + mx / LEN, uv[1] + my / WID];
    /**
     * Tempers flare (once a match at most): words, maybe a push, a team-mate calms things down and the referee
     * steps in between them before dealing with it.
     */
    function scuffle(c, d, Tt, spot, slide) {
      // The fouled player's nearest team-mate (within a few metres) walks over to have words; otherwise the fouled
      // player himself once he is back on his feet.
      const pool = team[c.team].filter(p => on(p) && p !== c && p.role !== "GK" && !p.star && mdist(p.pos, d.pos) < 6);
      const confronter = pool.length ? nearest(pool, d.pos).p : c;
      game.scuffled = true; game.stats.scuffles++;
      const v = [(d.pos[0] - confronter.pos[0]) * LEN, (d.pos[1] - confronter.pos[1]) * WID], n = Math.hypot(...v) || 1, u = [v[0] / n, v[1] / n];
      const start = confronter === c ? Tt + 1.8 : Tt + 0.4;
      const meet = inPitch(offset(d.pos, mul(u, -1.0))), ta = start + Math.max(0.6, mdist(confronter.pos, meet) / 3.5);
      const shove = rng() < 0.25, mid = lerp(meet, d.pos, 0.5);
      const apartA = inPitch(offset(mid, mul(u, -1.4))), apartD = inPitch(offset(mid, mul(u, 1.4)));
      const end = ta + 4.2;
      mkScript(confronter, [start, confronter.pos], [ta, meet], [ta + 1.4, meet], [ta + 1.8, apartA], [end, apartA]);
      mkScript(d, [Tt, d.pos], [ta + (shove ? 0.3 : 1.4), shove ? inPitch(offset(d.pos, mul(u, 0.4))) : d.pos], [ta + 1.8, apartD], [end, apartD]);
      confronter.keys.push(shove ? [ta - 0.15, ta + 0.3, "shove"] : [ta - 0.1, ta + 0.4, "armsWide"], [ta + 0.4, ta + 1.5, "chestOut"], [ta + 1.5, end, "armsWide"]);
      d.keys.push([ta + 0.2, ta + 1.5, "chestOut"], [ta + 1.5, end, "waveOff"]);
      confronter.busyUntil = d.busyUntil = end + 0.2;
      const faceA = Math.sign(ground(...d.pos)[0] - ground(...meet)[0]) || 1;
      at(ta - 0.3, () => { lockFace(confronter, end, faceA); lockFace(d, end, -faceA); });
      at(ta - 0.1, () => say(confronter, pick(["Chơi xấu à?!", "Đá kiểu gì thế?!", "Cố tình đấy à?!"]), "var(--color-coral)", 1.3));
      at(ta + 0.8, () => say(d, pick(["Tôi chạm bóng mà!", "Làm gì căng thế?!"]), "var(--color-coral)", 1.3));
      // A team-mate of the fouler steps in as peacemaker (only someone close by).
      const calm = nearest(outfield(team[d.team]).filter(p => p !== d && !p.script && mdist(p.pos, mid) < 10), mid).p;
      if (calm) {
        const spotE = inPitch(offset(mid, [-u[1] * 1.3, u[0] * 1.3])), arr = Tt + 0.6 + Math.max(0.8, mdist(calm.pos, spotE) / 4);
        mkScript(calm, [Tt + 0.6, calm.pos], [arr, spotE], [end - 0.4, spotE]);
        calm.keys.push([arr, end - 0.4, "separate"]);
        at(arr + 0.2, () => say(calm, "Thôi thôi, bỏ qua đi!", "var(--color-card)", 1.2));
        calm.busyUntil = end;
      }
      // The referee jogs or runs in at a believable speed, steps between them, then deals with it.
      const refIn = Math.max(ta + 1.0, Tt + 0.3 + mdist(ref.pos, mid) / 6);
      mkScript(ref, [Tt + 0.3, ref.pos], [refIn, mid], [refIn + 3.0, mid]);
      ref.keys.push([refIn, refIn + 1.2, "separate"], [refIn + 1.2, refIn + 1.6, "whistle"]);
      at(refIn + 0.05, () => say(ref, "Dừng lại!", "var(--color-card)", 1.0));
      game.fight = { uv: mid, until: refIn + 3.0 };
      // Cards: the confronter only if he shoved (a red only in the rarest case); the foul itself on its usual odds.
      if (shove) at(refIn + 1.8, () => book(confronter, rng() < 0.25));
      if (rng() < (slide ? 0.4 : 0.15)) at(refIn + 3.0, () => book(d, false));
      at(refIn + 3.6, () => { if (game.mode === "play") setPiece(c, spot); });
      return true;
    }
    
    /**
     * A proper free kick, never a quick one: the ball is placed, the defenders build a wall 6.5 m out while the
     * referee marks the distance, the keeper covers the side the wall leaves open, the taker steps back and waits
     * for the whistle. In range it is a shot over the wall; further out, a long ball once everyone is set.
     */
    function setPiece(c, spot) {
      const att = c.team, def = otherTeam(att), d = toT(att, spot)[0], gk = GK[def];
      game.stoppage = true; game.carrier = null; game.poss = att; game.dirty = true;
      ball.mode = "dead"; ball.seg = null; ball.kind = null; ball.g = ground(...spot); ball.h = 0; ball.show = true;
      setNote(`Đá phạt · ${TEAM_NAME[att]}`);
      const direct = d >= 0.6, walled = d >= 0.45, WALL_M = 6.5;
      // The fouled man takes it, unless he is far away (a substitute who has just come on): then whoever is nearest.
      const near = mdist(c.pos, spot) > 10 ? nearest(outfield(team[att]), spot).p ?? c : c;
      const taker = att === "R" && direct && on(STAR[7]) && mdist(STAR[7].pos, spot) < 15 ? STAR[7] : near;
      const goal = toW(att, [1, 0.5]), dm = [(goal[0] - spot[0]) * LEN, (goal[1] - spot[1]) * WID], dl = Math.hypot(...dm) || 1, dn = [dm[0] / dl, dm[1] / dl];
      const atM = (m, side = 0) => inPitch([spot[0] + (dn[0] * m - dn[1] * side) / LEN, spot[1] + (dn[1] * m + dn[0] * side) / WID]);
      // Taker: walks over, steps back for his run-up and waits for the whistle (which waits for him).
      const runFrom = atM(-3.2, -1.3), tArr = T + Math.max(1.2, mdist(taker.pos, runFrom) / 4.5);
      // A wall takes a while to set up; without one the free kick is taken as soon as the taker is ready.
      const Tk = walled ? Math.max(T + 4.6, tArr + 1.4) : Math.max(T + 2.6, tArr + 0.7);
      game.fk = { spot: [...spot], goal: toW(att, [1, 0.5]), until: Tk + 1.3, direct, att };
      mkScript(taker, [T + (taker === c ? 0.3 : 0), taker.pos], [tArr, runFrom], [Tk - 0.5, runFrom], [Tk - 0.04, atM(-0.4, -0.2)]);
      taker.keys.push([tArr + 0.1, Tk - 0.5, direct ? "stance" : "ready"]);
      at(tArr, () => lockFace(taker, Tk + 0.35, Math.sign(ground(...goal)[0] - taker.g[0]) || ATT[att]));
      taker.busyUntil = Infinity;
      // The wall: two or three defenders shoulder to shoulder, covering one side of the goal; they jump as it is struck.
      const wallSide = rng() < 0.5 ? -1 : 1;
      let wallPt = null;
      if (walled) {
        const n = d >= 0.7 ? 3 : 2;
        wallPt = atM(WALL_M, wallSide * 0.4);
        outfield(team[def]).sort((x, y) => mdist(x.pos, spot) - mdist(y.pos, spot)).slice(0, n).forEach((w, i) => {
          const place = atM(WALL_M, wallSide * 0.4 + (i - (n - 1) / 2) * 0.75), arr = T + Math.max(1.4, mdist(w.pos, place) / 4.5);
          mkScript(w, [T, w.pos], [arr, place], [Tk + 0.9, place]);
          w.keys.push([arr, Tk + 0.1, "wall"], [Tk + 0.1, Tk + 0.5, "wallJump"], [Tk + 0.5, Tk + 0.9, "wall"]);
          w.busyUntil = Tk + 1;
        });
      }
      // Referee: paces out the distance and points at the wall's line, then steps away and blows for it.
      game.refFocus = null;
      game.refPlan = [{ until: T + 2.4, uv: atM(WALL_M, -wallSide * 1.8) }, { until: Tk + 0.4, uv: atM(2.5, -wallSide * 7) }];
      ref.keys.push([T + 1.6, T + 2.4, "point"], [Tk - 0.75, Tk - 0.3, "whistle"]);
      // Keeper: on his line, covering the side the wall leaves open.
      if (direct && wallPt) {
        const lineW = toT(att, atM(WALL_M))[1], wallW = toT(att, wallPt)[1];
        const kp = toW(att, [0.975, 0.5 + (wallW > lineW ? -1 : 1) * 0.035]);
        mkScript(gk, [T, gk.pos], [T + 1.6, kp], [Tk + 0.2, kp]);
        gk.keys.push([T + 1.6, Tk + 0.25, "keeper"]);
      }
      if (direct) {
        if (walled) at(Tk - 2.0, () => say(gk, pick(["Hàng rào đứng chắc!", "Dịch sang trái!", "Dịch sang phải!"]), "var(--color-card)", 1.1));
        at(Tk - 0.4, () => {
          if (game.mode !== "play") return;
          game.stoppage = false; game.refPlan = null; clearRestartNote();
          const r = rng(), style = att === "R" ? (r < 0.5 ? "kick" : r < 0.85 ? "curl" : "knuckle") : (r < 0.6 ? "kick" : "curl");
          shoot(taker, { style, windup: 0.4, keepScript: true, wall: walled ? WALL_M : 0, wallPt, label: "Đá phạt!" });
        });
      } else {
        at(Tk, () => {
          if (game.mode !== "play") return;
          game.stoppage = false; game.refPlan = null; clearRestartNote();
          carry(taker); game.carrier = taker; game.freeKick = true; taker.busyUntil = T;
        });
      }
      return true;
    }
    
    /** Play modes use position and fitness; watch mode favours the next dramatic story beat. */
    function goalChance(c, style) {
      const next = game.story.goals[game.storyIdx];
      const distance = mdist(c.pos, toW(c.team, [1, 0.5]));
      if (interactive) {
        const open = nearest(outfield(opponents(c.team)), c.pos).d;
        return clamp(0.74 - distance * 0.024 + (open > 4 ? 0.08 : -0.1) - (1 - fit(c)) * 0.18, 0.025, 0.82);
      }
      if (game.golden) return minute() >= FULL + 3 ? 0.85 : 0.6;
      if (!next) return clamp(0.35 - distance * 0.012, 0.03, 0.35);
      if (c.team !== next[0] || minute() < next[1]) return 0.015;
      // The scheduled scorer: a good chance that grows the longer it is overdue, so it usually takes 1–2 attempts
      // (a match minute is only about 1.5 s of play); a shot from long range rarely goes in.
      const quality = game.finishing === c ? 0.1 : { curl: 0.05, knuckle: 0.03, chip: 0.05, volley: 0.02 }[style] ?? 0;
      const over = minute() - next[1];
      let p = clamp(0.55 + quality + over * 0.06, 0.55, 0.95);
      if ((1 - toT(c.team, c.pos)[0]) * LEN > 16) p = Math.min(p, over >= 4 ? 0.6 : 0.35);
      return p;
    }
    const SHOT = {
      kick: { label: "SÚT!", speed: 19, arc: 0.12 },
      power: { label: "Sút căng!", speed: 24, arc: 0.05 },
      curl: { label: "Cứa lòng!", speed: 17, arc: 0.25 },
      knuckle: { label: "Đá phạt!", speed: 21, arc: 1.0 },
      chip: { label: "Sút bổng!", speed: 11, arc: 2.0 },
      header: { label: "Đánh đầu!", speed: 12, arc: 0.15 },
      volley: { label: "Vô-lê!", speed: 17, arc: 0.1 },
      bicycle: { label: "Móc bóng!", speed: 16, arc: 0.1 },
    };
    /**
     * The shooter's situation when he pulls the trigger: through on his own (no defender between him and goal),
     * tightly marked, or shooting from distance, and whether a team-mate was clearly better placed.
     */
    function shotContext(c) {
      const t = c.team, [cd] = toT(t, c.pos), goal = toW(t, [1, 0.5]), defenders = outfield(opponents(t));
      const oneOnOne = !defenders.some(p => toT(t, p.pos)[0] > cd - 0.01 && mdist(p.pos, c.pos) < 9);
      const marked = nearest(defenders, c.pos).d < 2.5, longShot = cd < 0.68;
      const open = oneOnOne || !(marked || longShot) ? null
        : outfield(team[t]).find(m => m !== c && toT(t, m.pos)[0] > cd + 0.04 && nearest(defenders, m.pos).d > 4 && mdist(m.pos, goal) < mdist(c.pos, goal) - 3) ?? null;
      return { oneOnOne, open };
    }
    function shoot(c, o = {}) {
      const def = otherTeam(c.team), gk = GK[def], d = toT(c.team, c.pos)[0];
      c.shotCtx = shotContext(c);
      let style = o.style;
      if (!style) {
        const gkOff = mdist(gk.pos, toW(def, [0, 0.5])) > 4.5;
        if (gkOff && rng() < 0.6) style = "chip";
        else if (c.star === 10 && rng() < 0.5) style = "curl";
        else if (c.star === 7 && rng() < 0.5) style = "power";
        else if (d < 0.66 && rng() < 0.4) style = "power";
        else style = "kick";
      }
      const spec = SHOT[style], aerial = style === "header" || style === "bicycle";
      const Tk = T + (aerial ? 0.02 : o.windup ?? (style === "power" ? 0.42 : 0.3));
      const roll = rng(), gc = goalChance(c, style);
      // Misses: mostly saved or off target; the woodwork is rare (and at most twice a match per side).
      let outcome = roll < gc ? "goal" : roll < gc + (1 - gc) * 0.55 ? "save" : roll < gc + (1 - gc) * 0.6 ? "post" : "wide";
      if (o.onTarget) outcome = roll < gc ? "goal" : "save";
      if (outcome === "post" && game.posts[c.team] >= 2) outcome = "wide";
      if (outcome === "post") game.posts[c.team]++;
      // A free kick that does not go in sometimes just hits the wall.
      if (o.wall && o.wallPt && outcome !== "goal" && rng() < 0.425) outcome = "wallHit";
      const side = rng() < 0.5 ? -1 : 1;
      let w = 0.5 + side * (0.03 + rng() * 0.06), h = style === "chip" ? 0.4 + rng() * 0.6 : style === "knuckle" ? 1.1 + rng() * 0.45 : 0.25 + rng() * 1.1, over = false;
      if (outcome === "post") { w = 0.5 + side * (GOAL_V[1] - 0.5); h = 0.5 + rng() * 0.8; }
      if (outcome === "wide") { if (rng() < 0.55) w = 0.5 + side * (0.12 + rng() * 0.05); else { h = GOAL_H + 0.5 + rng() * 0.6; over = true; } }
      if (o.aimedW != null) { w = o.aimedW; h = 0.55; }
      const mouth = toW(c.team, [1, w]);
      if (!aerial && o.noPose) holdStill(c, T, Tk + 0.3);
      else if (!aerial) {
        if (!o.keepScript) holdStill(c, T, Tk + 0.1);
        kickPoses(c, Tk, style === "power" || style === "knuckle" ? "power" : style === "curl" ? "curl" : style === "chip" ? "chip" : "kick");
        lockFace(c, Tk + 0.3, Math.sign(ground(...mouth)[0] - c.g[0]) || ATT[c.team]);
      }
      c.busyUntil = Infinity;
      game.stats.shots++;
      at(Tk, () => {
        if (game.mode !== "play" || (o.manual && ball.owner !== c)) return;
        game.carrier = null;
        say(c, o.label ?? spec.label, "var(--color-coral)", 1.0);
        if (outcome === "wallHit") {
          // Smacks into the wall and bounces back into play for whoever gets there first.
          fly({ g: ground(...o.wallPt), h: 1.5 }, Math.max(0.3, o.wall / spec.speed), 0.25, { kind: "shot", onEnd: () => {
            say("ball", "Trúng hàng rào!", "var(--color-sky-soft)", 1.1);
            looseBall(inPitch(along(c.team, o.wallPt, -(5 + rng() * 5), (rng() - 0.5) * 8)), { maxArc: 0.8 });
          } });
          return;
        }
        const dist = mdist(ballUV(), mouth);
        // Over a wall, the ball must still be above the jumping heads (about 2.25 m) when it gets there; every
        // path is given at least the time gravity needs for its height.
        const wallArc = hEnd => { if (!o.wall) return 0; const f = clamp(o.wall / dist, 0.15, 0.85), hAt = ball.h + (hEnd - ball.h) * f; return (2.25 - hAt) / (4 * f * (1 - f)); };
        const curveFor = k => style === "curl" ? -side * ATT[c.team] * Math.min(26, dist * 1.2) * k : 0;
        // The keeper sets himself at his own depth, along the line of the shot, after a short reaction time.
        const [gd, gw] = toT(c.team, gk.pos), [sd, sw] = toT(c.team, ballUV()), kk = clamp((gd - sd) / Math.max(0.05, 1 - sd), 0, 1);
        const saveW = sw + (w - sw) * kk, save = toW(c.team, [gd, saveW]), lateral = Math.abs(saveW - gw) * WID;
        if (outcome === "save") {
          const kind = h > 1.55 ? "gkHigh" : lateral > 1.6 ? "dive" : h < 0.55 ? "gkLow" : "gkChest";
          const dest = kind === "dive" ? inPitch(lerp(gk.pos, save, 0.7)) : save;
          const faceDir = kind === "dive" ? (Math.sign(ground(...dest)[0] - gk.g[0]) || 1) : (Math.sign(c.g[0] - gk.g[0]) || 1);
          const r = rig(POSES[kind]), hands = lerp(r.handF, r.handB, 0.5), gD = ground(...dest);
          const hs = [gD[0] + (hands[0] + 4) * S * faceDir, gD[1] + (hands[1] - 2) * S], hEnd = (gD[1] + 1 - hs[1]) / K;
          const arc = Math.max(Math.min(spec.arc, 0.5), wallArc(hEnd)), flight = Math.max(0.3, dist / spec.speed, gravFlight(arc)), tc = T + flight;
          mkScript(gk, [T + 0.18, gk.pos], [tc - 0.03, dest], [tc + 1.3, dest]);
          gk.keys.push([tc - 0.3, tc + 0.35, kind]);
          if (kind === "dive") gk.keys.push([tc + 0.35, tc + 1.0, "diveLand"], [tc + 1.0, tc + 1.4, "sitUp"]);
          lockFace(gk, tc + 1.3, faceDir);
          // Diving and hard shots are mostly palmed away; ones at his body are held.
          const parry = flight < 0.45 || rng() < ({ dive: 0.7, gkHigh: 0.4, gkLow: 0.25, gkChest: 0.15 }[kind] + (flight < 0.5 ? 0.2 : 0));
          fly({ g: [hs[0], gD[1] + 1], h: hEnd }, flight, arc, { kind: "shot", curve: curveFor(0.6), onEnd: () => keeperSaves(gk, c, parry, kind) });
          gk.busyUntil = tc + 1.5;
          return;
        }
        const arc = Math.max(spec.arc + (style === "kick" ? dist * 0.012 : 0), wallArc(h)), flight = Math.max(0.3, dist / spec.speed, gravFlight(arc));
        fly({ g: ground(...mouth), h }, flight, arc, { kind: "shot", curve: curveFor(1), wobble: style === "knuckle" ? 2.5 : 0, onEnd: () => shotEnd(outcome, c, w, h, over) });
        if (outcome === "wide" && !over) {
          // Going wide: a step across and he watches it go past.
          mkScript(gk, [T + 0.18, gk.pos], [T + 0.18 + 0.4, inPitch(lerp(gk.pos, save, 0.15))]);
          gk.keys.push([T + 0.2, T + flight + 0.4, "keeper"], [T + flight + 0.4, T + flight + 1.2, "point"]);
        } else if (over) {
          gk.keys.push([T + 0.2, T + flight, "keeper"]);
          if (h < 2.4) gk.keys.push([T + flight - 0.2, T + flight + 0.3, "reachUp"]);
        } else {
          // Beaten (or it hits the post): a beat late and short, with the right action for the height.
          const reach = lerp(gk.pos, save, outcome === "goal" ? 0.5 : 0.4);
          mkScript(gk, [T + 0.25, gk.pos], [T + flight, reach]);
          if (lateral > 1.6 && h < 1.9) gk.keys.push([T + flight - 0.3, T + flight + 0.1, "dive"], [T + flight + 0.1, T + flight + 0.9, "diveLand"], [T + flight + 0.9, T + flight + 1.3, "sitUp"]);
          else gk.keys.push([T + flight - 0.25, T + flight + 0.3, h > 1.4 ? "gkHigh" : h < 0.55 ? "gkLow" : "keeper"]);
        }
        gk.busyUntil = T + flight + 1.2;
      });
      return true;
    }
    
    /** The ball reaches the keeper's hands: he holds it (and gets up hugging it), or palms it away for a scramble. */
    function keeperSaves(gk, c, parry, kind) {
      const def = gk.team;
      c.keys.push([T + 0.1, T + 1.2, "headHands"]);
      if (parry) {
        game.stats.parries++;
        if (rng() < 0.5) {
          say(gk, "Cứu thua! Ra ngoài!", "var(--color-sky-soft)", 1.2);
          const side = toW(c.team, [1.04, rng() < 0.5 ? 0.3 : 0.7]);
          fly({ g: ground(...side), h: 0.3 }, 0.45, 0.6, { onEnd: () => corner(c.team, side[1] < 0.5 ? 0 : 1) });
          reactToMiss(c, "save");
          return;
        }
        say(gk, "Đẩy ra!", "var(--color-sky-soft)", 1.1);
        looseBall(inPitch(toW(c.team, [0.8 + rng() * 0.07, rng() < 0.5 ? 0.2 + rng() * 0.12 : 0.68 + rng() * 0.12])), { maxArc: 0.8 });
        reactToMiss(c, "save");
        return;
      }
      game.stats.catches++;
      const won = game.poss !== def;
      holdBall(gk); game.poss = def; game.dirty = true;
      say(gk, "Bắt gọn!", "var(--color-sky-soft)", 1.2);
      // Hug it into the chest (getting up first after a dive), then look to start the next attack.
      const up = kind === "dive" ? 1.0 : 0.35;
      gk.keys.push([T + up, T + up + 0.9, "catch"]);
      at(T + up + 1.0, () => {
        if (game.mode === "play" && ball.owner === gk) { game.carrier = gk; gk.busyUntil = T; if (won) startCounter(gk); }
      });
      // A defender thanks him, more often than not.
      if (rng() < 0.6) {
        const mate = nearest(outfield(team[def]), gk.pos).p;
        if (mate && mdist(mate.pos, gk.pos) < 15) at(T + 0.6, () => { mate.keys.push([T, T + 0.8, "clapA"], [T + 0.8, T + 1.2, "clapB"]); say(mate, line("saveCheer"), "var(--color-card)", 1.1); });
      }
      reactToMiss(c, "save");
    }
    /** After a chance goes begging, a team-mate either lifts the shooter or lets him have it. */
    function reactToMiss(c, how) {
      if (rng() > 0.45) return;
      const ctx = c.shotCtx ?? {}, field = outfield(team[c.team]).filter(p => p !== c);
      // A word of advice only when someone really was free (and never when he was through on his own), and only sometimes.
      const advice = ctx.open && !ctx.oneOnOne && on(ctx.open) && rng() < 0.35;
      const mate = advice ? ctx.open : nearest(field, c.pos).p;
      if (!mate || mdist(mate.pos, c.pos) > 18) return;
      game.stats.reactions++; if (advice) game.stats.advice = (game.stats.advice ?? 0) + 1;
      const kind = advice ? "missAdvice" : how === "save" ? "keeperGood" : "missKind";
      at(T + 0.9, () => {
        if (!on(mate)) return;
        mate.keys.push(advice ? [T, T + 0.9, "blamePoint"] : [T, T + 0.5, "clapA"], ...(advice ? [] : [[T + 0.5, T + 0.9, "clapB"]]));
        say(mate, line(kind), advice ? "var(--color-sun)" : "var(--color-card)", 1.2);
      });
    }
    /** A team-mate shouts his approval after a good piece of defending. */
    function praise(p) {
      if (rng() > 0.4) return;
      const mate = nearest(outfield(team[p.team]).filter(x => x !== p), p.pos).p;
      if (!mate || mdist(mate.pos, p.pos) > 16) return;
      game.stats.praises = (game.stats.praises ?? 0) + 1;
      at(T + 0.5, () => { if (on(mate)) { mate.keys.push([T, T + 0.5, "clapA"], [T + 0.5, T + 0.9, "clapB"]); say(mate, line("praise"), "var(--color-card)", 1.1); } });
    }
    function shotEnd(outcome, c, w, h, over) {
      const def = otherTeam(c.team), gk = GK[def];
      if (outcome === "goal") {
        fly({ g: ground(...toW(c.team, [1 + GOAL_DEPTH * 0.85, w])), h: h * 0.8 }, 0.14, 0);
        at(T + 0.14, () => fly({ g: ground(...toW(c.team, [1 + GOAL_DEPTH * 0.8, w])), h: 0 }, 0.32, 0.05));
        scored(c, w);
      } else if (outcome === "post") {
        say("ball", "BOONG! Cột dọc!", "var(--color-sky-soft)", 1.2);
        reactToMiss(c);
        game.post = { t: T, at: [ball.g[0], ball.g[1] - ball.h * K] };
        c.keys.push([T + 0.1, T + 1.1, "headHands"]);
        looseBall(inPitch(toW(c.team, [0.78 + rng() * 0.08, w < 0.5 ? 0.22 + rng() * 0.14 : 0.64 + rng() * 0.14])), { maxArc: 1.0 });
      } else {
        if (!over && rng() < 0.4) {
          say("ball", "Chạm hậu vệ · phạt góc!", "var(--color-sky-soft)", 1.2);
          const out = toW(c.team, [1.05, w < 0.5 ? 0.25 : 0.75]);
          fly({ g: ground(...out), h: 0 }, 0.4, 0.2, { roll: true, onEnd: () => corner(c.team, out[1] < 0.5 ? 0 : 1) });
          game.stoppage = true;
          return;
        }
        say("ball", over ? "Vọt xà!" : "Ra ngoài!", "var(--color-sky-soft)", 1.2);
        reactToMiss(c);
        c.keys.push([T + 0.1, T + 1.2, "headHands"]);
        game.stoppage = true;
        const out = toW(c.team, [1.07, clamp(w, 0.3, 0.7)]);
        fly({ g: ground(...out), h: 0 }, 0.5, over ? 0.3 : 0.08, { roll: true });
        at(T + 1.2, () => { ball.show = false; });
        at(T + 1.9, () => {
          if (game.mode !== "play") return;
          ball.g = footPoint(gk); ball.h = 0; carry(gk); game.carrier = gk; game.poss = def; game.stoppage = false; gk.busyUntil = T + 1.1; game.dirty = true;
          setNote(`Phát bóng · ${TEAM_NAME[def]}`);
        });
      }
    }
    
    /** Goal: the scorer's own celebration (a leap and spin for the striker, pointing at the sky for the dribbler). */
    function scored(c, w) {
      game.score[c.team]++;
      setNote(`⚽ ${c.name} #${c.num} (${TEAM_NAME[c.team]}) ${game.golden ? "· bàn thắng vàng!" : Math.min(FULL, minute()) + "'"}`);
      game.mode = "celebrate"; game.modeT = T; game.scorer = c; game.carrier = null; game.stoppage = true;
      game.net = { t: T, end: toW(c.team, [1, 0.5])[0] > 0.5 ? 1 : 0 };
      game.crowdCheer = T; game.cheerTeam = c.team;
      say("ball", "VÀOOO!", "var(--color-pear)", 1.3);
      ref.keys.push([T + 0.3, T + 0.9, "whistle"], [T + 1.0, T + 2.4, "point"]);
      // What sort of goal was it? Still behind: grab the ball and get on with it. Padding a big lead: low key.
      // An equaliser or the lead after being behind (second half), or a late one: an emotional celebration, sometimes.
      const lead = game.score[c.team] - game.score[otherTeam(c.team)];
      game.trailed ??= { R: 0, B: 0 };
      const late = minute() >= FULL - 7 || game.golden, levelOrAhead = lead === 0 || lead === 1;
      const big = ((late && levelOrAhead) || (game.trailed[c.team] && game.half2 && levelOrAhead)) && rng() < 0.45;
      if (lead < 0) game.trailed[c.team] = 1;
      if (lead > 0) game.trailed[otherTeam(c.team)] = 1;
      const weights = lead >= 3 ? { fist: 4, mate: 4, arms: 2 }
        : { fist: 25, mate: 22, arms: 14, airplane: 10, pointMate: 8, badge: 5, dance: 5, kneeSlide: 4, shush: 3 };
      if (c.star === 7) weights.siu = 18;
      if (c.star === 10) weights.sky = 22;
      delete weights[game.lastCeleb[c.team]];
      const pickW = w => { let r = rng() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; } return "fist"; };
      const style = lead < 0 ? "hurry" : big ? (rng() < 0.75 ? "groupHug" : "kneelBrief") : pickW(weights);
      game.lastCeleb[c.team] = style; game.celebrate = style;
      game.stats.celebrations = game.stats.celebrations ?? {}; game.stats.celebrations[style] = (game.stats.celebrations[style] ?? 0) + 1;
      // Wherever he is heading, he runs at most about 6 m, at an amateur's 5 m/s.
      const cornerSpot = toW(c.team, [0.84, w < 0.5 ? 0.14 : 0.86]);
      const runTo = (target, cap = 6) => {
        const D = mdist(c.pos, target), spot = inPitch(lerp(c.pos, target, Math.min(1, cap / Math.max(0.1, D)))), tArr = T + 0.3 + mdist(c.pos, spot) / 5;
        mkScript(c, [T + 0.2, c.pos], [tArr, spot]);
        c.keys.push([T + 0.2, tArr, style === "airplane" ? "airplane" : "run"]);
        return { spot, tArr };
      };
      const mate = nearest(outfield(team[c.team]).filter(m => m !== c), c.pos);
      let endAt = T + 3.0;
      if (big) {
        say("ball", lead === 0 ? "Gỡ hòa!" : late ? "Phút cuối!" : "Ngược dòng!", "var(--art-gold)", 1.6);
        game.crowdCheer = T + 0.5;
      }
      if (style === "hurry") {
        // Still behind: into the net for the ball and back to the centre spot, no time to lose.
        const net = toW(c.team, [0.97, 0.5]);
        const tNet = T + 0.2 + mdist(c.pos, net) / 5;
        mkScript(c, [T + 0.2, c.pos], [tNet, net], [tNet + 0.3, net]);
        c.keys.push([T + 0.2, tNet, "run"], [tNet, tNet + 0.3, "gkLow"]);
        at(T + 0.4, () => say(c, "Nhanh lên, còn thời gian!", "var(--color-card)", 1.3));
        endAt = T + 2.4;
      } else if (style === "mate" && mate.p && mate.d < 12) {
        // Runs to the nearest team-mate: a high five and a hug.
        const { tArr } = runTo(offset(mate.p.pos, [0, 0.8]), 12);
        holdStill(mate.p, T, tArr + 1.4);
        mate.p.keys.push([tArr - 0.1, tArr + 0.5, "highFive"], [tArr + 0.5, tArr + 1.4, "hug"]);
        c.keys.push([tArr - 0.1, tArr + 0.5, "highFive"], [tArr + 0.5, tArr + 1.4, "hug"]);
        at(tArr, () => { say(c, line("scorer"), "var(--color-pear)", 1.1); say(mate.p, line("mateGoal"), "var(--color-card)", 1.1); });
        endAt = tArr + 1.8;
      } else if (style === "pointMate" && mate.p) {
        // Points at the team-mate who made it: "his goal as much as mine".
        const { tArr } = runTo(offset(mate.p.pos, [0, 1.0]), 4);
        c.keys.push([tArr, tArr + 1.0, "blamePoint"], [tArr + 1.0, tArr + 1.8, "hug"]);
        at(tArr, () => { lockFace(c, tArr + 1.8, Math.sign(mate.p.g[0] - c.g[0]) || 1); say(c, "Của ông đấy!", "var(--color-pear)", 1.1); });
        endAt = tArr + 2.0;
      } else if (style === "kneeSlide") {
        // A short knee slide that slows down, arms up.
        const { spot, tArr } = runTo(cornerSpot, 5);
        const dir = [(spot[0] - c.pos[0]) * LEN, (spot[1] - c.pos[1]) * WID], n = Math.hypot(...dir) || 1;
        const slide1 = inPitch(offset(spot, [dir[0] / n * 1.0, dir[1] / n * 1.0])), slide2 = inPitch(offset(spot, [dir[0] / n * 1.6, dir[1] / n * 1.6]));
        c.script.keys.push([tArr + 0.2, ...slide1], [tArr + 0.55, ...slide2], [tArr + 1.8, ...slide2]);
        c.keys.push([tArr, tArr + 1.4, "kneeSlide"], [tArr + 1.4, tArr + 2.2, "cheer"]);
        at(tArr, () => say(c, line("scorer"), "var(--color-pear)", 1.1));
        endAt = tArr + 2.3;
      } else if (style === "kneelBrief") {
        // An emotional one: drops to his knees for a second, arms up, then up again and the team comes in.
        const { tArr } = runTo(cornerSpot, 4);
        c.keys.push([tArr, tArr + 1.0, "kneelSky"], [tArr + 1.0, tArr + 1.4, "cheerHop"], [tArr + 1.4, tArr + 2.8, "hug"]);
        at(tArr + 0.1, () => say(c, line(lead === 0 ? "equaliser" : "goAhead"), "var(--art-gold)", 1.3));
        endAt = tArr + 3.0;
      } else if (style === "groupHug") {
        // Big goal: he runs off with both fists clenched and the team-mates who are close by come and hug him.
        const { tArr } = runTo(cornerSpot, 6);
        c.keys.push([tArr, tArr + 0.6, "fistPump"], [tArr + 0.6, tArr + 3.0, "hug"]);
        at(T + 0.4, () => say(c, line("scorer"), "var(--art-gold)", 1.2));
        at(tArr + 1.2, () => { const m2 = nearest(outfield(team[c.team]).filter(m => m !== c), c.pos).p; if (m2) say(m2, line(lead === 0 ? "equaliser" : "goAhead"), "var(--color-pear)", 1.2); });
        endAt = tArr + 3.0;
      } else {
        const { tArr } = runTo(style === "shush" ? [c.pos[0], c.pos[1] < 0.5 ? 0.02 : 0.98] : cornerSpot);
        const hold = { siu: null, sky: "pointSky", badge: "badge", shush: "shush", airplane: "cheer", arms: "cheer", fist: "fistPump", dance: null }[style];
        if (style === "siu") {
          c.keys.push([tArr, tArr + 0.45, "siuJump"], [tArr + 0.45, tArr + 1.65, "siuLand"]);
          at(tArr + 0.15, () => lockFace(c, tArr + 1.8, -c.faceDir));
          at(tArr + 0.42, () => say(c, "SIUUU!", "var(--art-gold)", 1.3));
        } else if (style === "dance") {
          for (let k = 0; k < 3; k++) c.keys.push([tArr + k * 0.4, tArr + k * 0.4 + 0.4, k % 2 ? "danceB" : "danceA"]);
          at(tArr, () => say(c, line("scorer"), "var(--color-pear)", 1.1));
        } else {
          c.keys.push([tArr, tArr + 1.1, hold]);
          if (style === "fist") c.keys.push([tArr + 0.5, tArr + 0.8, "cheerHop"]);
          at(tArr, () => say(c, style === "shush" ? "Suỵt!" : style === "badge" ? "Vì đội bóng!" : line("scorer"), "var(--color-pear)", 1.1));
        }
        c.keys.push([tArr + 1.3, tArr + 2.2, "cheerLow"]);
        endAt = tArr + 2.2;
      }
      game.celebrateFor = clamp(endAt - T, 2.2, big ? 4.6 : 3.6);
      // The side that conceded stands; only a late goal that puts them behind drops someone to his knees.
      if (late && lead >= 1 && rng() < 0.5) {
        const own = toW(otherTeam(c.team), [0, 0.5]), culprit = [...outfield(team[otherTeam(c.team)])].sort((a, b) => mdist(a.pos, own) - mdist(b.pos, own))[0];
        if (culprit) culprit.keys.push([T + 0.6, T + 2.1, "kneelSad"]);
      }
      game.kickoffTeam = otherTeam(c.team);
      game.lastGoalMinute = minute(); game.ballFetched = false;
      game.stats.goals++;
      if (c.cornerAt && T - c.cornerAt < 2.5) game.stats.cornerGoals++;
      const next = game.story.goals[game.storyIdx];
      if (next && next[0] === c.team) game.storyIdx++;
      // The side that conceded: half the time they turn on each other, often someone lifts them instead.
      const r = rng();
      if (r < 0.52) blame(otherTeam(c.team)); else if (r < 0.9) encourage(otherTeam(c.team));
      // Unless the scorer's side is in a hurry to get it back, the keeper fishes the ball out of the net and
      // boots it back to the centre spot.
      // (If the keeper is busy arguing, the defender nearest the goal does it.)
      const ownGoal = toW(otherTeam(c.team), [0, 0.5]);
      const gkC = [GK[otherTeam(c.team)], ...outfield(team[otherTeam(c.team)]).sort((a, b) => mdist(a.pos, ownGoal) - mdist(b.pos, ownGoal))]
        .find(p => on(p) && p !== game.blame?.a && p !== game.blame?.c && (p.role === "GK" || !p.script));
      if (game.celebrate !== "hurry" && gkC) {
        const netUV = toW(c.team, [1 + GOAL_DEPTH * 0.3, clamp(w, 0.42, 0.58)]), t0 = T + 1.6;
        const tA = t0 + Math.max(0.6, mdist(gkC.pos, netUV) / 2.5);
        mkScript(gkC, [t0, gkC.pos], [tA, netUV], [tA + 1.0, netUV]);
        gkC.keys.push([tA, tA + 0.5, "gkLow"], [tA + 0.55, tA + 0.75, "kickBack"], [tA + 0.75, tA + 1.0, "kick"]);
        at(tA + 0.5, () => lockFace(gkC, tA + 1.1, Math.sign(ground(0.5, 0.5)[0] - gkC.g[0]) || 1));
        at(tA + 0.8, () => {
          if (game.mode !== "celebrate" && game.mode !== "reset") return;
          game.ballFetched = true; ball.show = true; ball.alpha = 1;
          fly({ g: ground(0.5, 0.5), h: 0 }, 1.7, 3.0);
        });
      }
    }
    
    /** After conceding: the captain (or keeper) claps and rallies the team; a team-mate answers. */
    function encourage(t) {
      const field = outfield(team[t]), leader = on(team[t][3]) ? team[t][3] : GK[t];
      const mate = field.filter(p => p !== leader).sort((a, b) => mdist(a.pos, leader.pos) - mdist(b.pos, leader.pos))[0];
      if (!leader || !mate) return;
      game.stats.encourages++;
      const ta = T + 1.6, end = ta + 2.4;
      holdStill(leader, ta - 0.2, end);
      leader.keys.push([ta, ta + 0.5, "clapA"], [ta + 0.5, ta + 0.8, "clapB"], [ta + 0.8, ta + 1.4, "rally"], [ta + 1.4, ta + 1.7, "clapA"], [ta + 1.7, end, "rally"]);
      at(ta, () => { lockFace(leader, end, Math.sign(mate.g[0] - leader.g[0]) || 1); say(leader, line("encourage"), "var(--color-pear-soft)", 1.4); });
      at(ta + 1.3, () => { if (on(mate)) { mate.keys.push([T, T + 1.0, "fistPump"]); say(mate, line("reply"), "var(--color-card)", 1.1); } });
      game.blame = { a: leader, c: mate, from: ta - 0.6, until: end };
    }
    
    /** After conceding: someone (usually the keeper) has a go at the defender nearest the goal, who argues back. */
    function blame(t) {
      const own = toW(t, [0, 0.5]), field = outfield(team[t]);
      const culprit = [...field].sort((a, b) => mdist(a.pos, own) - mdist(b.pos, own))[0];
      const accuser = rng() < 0.35 ? GK[t] : field.find(p => p !== culprit && p.role === "MF") ?? field.find(p => p !== culprit);
      if (!culprit || !accuser) return;
      // Not in the middle of the other side's celebration: then it is a word of encouragement instead.
      if (game.scorer && (mdist(culprit.pos, game.scorer.pos) < 5 || mdist(accuser.pos, game.scorer.pos) < 5)) return encourage(t);
      game.stats.blames++;
      const v = [(culprit.pos[0] - accuser.pos[0]) * LEN, (culprit.pos[1] - accuser.pos[1]) * WID], n = Math.hypot(...v) || 1, u = [v[0] / n, v[1] / n];
      const mid = lerp(accuser.pos, culprit.pos, 0.5), spotA = inPitch(offset(mid, mul(u, -0.9))), spotC = inPitch(offset(mid, mul(u, 0.9)));
      const t0 = T + 1.2, ta = t0 + Math.max(0.8, mdist(accuser.pos, spotA) / 4.5), end = ta + 2.8;
      mkScript(accuser, [t0, accuser.pos], [ta, spotA], [end, spotA]);
      mkScript(culprit, [t0 + 0.2, culprit.pos], [ta, spotC], [end, spotC]);
      accuser.keys.push([ta, ta + 0.7, "blamePoint"], [ta + 0.7, ta + 1.3, "armsWide"], [ta + 1.3, ta + 2.1, "blamePoint"], [ta + 2.1, end, "waveOff"]);
      culprit.keys.push([ta + 0.3, ta + 1.1, "armsWide"], [ta + 1.1, ta + 1.9, "blamePoint"], [ta + 1.9, end, "waveOff"]);
      const dir = Math.sign(ground(...spotC)[0] - ground(...spotA)[0]) || 1;
      at(ta - 0.2, () => { lockFace(accuser, end, dir); lockFace(culprit, end, -dir); });
      at(ta + 0.05, () => say(accuser, line("accuse"), "var(--color-coral)", 1.3));
      at(ta + 1.15, () => say(culprit, line("retort"), "var(--color-coral)", 1.3));
      game.blame = { a: accuser, c: culprit, from: ta - 0.6, until: end };
    }
    
    /* ---------------------------------- where everyone runs ---------------------------------- */
    const KICKOFF = [[0.03, 0.5], [0.2, 0.3], [0.2, 0.7], [0.38, 0.5], [0.487, 0.5], [0.46, 0.76]];
    const KICKOFF_DEF = [[0.03, 0.5], [0.2, 0.3], [0.2, 0.7], [0.32, 0.5], [0.4, 0.26], [0.4, 0.74]];
    const kickoffTaker = t => team[t].find(p => p.i === 4 && on(p)) ?? team[t].find(p => p.role !== "GK" && on(p));
    const kickoffSpot = p => p === kickoffTaker(game.kickoffTeam) ? toW(p.team, [0.487, 0.5]) : toW(p.team, (p.team === game.kickoffTeam ? KICKOFF : KICKOFF_DEF)[p.i]);
    function formation(p) {
      const t = p.team, [bd, bw] = toT(t, ballUV()), poss = game.poss === t, sh = SHAPES[game.shape[t]];
      if (p.role === "GK") return toW(t, [0.03 + (bd < 0.3 ? (0.3 - bd) * 0.12 : 0), 0.5 + (bw - 0.5) * 0.3]);
      // A side sitting in 3-1-1 springs back into 2-1-2 the moment it has the ball, further still on the counter.
      const shape = sh.sit && poss ? SHAPES[sh.withBall] : sh;
      const counter = game.counter && game.counter.team === t && T < game.counter.until;
      const { home: [hd, hw], line } = shapeSlot(p, shape);
      let d = hd * 0.55 + bd * 0.45 + (poss ? 0.08 : -0.07) + shape.push + (counter && line !== "DF" ? 0.08 : 0);
      let w = poss ? 0.5 + (hw - 0.5) * 1.2 + (bw - 0.5) * 0.25 : 0.5 + (hw - 0.5) * 0.8 + (bw - 0.5) * 0.4;
      if (line === "DF") d = Math.min(d, poss ? 0.56 + shape.push : Math.max(0.08, bd - 0.05));
      if (line === "FW") d = Math.max(d, poss ? 0.4 : sh.sit ? 0.45 : 0.3);
      d += 0.012 * Math.sin(T * 0.6 + p.n * 1.7); w += 0.016 * Math.sin(T * 0.5 + p.n * 2.3);
      return toW(t, [clamp(d, 0.06, 0.9), clamp(w, 0.06, 0.94)]);
    }
    /**
     * A waypoint that takes `p` round a group of people centred on `c` (radius r metres) on his way to `dest`,
     * on the side he is already on; `dest` itself when the straight line is clear.
     */
    function around(p, dest, c, r = 5) {
      const P = [p.pos[0] * LEN, p.pos[1] * WID], D = [dest[0] * LEN, dest[1] * WID], C = [c[0] * LEN, c[1] * WID];
      const v = [D[0] - P[0], D[1] - P[1]], L2 = v[0] * v[0] + v[1] * v[1] || 1;
      const k = clamp(((C[0] - P[0]) * v[0] + (C[1] - P[1]) * v[1]) / L2, 0, 1);
      const Q = [P[0] + v[0] * k, P[1] + v[1] * k], dq = Math.hypot(Q[0] - C[0], Q[1] - C[1]);
      if (dq >= r || k >= 1 || Math.hypot(D[0] - C[0], D[1] - C[1]) < r) return dest;
      let n = [Q[0] - C[0], Q[1] - C[1]];
      if (dq < 0.01) n = [-v[1], v[0]];
      const nl = Math.hypot(...n) || 1;
      return inPitch([(C[0] + n[0] / nl * (r + 1.5)) / LEN, (C[1] + n[1] / nl * (r + 1.5)) / WID]);
    }
    /** At a free kick or corner the other side keeps about five metres from the ball (the wall is scripted). */
    function targetFor(p) {
      const t = baseTarget(p), fk = game.fk;
      if (!fk || T >= fk.until || !p.team || p.bench || p.team === fk.att || game.mode !== "play") return t;
      const d = mdist(t, fk.spot);
      if (d >= 5) return t;
      const away = d > 0.1 ? t : toW(p.team, [0, 0.5]);
      return inPitch(lerp(fk.spot, away, 5.5 / Math.max(0.1, mdist(away, fk.spot))));
    }
    function baseTarget(p) {
      const m = game.mode;
      if (p.bench) return p.exitTo ?? seatUV(p);
      if (p.medic) return p.post;
      if (m === "halftime") return p.pos;
      if (p === ref) return refTarget();
      if (m === "reset") return kickoffSpot(p);
      if (m === "celebrate") {
        if (p.team === game.scorer.team && p.role !== "GK") {
          if (game.celebrate === "hurry") return kickoffSpot(p);
          // Team-mates close by (15 m) come over and stand around him; those further away come a few steps and clap.
          const a = p.i * 1.3, dist = mdist(p.pos, game.scorer.pos);
          const ring = inPitch(add(game.scorer.pos, [0.8 / LEN * Math.cos(a), 0.8 / WID * Math.sin(a)]));
          if (p.near ?? (p.near = dist < 15)) return T - game.modeT < 0.6 ? p.pos : ring;
          return T - game.modeT < 1.5 ? inPitch(lerp(p.pos, game.scorer.pos, Math.min(1, 4 / Math.max(4, dist)))) : p.pos;
        }
        // The side that conceded stands for a moment, then walks back, round the celebration and not through it.
        if (p.team !== game.scorer.team) return T - game.modeT < 1.8 ? p.pos : around(p, kickoffSpot(p), game.scorer.pos);
        return toW(p.team, KICKOFF_DEF[p.i]);
      }
      if (m === "fulltime" || m === "draw") return p.pos;
      if (m === "ceremony") return ceremonySpot(p);
      if (game.press[p.team] === p) {
        const bT = toT(p.team, ballUV());
        return toW(p.team, [bT[0] - 0.035, bT[1]]);
      }
      return formation(p);
    }
    /**
     * The referee: diagonal system. He stays 7–10 m from the ball, behind the play and to one side of it,
     * keeps out of the players' way, jogs most of the time and only sprints when play gets away from him.
     */
    function refTarget() {
      const m = game.mode;
      if (m === "ceremony" || m === "fulltime") return m === "ceremony" ? ceremonySpot(ref) : ref.pos;
      if (m === "reset") return [0.47, 0.82];
      if (m === "celebrate") return [0.5, 0.7];
      if (game.refPlan) { const step = game.refPlan.find(x => T < x.until); if (step) return step.uv; game.refPlan = null; }
      if (game.refFocus && T < game.refFocus.until) return inPitch([game.refFocus.uv[0], game.refFocus.uv[1] + (game.refFocus.uv[1] < 0.8 ? 0.13 : -0.13)]);
      // Every half second he weighs a ring of spots 7–11 m from the ball and takes the clearest one: away from
      // players, behind the play, out of the line between ball and goal, and not a long way from where he is.
      if (!ref.aim || T - (ref.pickAt ?? -9) > 0.5) {
        ref.pickAt = T;
        const b = ballUV(), att = game.poss ?? "R", goal = toW(att, [1, 0.5]), bT = toT(att, b);
        const field = players.filter(on);
        const score = c => {
          const clear = Math.min(...field.map(p => mdist(p.pos, c)));
          const ahead = (toT(att, c)[0] - bT[0]) * LEN;                       // metres in front of the ball
          const g = [(goal[0] - b[0]) * LEN, (goal[1] - b[1]) * WID], cv = [(c[0] - b[0]) * LEN, (c[1] - b[1]) * WID];
          const gl = Math.hypot(...g) || 1, along = (cv[0] * g[0] + cv[1] * g[1]) / gl, off = Math.abs(cv[0] * g[1] - cv[1] * g[0]) / gl;
          const inLane = along > 0 && along < gl && off < 4;
          const edge = Math.min(c[0], 1 - c[0]) * LEN < 2 || Math.min(c[1], 1 - c[1]) * WID < 2;
          const toBall = mdist(c, b), band = toBall < 6 ? (6 - toBall) * 0.8 : toBall > 12 ? (toBall - 12) * 0.6 : 0;
          return Math.min(clear, 6) - Math.max(0, ahead) * 0.25 - (inLane ? 4 : 0) - (edge ? 2 : 0) - band - mdist(c, ref.pos) * 0.04;
        };
        let best = ref.aim, bestS = ref.aim ? score(ref.aim) + 0.5 : -Infinity;
        for (let i = 0; i < 16; i++) for (const r of [7.5, 10]) {
          const a = i / 16 * Math.PI * 2, c = inPitch([b[0] + Math.cos(a) * r / LEN, b[1] + Math.sin(a) * r / WID]), sc = score(c);
          if (sc > bestS) { best = c; bestS = sc; }
        }
        ref.aim = best;
      }
      return ref.aim;
    }
    function speedFor(p, dist = 10) {
      const m = game.mode;
      if (p.bench) return p.injured ? 1.6 : 3.2;
      if (p.medic) return 3.0;
      if (p === ref) return m === "play" && mdist(ref.pos, refTarget()) > 10 ? 6.0 : 4.0;
      if (m === "reset") return game.halfBreak || game.newMatch ? 4.2 : game.afterGoal && p.team === game.kickoffTeam && T - game.modeT < 2.5 ? 1.8 : 3.5;
      if (m === "celebrate") return p.team === game.scorer?.team ? (p.near ? 5 : 2.5) : 1.8;
      // At the end the winners jog over to their captain; the beaten side walks.
      if (m === "ceremony" || m === "fulltime") return p.team === game.winner ? 3.0 : 2.1;
      if (game.counter && game.counter.team === p.team && T < game.counter.until) return 6.0;
      if (game.press[p.team] === p) return 5.5;
      // Off the ball: a jog over short distances, a run when there is ground to make up.
      return dist > 8 ? 4.8 : 3.2;
    }
    function updatePress() {
      if (T - game.pressAt < 0.4) return;
      game.pressAt = T;
      for (const t of TEAMS) {
        game.press[t] = null;
        if (game.mode !== "play" || game.stoppage || game.poss === t) continue;
        game.press[t] = nearest(outfield(team[t]).filter(p => !p.script), ballUV()).p;
      }
    }
    
    const SAD = ["hipsHands", "headHands", "slump", "hipsHands", "headHands"];
    /** Arms up with the odd small hop, then clapping: not non-stop jumping. */
    const joy = (p, since) => since < 2 ? ((T * 0.8 + p.i * 0.37) % 1 < 0.3 ? "cheerHop" : "cheerLow") : (T * 2 + p.i * 0.3) % 1 < 0.5 ? "clapA" : "clapB";
    function autoPose(p, speed) {
      const m = game.mode, near = mdist(p.pos, ballUV()), moving = speed > 2.2 ? "run" : speed > 0.9 ? "walkSad" : null;
      if (p.medic) return moving ?? "ready";
      if (p.bench) {
        if (moving) return moving;
        if (p.injured) return "sitSad";
        const s = T - game.modeT;
        if (m === "celebrate" && game.scorer?.team === p.team && s < 2.5) return joy(p, s);
        if ((m === "fulltime" || m === "ceremony") && game.winner === p.team) return joy(p, s);
        return p.subbing ? "ready" : "sitBench";
      }
      if (m === "celebrate" && p !== ref) {
        if (p.team === game.scorer.team) {
          if (speed > 1.2) return "run";
          if (game.celebrate === "hurry") return "ready";
          return mdist(p.pos, game.scorer.pos) < 1.6 ? "hug" : joy(p, T - game.modeT);
        }
        return moving ?? SAD[(p.i + game.score.R + game.score.B) % SAD.length];
      }
      // Walking back to the kick-off spots, heads down.
      if (m === "reset" && p !== ref && game.afterGoal && p.team === game.kickoffTeam && T - game.modeT < 2.5) return moving ?? "slump";
      if (m === "halftime" && p !== ref) return moving ?? (p.i % 2 ? "hipsHands" : "ready");
      if (m === "fulltime" && p !== ref) return p.team === game.winner ? joy(p, T - game.modeT) : p.endPose ?? SAD[(p.i * 3) % SAD.length];
      if (m === "ceremony") return ceremonyPose(p, speed);
      if (speed > 1.2) return ball.owner === p && ball.mode === "carried" ? (p.dribStyle && T < p.busyUntil ? p.dribStyle : "dribble") : "run";
      if (p.role === "GK" && toT(p.team, ballUV())[0] < 0.4 && m === "play") return "keeper";
      // Spent: hands on knees while the ball is elsewhere.
      if (m === "play" && p.role !== "GK" && (p.energy ?? 1) < 0.35 && speed < 0.5 && near > 10) return "handsKnees";
      if (game.press[p.team] === p && near < 6) return "jockey";
      return "ready";
    }
    
    function updatePerson(p, dt) {
      if (p.off) return;
      const before = [...p.pos];
      if (p.script) {
        if (T >= p.script.keys[0][0]) {
          p.pos = scriptPos(p, T);
          if (T >= p.script.keys[p.script.keys.length - 1][0]) p.script = null;
        }
        p.vel = [(p.pos[0] - before[0]) * LEN / dt, (p.pos[1] - before[1]) * WID / dt];
      } else {
        const h = manual(p) ? humanFor(p) : null;
        const direction = h ? courtUV([h.x, h.y]) : null;
        const directionLength = direction ? Math.hypot(direction[0] * LEN, direction[1] * WID) : 0;
        const tgt = h ? inPitch([p.pos[0] + (directionLength ? direction[0] / directionLength * 4 : 0), p.pos[1] + (directionLength ? direction[1] / directionLength * 4 : 0)]) : targetFor(p);
        const dm = [(tgt[0] - p.pos[0]) * LEN, (tgt[1] - p.pos[1]) * WID], dist = Math.hypot(...dm);
        const top = (h ? h.sprint ? 6.2 : 4.5 : speedFor(p, dist)) * (game.mode === "play" && p.team && !p.bench ? 0.7 + 0.3 * fit(p) : 1), sp = Math.min(top, dist * 2.2);
        let des = dist > 0.05 ? mul(dm, sp / dist) : [0, 0];
        // Keep a little space between bodies. Players ignore the referee; he steps around them.
        const dn = Math.hypot(...des) > 0.1 ? mul(des, 1 / Math.hypot(...des)) : null;
        for (const o of people) {
          if (o === p || o.off || (o === ref && p !== ref)) continue;
          const ox = (p.pos[0] - o.pos[0]) * LEN, oy = (p.pos[1] - o.pos[1]) * WID, od = Math.hypot(ox, oy);
          if (p === ref) {
            if (od < 2.5 && od > 0.001) { des[0] += ox / od * (2.5 - od) * 2; des[1] += oy / od * (2.5 - od) * 2; }
            // Someone in his path: sidestep round him rather than barging through.
            if (dn && od < 5 && od > 0.001 && -(ox * dn[0] + oy * dn[1]) > 0) {
              const perp = [-dn[1], dn[0]], side = Math.sign(-(ox * perp[0] + oy * perp[1])) || 1;
              des[0] -= perp[0] * side * (5 - od) * 1.1; des[1] -= perp[1] * side * (5 - od) * 1.1;
            }
            continue;
          }
          if (od < 1.5 && od > 0.001) { des[0] += ox / od * (1.5 - od) * 3; des[1] += oy / od * (1.5 - od) * 3; }
        }
        const dl = Math.hypot(...des);
        if (dl > top + 0.5) des = mul(des, (top + 0.5) / dl);
        const k = Math.min(1, dt * 3);
        p.vel = [p.vel[0] + (des[0] - p.vel[0]) * k, p.vel[1] + (des[1] - p.vel[1]) * k];
        p.pos = [p.pos[0] + p.vel[0] / LEN * dt, p.pos[1] + p.vel[1] / WID * dt];
        if (h) p.pos = inPitch(p.pos);
      }
      p.g = ground(...p.pos);
      const speed = Math.hypot(...p.vel);
      p.stride += speed * dt * (p.dribStyle === "dribbleLow" ? 3.4 : 2.4);
      // Facing: a locked direction, else where they run, else towards the ball. Thresholds give hysteresis.
      const sx = p.vel[0] / LEN * A[0] + p.vel[1] / WID * B[0];
      let want = p.faceDir;
      const locked = p.faceLock && T < p.faceLock.until;
      if (locked) want = p.faceLock.dir;
      else if (speed > 1.4) { if (Math.abs(sx) > 6) want = Math.sign(sx); }
      else if (ball.show && Math.abs(ball.g[0] - p.g[0]) > 16) want = Math.sign(ball.g[0] - p.g[0]);
      // A turn only happens once it has been wanted for a moment, so jostling in a crowd does not flicker.
      if (want !== p.faceDir) { p.turnSince ??= T; if (locked || T - p.turnSince > 0.15) { p.faceDir = want; p.turnSince = null; } }
      else p.turnSince = null;
      p.face += (p.faceDir - p.face) * Math.min(1, dt * 16);
      // Pose: a keyed action wins, else the automatic one; both ease towards the target pose.
      p.keys = p.keys.filter(k => k[1] > T - 0.1);
      const key = p.keys.filter(k => T >= k[0] && T < k[1]).pop();
      p.poseName = key ? key[2] : autoPose(p, speed);
      const target = poseOf(p.poseName, p.stride), k = Math.min(1, dt * (key ? 20 : 14));
      for (const q in target) {
        const step = (target[q] - p.pose[q]) * k;
        // A body does not swing up from lying to standing in a couple of frames: at most about 240°/s.
        p.pose[q] += q === "rot" ? clamp(step, -240 * dt, 240 * dt) : step;
      }
    }
    
    /* ---------------------------------- modes ---------------------------------- */
    function startMatch() {
      game.timers = []; game.pendingSubs = []; game.newMatch = true; game.redPending = 0;
      for (const p of people) { p.script = null; p.keys = []; p.faceLock = null; p.busyUntil = 0; }
      for (const m of medics) { m.off = false; m.pos = [...m.post]; m.g = ground(...m.pos); }
      for (const p of players) if (p.off || p.sentOff) { p.off = p.sentOff = false; p.script = null; p.pos = toW(p.team, KICKOFF_DEF[p.i]); }
      for (const p of players) { p.endPose = null; p.stayDown = false; p.sulking = false; p.near = null; p.subbing = false; }
      pickSquads(); game.injured = false; game.subsUntil = 0;
      game.lastGoalMinute = 0;
      game.story = newStory(); game.storyIdx = 0; game.extra = false; game.shapeAt = { R: -99, B: -99 }; game.chainsUsed = { R: 0, B: 0 }; game.posts = { R: 0, B: 0 }; game.scuffled = false; game.trailed = { R: 0, B: 0 }; game.momentum = null; game.counter = null; game.chain = null;
      game.pullAt = -99;
      game.score = { R: 0, B: 0 }; game.cards = { R: 0, B: 0 }; game.reds = { R: 0, B: 0 }; game.shape = { R: "2-1-2", B: "2-1-2" }; game.clock = 0; game.golden = false; game.winner = null;
      SWAP = initialSwap; game.half2 = false; game.halfBreak = false; game.afterGoal = false; game.ballFetched = false; game.firstKick = game.kickoffTeam;
      game.mode = "reset"; game.modeT = T; game.stoppage = true; ball.show = false; game.dirty = true;
      setNote(null);
    }
    function updateModes() {
      const m = game.mode, s = T - game.modeT;
      if (m === "celebrate" && s > (game.celebrateFor ?? 3.0)) {
        for (const p of players) p.near = null;
        if (game.score.R !== game.score.B && (game.golden || minute() > FULL)) return fullTime();
        game.mode = "reset"; game.modeT = T; game.net = null; game.afterGoal = true;
        if (!game.ballFetched) ball.show = false;
        for (const t of TEAMS) planSubs(t);
      } else if (m === "reset") {
        if (s > 1.2 && !ball.show) { ball.mode = "dead"; ball.g = ground(0.5, 0.5); ball.h = 0; ball.show = true; ball.alpha = 0; }
        // Kick off only once both teams are back in shape (with a safety limit so the match can never stall).
        const taker = kickoffTaker(game.kickoffTeam);
        const lined = players.filter(on).every(p => !p.script && mdist(p.pos, kickoffSpot(p)) < (p === taker ? 0.5 : 1.0));
        const subbing = T < (game.subsUntil ?? 0), since = T - Math.max(game.modeT, game.subsUntil ?? 0);
        const limit = game.halfBreak || game.newMatch ? 16 : 9, takerReady = mdist(taker.pos, kickoffSpot(taker)) < 1.5;
        if ((s > 1.5 && lined && !subbing) || (since > limit && takerReady) || s > 25) {
          game.mode = "play"; game.stoppage = false; game.halfBreak = false; game.newMatch = false; game.afterGoal = false; game.ballFetched = false; game.poss = game.kickoffTeam; game.kickoffPass = true; game.dirty = true;
          taker.pos = toW(taker.team, [0.487, 0.5]); taker.g = ground(...taker.pos);
          carry(taker); game.carrier = taker; taker.busyUntil = T + 0.6;
          ref.keys.push([T - 0.3, T + 0.4, "whistle"]);
        }
      } else if (m === "play") {
        // Half time at 30 minutes, once someone has the ball under control.
        if (!game.half2 && minute() > HALF && !game.stoppage && game.carrier && ball.owner === game.carrier) return halfTime();
        // Either side can win. Play modes allow a draw; watch mode retains a golden-goal finale.
        if (minute() > FULL && ball.kind !== "shot" && !game.stoppage) {
          if (game.score.R !== game.score.B || interactive) fullTime();
          else if (!game.golden) { game.golden = true; setNote("Hòa! Bàn thắng vàng"); }
        }
      } else if (m === "halftime" && s > 2.5) {
        // Change of ends: everyone walks across to the other half, and the side that did not kick off first starts.
        SWAP = !initialSwap; game.clock = HALF / PACE; game.kickoffTeam = otherTeam(game.firstKick);
        game.mode = "reset"; game.modeT = T; game.halfBreak = true; game.dirty = true;
        setNote("Hiệp 2 · đổi sân");
        // A breather at the break, and the coach's changes.
        for (const p of players) if (on(p)) p.energy = Math.min(1, p.energy + 0.12);
        for (const t of TEAMS) planSubs(t);
      } else if (m === "fulltime" && s > 2) {
        game.mode = "ceremony"; game.modeT = T; game.crowdCheer = T; game.cheerTeam = game.winner;
        // Anyone on the beaten side who is down near where the winners gather gets up and moves away first.
        for (const p of team[otherTeam(game.winner)]) if (mdist(p.pos, WINNERS_AT) < 10) p.stayDown = false;
        // The beaten captain's word as the cup goes up; the losers face the winners.
        const lc = team[otherTeam(game.winner)].find(p => p.i === 3 && on(p)) ?? team[otherTeam(game.winner)].find(on);
        if (lc) at(T + TROPHY_IN + 0.4, () => sayFT(lc, pick(["Chúc mừng các anh!", "Trận sau gặp lại!", "Các anh đá hay!"]), "var(--color-card)", 1.5));
        for (const p of team[otherTeam(game.winner)]) at(T + 4.5, () => lockFace(p, T + 6, Math.sign(ground(...WINNERS_AT)[0] - p.g[0]) || 1));
      } else if (m === "ceremony" && s > CEREMONY && !interactive) startMatch();
    }
    const TUNNEL = [0.32, -0.11];
    
    /**
     * Bench players fit to go on: rested a few minutes since they came off (for an injury, anyone who is not hurt).
     * A sub who has not played yet is ready at once.
     */
    const benchReady = (t, min = 0.6, rest = 3) => bench[t].filter(b => !b.off && !b.injured && !b.subbing && b.energy > min && minute() - b.benchSince >= rest);
    /** Whether the coach wants him off: his 20 minutes are up (key men excepted), or he is spent. */
    const dueOff = (p, slack = 0) => (!p.pillar && minute() - p.onSince >= p.stintLen - slack) || p.energy < (p.pillar ? 0.25 : 0.33);
    /** Who comes off first: the spent, then whoever has been on longest. */
    const offOrder = (a, b) => ((b.energy < 0.33) - (a.energy < 0.33)) || (a.onSince - b.onSince);
    /** The two swap who they are and where they stand at the same moment, so nothing jumps on screen. */
    function swapPlaces(p, b) {
      for (const k of IDENT) [p[k], b[k]] = [b[k], p[k]];
      for (const k of ["pos", "g", "vel", "face", "faceDir", "pose", "poseName", "stride", "keys", "faceLock", "script"]) [p[k], b[k]] = [b[k], p[k]];
      // The man coming on starts a new stint; the man going off starts his rest.
      game.stats.stints = game.stats.stints ?? [];
      if (!b.injured) game.stats.stints.push({ who: b.name, pillar: b.pillar, mins: minute() - b.onSince });
      p.onSince = minute(); p.stintLen = newStint(); b.benchSince = minute();
      restyle(p); restyle(b);
      p.subbing = b.subbing = false; p.busyUntil = 0; game.dirty = true;
    }
    /**
     * A tired player walks to the halfway line, where his replacement is waiting just off the pitch: a high five,
     * the new man runs on and the old one goes and sits down (he can come back on later, once rested).
     */
    function substitute(p, b) {
      const t = p.team, line = [t === "R" ? 0.485 : 0.515, 0.005], wait = [line[0], -0.03];
      p.subbing = b.subbing = true;
      const tP = T + Math.max(1, mdist(p.pos, line) / 4.2), tB = T + Math.max(0.8, mdist(b.pos, wait) / 3), tm = Math.max(tP, tB) + 0.5;
      mkScript(p, [T, p.pos], [tP, line], [tm, line]);
      mkScript(b, [T, b.pos], [tB, wait], [tm, wait]);
      p.keys.push([tm - 0.45, tm, "highFive"]); b.keys.push([tB, tm - 0.45, "ready"], [tm - 0.45, tm, "highFive"]);
      at(tm - 0.6, () => { const f = Math.sign(b.g[0] - p.g[0]) || 1; lockFace(p, tm + 0.2, f); lockFace(b, tm + 0.2, -f); });
      const pair = { p, b, done: false };
      (game.pendingSubs ??= []).push(pair);
      at(tm, () => finishSub(pair));
      game.subsUntil = Math.max(game.subsUntil ?? 0, tm + 1.5);
      game.stats.subs++;
      setNote(`Thay người · ${TEAM_NAME[t]}: ${b.name} #${b.num} vào, ${p.name} #${p.num} ra`);
      at(T + 0.3, () => say(b, pick(["Đến lượt tôi!", "Vào thay đây!", "Nghỉ chút đi, để tôi!"]), "var(--color-card)", 1.0));
    }
    /** Completes a substitution (on time, or at once when the half ends in the middle of it). */
    function finishSub(pair) {
      if (pair.done) return;
      pair.done = true;
      swapPlaces(pair.p, pair.b);
      game.pendingSubs = (game.pendingSubs ?? []).filter(x => x !== pair);
    }
    /**
     * At a break in play, each side brings on rested legs for its most tired player; a second one too if someone
     * is really spent.
     */
    function planSubs(t, slack = 3) {
      // A break in play is a good moment: anyone due within the next few minutes goes now (two at most).
      const off = outfield(team[t]).filter(p => !p.subbing && !p.script && dueOff(p, slack)).sort(offOrder);
      const fresh = benchReady(t).sort((a, b) => a.benchSince - b.benchSince || b.energy - a.energy);
      for (let n = 0; n < 2 && off.length && fresh.length; n++) substitute(off.shift(), fresh.shift());
    }
    /**
     * Rolling substitutions on the fly (six-a-side rules): every player except the key men gets about 20 minutes,
     * then, once he is well away from the ball, jogs off at the halfway line and a rested team-mate runs on while
     * play goes on. A spent player comes off the same way. One at a time per side.
     */
    function rollingSubs() {
      if (game.mode !== "play" || game.stoppage || ball.mode === "fly") return;
      // Not in the last minute of a half: the change would be cut short by the whistle.
      if ((!game.half2 && minute() >= HALF - 1) || minute() >= FULL - 1) return;
      for (const t of TEAMS) {
        if (T < (game.subCheck?.[t] ?? 0) || bench[t].some(b => b.subbing)) continue;
        (game.subCheck ??= { R: 0, B: 0 })[t] = T + 2;
        const fresh = benchReady(t).sort((a, b) => a.benchSince - b.benchSince || b.energy - a.energy)[0];
        if (!fresh) continue;
        const p = outfield(team[t]).filter(p => dueOff(p) && !p.script && T >= p.busyUntil && ball.owner !== p && mdist(p.pos, ballUV()) > 12).sort(offOrder)[0];
        if (p) { substitute(p, fresh); game.subCheck[t] = T + 4; }
      }
    }
    /**
     * An injury from a foul: he stays down holding his leg, then hobbles off by the nearest touchline. Someone
     * from the bench comes on at the halfway line; with nobody left, his side plays on a man short.
     * Returns when he is off, so the free kick can wait for him.
     */
    function injure(c, Tt) {
      game.injured = true; game.stats.injuries++;
      c.injured = true;
      const X = [...c.pos], far = X[1] < 0.5;
      at(Tt + 1.2, () => say(c, pick(["Á… chân tôi!", "Đau quá!", "Không đứng dậy được…"]), "var(--color-card)", 1.3));
      const mates = outfield(team[c.team]).filter(p => p !== c && !p.script && mdist(p.pos, X) < 16).sort((a, b) => mdist(a.pos, X) - mdist(b.pos, X));
      if (mates[0]) at(Tt + 2.0, () => say(mates[0], "Trọng tài ơi, có người đau!", "var(--color-card)", 1.2));
      ref.keys.push([Tt + 2.4, Tt + 3.2, "point"]);
      // Either side of him along the screen, so a man lying down fits between them.
      const side = (uv, k) => [uv[0] + k * 0.03, uv[1] + k * 0.05];
      const serious = mates.length < 2 || rng() < 0.5;
      // A stretcher goes off on the bench side and down the tunnel, where the medics came from; a man helped off
      // leaves by the nearest touchline (on the near side he sits down on the grass beyond it).
      const exitFar = serious || far;
      const exit = [clamp(X[0], 0.08, 0.92), exitFar ? -0.015 : 1.015], beyond = serious ? TUNNEL : [exit[0], exitFar ? -0.075 : 1.05];
      let tOut, tEnd;
      if (serious) {
        // The medics run on with the stretcher, see to him, lift him and carry him off at a walk.
        game.stats.stretchers = (game.stats.stretchers ?? 0) + 1;
        const tGo = Tt + 2.8, tArr = tGo + Math.max(...medics.map((m, k) => mdist(m.pos, side(X, k ? 1 : -1)))) / 5;
        const tLift = tArr + 1.4;
        tOut = tLift + Math.max(1.2, mdist(X, exit) / 2.4); tEnd = tOut + Math.max(1.2, mdist(exit, beyond) / 2.4);
        c.keys.push([Tt + 0.9, tLift, "hurt"], [tLift, tEnd + 0.2, "onStretcher"]);
        mkScript(c, [Tt, X], [tLift, X], [tOut, exit], [tEnd, beyond]);
        medics.forEach((m, k) => {
          const sgn = k ? 1 : -1;
          mkScript(m, [tGo, m.pos], [tArr, side(X, sgn)], [tLift, side(X, sgn)], [tOut, side(exit, sgn)], [tEnd, side(beyond, sgn)]);
          m.keys.push([tArr, tLift - 0.2, "treat"], [tLift - 0.2, tEnd, "carryLow"]);
          at(tArr - 0.4, () => lockFace(m, tEnd, -sgn * (Math.sign(ground(...side(X, 1))[0] - ground(...side(X, -1))[0]) || 1)));
          // Taken down the tunnel; the medics are back at their post a little later.
          at(tEnd, () => { m.off = true; });
          at(tEnd + 5, () => { m.off = false; m.script = null; m.pos = [...m.post]; m.g = ground(...m.pos); m.keys = []; });
        });
        at(tArr + 0.2, () => say(medics[0], pick(["Để chúng tôi xem!", "Nằm yên nhé!"]), "var(--color-card)", 1.1));
        setNote(`Chấn thương · ${c.name} (${TEAM_NAME[c.team]}) · cáng ra ngoài`);
      } else {
        // A knock: two team-mates go over, get him up and help him off with his arms over their shoulders.
        game.stats.helpedOff = (game.stats.helpedOff ?? 0) + 1;
        const helpers = mates.slice(0, 2), tGo = Tt + 2.2;
        const tArr = tGo + Math.max(...helpers.map((h, k) => mdist(h.pos, side(X, k ? 1 : -1)))) / 3.5, tUp = tArr + 0.9;
        tOut = tUp + Math.max(1.5, mdist(X, exit) / 1.8); tEnd = tOut;
        c.keys.push([Tt + 0.9, tArr + 0.3, "hurt"], [tArr + 0.3, tUp, "sitUp"], [tUp, tOut + 0.6, "limp"]);
        mkScript(c, [Tt, X], [tUp, X], [tOut, exit]);
        helpers.forEach((h, k) => {
          const sgn = k ? 1 : -1;
          mkScript(h, [tGo, h.pos], [tArr, side(X, sgn * 0.55)], [tUp, side(X, sgn * 0.55)], [tOut, side(exit, sgn * 0.55)], [tOut + 0.3, side(exit, sgn * 0.55)]);
          h.keys.push([tArr, tUp, "treat"], [tUp, tOut, "helpCarry"]);
          at(tArr - 0.3, () => lockFace(h, tOut, Math.sign(ground(...exit)[0] - ground(...X)[0]) || 1));
          h.busyUntil = tOut + 0.3;
        });
        at(tArr + 0.1, () => say(helpers[0], pick(["Cố đứng lên nào!", "Từ từ thôi!", "Bám vào tôi!"]), "var(--color-card)", 1.1));
        at(tUp, () => lockFace(c, tOut, Math.sign(ground(...exit)[0] - ground(...X)[0]) || 1));
        setNote(`Chấn thương · ${c.name} (${TEAM_NAME[c.team]})`);
      }
      // The referee waves them on from a few metres away, then gets out of their path.
      game.refFocus = { uv: inPitch([X[0] + 0.12, X[1] + (far ? 0.15 : -0.15)]), until: Tt + 4 };
      const sub = benchReady(c.team, 0.3, 0).sort((a, b) => b.energy - a.energy)[0];
      if (sub) {
        sub.subbing = true;
        const wait = [c.team === "R" ? 0.485 : 0.515, -0.03];
        mkScript(sub, [Tt + 2.6, sub.pos], [Tt + 2.6 + Math.max(0.8, mdist(sub.pos, wait) / 3), wait], [tOut, wait]);
        at(tOut, () => {
          // He is off the pitch: the man waiting at halfway comes on in his place. (The injured man keeps his
          // script: carried down the tunnel, or he hobbles to the bench, or off behind the near touchline.)
          const hurt = { name: c.name, num: c.num };
          swapPlaces(c, sub);
          if (serious) at(tEnd, () => { sub.off = true; });
          else if (!far) sub.exitTo = beyond;
          game.stats.subs++;
          setNote(`Thay người · ${TEAM_NAME[c.team]}: ${c.name} #${c.num} vào thay ${hurt.name} #${hurt.num}`);
        });
      } else {
        // Nobody left on the bench: a man short.
        c.sentOff = true;
        at(serious ? tEnd : tOut + 0.1, () => { c.off = true; game.dirty = true; setNote(`${TEAM_NAME[c.team]} hết người dự bị · đá thiếu người`); });
      }
      game.subsUntil = Math.max(game.subsUntil ?? 0, tOut + 0.5);
      return tOut + 0.4;
    }
    
    function halfTime() {
      game.half2 = true; game.mode = "halftime"; game.modeT = T; game.stoppage = true; game.dirty = true;
      game.carrier = null; game.counter = null; game.chain = null; game.press = { R: null, B: null };
      // Whoever had it lets it go: a pass or shot he was shaping to hit is never struck. A substitution under way
      // is completed on the spot.
      if (ball.mode === "carried" || ball.mode === "held") ball.mode = "dead";
      ball.owner = null;
      (game.pendingSubs ?? []).slice().forEach(finishSub);
      for (const p of people) if (!p.medic) { p.script = null; p.busyUntil = 0; }
      ref.keys.push([T, T + 1.2, "whistle"]); say(ref, "Hết hiệp 1!", "var(--color-card)", 1.4);
      at(T + 1.0, () => { ball.show = false; });
      setNote(`Hết hiệp 1 · Đỏ ${game.score.R}–${game.score.B} Xanh`);
    }
    
    function fullTime() {
      game.winner = game.score.R === game.score.B ? null : game.score.R > game.score.B ? "R" : "B";
      game.mode = "fulltime"; game.modeT = T; game.stoppage = true; game.carrier = null; game.counter = null; game.chain = null;
      if (ball.mode === "carried") ball.mode = "dead";
      // Nothing from open play carries on past the whistle: substitutions finish at once, arguments, actions and
      // shouts stop.
      (game.pendingSubs ?? []).slice().forEach(finishSub);
      for (const p of people) if (!p.medic && !p.bench) { p.script = null; p.keys = p.keys.filter(k => k[1] <= T); }
      game.blame = null; game.callouts = [];
      ref.keys.push([T, T + 1.2, "whistle"]); say(ref, "Hết giờ!", "var(--color-card)", 1.4);
      at(T + 1.2, () => { ball.show = false; });
      if (!game.winner) {
        game.mode = "draw";
        setNote(`Hết giờ · Hòa ${game.score.R}–${game.score.B}`);
        return;
      }
      setNote(`Hết giờ · ${TEAM_NAME[game.winner]} thắng ${game.score[game.winner]}–${game.score[otherTeam(game.winner)]}`);
      game.kickoffTeam = otherTeam(game.winner);
      // The beaten side, each in his own way: one or two crouch or sit for a moment (the keeper sits down in his
      // area), the others hands on hips or head in hands. Those who went down get up during the ceremony.
      const loser = otherTeam(game.winner), field = [...outfield(team[loser])].sort(() => rng() - 0.5);
      const reactions = [rng() < 0.5 ? "kneelSad" : "sitSad", "headHands", "hipsHands", rng() < 0.4 ? "kneelSad" : "hipsHands", "headHands"];
      field.forEach((p, k) => { p.endPose = reactions[k % reactions.length]; p.stayDown = p.endPose === "kneelSad" || p.endPose === "sitSad"; });
      if (on(GK[loser])) { GK[loser].endPose = "sitSad"; GK[loser].stayDown = true; }
      // Walking off before the trophy is rare: only after a late winner or a red card, and only one player, slowly.
      const lateWinner = game.lastGoalMinute >= FULL - 3, hadRed = game.reds[loser] > 0;
      if (Math.abs(game.score.R - game.score.B) === 1 && (lateWinner || hadRed) && rng() < 0.12 && field[1]) {
        const p = field[1], t0 = T + 1.0, dur = Math.max(4, mdist(p.pos, TUNNEL) / 1.6);
        p.sulking = true; game.stats.sulks++;
        mkScript(p, [t0, p.pos], [t0 + dur, TUNNEL]);
        p.keys.push([t0 - 0.5, t0, "waveOff"]);
        at(t0 - 0.45, () => sayFT(p, line("sulk"), "var(--color-card)", 1.2));
        at(t0 + dur + 0.05, () => { if (p.sulking) p.off = true; });
      }
    }
    
    /* ceremony: winners gather behind their captain, who lifts the cup; the others clap */
    const CEREMONY = 9.5, TROPHY_FROM = 2.2, TROPHY_IN = 3.1, TROPHY_OUT = 8.4;
    const WINNERS_AT = [0.49, 0.42];
    function ceremonySpot(p) {
      if (p === ref) return around(p, [0.72, 0.9], WINNERS_AT, 5);
      if (p.stayDown && T - game.modeT < 3) return p.pos;
      const win = p.team === game.winner, k = p.i;
      if (win) return k === 3 ? [0.49, 0.52] : [[0.44, 0.36], [0.455, 0.43], [0.52, 0.42], [0.535, 0.35], [0.49, 0.32]][k > 3 ? k - 1 : k];
      // The beaten side stays more or less where the final whistle found them; anyone within about ten metres
      // of the winners' group backs off to give them room (never through it).
      const C = [WINNERS_AT[0] * LEN, WINNERS_AT[1] * WID], P = [p.pos[0] * LEN, p.pos[1] * WID], d = Math.hypot(P[0] - C[0], P[1] - C[1]);
      if (d >= 10) return p.pos;
      const dir = d > 0.1 ? [(P[0] - C[0]) / d, (P[1] - C[1]) / d] : [0.6, 0.8];
      return inPitch([(C[0] + dir[0] * 10.5) / LEN, (C[1] + dir[1] * 10.5) / WID]);
    }
    function ceremonyPose(p, speed) {
      const s = T - game.modeT;
      if (speed > 1.2) return speed > 2.2 ? "run" : "walkSad";
      if (p.stayDown && s < 3) return p.endPose;
      if (p === ref) return (T * 2 + p.n * 0.3) % 1 < 0.5 ? "clapA" : "clapB";
      // The beaten side: from the moment the cup goes up, about half of them applaud (slowly); the rest stand
      // hands on hips or head down.
      if (p.team !== game.winner) {
        if (s > TROPHY_IN - 0.3 && p.i % 2 === 1) return (T * 1.4 + p.n * 0.3) % 1 < 0.5 ? "clapA" : "clapB";
        return p.i % 3 === 0 ? "slump" : "hipsHands";
      }
      if (p.i === 3 && s > TROPHY_IN - 0.2 && s < TROPHY_OUT) return s > 3.6 && s < TROPHY_IN + 2.5 && (s * 1.2) % 1 < 0.35 ? "trophyHop" : "trophyUp";
      // Winners: a few small hops when the cup goes up, otherwise arms up and applause.
      if (s > TROPHY_IN && s < TROPHY_IN + 2.5) return (T * 0.8 + p.i * 0.37) % 1 < 0.3 ? "cheerHop" : "cheer";
      return (T * 2 + p.i * 0.3) % 1 < 0.5 ? "clapA" : "clapB";
    }
    
    /** Which shape a side wants right now: sit and counter with a lead, throw everyone forward when chasing late. */
    function shapeFor(t) {
      const lead = game.score[t] - game.score[otherTeam(t)], mnt = minute(), n = team[t].filter(p => p.role !== "GK" && inSquad(p)).length;
      const chasingHard = lead < 0 && (mnt >= FULL - 10 || game.golden || (lead <= -2 && mnt >= 33));
      const protecting = lead >= 2 || (lead >= 1 && game.half2);
      // Down to three outfield players.
      if (n <= 3) return chasingHard ? "1-2" : protecting || lead >= 1 ? "2-1" : "1-1-1";
      // A man down: one fewer in midfield, and a shape that suits the score.
      if (n === 4) return chasingHard ? "1-1-2" : lead < 0 ? "1-2-1" : lead >= 1 ? "3-1" : "2-1-1";
      // Full strength.
      if (chasingHard) return "1-1-3";
      if (lead < 0 && mnt >= 33) return "1-2-2";
      if (protecting) return "3-1-1";
      return "2-1-2";
    }
    function updateShape() {
      // Narrative momentum belongs to either side and is disabled for human play.
      const next = game.story.goals[game.storyIdx];
      game.momentum = !interactive && next && minute() >= next[1] - 5 ? next[0] : null;
      if (game.mode !== "play" && game.mode !== "reset") return;
      for (const t of TEAMS) {
        const want = shapeFor(t);
        if (want === game.shape[t]) continue;
        // Teams change shape once in a while (about every 15 minutes at most), except when a red card forces it.
        const forced = SHAPES[want].size !== SHAPES[game.shape[t]].size;
        if (!forced && minute() - game.shapeAt[t] < 10) continue;
        game.shape[t] = want; game.shapeAt[t] = minute(); game.dirty = true; game.stats.shapeChanges++;
        const left = team[t].filter(inSquad).length;
        setNote(left < 6 ? `${TEAM_NAME[t]} còn ${left} người · ${want} · ${SHAPES[want].name}` : `${TEAM_NAME[t]} chuyển sang ${want} · ${SHAPES[want].name}`);
        const captain = on(team[t][3]) ? team[t][3] : GK[t];
        if (((game.mode === "play" && !game.stoppage) || SHAPES[want].size < 5) && on(captain)) say(captain, SHAPES[want].call, "var(--color-card)", 1.2);
      }
    }
    
    /**
     * Legs: every man on the pitch tires while the clock runs, faster when he is running hard (keepers barely);
     * after about 40 minutes without a rest an outfield player is spent. The bench gets its breath back.
     */
    function updateEnergy(dt) {
      const running = game.mode === "play" && !game.stoppage, dm = dt * PACE;
      for (const t of TEAMS) {
        if (running) for (const p of team[t]) {
          if (!on(p)) continue;
          const effort = Math.min(1, Math.hypot(...p.vel) / 6);
          p.energy = Math.max(0.05, p.energy - dm * (p.role === "GK" ? 0.003 : 0.009 + 0.016 * effort) / p.stamina);
          if (p.role !== "GK" && p.energy < 0.35 && !p.tiredSaid) {
            p.tiredSaid = true; game.stats.tired = (game.stats.tired ?? 0) + 1;
            if (game.carrier !== p) say(p, pick(["Mệt quá!", "Hết hơi rồi!", "Đuối quá!", "Chân nặng quá…"]), "var(--color-card)", 1.0);
          }
        }
        for (const b of bench[t]) if (!b.off && !b.injured) b.energy = Math.min(1, b.energy + dm * 0.045);
      }
    }
    
    /* ---------------------------------- the step ---------------------------------- */
    function step(dt) {
      T += dt;
      game.timers.sort((a, b) => a.t - b.t);
      while (game.timers.length && game.timers[0].t <= T) game.timers.shift().fn();
      // The clock only runs while the ball is in play (celebrations, restarts and rows are added on, like stoppage time).
      if (game.mode === "play" && !game.stoppage) {
        const before = Math.min(FULL + 1, minute()); game.clock += dt; if (Math.min(FULL + 1, minute()) !== before) game.dirty = true;
      }
      updateEnergy(dt);
      rollingSubs();
      updateModes();
      updateShape();
      updateControls();
      updatePress();
      if (game.mode === "play" && !game.stoppage && game.carrier && ball.owner === game.carrier && (ball.mode === "carried" || ball.mode === "held") && T >= game.carrier.busyUntil && !humanFor(game.carrier)) decide(game.carrier);
      for (const p of people) updatePerson(p, dt);
      updateBall(dt);
      updateCamera(dt);
    }
    
    /* ---------------------------------- camera ---------------------------------- */
    const PITCH_BOX = (() => { const c = [ground(0, 0), ground(1, 0), ground(0, 1), ground(1, 1)]; return { x0: Math.min(...c.map(p => p[0])), x1: Math.max(...c.map(p => p[0])), y0: Math.min(...c.map(p => p[1])), y1: Math.max(...c.map(p => p[1])) }; })();
    function updateCamera(dt) {
      const m = game.mode, bs = [ball.g[0], ball.g[1] - ball.h * K * 0.5];
      // Wide by default; it tightens for tricks, shots and goalmouth play, and pulls right out for kick-offs.
      let tx = bs[0], ty = bs[1], tz = 0.68;
      if (m === "play") {
        const lead = ATT[game.poss] * 75;
        tx += lead; ty += -lead * 0.3;
        const bu = ballUV()[0];
        if (T < game.skillUntil) { tz = 0.82; tx -= lead * 0.6; ty += lead * 0.18; }
        if (ball.kind === "shot" || bu < 0.18 || bu > 0.82) tz = 0.82;
        if (game.fight && T < game.fight.until) { [tx, ty] = add(ground(...game.fight.uv), [0, -30]); tz = 0.95; }
        // Free kick: frame the ball, the wall and the goal together.
        if (game.fk && T < game.fk.until && game.fk.direct) { [tx, ty] = add(lerp(ground(...game.fk.spot), ground(...game.fk.goal), 0.45), [0, -10]); tz = 0.88; }
      } else if (m === "celebrate") {
        tx = game.scorer.g[0]; ty = game.scorer.g[1] - 30; tz = T - game.modeT > 0.8 ? 1.08 : 0.9;
        // If the defence is arguing, widen to keep the scorer and the row in the same shot.
        const bl = game.blame;
        if (bl && T > bl.from && T < bl.until) {
          const mid = lerp(bl.a.g, bl.c.g, 0.5), span = Math.max(Math.abs(mid[0] - tx) * 0.9, Math.abs(mid[1] - ty) * 1.6);
          tx = (mid[0] + tx) / 2; ty = (mid[1] + ty) / 2 - 20; tz = clamp(560 / (span + 220), 0.62, 1.0);
        }
      }
      else if (m === "reset") {
        [tx, ty] = ground(0.5, 0.5); tz = 0.6;
        const bl = game.blame;
        if (bl && T < bl.until) { [tx, ty] = add(lerp(bl.a.g, bl.c.g, 0.5), [0, -30]); tz = 0.95; }
      }
      else if (m === "fulltime") tz = 0.78;
      else if (m === "ceremony") { [tx, ty] = add(ground(0.52, 0.48), [0, -12]); tz = T - game.modeT > 1.5 ? 1.12 : 0.8; }
      if ((m === "play" || m === "reset") && game.pendingSubs?.length) { const sp = ground(0.5, -0.02); ty = Math.min(ty, sp[1] + 40 / tz); }
      const kz = 1 - Math.exp(-dt * 1.4), kp = 1 - Math.exp(-dt * 2.4);
      cam.z += (tz - cam.z) * kz;
      const hw = VW / 2 / cam.z, hh = VH / 2 / cam.z;
      tx = clamp(tx, PITCH_BOX.x0 + hw - 60, PITCH_BOX.x1 - hw + 60);
      ty = clamp(ty, PITCH_BOX.y0 + hh - 150, PITCH_BOX.y1 - hh + 70);
      cam.x += (tx - cam.x) * kp; cam.y += (ty - cam.y) * kp;
    }
    
    /* ---------------------------------- drawing ---------------------------------- */
    const svg = root.querySelector('[data-id="scene"]');
    const L = id => svg.querySelector('[data-id="' + id.slice(1) + '"]');
    const layer = { world: L("#world"), ground: L("#ground"), crowd: L("#crowd"), pitch: L("#pitch"), shadows: L("#shadows"), dyn: L("#dyn"), wfx: L("#wfx"), sfx: L("#sfx") };
    function el(tag, attrs = {}, parent) {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }
    const set = (n, attrs) => { for (const k in attrs) n.setAttribute(k, attrs[k]); };
    const poly = pts => pts.map(pt).join(" ");
    const G = (u, v) => ground(u, v);
    const seg = (...pts) => "M" + pts.map(pt).join(" L");
    
    /* stands, crowd and boards along the far touchline */
    const crowd = [];
    function drawStadium() {
      const g = layer.ground;
      el("polygon", { points: poly([G(-0.6, -0.12), G(1.6, -0.12), G(1.6, 2.2), G(-0.6, 2.2)]), fill: "var(--art-surround-deep)", stroke: "none" }, g);
      const ROWS = 4, rise = r => 8 + r * 15, vOf = r => -0.13 - r * 0.045;
      const up = (p, h) => [p[0], p[1] - h];
      el("polygon", { points: poly([up(G(-0.12, vOf(ROWS)), rise(ROWS) + 40), up(G(1.12, vOf(ROWS)), rise(ROWS) + 40), up(G(1.12, vOf(ROWS)), rise(ROWS - 1)), up(G(-0.12, vOf(ROWS)), rise(ROWS - 1))]),
        fill: "var(--art-stand-deep)", "stroke-width": 2.5 }, g);
      const SHIRTS = ["var(--art-red)", "var(--art-blue)", "var(--art-red)", "var(--color-sun)", "var(--art-blue)", "var(--art-red)", "var(--color-card)"];
      for (let r = ROWS - 1; r >= 0; r--) {
        const v0 = vOf(r), v1 = vOf(r + 1), hTop = rise(r), hLow = r ? rise(r - 1) : 0;
        el("polygon", { points: poly([up(G(-0.12, v0), hTop), up(G(1.12, v0), hTop), up(G(1.12, v1), hTop), up(G(-0.12, v1), hTop)]), fill: "var(--art-stand)", "stroke-width": 2 }, layer.crowd);
        const fans = el("g", {}, layer.crowd);
        for (let i = 0; i < 44; i++) {
          const u = -0.1 + (i + (r % 2) * 0.5) * (1.2 / 44), base = up(G(u, (v0 + v1) / 2), hTop);
          const shirt = SHIRTS[(i * 5 + r * 3) % SHIRTS.length];
          const fan = el("g", { transform: `translate(${pt(base)})` }, fans);
          el("path", { d: "M-6 0 Q-6 -9 0 -9 Q6 -9 6 0 Z", fill: shirt, "stroke-width": 1.6 }, fan);
          el("circle", { cy: -13, r: 4.6, fill: (i + r) % 3 ? "var(--art-skin)" : "var(--art-skin-2)", "stroke-width": 1.6 }, fan);
          crowd.push({ node: fan, base, team: shirt.includes("red") ? "R" : shirt.includes("blue") ? "B" : null, k: i * 0.37 + r * 1.3 });
        }
        el("polygon", { points: poly([up(G(-0.12, v0), hLow), up(G(1.12, v0), hLow), up(G(1.12, v0), hTop), up(G(-0.12, v0), hTop)]), fill: "var(--art-stand-deep)", "stroke-width": 2 }, layer.crowd);
      }
      // The players' tunnel, under the stand between two advertising boards.
      el("polygon", { points: poly([up(G(0.296, -0.13), 0), up(G(0.344, -0.13), 0), up(G(0.344, -0.13), 22), up(G(0.296, -0.13), 22)]), fill: "var(--color-ink)", "stroke-width": 2 }, layer.crowd);
      // Advertising boards: text sheared along the touchline.
      const dir = mul(A, 1 / Math.hypot(...A)), boardV = -0.085;
      for (const [u0, u1, text] of [[-0.04, 0.3, "PTSC CUP 2026"], [0.34, 0.66, "ĐẶT SÂN ONLINE"], [0.7, 1.04, "PTSC CUP 2026"]]) {
        const a = G(u0, boardV), b = G(u1, boardV);
        el("polygon", { points: poly([a, b, up(b, 15), up(a, 15)]), fill: "var(--color-card)", "stroke-width": 2 }, layer.crowd);
        const mid = up(G((u0 + u1) / 2, boardV), 4);
        el("text", { transform: `matrix(${dir[0].toFixed(4)} ${dir[1].toFixed(4)} 0 1 ${mid[0].toFixed(1)} ${mid[1].toFixed(1)})`, "text-anchor": "middle", fill: "var(--color-ink)", stroke: "none",
          "font-family": "var(--font-mono)", "font-size": 10, "font-weight": 700, "letter-spacing": 1 }, layer.crowd).textContent = text;
      }
    }
    /** 6-a-side markings: halfway line, a big centre circle and a semicircular penalty area at each end. */
    function drawPitch() {
      const g = layer.pitch;
      const sur = [G(-0.07, -0.07), G(1.07, -0.07), G(1.07, 1.1), G(-0.07, 1.1)];
      el("polygon", { points: poly(sur.map(p => [p[0], p[1] + 10])), fill: "var(--color-ink)", "stroke-width": 3 }, g);
      el("polygon", { points: poly(sur), fill: "var(--art-surround)", "stroke-width": 3 }, g);
      for (let i = 0; i < 10; i++) el("polygon", { points: poly([G(i / 10, 0), G((i + 1) / 10, 0), G((i + 1) / 10, 1), G(i / 10, 1)]), fill: i % 2 ? "var(--art-grass-2)" : "var(--art-grass)", stroke: "none" }, g);
      const W = { stroke: "var(--color-card)", "stroke-width": 2.8, fill: "none" };
      el("polygon", { points: poly([G(0, 0), G(1, 0), G(1, 1), G(0, 1)]), ...W, "stroke-width": 3.2 }, g);
      el("path", { d: seg(G(0.5, 0), G(0.5, 1)), ...W }, g);
      const ring = (cu, cv, rm, a0 = 0, a1 = Math.PI * 2, du = 1) => {
        const out = [];
        for (let i = 0; i <= 56; i++) { const a = a0 + (a1 - a0) * i / 56; out.push(G(cu + du * rm / LEN * Math.cos(a), cv + rm / WID * Math.sin(a))); }
        return poly(out);
      };
      el("polyline", { points: ring(0.5, 0.5, 7), ...W }, g);
      const dot = (u, v, r = 3) => { const c = G(u, v); el("ellipse", { cx: c[0], cy: c[1], rx: r, ry: r * 0.6, fill: "var(--color-card)", stroke: "none" }, g); };
      dot(0.5, 0.5);
      for (const e of [0, 1]) {
        el("polyline", { points: ring(e, 0.5, 9.5, -Math.PI / 2, Math.PI / 2, e ? -1 : 1), ...W }, g);
        dot(e + (e ? -1 : 1) * 6 / LEN, 0.5, 2.6);
      }
      // The two benches, either side of the halfway line on the far touchline.
      const seatH = (SH + 3.5) * S, up = (pnt, h) => [pnt[0], pnt[1] - h];
      for (const [u0, u1] of [[0.36, 0.466], [0.538, 0.644]]) {
        const vb = -0.052, vf = -0.04;
        el("polygon", { points: poly([up(G(u0, vb), seatH + 14), up(G(u1, vb), seatH + 14), up(G(u1, vb), 0), up(G(u0, vb), 0)]), fill: "var(--art-stand-deep)", "stroke-width": 2 }, g);
        el("polygon", { points: poly([up(G(u0, vb), seatH), up(G(u1, vb), seatH), up(G(u1, vf), seatH), up(G(u0, vf), seatH)]), fill: "var(--art-stand)", "stroke-width": 2 }, g);
        el("polygon", { points: poly([up(G(u0, vf), seatH), up(G(u1, vf), seatH), G(u1, vf), G(u0, vf)]), fill: "var(--art-stand-deep)", "stroke-width": 2 }, g);
      }
    }
    
    /* goals: net box and mouth are separate depth-sorted items */
    function goalShape(end, bulge) {
      const dir = end ? 1 : -1, back = end + dir * GOAL_DEPTH, n = Math.hypot(...A), shift = [A[0] / n * dir * bulge, A[1] / n * dir * bulge];
      const up = (p, h) => [p[0], p[1] - h * K];
      const m = (v, h) => up(G(end, v), h), bk = (v, h, s = 0) => add(up(G(back, v), h), mul(shift, s));
      const [vl, vr] = GOAL_V, H = GOAL_H, Hb = GOAL_H * 0.8;
      return {
        back: [bk(vl, 0, 0.6), bk(vr, 0, 0.6), bk(vr, Hb, 0.8), bk((vl + vr) / 2, Hb * 0.55, 1.2), bk(vl, Hb, 0.8)],
        sideL: [m(vl, 0), bk(vl, 0, 0.6), bk(vl, Hb, 0.8), m(vl, H)], sideR: [m(vr, 0), bk(vr, 0, 0.6), bk(vr, Hb, 0.8), m(vr, H)],
        top: [m(vl, H), m(vr, H), bk(vr, Hb, 0.8), bk(vl, Hb, 0.8)], mouth: [m(vl, 0), m(vl, H), m(vr, H), m(vr, 0)],
        keyBox: G(back, 0.5)[1], keyMouth: G(end, 0.5)[1],
      };
    }
    const goals = [0, 1].map(end => {
      const box = el("g", {}), mouth = el("g", {}), parts = {};
      for (const k of ["back", "sideL", "sideR", "top"]) {
        parts[k] = el("polygon", { fill: "url(#" + UID + "-net)", stroke: "var(--color-card)", "stroke-width": 1.4, opacity: 0.95 }, box);
        parts[k + "Tint"] = el("polygon", { fill: "var(--color-card)", "fill-opacity": 0.14, stroke: "none" }, box);
      }
      parts.mouthInk = el("polyline", { "stroke-width": 7 }, mouth);
      parts.mouth = el("polyline", { stroke: "var(--color-card)", "stroke-width": 4 }, mouth);
      return { end, box, mouth, parts, bulge: -1, keyBox: 0, keyMouth: 0 };
    });
    function drawGoal(g, bulge) {
      if (Math.abs(bulge - g.bulge) < 0.05) return;
      g.bulge = bulge;
      const s = goalShape(g.end, bulge);
      for (const k of ["back", "sideL", "sideR", "top"]) { g.parts[k].setAttribute("points", poly(s[k])); g.parts[k + "Tint"].setAttribute("points", poly(s[k])); }
      g.parts.mouthInk.setAttribute("points", poly(s.mouth)); g.parts.mouth.setAttribute("points", poly(s.mouth));
      g.keyBox = s.keyBox; g.keyMouth = s.keyMouth;
    }
    const flags = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => {
      const p = G(u, v), f = el("g", { transform: `translate(${pt(p)})` });
      el("path", { d: "M0 0 V-30", "stroke-width": 2 }, f);
      el("path", { d: "M0 -30 L12 -26 L0 -21 Z", fill: "var(--color-sun)", "stroke-width": 1.6 }, f);
      return { node: f, key: p[1] };
    });
    
    /* people: all men, each with his own haircut */
    const EYES = `<circle cx="1" cy="2" r="1.8" fill="var(--color-ink)" stroke="none" /><circle cx="9" cy="2" r="1.8" fill="var(--color-ink)" stroke="none" />`;
    const BROWS = `<path d="M-1 -3 H4 M7 -3 H11" stroke-width="1.6" />`;
    const HEADS = {
      glasses: `<circle r="15" fill="SKIN" stroke-width="2.5" />
        <path d="M-16 -2 Q-16 -18 0 -18 Q16 -18 16 -4 Q8 -12 -4 -8 Q-10 -12 -16 -2 Z" fill="var(--art-hair)" stroke-width="2" />
        <circle cx="0" cy="2" r="4.5" fill="var(--color-card)" stroke-width="1.8" /><circle cx="11" cy="2" r="4.5" fill="var(--color-card)" stroke-width="1.8" />
        <path d="M4.5 2 H6.5" stroke-width="1.8" /><path data-mouth="" stroke-width="1.8" transform="translate(0 2)" />`,
      buzz: `<circle r="14.5" fill="SKIN" stroke-width="2.5" />
        <path d="M-15 -2 Q-15 -16 0 -16 Q15 -16 15 -6 Q4 -10 -15 -2 Z" fill="var(--art-hair)" stroke-width="2" />
        BROWS EYES<path data-mouth="" stroke-width="1.7" />`,
      curly: `<circle r="14.5" fill="SKIN" stroke-width="2.5" />
        <g fill="var(--art-hair)" stroke-width="1.8"><circle cx="-12" cy="-6" r="6" /><circle cx="-7" cy="-13" r="6" /><circle cx="1" cy="-15" r="6" /><circle cx="9" cy="-12" r="5.5" /><circle cx="-14" cy="2" r="4.5" /></g>
        EYES<path data-mouth="" stroke-width="1.7" />`,
      spiky: `<circle r="14.5" fill="SKIN" stroke-width="2.5" />
        <path d="M-15 -1 L-17 -10 L-10 -11 L-10 -19 L-3 -14 L1 -21 L5 -14 L11 -18 L11 -10 L16 -8 Q8 -9 -4 -7 Q-11 -6 -15 -1 Z" fill="var(--art-hair)" stroke-width="2" />
        EYES<path data-mouth="" stroke-width="1.7" />`,
      sidepart: `<circle r="14.5" fill="SKIN" stroke-width="2.5" />
        <path d="M-15 0 Q-17 -17 2 -17 Q16 -16 15 -4 Q10 -11 -2 -11 Q-9 -10 -15 0 Z" fill="var(--art-hair-brown)" stroke-width="2" />
        <path d="M-3 -16 Q2 -12 10 -12" stroke-width="1.4" opacity=".6" />EYES<path data-mouth="" stroke-width="1.7" />`,
      quiff: `<circle r="14.5" fill="SKIN" stroke-width="2.5" />
        <path d="M-15 -1 Q-17 -14 -6 -17 Q2 -25 14 -19 Q18 -15 15 -7 Q8 -11 -3 -9 Q-10 -8 -15 -1 Z" fill="var(--art-hair)" stroke-width="2" />
        BROWS EYES<path data-mouth="" stroke-width="1.7" />`,
      beard: `<circle r="14.5" fill="SKIN" stroke-width="2.5" />
        <path d="M-15 -1 Q-16 -16 0 -16 Q15 -16 15 -5 Q5 -10 -4 -8 Q-11 -7 -15 -1 Z" fill="var(--art-hair-brown)" stroke-width="2" />
        <path d="M-12 4 Q-11 15 1 16 Q11 15 13 6 Q8 11 5 10 Q1 8 -2 10 Q-7 10 -12 4 Z" fill="var(--art-hair-brown)" stroke-width="1.8" />
        EYES<path data-mouth="" stroke-width="1.6" stroke="var(--color-card)" />`,
      ref: `<circle r="14" fill="SKIN" stroke-width="2.5" />
        <path d="M-15 -1 Q-15 -16 0 -16 Q14 -16 14 -6 L-6 -6 Q-10 -6 -15 -1 Z" fill="var(--art-hair)" stroke-width="2" />
        <circle cx="3" cy="1" r="1.8" fill="var(--color-ink)" stroke="none" /><circle cx="10" cy="1" r="1.8" fill="var(--color-ink)" stroke="none" />
        <path d="M1 6 Q6 4 12 6 Q8 9 6 7 Q4 9 1 6 Z" fill="var(--art-hair)" stroke-width="1.2" />
        <path data-mouth="" stroke-width="1.6" transform="translate(1 2)" />
        <g data-whistle="" opacity="0"><rect x="9" y="6" width="8" height="5" rx="2" fill="var(--art-gold)" stroke-width="1.5" /></g>`,
    };
    function makeSprite(p) {
      const kit = p === ref ? { shirt: "var(--art-ref)", shorts: "var(--art-shorts)", socks: "var(--art-shorts)" }
        : p.medic ? { shirt: "var(--color-card)", shorts: "var(--art-shorts)", socks: "var(--color-card)" }
        : { shirt: p.role === "GK" ? KIT[p.team].gk : KIT[p.team].shirt, shorts: KIT[p.team].shorts, socks: KIT[p.team].socks };
      const skin = p.skin === 2 ? "var(--art-skin-2)" : "var(--art-skin)";
      const root = el("g", {}), shadow = el("ellipse", { rx: 15, ry: 4.5, fill: "var(--art-shadow)", stroke: "none", opacity: 0.22 }, layer.shadows);
      const q = {};
      q.armBInk = el("path", { "stroke-width": 8 }, root); q.armB = el("path", { stroke: skin, "stroke-width": 4.6 }, root);
      for (const s of ["B", "F"]) {
        q["leg" + s + "Ink"] = el("path", { "stroke-width": 9 }, root);
        q["thigh" + s] = el("path", { stroke: skin, "stroke-width": 5.5 }, root);
        q["sock" + s] = el("path", { stroke: kit.socks, "stroke-width": 5.5 }, root);
        q["boot" + s] = el("ellipse", { rx: 7, ry: 3.6, fill: "var(--art-shorts)", "stroke-width": 1.8 }, root);
      }
      q.shortsInk = el("path", { "stroke-width": 23 }, root); q.shorts = el("path", { stroke: kit.shorts, "stroke-width": 18.5 }, root);
      q.torsoInk = el("path", { "stroke-width": 26 }, root); q.torso = el("path", { stroke: kit.shirt, "stroke-width": 21.5 }, root);
      // The referee's shirt has a black band across the chest, so he never reads as a player.
      if (p === ref) q.band = el("path", { stroke: "var(--color-ink)", "stroke-width": 21.5, "stroke-linecap": "butt" }, root);
      if (p.num != null) {
        q.num = el("text", { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": p.medic ? 17 : 11, "font-weight": 700, fill: p.medic ? "var(--art-red)" : p.role === "GK" ? "var(--color-ink)" : "var(--color-card)", stroke: "none" }, root);
        q.num.textContent = p.num;
      }
      q.head = el("g", {}, root); q.head.innerHTML = HEADS[p.head].replaceAll("SKIN", skin).replace("BROWS", BROWS).replace("EYES", EYES);
      q.mouth = q.head.querySelector("[data-mouth]"); q.whistle = q.head.querySelector("[data-whistle]");
      q.armFInk = el("path", { "stroke-width": 8 }, root); q.armF = el("path", { stroke: skin, "stroke-width": 4.6 }, root);
      if (p.role === "GK") { q.gloveF = el("circle", { r: 4, fill: "var(--color-card)", "stroke-width": 1.8 }, root); q.gloveB = el("circle", { r: 4, fill: "var(--color-card)", "stroke-width": 1.8 }); root.insertBefore(q.gloveB, q.armB.nextSibling); }
      if (p === ref) { q.card = el("g", { opacity: 0 }, root); q.cardRect = el("rect", { x: -4.5, y: -15, width: 9, height: 13, rx: 1.5, fill: "var(--art-card-yellow)", "stroke-width": 1.8 }, q.card); }
      p.sprite = { root, shadow, q };
    }
    people.forEach(makeSprite);
    /** Redraws the parts of a figure that belong to the man, not the slot: skin, head and hair, shirt number. */
    function restyle(p) {
      const q = p.sprite.q, skin = p.skin === 2 ? "var(--art-skin-2)" : "var(--art-skin)";
      for (const k of ["thighF", "thighB", "armF", "armB"]) set(q[k], { stroke: skin });
      q.head.innerHTML = HEADS[p.head].replaceAll("SKIN", skin).replace("BROWS", BROWS).replace("EYES", EYES);
      q.mouth = q.head.querySelector("[data-mouth]"); q.whistle = q.head.querySelector("[data-whistle]");
      if (q.num) q.num.textContent = p.num;
    }
    pickSquads();
    
    function drawPerson(p) {
      const { q, root, shadow } = p.sprite, r = rig(p.pose), name = p.poseName;
      root.style.display = p.off ? "none" : ""; if (p.off) { set(shadow, { opacity: 0 }); return; }
      // Never draw a body thinner than a third of its width mid-turn.
      const sx = (Math.sign(p.face) || 1) * Math.max(0.6, Math.abs(p.face));
      set(root, { transform: `translate(${pt(p.g)}) scale(${(S * sx).toFixed(3)} ${S})` });
      const lying = Math.abs(r.rot) > 40;
      set(shadow, { cx: p.g[0].toFixed(1), cy: p.g[1].toFixed(1), rx: ((lying ? 30 : 15) * S - p.pose.j * 0.2).toFixed(1), ry: (4.5 * S + 1).toFixed(1), opacity: (0.24 - p.pose.j * 0.005).toFixed(3) });
      for (const s of ["F", "B"]) {
        const knee = r["knee" + s], foot = r["foot" + s];
        set(q["leg" + s + "Ink"], { d: seg(r.hip, knee, foot) });
        set(q["thigh" + s], { d: seg(r.hip, knee) });
        set(q["sock" + s], { d: seg(lerp(knee, foot, 0.3), foot) });
        const shin = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]) * 180 / Math.PI - 90;
        set(q["boot" + s], { cx: (foot[0] + 2).toFixed(1), cy: foot[1].toFixed(1), transform: `rotate(${shin.toFixed(0)} ${pt(foot)})` });
      }
      set(q.shortsInk, { d: seg(r.hip, r.waist) }); set(q.shorts, { d: seg(r.hip, r.waist) });
      set(q.torsoInk, { d: seg(r.waist, r.top) }); set(q.torso, { d: seg(r.waist, r.top) });
      if (q.band) set(q.band, { d: seg(lerp(r.waist, r.top, 0.55), lerp(r.waist, r.top, 0.78)) });
      if (q.num) {
        // The number reads the right way round whichever way he faces.
        const mid = lerp(r.waist, r.top, 0.55);
        set(q.num, { transform: `translate(${pt(mid)}) rotate(${(r.lean + r.rot).toFixed(0)}) scale(${sx < 0 ? -1 : 1} 1) translate(0 4)` });
      }
      set(q.armBInk, { d: seg(r.top, r.elbowB, r.handB) }); set(q.armB, { d: seg(r.top, r.elbowB, r.handB) });
      set(q.armFInk, { d: seg(r.top, r.elbowF, r.handF) }); set(q.armF, { d: seg(r.top, r.elbowF, r.handF) });
      if (q.gloveF) { set(q.gloveF, { cx: r.handF[0].toFixed(1), cy: r.handF[1].toFixed(1) }); set(q.gloveB, { cx: r.handB[0].toFixed(1), cy: r.handB[1].toFixed(1) }); }
      set(q.head, { transform: `translate(${pt(r.head)}) rotate(${(r.lean * 0.4 + r.rot).toFixed(1)})` });
      const mouth = MOUTH[name];
      set(q.mouth, { d: mouth ?? SMILE, fill: mouth?.endsWith("Z") ? "var(--color-card)" : "none" });
      if (q.whistle) set(q.whistle, { opacity: name === "whistle" ? 1 : 0 });
      if (q.card) {
        set(q.card, { opacity: name === "card" || name === "cardRed" ? 1 : 0, transform: `translate(${pt(r.handF)})` });
        set(q.cardRect, { fill: name === "cardRed" ? "var(--art-card-red)" : "var(--art-card-yellow)" });
      }
    }
    
    /* ball, effects, callout */
    const ballShadow = el("ellipse", { rx: 5, ry: 2, fill: "var(--art-shadow)", stroke: "none", opacity: 0 }, layer.shadows);
    const ballNode = el("g", { opacity: 0 });
    el("circle", { r: 5.6, fill: "var(--color-card)", stroke: "none" }, ballNode);
    const ballSpin = el("g", { "clip-path": "url(#" + UID + "-ball-clip)" }, ballNode);
    el("path", { d: "M0 -2.4 L2.3 -0.7 L1.4 1.9 L-1.4 1.9 L-2.3 -0.7 Z", fill: "var(--color-ink)", stroke: "none" }, ballSpin);
    for (let i = 0; i < 5; i++) {
      const a = -90 + i * 72;
      el("path", { d: "M-1.8 -1.3 L0 -2.6 L1.8 -1.3 L1.2 0.9 L-1.2 0.9 Z", transform: `rotate(${a}) translate(0 -5.8)`, fill: "var(--color-ink)", stroke: "none" }, ballSpin);
      el("path", { d: "M0 0 L0 -3.6", transform: `rotate(${a}) translate(0 -1.6)`, stroke: "var(--color-ink)", "stroke-width": 0.8 }, ballSpin);
    }
    el("circle", { r: 5.6, "stroke-width": 1.7, fill: "none" }, ballNode);
    const trail = [0, 1, 2, 3].map(i => el("circle", { r: 5 - i * 0.8, fill: "var(--color-card)", stroke: "none", opacity: 0 }, layer.wfx));
    const trailPts = [];
    const postBurst = el("g", { opacity: 0, stroke: "var(--art-gold)", "stroke-width": 2.5 }, layer.wfx);
    el("path", { d: "M-6 -6 L-12 -12 M6 -6 L12 -12 M8 2 L15 3 M-8 2 L-15 3 M0 -8 V-15" }, postBurst);
    const trophy = el("g", { opacity: 0 }, layer.wfx);
    trophy.innerHTML = `<path d="M-9 -30 H9 Q9 -14 0 -12 Q-9 -14 -9 -30 Z" fill="var(--art-gold)" stroke-width="2.2" />
      <path d="M-9 -27 Q-17 -27 -14 -20 Q-12 -16 -7 -16 M9 -27 Q17 -27 14 -20 Q12 -16 7 -16" stroke-width="2.2" />
      <rect x="-2.5" y="-12" width="5" height="7" fill="var(--art-gold-deep)" stroke-width="1.8" />
      <rect x="-8" y="-5" width="16" height="5" rx="1.5" fill="var(--art-gold-deep)" stroke-width="2" />
      <circle cx="0" cy="-23" r="3.2" fill="var(--color-card)" stroke-width="1.4" />`;
    const LABELS = [0, 1, 2].map(() => {
      const g = el("g", { opacity: 0 }, layer.sfx);
      return { g, box: el("rect", { y: -13, height: 26, rx: 13, fill: "var(--color-card)", "stroke-width": 2.5 }, g),
        text: el("text", { y: 5, "text-anchor": "middle", fill: "var(--color-ink)", stroke: "none", "font-family": "var(--font-display)", "font-size": 13, "font-weight": 800 }, g) };
    });
    const confetti = Array.from({ length: 40 }, (_, i) => el("rect", { x: -3, y: -1.6, width: 6, height: 3.2, rx: 0.8, stroke: "none", opacity: 0,
      fill: ["var(--art-gold)", "var(--art-red)", "var(--color-card)", "var(--color-coral)", "var(--art-red)", "var(--color-pear)"][i % 6] }, layer.sfx));
    const banner = el("g", { opacity: 0 }, layer.sfx);
    el("rect", { x: -96, y: -19, width: 192, height: 38, rx: 19, fill: "var(--art-gold)", "stroke-width": 2.5 }, banner);
    const bannerText = el("text", { y: 6, "text-anchor": "middle", fill: "var(--color-ink)", stroke: "none", "font-family": "var(--font-display)", "font-size": 17, "font-weight": 800 }, banner);
    
    const stretcher = el("g", { opacity: 0 });
    const stretcherPole = el("path", { "stroke-width": 7, "stroke-linecap": "round" }, stretcher);
    const stretcherCloth = el("path", { stroke: "var(--color-card)", "stroke-width": 4, "stroke-linecap": "round" }, stretcher);
    const handAt = p => { const r = rig(p.pose); return [p.g[0] + r.handF[0] * S * p.face, p.g[1] + r.handF[1] * S]; };
    function drawStretcher() {
      const [a, b] = medics, carrying = a.poseName === "carryLow" && b.poseName === "carryLow" && !a.off && !b.off;
      set(stretcher, { opacity: carrying ? 1 : 0 });
      if (!carrying) return;
      const d = seg(handAt(a), handAt(b));
      set(stretcherPole, { d }); set(stretcherCloth, { d });
    }
    
    /** World → screen through the camera. */
    const toScreen = w => [(w[0] - cam.x) * cam.z + VW / 2, (w[1] - cam.y) * cam.z + VH / 2];
    
    let lastOrder = "";
    function sortDepth(items) {
      items.sort((a, b) => a.key - b.key);
      const order = items.map(i => i.id).join();
      if (order === lastOrder) return;
      lastOrder = order;
      for (const i of items) layer.dyn.appendChild(i.node);
    }
    
    function render() {
      const shake = T - game.shake < 0.5 ? Math.sin(T * 70) * 3 * (1 - (T - game.shake) / 0.5) : 0;
      set(layer.world, { transform: `translate(${(VW / 2 + shake).toFixed(1)} ${(VH / 2).toFixed(1)}) scale(${cam.z.toFixed(4)}) translate(${(-cam.x).toFixed(1)} ${(-cam.y).toFixed(1)})` });
      for (const p of people) drawPerson(p);
      controlMarkers.forEach(({ h, ring, label, arrow }) => {
        const p = h.selected, visible = !!p && on(p) && ["play", "reset"].includes(game.mode);
        set(ring, { cx: p?.g[0] ?? 0, cy: (p?.g[1] ?? 0) + 2, opacity: visible ? 1 : 0 });
        set(label, { x: p?.g[0] ?? 0, y: (p?.g[1] ?? 0) - 53, opacity: visible ? 1 : 0 });
        const direction = aimFor(h, p).world;
        const project = metres => p ? ground(p.pos[0] + direction[0] * metres, p.pos[1] + direction[1] * metres) : [0, 0];
        const start = project(0.7), tip = project(2.8), neck = project(2.1);
        const dx = tip[0] - neck[0], dy = tip[1] - neck[1], length = Math.hypot(dx, dy) || 1;
        const left = [neck[0] - dy / length * 5.5, neck[1] + dx / length * 5.5];
        const right = [neck[0] + dy / length * 5.5, neck[1] - dx / length * 5.5];
        set(arrow, { d: `M${pt(start)} L${pt(tip)} M${pt(left)} L${pt(tip)} L${pt(right)}`, opacity: visible ? 0.95 : 0, "data-direction": aimFor(h, p).screen.join(",") });
      });
      // Ball, shadow and the streak behind a hard shot.
      const bs = [ball.g[0], ball.g[1] - ball.h * K];
      set(ballNode, { transform: `translate(${pt(bs)})`, opacity: ball.alpha.toFixed(2) });
      set(ballSpin, { transform: `rotate(${(ball.spin % 360).toFixed(0)})` });
      set(ballShadow, { cx: ball.g[0].toFixed(1), cy: (ball.g[1] + 1).toFixed(1), rx: Math.max(2.5, 5.5 - ball.h * 1.1).toFixed(1), opacity: (ball.alpha * Math.max(0.1, 0.36 - ball.h * 0.07)).toFixed(2) });
      trailPts.unshift(bs); trailPts.length = Math.min(trailPts.length, 8);
      const fast = ball.mode === "fly" && (ball.kind === "shot" || ball.seg?.arc < 0.2);
      trail.forEach((n, i) => { const tp = trailPts[i * 2 + 1] ?? bs; set(n, { transform: `translate(${pt(tp)})`, opacity: fast ? (0.5 - i * 0.11).toFixed(2) : 0 }); });
      if (game.post && T - game.post.t < 0.35) { const f = (T - game.post.t) / 0.35; set(postBurst, { transform: `translate(${pt(game.post.at)}) scale(${(0.7 + f * 0.8).toFixed(2)})`, opacity: (1 - f).toFixed(2) }); }
      else set(postBurst, { opacity: 0 });
      for (const g of goals) {
        let b = 0;
        if (game.net && game.net.end === g.end) { const s = T - game.net.t; b = s < 1.3 && s > 0 ? 10 * Math.exp(-s * 3) * Math.cos(s * 14) * (s < 0.12 ? s / 0.12 : 1) : 0; }
        drawGoal(g, Math.max(0, b));
      }
      // Crowd: a gentle sway, a jump when their team scores or lifts the cup.
      const cheerAge = T - game.crowdCheer;
      for (const f of crowd) {
        const wild = cheerAge < 2.5 || game.mode === "ceremony", mine = f.team === null || f.team === game.cheerTeam;
        const bob = wild && mine ? Math.abs(Math.sin(T * 7 + f.k * 5)) * (game.mode === "ceremony" ? 6 : 4) : wild ? 1 : Math.max(0, Math.sin(T * 2 + f.k * 3)) * 1.2;
        f.node.setAttribute("transform", `translate(${f.base[0].toFixed(1)},${(f.base[1] - bob).toFixed(1)})`);
      }
      drawCeremonyFx();
      drawCallout();
      drawStretcher();
      sortDepth([
        ...people.map(p => ({ id: p.id, node: p.sprite.root, key: p.g[1] + (p.poseName === "onStretcher" ? 0.02 : 0) })),
        { id: "stretcher", node: stretcher, key: (medics[0].g[1] + medics[1].g[1]) / 2 + 0.01 },
        { id: "ball", node: ballNode, key: ball.g[1] + 0.5 },
        ...goals.flatMap(g => [{ id: `box${g.end}`, node: g.box, key: g.keyBox }, { id: `mouth${g.end}`, node: g.mouth, key: g.keyMouth }]),
        ...flags.map((f, i) => ({ id: `flag${i}`, node: f.node, key: f.key })),
      ]);
      if (game.dirty) drawBoard();
    }
    
    function drawCallout() {
      const live = game.callouts.filter(c => T - c.t >= 0 && T - c.t < c.life && (c.who === "ball" || !c.who.off)).sort((a, b) => a.t - b.t);
      const placed = [];
      LABELS.forEach((L, i) => {
        const c = live[i];
        if (!c) { set(L.g, { opacity: 0 }); return; }
        const carding = c.who === ref && (ref.poseName === "card" || ref.poseName === "cardRed");
        const since = T - c.t, world = c.who === "ball" ? c.at : add(c.who.g, [0, -(98 * S) - 14 - (carding ? 34 : 0)]);
        let [x, y] = toScreen(world);
        const pop = since < 0.12 ? 0.6 + since / 0.12 * 0.5 : since < 0.2 ? 1.1 - (since - 0.12) / 0.08 * 0.1 : 1;
        if (L.text.textContent !== c.text) L.text.textContent = c.text;
        const w = c.text.length * 7.6 + 24;
        x = clamp(x, w / 2 + 10, VW - w / 2 - 10); y = clamp(y, y < 90 && x < 330 ? 104 : 26, VH - 20);
        // Stack bubbles that would overlap.
        for (let k = 0; k < 3; k++) {
          const hit = placed.find(b => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.y - y) < 30);
          if (!hit) break;
          y = hit.y - 31 < 26 ? hit.y + 31 : hit.y - 31;
        }
        placed.push({ x, y, w });
        set(L.box, { width: w.toFixed(0), x: (-w / 2).toFixed(0), fill: c.fill });
        set(L.g, { transform: `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${pop.toFixed(2)})`, opacity: since > c.life - 0.2 ? Math.max(0, (c.life - since) / 0.2).toFixed(2) : 1 });
      });
    }
    
    function drawCeremonyFx() {
      const on = game.mode === "ceremony", s = T - game.modeT;
      if (on && s >= TROPHY_FROM && s < TROPHY_OUT + 0.3) {
        const cap = team[game.winner][3], drop = 1 - Math.pow(1 - Math.min(1, (s - TROPHY_FROM) / (TROPHY_IN - TROPHY_FROM)), 3);
        const r = rig(cap.pose), hands = lerp(r.handF, r.handB, 0.5), hs = [cap.g[0] + hands[0] * S * cap.face, cap.g[1] + hands[1] * S];
        set(trophy, { transform: `translate(${pt([hs[0], hs[1] - 2 - (1 - drop) * 260])})`, opacity: s > TROPHY_OUT ? Math.max(0, 1 - (s - TROPHY_OUT) / 0.3).toFixed(2) : 1 });
      } else set(trophy, { opacity: 0 });
      const bo = !on ? 0 : s < 1 ? 0 : s < 1.3 ? (s - 1) / 0.3 : s > CEREMONY - 0.5 ? Math.max(0, (CEREMONY - s) / 0.5) : 1;
      if (on) bannerText.textContent = `${TEAM_NAME[game.winner].toUpperCase()} VÔ ĐỊCH!`;
      set(banner, { transform: `translate(${VW / 2},${VH - 40}) scale(${(0.8 + 0.2 * Math.min(1, bo)).toFixed(2)})`, opacity: bo.toFixed(2) });
      confetti.forEach((n, i) => {
        const live = on && s > TROPHY_IN - 0.3, speed = 55 + (i * 37) % 45, x0 = 20 + (i * 97) % 600, y = -10 + ((s - TROPHY_IN) * speed + (i * 53) % 360 + 360) % 380;
        set(n, { transform: `translate(${(x0 + Math.sin(T * 2 + i) * 14).toFixed(1)},${y.toFixed(1)}) rotate(${((T * 200 + i * 40) % 360).toFixed(0)})`,
          opacity: live ? (s > CEREMONY - 0.6 ? Math.max(0, (CEREMONY - s) / 0.6) : 1).toFixed(2) : 0 });
      });
    }
    
    /* scoreboard */
    const $ = id => root.querySelector('[data-id="' + id + '"]');
    let shownScore = { R: 0, B: 0 };
    function drawBoard() {
      game.dirty = false;
      for (const t of TEAMS) {
        $(`sb-${t}`).classList.toggle("has-ball", game.mode === "play" && game.poss === t);
        $(`cards-${t}`).innerHTML = "<i></i>".repeat(game.cards[t]) + '<i class="red"></i>'.repeat(game.reds[t]);
        const b = $(`score-${t}`);
        if (shownScore[t] !== game.score[t]) { b.textContent = game.score[t]; b.classList.remove("is-changed"); void b.offsetWidth; if (game.score[t] > shownScore[t]) b.classList.add("is-changed"); }
      }
      shownScore = { ...game.score };
      for (const t of TEAMS) {
        const left = team[t].filter(inSquad).length, sb = bench[t].filter(b => !b.off && !b.injured).length;
        $(`shape-${t}`).textContent = (left < 6 ? `${game.shape[t]} (${left})` : game.shape[t]) + ` · DB ${sb}`;
      }
      const m = Math.min(FULL, minute());
      $("clock").textContent = game.mode === "ceremony" || game.mode === "fulltime" || game.mode === "draw" ? "HẾT"
        : game.mode === "halftime" || (game.mode === "reset" && game.halfBreak) ? "HẾT H1"
        : !game.half2 && minute() > HALF ? `${HALF}+${minute() - HALF}'`
        : game.golden ? `${FULL}+${Math.max(1, minute() - FULL)}'` : `${m}'`;
      const note = $("note");
      note.hidden = !game.note;
      if (note.textContent !== (game.note ?? "")) { note.textContent = game.note ?? ""; note.style.animation = "none"; void note.offsetWidth; note.style.animation = ""; }
      note.classList.toggle("is-golden", game.golden && game.mode === "play");
    }
    
    /* ---------------------------------- run ---------------------------------- */
    drawStadium(); drawPitch();
    const controlMarkers = humans.map(h => ({ h,
      ring: el("ellipse", { rx: 14, ry: 7, fill: "none", stroke: h.slot === "A" ? "#fff37a" : "#ffffff", "stroke-width": 3 }, layer.shadows),
      arrow: el("path", { "data-id": `aim-${h.slot}`, fill: "none", stroke: h.slot === "A" ? "#fff37a" : "#ffffff", "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, layer.shadows),
      label: el("text", { "text-anchor": "middle", fill: h.slot === "A" ? "#fff37a" : "#ffffff", stroke: "#1d2340", "stroke-width": 3, "paint-order": "stroke", "font-size": 16, "font-weight": 800 }, layer.wfx) }));
    controlMarkers.forEach(({ h, label }) => { label.textContent = h.slot; });
    // Recording mode (?gif): frames are stepped by hand, so wall-clock CSS animations would be caught half-way.
    if (query.has("gif")) root.classList.add("is-recording");
    // Everyone starts in kick-off shape.
    for (const p of players) { p.pos = toW(p.team, (p.team === game.kickoffTeam ? KICKOFF : KICKOFF_DEF)[p.i]); p.g = ground(...p.pos); }
    ref.pos = [0.45, 0.72]; ref.g = ground(...ref.pos);
    
    const DT = 1 / 60;
    api.__step = (seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) step(DT); render(); return api.__state(); };
    api.__state = () => ({ T: +T.toFixed(2), mode: game.mode, score: { ...game.score }, minute: minute(), poss: game.poss, carrier: game.carrier?.name ?? null,
      ball: ball.mode, kind: ball.kind, kick: game.lastKick ? { ...game.lastKick, origin: [...game.lastKick.origin], target: [...game.lastKick.target] } : null,
      owner: ball.owner?.name ?? null, callout: game.callout && T - game.callout.t < game.callout.life ? game.callout.text : null, note: game.note, cam: { z: +cam.z.toFixed(2) } });
    api.__fastForward = (minutes) => { game.clock = (minutes - 1) / PACE; game.dirty = true; };
    api.__energy = () => Object.fromEntries([...players, ...bench.R, ...bench.B].filter(p => !p.off).map(p => [`${p.team}:${p.name}${p.bench ? "*" : ""}`, +p.energy.toFixed(2)]));
    api.__stats = () => ({ ...game.stats, story: game.story.name, storyGoals: game.story.goals.map(g => [...g]), shape: { ...game.shape }, onPitch: { R: team.R.filter(on).length, B: team.B.filter(on).length } });
    
    if (query.has("still") || (!interactive && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)) {
      api.__step(query.has("still") ? Number(query.get("still")) || 0 : 9);
      api.pause = api.play = () => {};
      api.destroy = () => { shadow.innerHTML = ""; delete host.__ptscFootball; };
    } else {
      render();
      let last = performance.now(), acc = 0, raf = 0, visible = true, running = true;
      const tick = now => {
        acc += Math.min(0.1, Math.max(0, now - last) / 1000); last = now;
        while (acc >= DT) { step(DT); acc -= DT; }
        render();
        raf = visible && running ? requestAnimationFrame(tick) : 0;
      };
      // Only runs while on screen (and the tab is visible).
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } });
      io.observe(svg);
      raf = requestAnimationFrame(tick);
      api.pause = () => { running = false; cancelAnimationFrame(raf); raf = 0; };
      api.play = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); };
      api.destroy = () => { api.pause(); io.disconnect(); shadow.innerHTML = ""; delete host.__ptscFootball; };
    }

    return api;
  }
  function mountAll(selector = ".ptsc-football, [data-ptsc-football]") {
    return Array.from(document.querySelectorAll(selector)).map(el => mount(el));
  }
  window.PTSCFootball = { mount, mountAll };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountAll());
  else mountAll();
})();
