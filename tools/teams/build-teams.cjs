// Builds teams.js (window.PTSC_TEAMS) from the workbook players and the agents' face assignments.
const fs = require("fs"), path = require("path");
const players = require("./players.json");
const faces = new Map();
for (let n = 1; n <= 5; n++) {
  const file = path.join(__dirname, `faces-${n}.json`);
  if (!fs.existsSync(file)) continue;
  for (const f of JSON.parse(fs.readFileSync(file, "utf8")).players ?? []) faces.set(f.team + "|" + f.name, f);
}
const TEAMS = [
  { id: "real-madrid", name: "Real Madrid", short: "RMA", country: "Tây Ban Nha", sheet: "Real Madrid",
    kits: { home: { shirt: "#ffffff", shorts: "#ffffff", socks: "#ffffff", stripe: null, gk: "#e8a23a" }, away: { shirt: "#1e5a3f", shorts: "#153f2d", socks: "#1e5a3f", stripe: null, gk: "#f2c13b" } } },
  { id: "barcelona", name: "FC Barcelona", short: "BAR", country: "Tây Ban Nha", sheet: "FC Barcelona",
    kits: { home: { shirt: "#a50044", shorts: "#0b1f5b", socks: "#a50044", stripe: "#004d98", gk: "#2fb36f" }, away: { shirt: "#141414", shorts: "#000000", socks: "#141414", stripe: "#f0c030", gk: "#e8792b" } } },
  { id: "man-utd", name: "Manchester United", short: "MUN", country: "Anh", sheet: "Manchester United",
    kits: { home: { shirt: "#da291c", shorts: "#ffffff", socks: "#111111", stripe: null, gk: "#2fa84f" }, away: { shirt: "#1f3fa8", shorts: "#1f3fa8", socks: "#1f3fa8", stripe: null, gk: "#f2c13b" } } },
  { id: "psg", name: "Paris Saint-Germain", short: "PSG", country: "Pháp", sheet: "Paris Saint-Germain",
    kits: { home: { shirt: "#1b2a6b", shorts: "#1b2a6b", socks: "#1b2a6b", stripe: "#d7192d", gk: "#f2c13b" }, away: { shirt: "#f4f4f4", shorts: "#f4f4f4", socks: "#f4f4f4", stripe: "#c43b6e", gk: "#2a9d5c" } } },
  { id: "man-city", name: "Manchester City", short: "MCI", country: "Anh", sheet: "Manchester City",
    kits: { home: { shirt: "#6cabdd", shorts: "#6cabdd", socks: "#6cabdd", stripe: null, gk: "#e8792b" }, away: { shirt: "#1a1a1a", shorts: "#000000", socks: "#1a1a1a", stripe: "#f2c13b", gk: "#2fb36f" } } },
  { id: "juventus", name: "Juventus", short: "JUV", country: "Ý", sheet: "Juventus",
    kits: { home: { shirt: "#ffffff", shorts: "#ffffff", socks: "#111111", stripe: "#111111", gk: "#e8792b" }, away: { shirt: "#f0a8b4", shorts: "#e49ca8", socks: "#f0a8b4", stripe: null, gk: "#2a9d5c" } } },
  { id: "liverpool", name: "Liverpool", short: "LIV", country: "Anh", sheet: "Liverpool",
    kits: { home: { shirt: "#c8102e", shorts: "#c8102e", socks: "#c8102e", stripe: null, gk: "#2a9d5c" }, away: { shirt: "#f2f2f2", shorts: "#8c0a14", socks: "#f2f2f2", stripe: null, gk: "#e8792b" } } },
  { id: "chelsea", name: "Chelsea", short: "CHE", country: "Anh", sheet: "Chelsea",
    kits: { home: { shirt: "#034694", shorts: "#0a2a7a", socks: "#ffffff", stripe: null, gk: "#f2c13b" }, away: { shirt: "#141414", shorts: "#000000", socks: "#141414", stripe: "#f0c030", gk: "#e8792b" } } },
  { id: "bayern", name: "Bayern Munich", short: "BAY", country: "Đức", sheet: "Bayern Munich",
    kits: { home: { shirt: "#dc052d", shorts: "#dc052d", socks: "#dc052d", stripe: null, gk: "#2fb36f" }, away: { shirt: "#f2f2f2", shorts: "#f2f2f2", socks: "#f2f2f2", stripe: null, gk: "#f2c13b" } } },
  { id: "arsenal", name: "Arsenal", short: "ARS", country: "Anh", sheet: "Arsenal",
    kits: { home: { shirt: "#ef0107", shorts: "#ffffff", socks: "#ef0107", stripe: null, gk: "#f2c13b" }, away: { shirt: "#f0d830", shorts: "#111111", socks: "#f0d830", stripe: "#2a2a2a", gk: "#2a9d5c" } } }
];
const ROLE_OF = { GK: "GK", CB: "DF", LB: "DF", RB: "DF", CDM: "MF", CM: "MF", CAM: "MF", LM: "MF", RM: "MF", LW: "FW", RW: "FW", ST: "FW", CF: "FW" };
const PARTICLES = new Set(["van", "de", "di", "der", "del", "da", "do", "dos", "la", "le", "den", "von", "te", "ter"]);
/** A short display name: the surname with its particles, or the lone name. */
function shortName(name) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  let i = parts.length - 1;
  while (i > 0 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  const short = parts.slice(i).join(" ");
  return short.length <= 11 ? short : parts[parts.length - 1];
}
/** Playing styles from the role in the data, the position and the ratings; behaviour only. */
function stylesFor(p) {
  const role = ROLE_OF[p.pos], s = p.stats, r = p.role, wide = ["LW", "RW", "LB", "RB", "LM", "RM"].includes(p.pos), tall = p.height >= 186;
  let attack, defense;
  if (role === "GK") {
    const sweeper = SWEEPER_KEEPERS.has(p.name);
    attack = sweeper || s.passing >= 62 ? "footKeeper" : "quickKeeper";
    defense = sweeper ? "keeperRush" : "keeperLine";
  } else if (role === "DF") {
    attack = ["LB", "RB"].includes(p.pos) ? "runner" : "builder";
    defense = /kèm|tranh chấp|máy quét/i.test(r) || s.strength >= 86 ? "marker" : "cover";
  } else if (role === "MF") {
    attack = /box-to-box/i.test(r) || ["LM", "RM"].includes(p.pos) || (p.pos === "CAM" && s.finishing >= 80) ? "shuttle" : "conductor";
    defense = p.pos === "CDM" || /trụ|đánh chặn|phòng ngự|điều phối/i.test(r) ? "screener" : /box-to-box|tranh chấp/i.test(r) || s.stamina >= 88 ? "harrier" : s.defending >= 72 ? "screener" : "harrier";
  } else {
    attack = ["LW", "RW"].includes(p.pos) ? "flyer"
      : /tường|không chiến|liên kết/i.test(r) || (p.pos === "CF" && s.passing >= 85) || (tall && s.heading >= 88 && s.finishing < 93 && s.dribbling < 85) ? "anchor"
      : s.dribbling >= 93 && s.dribbling > s.finishing + 3 ? "flyer" : "poacher";
    defense = s.speed >= 89 && s.defending < 45 ? "outlet" : s.stamina >= 82 || s.defending >= 50 ? "chaser" : "outlet";
  }
  return { attack, defense };
}
// Known playing profiles the workbook's numbers cannot tell apart (every keeper there is a shot-stopper).
const SWEEPER_KEEPERS = new Set(["Manuel Neuer", "Ederson", "Marc-André ter Stegen", "Alisson Becker", "Jens Lehmann"]);
const CANNON_TAKERS = new Set(["Roberto Carlos"]);
const ATTACK = new Set(["burst", "finisher", "phantom", "maestro", "laserPass"]);
function skillsFor(p, stats) {
  const role = ROLE_OF[p.pos], s = stats, best = list => list.sort((a, b) => b[1] - a[1])[0][0];
  let open;
  if (role === "GK") open = SWEEPER_KEEPERS.has(p.name) ? "sweeper" : p.height >= 194 || s.strength >= 84 ? "keeperHands" : "reflex";
  else if (role === "FW") open = best([["finisher", s.finishing + 1], ["burst", s.speed], ["phantom", s.dribbling]]);
  else if (role === "MF") open = p.pos === "CDM" || (s.defending >= 85 && s.defending > s.dribbling)
    ? (s.defending >= 86 ? "interceptor" : "laserPass")
    : best([["laserPass", (s.passing + s.longPass) / 2 + 1], ["maestro", (s.dribbling + s.passing) / 2], ["finisher", s.finishing - 3], ["burst", s.speed - 4]]);
  else open = ["LB", "RB"].includes(p.pos) && s.speed >= 89 && s.dribbling >= 82 ? "burst"
    : s.defending >= 98 ? "superDefense" : s.speed >= s.strength ? "interceptor" : "wall";
  const outfield = role !== "GK", curl = s.longPass * .6 + s.finishing * .4;
  const freeKick = !outfield ? null : CANNON_TAKERS.has(p.name) ? "deadBallCannon" : curl >= 86 && s.longPass >= 85 ? "freeKick" : s.finishing >= 93 && s.strength >= 76 ? "deadBallCannon" : null;
  let corner = (role === "MF" || role === "FW") && s.longPass >= 88 ? "cornerCurve" : null;
  const cornerDefense = role === "DF" && s.heading >= 90 ? "aerialFort" : null;
  let open2 = open, fk = freeKick;
  // An attacking skill and a dead-ball one never go together: he keeps whichever his ratings make him better at.
  if (ATTACK.has(open) && (fk || corner)) {
    const openScore = { finisher: s.finishing, burst: s.speed, phantom: s.dribbling, maestro: (s.dribbling + s.passing) / 2, laserPass: (s.passing + s.longPass) / 2 }[open];
    const setScore = Math.max(fk ? curl : 0, corner ? s.longPass : 0);
    if (setScore >= openScore || CANNON_TAKERS.has(p.name)) open2 = null; else { fk = null; corner = null; }
  }
  return { open: open2, freeKick: fk, corner, cornerDefense,
    penalty: outfield && s.finishing >= 90 ? "penaltyFinisher" : null,
    penaltySave: role === "GK" && s.goalkeeping >= 95 ? "penaltySaver" : null };
}
const OVERRIDES = {
  "Bayern Munich|Jérôme Boateng": { defending: 91, heading: 86, strength: 86 },
  "Juventus|Leonardo Bonucci": { defending: 92, heading: 84, strength: 80 },
  "Manchester City|John Stones": { defending: 88, heading: 82, strength: 78 }
};
const used = new Map();
const out = TEAMS.map(team => {
  const list = players.filter(p => p.team === team.sheet);
  const shorts = new Map();
  const squad = list.map(p => {
    const f = faces.get(team.sheet + "|" + p.name) ?? {};
    let short = f.short && f.short.length <= 11 ? f.short : shortName(p.name);
    if (shorts.has(short)) { const initial = p.name.split(/\s+/)[0][0]; short = (initial + ". " + short).slice(0, 11); }
    shorts.set(short, p.name);
    const role = ROLE_OF[p.pos], { attack, defense } = stylesFor(p);
    const star = role !== "GK" && p.stats.dribbling >= 92 && p.stats.dribbling >= p.stats.finishing ? 10 : role !== "GK" && p.stats.finishing >= 92 ? 7 : 0;
    const key = team.id + ":" + p.no;
    return { id: key, name: p.name, short, num: Number.isInteger(f.num) && f.num > 0 && f.num < 100 ? f.num : null, pos: p.pos, role, roleName: p.role, summary: p.summary, ovr: p.ovr, height: p.height, weight: p.weight, stats: { ...p.stats, ...(OVERRIDES[team.sheet + "|" + p.name] ?? {}) }, star, attack, defense, skills: null,
      celebration: f.celebration ?? null, face: { hair: f.hair ?? "buzz", hairColor: f.hairColor ?? "black", skin: f.skin ?? 1, beard: f.beard ?? "none", brows: f.brows ?? "normal", extras: f.extras ?? "none", build: f.build ?? "round" } };
  });
  for (const p of squad) p.skills = skillsFor(p, p.stats);
  for (const p of squad) if (!faces.has(team.sheet + "|" + p.name)) used.set(p.name, (used.get(p.name) ?? 0) + 1);
  return { id: team.id, name: team.name, short: team.short, country: team.country, logo: `assets/teams/${team.id}.png`,
    kits: { home: { ...team.kits.home, image: `assets/teams/${team.id}-home.png` }, away: { ...team.kits.away, image: `assets/teams/${team.id}-away.png` } }, players: squad };
});
const missing = [...used.keys()];
console.log("teams", out.length, "players", out.reduce((n, t) => n + t.players.length, 0), "faces found", faces.size, "missing faces", missing.length, missing.slice(0, 8));
const counts = {}; for (const t of out) for (const p of t.players) { counts[p.attack] = (counts[p.attack] ?? 0) + 1; counts[p.defense] = (counts[p.defense] ?? 0) + 1; }
console.log("style use", JSON.stringify(counts));
const roleCounts = out.map(t => [t.short, ["GK", "DF", "MF", "FW"].map(r => t.players.filter(p => p.role === r).length).join("/")]);
console.log("GK/DF/MF/FW per team", JSON.stringify(roleCounts));
const header = `/* PTSC Cup 6v6 · mười câu lạc bộ, 300 cầu thủ. Sinh từ document/top_10_clb_bong_da_2026_300_ngoi_sao_25_huyen_thoai_khoi_phuc.xlsx;
 * chỉ số, chiều cao, cân nặng và lối chơi của từng người là dữ liệu cố định. Dùng qua window.PTSCTeams (xem cuối tệp). */
`;
fs.writeFileSync(path.join(__dirname, "teams-data.json"), JSON.stringify({ version: 1, teams: out }));
fs.writeFileSync(path.join(__dirname, "teams-header.txt"), header);
console.log("written teams-data.json", (JSON.stringify(out).length / 1024).toFixed(0) + " KB");
