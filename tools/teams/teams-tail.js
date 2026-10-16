
/* Helpers over the data: a nine-man squad from a club, kits that do not clash, random pairings. */
window.PTSCTeams = (() => {
  "use strict";
  const teams = window.PTSC_TEAMS.teams, byId = new Map(teams.map(t => [t.id, t]));
  // A squad: one keeper, three defenders, two midfielders, three forwards. Six start, three sit on the bench.
  const NEED = { GK: 1, DF: 3, MF: 2, FW: 3 };
  const NUMBERS = { GK: [1, 13, 25, 22, 31, 30], DF: [2, 3, 4, 5, 6, 12, 15, 19, 21, 24, 26, 33], MF: [8, 6, 10, 14, 16, 18, 20, 23, 17, 22, 27, 28], FW: [9, 7, 11, 10, 17, 19, 14, 20, 27, 29, 21, 23] };
  const hexRgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim()); if (!m) return [0.5, 0.5, 0.5]; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  /** How different two colours look, 0 (same) to about 1.7. */
  const apart = (a, b) => { const [r1, g1, b1] = hexRgb(a), [r2, g2, b2] = hexRgb(b); return Math.hypot(r1 - r2, g1 - g2, b1 - b2); };
  const CLASH = 0.42, SPARE_GK = ["#f2c13b", "#2fb36f", "#e8792b", "#8e44ad", "#1abc9c", "#ff6fae", "#b8e986"];
  const shuffle = (list, rng) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /** A man as the engine wants him: identity, look, fixed ratings and build, styles. */
  function entry(p, num) {
    return { id: p.id, name: p.name, short: p.short, num, face: p.face, skin: p.face.skin, star: p.star, natural: p.role, pos: p.pos, roleName: p.roleName, summary: p.summary,
      stats: p.stats, height: p.height, weight: p.weight, attack: p.attack, defense: p.defense, celebration: p.celebration, ovr: p.ovr };
  }
  /**
   * Nine players drawn from the club at random, spread over the positions; the better ones of each line start.
   * `rng` is any function returning [0, 1); the same sequence gives the same squad.
   */
  function pickSquad(teamOrId, rng = Math.random, options = {}) {
    const team = typeof teamOrId === "string" ? byId.get(teamOrId) : teamOrId;
    if (!team) return null;
    const picked = [];
    for (const [role, n] of Object.entries(NEED)) {
      const pool = shuffle(team.players.filter(p => p.role === role), rng);
      picked.push(...pool.slice(0, n));
      // A club short of a line (never in the shipped data) fills from the nearest line.
      if (pool.length < n) picked.push(...shuffle(team.players.filter(p => p.role !== role && !picked.includes(p)), rng).slice(0, n - pool.length).map(p => ({ ...p, role })));
    }
    // Unique shirt numbers among the nine: a man keeps his own if nobody else took it.
    const taken = new Set(), numbered = [];
    for (const p of picked) { if (p.num && !taken.has(p.num)) { taken.add(p.num); numbered.push([p, p.num]); } else numbered.push([p, null]); }
    for (const pair of numbered) if (pair[1] == null) { pair[1] = [...NUMBERS[pair[0].role], ...Array.from({ length: 60 }, (_, i) => 30 + i)].find(n => !taken.has(n)); taken.add(pair[1]); }
    const num = new Map(numbered.map(([p, n]) => [p, n]));
    const byOvr = (a, b) => b.ovr - a.ovr;
    const line = role => picked.filter(p => p.role === role).sort(byOvr);
    const gk = line("GK"), df = line("DF"), mf = line("MF"), fw = line("FW");
    const starters = [gk[0], df[0], df[1], mf[0], fw[0], fw[1]], bench = [df[2], mf[1], fw[2]].filter(Boolean);
    // The two best outfielders are the key men: they last longer and are not rotated by the coach.
    const key = new Set([...df, ...mf, ...fw].sort(byOvr).slice(0, 2));
    const toEntry = p => ({ ...entry(p, num.get(p)), pillar: key.has(p) });
    return { players: starters.map(toEntry), bench: bench.map(toEntry), fixedBench: true, picked: picked.map(p => p.id) };
  }
  /** Which kit each side wears: the first club in its home kit, the second in whatever does not look like it. */
  function kitsFor(idA, idB) {
    const a = byId.get(idA), b = byId.get(idB);
    if (!a || !b) return null;
    let kitA = "home", kitB = "home";
    if (apart(a.kits.home.shirt, b.kits.home.shirt) < CLASH) kitB = "away";
    if (apart(a.kits[kitA].shirt, b.kits[kitB].shirt) < CLASH) kitA = "away";
    if (apart(a.kits[kitA].shirt, b.kits[kitB].shirt) < CLASH) kitB = "home";
    const colors = (team, kit, otherShirt, avoid = []) => {
      const k = team.kits[kit], others = [k.shirt, otherShirt, ...avoid];
      const fits = c => others.every(s => apart(c, s) >= CLASH);
      const gk = fits(k.gk) ? k.gk : SPARE_GK.find(fits) ?? k.gk;
      return { shirt: k.shirt, shorts: k.shorts, socks: k.socks, stripe: k.stripe, gk, kit, image: k.image };
    };
    const R = colors(a, kitA, b.kits[kitB].shirt), B = colors(b, kitB, a.kits[kitA].shirt, [R.gk]);
    return { R, B };
  }
  /** The `teams` option for PTSCFootball.mount: who the sides are and what they wear. */
  function teamOption(idA, idB) {
    const kits = kitsFor(idA, idB);
    if (!kits) return null;
    const side = (id, colors) => { const t = byId.get(id); return { id: t.id, name: t.name, short: t.short, logo: t.logo, colors }; };
    return { R: side(idA, kits.R), B: side(idB, kits.B) };
  }
  function randomPair(rng = Math.random) {
    const a = teams[Math.floor(rng() * teams.length)], others = teams.filter(t => t !== a);
    return [a.id, others[Math.floor(rng() * others.length)].id];
  }
  /** The ratings people compare clubs by: the average overall of the best eleven-equivalent nine. */
  const strength = team => { const top = r => team.players.filter(p => p.role === r).sort((a, b) => b.ovr - a.ovr); const nine = [...top("GK").slice(0, 1), ...top("DF").slice(0, 3), ...top("MF").slice(0, 2), ...top("FW").slice(0, 3)]; return Math.round(nine.reduce((s, p) => s + p.ovr, 0) / nine.length); };
  return { list: () => teams, get: id => byId.get(id) ?? null, pickSquad, kitsFor, teamOption, randomPair, strength, apart };
})();
