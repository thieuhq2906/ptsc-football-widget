(() => {
  "use strict";
  const sessions = new Map();
  // Physical keys held down. Tracked while paused too, so a direction held through Space keeps working.
  const keys = new Set();
  const switchRepeats = new Map();
  const DEFAULT_NAMES = { R: "Đỏ", B: "Xanh" };
  const clubs = window.PTSCTeams;
  /** The club a side of a match (or the watched one) is: name, short name, logo and kit; the plain red/blue without one. */
  const teamOf = (view, t) => view?.api?.teams?.()?.[t] ?? null;
  const nameOf = (view, t) => teamOf(view, t)?.name ?? DEFAULT_NAMES[t];
  const shortOf = (view, t) => teamOf(view, t)?.short ?? DEFAULT_NAMES[t];
  const inkFor = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim()); if (!m) return "#fff"; const n = parseInt(m[1], 16); return ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) > 150 ? "#1d2340" : "#fff"; };
  /** The HUD around a pitch takes the two shirts' colours. */
  function paintTeams(node, api) {
    const teams = api?.teams?.();
    for (const t of ["R", "B"]) {
      const shirt = teams?.[t]?.colors?.shirt ?? (t === "R" ? "#e45248" : "#397eca");
      node.style.setProperty("--team-" + t, shirt); node.style.setProperty("--team-" + t + "-ink", inkFor(shirt));
    }
  }
  const TEAM_STORE = "ptsc-football.clubs.v1";
  const savedClubs = (() => { try { return JSON.parse(localStorage.getItem(TEAM_STORE) || "{}") || {}; } catch { return {}; } })();
  const rememberClub = (key, id) => { savedClubs[key] = id; try { localStorage.setItem(TEAM_STORE, JSON.stringify(savedClubs)); } catch {} };
  /** A seeded random source for squad picks, so a data-seed on the host gives the same squads every time. */
  function rngFrom(seed) {
    let a = (Number(seed) || Math.floor(Math.random() * 2 ** 31)) >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clubIds = () => clubs.list().map(t => t.id);
  const resolveClub = (id, avoid) => id === "random" || !clubs.get(id) ? clubIds().filter(x => x !== avoid)[Math.floor(Math.random() * (clubIds().length - (avoid ? 1 : 0)))] : id;
  const opposite = team => team === "R" ? "B" : "R";
  const keymap = window.PTSCKeymap, label = keymap.label;
  const MOVE_ACTIONS = new Set(["up", "down", "left", "right", "sprint", "press"]);
  const GUIDE_ACTIONS = ["switch", "sprint", "pass", "shoot", "press", "challenge"];
  const GUIDE_LABELS = ["Đổi người", "Chạy nhanh", "Chuyền", "Sút / xoạc", "Bám người", "Tranh bóng"];
  const GUIDE_GESTURES = ["Bấm · có bóng: gọi chạy chỗ", "Giữ", "Giữ → thả", "Giữ → thả / bấm", "Giữ để bám theo", "Bấm"];
  const CORNER_ACTIONS = ["pass", "shoot", "press", "challenge"];
  const PENALTY_ACTIONS = { left: "left", down: "center", right: "right" };
  const gameData = window.PTSCFootball.data;
  const defaultSkillIcon = gameData.skills.freeKick.icon;
  const game = document.getElementById("game");
  // Per mode: the key sets in use and a code → { slot, action } lookup.
  const controls = new Map();
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const kbd = code => `<kbd>${escapeHtml(label(code))}</kbd>`;
  function skillBadge(kind, icon, id) {
    const role = gameData.skills[kind]?.role ?? "MF", color = gameData.skillRules.colors[role];
    return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#123a62"/></radialGradient></defs><circle cx="12" cy="12" r="11.2" fill="#16456b" stroke="#2b92da" stroke-width="1.4"/><circle cx="12" cy="12" r="9.2" fill="url(#${id})" stroke="#8dd1fb" stroke-width="1"/><path d="M5 7Q12 1 19 7" fill="none" stroke="#d2f0ff" stroke-width="1" opacity=".7"/><path d="M3 16Q12 23 21 16" fill="none" stroke="#4bbcf5" stroke-width="1.3"/><g transform="translate(4,4) scale(.66)" fill="none" stroke="${role === "DF" ? "#acffbd" : role === "GK" ? "#ffe3d4" : "#fff1b0"}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${icon || defaultSkillIcon}</g>`;
  }
  function refreshControls(mode) {
    const bindings = keymap.bindings(mode), codes = new Map();
    for (const [slot, set] of Object.entries(bindings)) for (const [action, code] of Object.entries(set)) if (!codes.has(code)) codes.set(code, { slot, action });
    controls.set(mode, { bindings, codes });
  }
  const bindingsOf = mode => controls.get(mode)?.bindings ?? {};
  const lookup = (mode, code) => controls.get(mode)?.codes.get(code) ?? null;
  function renderGuide(guide, set) {
    // The guide on the pitch can also be clicked: switch player, and shoot or slide.
    const slot = guide.dataset.slot, clickableArea = !!guide.closest(".arena-hints");
    guide.innerHTML = `<div class="movement-help"><strong>NGƯỜI ${slot}</strong><div class="pad-diagram"><img src="assets/control-pad.svg" alt="Pad di chuyển của người ${slot}" width="343" height="343"><span class="pad-player">${slot}</span>${["up", "left", "down", "right"].map(direction => `<span class="pad-key pad-${direction}" data-code="${escapeHtml(set[direction])}">${escapeHtml(label(set[direction]))}</span>`).join("")}</div></div><div class="action-grid">${GUIDE_ACTIONS.map((action, i) => {
      const clickable = clickableArea && (action === "switch" || action === "shoot"), tag = clickable ? "button" : "div";
      return `<${tag} class="action-key${clickable ? action === "switch" ? " switch-action" : " slide-action" : ""}" data-code="${escapeHtml(set[action])}" data-action="${action}"${clickable ? ` type="button" tabindex="-1" data-slot="${slot}" disabled` : ""}>${kbd(set[action])}<span><span class="action-label">${GUIDE_LABELS[i]}</span><small>${GUIDE_GESTURES[i]}</small></span></${tag}>`;
    }).join("")}</div>`;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /* ------------------------------ game info: console-style browsers ------------------------------ */
  // Every section of Game info is a browser like a console's extras menu: groups switched with Q/E, entries picked
  // with the arrows, and a card with everything about the entry under the cursor.
  const ROLE_GROUPS = { FW: "Tiền đạo", MF: "Tiền vệ", DF: "Hậu vệ", GK: "Thủ môn" };
  const ROLE_COLORS = { FW: "#e05252", MF: "#3db86b", DF: "#3c8dde", GK: "#e8b923" };
  /** The nearest entry in a direction, by position on screen: works for lists and grids alike. */
  function spatial(root, from, dir) {
    const items = [...root.querySelectorAll("[data-br]")].filter(el => !el.disabled && !el.closest("[hidden], [inert]") && el.getClientRects().length);
    if (!from || !items.includes(from)) return items[0] ?? null;
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === from) continue;
      const b = el.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      const main = dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx, cross = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
      if (main <= 4) continue;
      const score = main + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }
  /** Keys inside a browser: arrows move, Q/E switch groups, ←/→ change a setting row, Esc (or ← at the edge) leaves. */
  function browserKeys(root, { onTab, onSide, onLeave } = {}) {
    const step = dir => {
      const to = spatial(root, document.activeElement?.closest?.("[data-br]"), dir);
      if (to) { focusOn(to); to.scrollIntoView?.({ block: "nearest" }); }
      return !!to;
    };
    root.addEventListener("keydown", event => {
      if (capture || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target, typing = target.matches?.("input, select, textarea");
      if (event.code === "Escape") { if (onLeave?.("escape")) event.preventDefault(); return; }
      if (typing) {
        if (event.code === "ArrowUp" || event.code === "ArrowDown") { event.preventDefault(); step(event.code === "ArrowUp" ? "up" : "down"); }
        return;
      }
      if ((event.code === "KeyQ" || event.code === "PageUp") && onTab) { event.preventDefault(); if (!event.repeat) onTab(-1); return; }
      if ((event.code === "KeyE" || event.code === "PageDown") && onTab) { event.preventDefault(); if (!event.repeat) onTab(1); return; }
      const dir = NAV_KEYS[event.code];
      if (!dir || (event.code.startsWith("Key") && event.repeat)) return;
      const row = target.closest?.("[data-side]");
      if (row && onSide && (dir === "left" || dir === "right")) { event.preventDefault(); onSide(row, dir === "left" ? -1 : 1); return; }
      event.preventDefault();
      if (!step(dir) && dir === "left") onLeave?.("left");
    });
  }
  /** Puts the cursor back on a browser's current entry and replays the key there. */
  function backToEntry(scope, event) {
    const item = scope.querySelector(".br-item.is-current") ?? spatial(scope, null, "down");
    if (!item) return false;
    focusOn(item);
    item.dispatchEvent(new KeyboardEvent("keydown", { code: event.code, key: event.key, shiftKey: event.shiftKey, bubbles: true, cancelable: true }));
    return true;
  }
  const leaveToNav = () => { if (route.name !== "info") return false; focusOn(infoScreen.querySelector(".info-nav .is-current")); return true; };
  /**
   * A browser over a container. spec: { cls, title, lead, grid, tabs() → [{ label, items: [{ key, html, group }] }], detail(key, tab) → html, onLeave }.
   * Entries are buttons with class br-item and data-key; they are rendered by the spec, the cursor and the card by the browser.
   */
  function makeBrowser(root, spec) {
    const state = { tab: 0, key: null };
    root.classList.add("browser", spec.cls);
    root.innerHTML = '<header class="br-head">' + (spec.title ? '<h2 class="pane-title">' + spec.title + "</h2>" : "") + (spec.lead ? '<p class="pane-lead">' + spec.lead + "</p>" : "") + '</header><div class="br-tabs" role="tablist"></div><div class="br-body"><div class="br-list' + (spec.grid ? " is-grid" : "") + '"></div><aside class="br-detail" aria-live="polite"></aside></div>';
    const tabsEl = root.querySelector(".br-tabs"), list = root.querySelector(".br-list"), detail = root.querySelector(".br-detail");
    let tabs = [];
    function show(key) {
      if (!key) { detail.innerHTML = ""; return; }
      if (key === state.key && detail.dataset.key === key) return;
      state.key = key; detail.dataset.key = key;
      detail.innerHTML = spec.detail(key, tabs[state.tab]);
      detail.scrollTop = 0;
      for (const item of list.querySelectorAll("[data-key]")) item.classList.toggle("is-current", item.dataset.key === key);
    }
    function render(focus = root.contains(document.activeElement)) {
      tabs = spec.tabs();
      state.tab = clamp(state.tab, 0, tabs.length - 1);
      tabsEl.hidden = tabs.length < 2;
      tabsEl.innerHTML = tabs.map((t, i) => `<button type="button" class="br-tab${i === state.tab ? " is-current" : ""}" role="tab" tabindex="-1" aria-selected="${i === state.tab}" data-i="${i}">${t.label}</button>`).join("") + (tabs.length > 1 ? '<span class="br-tab-keys"><kbd>Q</kbd><kbd>E</kbd></span>' : "");
      let group = null;
      list.innerHTML = tabs[state.tab].items.map(item => (item.group && item.group !== group ? `<p class="br-sep">${group = item.group}</p>` : "") + item.html).join("");
      const target = list.querySelector(`[data-key="${CSS.escape(state.key ?? "")}"]`) ?? list.querySelector("[data-key]");
      state.key = null; delete detail.dataset.key; show(target?.dataset.key);
      if (focus && target) focusOn(target);
    }
    const setTab = step => { state.tab = (state.tab + step + tabs.length) % tabs.length; state.key = null; render(true); };
    tabsEl.addEventListener("click", event => { const tab = event.target.closest(".br-tab"); if (tab) { state.tab = Number(tab.dataset.i); state.key = null; render(true); } });
    list.addEventListener("focusin", event => show(event.target.closest("[data-key]")?.dataset.key));
    list.addEventListener("click", event => {
      const item = event.target.closest("[data-key]");
      if (!item) return;
      focusOn(item); show(item.dataset.key);
      if (event.detail && getComputedStyle(root.querySelector(".br-body")).gridTemplateColumns.split(" ").length < 2) detail.scrollIntoView?.({ block: "start", behavior: "smooth" });
    });
    browserKeys(root, { onTab: setTab, onLeave: spec.onLeave ?? leaveToNav });
    render(false);
    return { render, state };
  }
  const chip = (text, color) => `<span class="bd-chip"${color ? ` style="--chip:${color}"` : ""}>${text}</span>`;
  const bars = rows => '<div class="bd-bars">' + rows.map(([labelText, value, max, shown, tone]) => `<div class="bd-bar"><span>${labelText}</span><i><i style="width:${Math.round(clamp01(value / max) * 100)}%"${tone ? ` data-tone="${tone}"` : ""}></i></i><b>${shown}</b></div>`).join("") + "</div>";
  const facts = rows => '<dl class="bd-facts">' + rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("") + "</dl>";

  /* Clubs */
  /* ------------------------------ player card ------------------------------ */
  // The hexagon reads clockwise from the top as in the reference: shooting, passing, strength, defending, speed, dribbling.
  const HEX = [["SÚT", s => s.finishing], ["CHUYỀN", s => (s.passing + s.longPass) / 2], ["SỨC", s => (s.strength + s.heading) / 2], ["THỦ", s => s.defending], ["TỐC", s => s.speed], ["RÊ", s => s.dribbling]];
  const HEX_GK = [["BẮT", s => s.goalkeeping], ...HEX.slice(1)];
  function hexSvg(stats, line) {
    const axes = line === "GK" ? HEX_GK : HEX;
    const point = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [60 + Math.cos(a) * r * 38, 58 + Math.sin(a) * r * 38]; };
    const ring = r => axes.map((_, i) => point(i, r).map(v => v.toFixed(1)).join(",")).join(" ");
    const values = axes.map(([, f]) => Math.round(f(stats)));
    const shape = values.map((v, i) => point(i, Math.max(.06, clamp01((v - 30) / 69))).map(n => n.toFixed(1)).join(",")).join(" ");
    return `<svg class="hex" viewBox="0 0 120 116" role="img" aria-label="${axes.map(([k], i) => k + " " + values[i]).join(", ")}"><polygon class="hex-ring" points="${ring(1)}"/><polygon class="hex-ring" points="${ring(2 / 3)}"/><polygon class="hex-ring" points="${ring(1 / 3)}"/>`
      + axes.map((_, i) => { const [x, y] = point(i, 1); return `<line class="hex-axis" x1="60" y1="58" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("")
      + `<polygon class="hex-shape" points="${shape}"/>`
      + axes.map(([k], i) => { const [x, y] = point(i, 1.32); return `<text x="${x.toFixed(1)}" y="${(y - 3).toFixed(1)}" class="hex-key">${k}</text><text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" class="hex-val" data-tone="${statTone(values[i])}">${values[i]}</text>`; }).join("") + "</svg>";
  }
  // Where a position sits on a vertical pitch (attack at the top): row 0 forwards … row 3 the keeper; column 0 left.
  const POS_ZONE = { LW: [0, 0], ST: [0, 1], CF: [0, 1], RW: [0, 2], LM: [1, 0], CAM: [1, 1], CM: [1, 1], CDM: [1, 1], RM: [1, 2], LB: [2, 0], CB: [2, 1], RB: [2, 2], GK: [3, 1] };
  const ZONE_LINES = ["FW", "MF", "DF", "GK"];
  /** The pitch map: his own position bright, the lines he can play nearly as well in green, the rest grey; each line's OVR. */
  function posMapSvg(posName, natural, ovrs) {
    const own = POS_ZONE[posName] ?? [ZONE_LINES.indexOf(natural), 1], best = ovrs?.[natural] ?? 0;
    const tone = (row, col) => {
      if (row === own[0] && col === own[1]) return "own";
      const d = best - (ovrs?.[ZONE_LINES[row]] ?? 0);
      return d <= 3 ? "good" : d <= 8 ? "fair" : "off";
    };
    let cells = "";
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      if (row === 3 && col !== 1) continue;
      const x = row === 3 ? 22 : 4 + col * 24, w = row === 3 ? 24 : 22, y = 4 + row * 27, h = row === 3 ? 18 : 25;
      cells += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" data-zone="${tone(row, col)}"/>`;
    }
    const labels = ZONE_LINES.map((line, row) => `<text x="77" y="${(row === 3 ? 16 : 19) + row * 27}" class="pm-ovr">${LINE_LABEL[line]} <tspan data-tone="${statTone(ovrs?.[line] ?? 0)}">${ovrs?.[line] ?? "–"}</tspan></text>`).join("");
    return `<svg class="posmap" viewBox="0 0 104 108" role="img" aria-label="Vị trí sở trường ${escapeHtml(posName || natural)}"><rect x="1" y="1" width="74" height="106" rx="4" class="pm-pitch"/>${cells}<path class="pm-lines" d="M4 54.5h68M26 107v-6h24v6M26 1v6h24V1"/>${labels}</svg>`;
  }
  /** OVR in each line for a man from the club data (the match engine works these out the same way). */
  function lineOvrs(p) {
    const weighted = line => Object.entries(gameData.stats.weights[line]).reduce((sum, [k, w]) => sum + (p.stats[k] ?? 70) * w, 0);
    return Object.fromEntries(ZONE_LINES.map(line => [line, Math.max(1, Math.min(99, Math.round(p.ovr + weighted(line) - weighted(p.role))))]));
  }
  /**
   * A player card in the style of the reference: the card itself (position, OVR, portrait or shirt, name, club),
   * the ratings hexagon, the position map and the facts underneath.
   */
  function playerCardHtml(p, { art = "", logo = "", club = "", color = "#1d2340", rows = [] } = {}) {
    const natural = p.natural ?? p.role, ovr = p.ovrs?.[natural] ?? p.ovr;
    return `<div class="pcard" style="--pc-team:${escapeHtml(color)}"><div class="pcard-top"><div class="pcard-card" data-line="${natural}"><span class="pcard-pos">${escapeHtml(p.posName || p.pos || LINE_LABEL[natural])}</span><b class="pcard-ovr">${ovr ?? "–"}</b><div class="pcard-art">${art}</div>${logo ? `<img class="pcard-logo" src="${escapeHtml(logo)}" alt="" width="26" height="26" loading="lazy">` : ""}<span class="pcard-num">#${p.num ?? ""}</span><strong class="pcard-name">${escapeHtml(p.short || p.name)}</strong></div>`
      + `<div class="pcard-hex">${hexSvg(p.stats, natural)}</div><div class="pcard-map">${posMapSvg(p.posName || p.pos, natural, p.ovrs)}</div></div>`
      + `<dl class="pcard-facts">${[["Họ tên", escapeHtml(p.name)], club && ["Câu lạc bộ", escapeHtml(club)], ...rows].filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl></div>`;
  }
  const styleName = (phase, id) => gameData.playstyles[phase][id]?.name ?? "–";
  /** A skill with its badge, for the card's facts. */
  const skillChip = id => { const k = gameData.skills[id]; return k ? `<span class="pcard-skill"><svg viewBox="0 0 24 24" aria-hidden="true">${skillBadge(id, k.icon, "pc-" + id + "-" + (++skillChip.n))}</svg>${escapeHtml(k.name)}</span>` : ""; };
  skillChip.n = 0;
  /** The card's skill rows: the open-play skill, the dead-ball ones, the penalty one. */
  const skillRows = (open, setPieces = [], penalty) => [
    ["Skill", open ? skillChip(open) : setPieces.some(id => !["aerialFort"].includes(id)) ? "<small>chuyên bóng chết</small>" : "–"],
    setPieces.length && ["Bóng chết", setPieces.map(skillChip).join("")],
    penalty && ["Penalty", skillChip(penalty)]].filter(Boolean);
  function renderTeamsGuide(container) {
    const ovrTone = v => v >= 95 ? "top" : v >= 90 ? "good" : v >= 85 ? "fair" : "low";
    makeBrowser(container, {
      cls: "teams-browser", title: "Đội bóng",
      lead: "Q/E đổi đội, ↑ ↓ chọn cầu thủ để xem thẻ.",
      tabs: () => [{ label: "Câu lạc bộ", items: clubs.list().map(t => ({ key: t.id, html: `<button type="button" class="br-item club-row" data-br data-nav data-key="${t.id}"><img class="club-logo" src="${escapeHtml(t.logo)}" alt="" width="40" height="40" loading="lazy"><span><b>${escapeHtml(t.name)}</b><small>${escapeHtml(t.country)} · OVR ${clubs.strength(t)} · ${t.players.length} cầu thủ</small></span></button>` })) },
        ...clubs.list().map(t => ({ label: t.short, items: ["GK", "DF", "MF", "FW"].flatMap(r => t.players.filter(p => p.role === r).sort((a, b) => b.ovr - a.ovr).map(p => ({ group: ROLE_GROUPS[r], key: p.id,
          html: `<button type="button" class="br-item player-row" data-br data-nav data-key="${escapeHtml(p.id)}">${posBadge(p.role)}<span><b>${escapeHtml(p.name)}</b><small>#${p.num} · ${escapeHtml(p.pos)} · ${escapeHtml([p.skills?.open, p.skills?.freeKick, p.skills?.corner, p.skills?.cornerDefense].filter(Boolean).map(id => gameData.skills[id]?.short).join(" · ") || p.roleName)}</small></span><b class="club-ovr" data-tone="${ovrTone(p.ovr)}">${p.ovr}</b></button>` }))) }))],
      detail: id => {
        if (id.includes(":")) {
          const t = clubs.get(id.split(":")[0]), p = t?.players.find(x => x.id === id);
          if (!p) return "";
          const card = { ...p, natural: p.role, posName: p.pos, ovrs: lineOvrs(p) };
          const art = `<img src="${escapeHtml(t.kits.home.image)}" alt="" width="64" height="100" loading="lazy">`;
          return playerCardHtml(card, { art, logo: t.logo, club: t.name, color: t.kits.home.shirt, rows: [
            ["Vai trò", escapeHtml(p.roleName)], ["Chiều cao · cân nặng", p.height + " cm · " + p.weight + " kg"],
            ["Lối chơi", `${escapeHtml(styleName("attack", p.attack))} <small>có bóng</small> · ${escapeHtml(styleName("defense", p.defense))} <small>mất bóng</small>`],
            ...skillRows(p.skills?.open, ["freeKick", "corner", "cornerDefense"].map(k => p.skills?.[k]).filter(Boolean), p.skills?.penalty ?? p.skills?.penaltySave),
            ["Ăn mừng", escapeHtml(CELEBRATION_NAMES[p.celebration] ?? p.celebration ?? "–")], ["Tóm tắt", escapeHtml(p.summary)]] });
        }
        const t = clubs.get(id);
        if (!t) return "";
        const lines = ["GK", "DF", "MF", "FW"].map(r => [ROLE_GROUPS[r], t.players.filter(p => p.role === r).length]);
        const rows = [...t.players].sort((a, b) => b.ovr - a.ovr).map(p => `<div class="club-player">${posBadge(p.role)}<span><b>${escapeHtml(p.short)}</b><small>${escapeHtml(p.pos)} · ${escapeHtml(p.roleName)}</small></span><b class="club-ovr" data-tone="${ovrTone(p.ovr)}">${p.ovr}</b></div>`).join("");
        return `<div class="bd-hero bd-hero-club"><img class="bd-logo" src="${escapeHtml(t.logo)}" alt="" width="96" height="96"><div><span class="bd-kicker">${escapeHtml(t.country)}</span><h3>${escapeHtml(t.name)}</h3><p class="bd-sub">OVR đội hình mạnh nhất ${clubs.strength(t)} · ${lines.map(([n, c]) => c + " " + n.toLowerCase()).join(" · ")}</p></div></div>`
          + `<div class="bd-kits"><figure><img src="${escapeHtml(t.kits.home.image)}" alt="" width="80" height="125" loading="lazy"><figcaption>Sân nhà</figcaption></figure><figure><img src="${escapeHtml(t.kits.away.image)}" alt="" width="80" height="125" loading="lazy"><figcaption>Sân khách</figcaption></figure><p class="bd-text">Đội thứ hai mặc áo sân khách khi hai màu áo giống nhau; thủ môn luôn mặc màu khác cả hai đội.</p></div>`
          + `<h4 class="bd-h">Danh sách 30 cầu thủ</h4><div class="club-players">${rows}</div>`;
      }
    });
  }
  /* Skills */
  const SKILL_GROUPS = [
    ["Tấn công", skill => skill.contexts.includes("attack")],
    ["Phòng ngự", skill => skill.contexts.includes("defense") && !skill.auto],
    ["Thủ môn", skill => skill.auto],
    ["Đá phạt & góc", skill => skill.contexts.some(c => ["directFreeKick", "cornerAttack", "cornerDefense"].includes(c))],
    ["Penalty", skill => skill.contexts.some(c => ["penaltyAttack", "penaltyDefense"].includes(c))]
  ];
  const skillRoles = skill => skill.roles ?? [skill.role];
  function skillTiming(skill) {
    const rules = gameData.skillRules;
    if (skill.auto) return rules.keeperAuto.minutes + " phút đồng hồ trận";
    if (skill.contexts.includes("defense")) return rules.defenseDuration + " giây";
    if (skill.effect === "shield") return rules.duration + " giây";
    return "Tức thì";
  }
  function renderSkillLegend(container) {
    const skills = Object.entries(gameData.skills), rules = gameData.skillRules;
    const browser = makeBrowser(container, {
      cls: "skill-browser", grid: true, title: "Bảng skill",
      lead: "Skill cố định theo cầu thủ, hồi chiêu 10 phút.",
      tabs: () => SKILL_GROUPS.map(([labelText, test]) => ({ label: labelText, items: skills.filter(([, skill]) => test(skill)).map(([kind, skill]) => ({ key: kind,
        html: `<button type="button" class="br-item skill-tile" data-br data-nav data-key="${kind}"><svg viewBox="0 0 24 24" aria-hidden="true">${skillBadge(kind, skill.icon, "tile-" + kind)}</svg><span><b>${escapeHtml(skill.short)}</b><small>${escapeHtml(skill.name)}</small></span></button>` })) })),
      detail: kind => {
        const skill = gameData.skills[kind], openPlay = skill.contexts.some(c => c === "attack" || c === "defense"), penalty = skill.contexts.some(c => c.startsWith("penalty"));
        const cpuKey = bindingsOf("cpu").A?.special, keyA = bindingsOf("local").A?.special, keyB = bindingsOf("local").B?.special;
        return `<div class="bd-hero"><svg class="bd-badge" viewBox="0 0 24 24" aria-hidden="true">${skillBadge(kind, skill.icon, "hero-" + kind)}</svg><div><span class="bd-kicker">${skill.auto ? "Tự kích hoạt" : "Skill"}</span><h3>${escapeHtml(skill.short)}</h3><p class="bd-sub">${escapeHtml(skill.name)}</p></div></div>`
          + '<div class="bd-chips">' + skillRoles(skill).map(r => chip(ROLE_GROUPS[r], ROLE_COLORS[r])).join("") + skill.contexts.map(c => chip(gameData.skillContexts[c].label)).join("") + "</div>"
          + `<p class="bd-text">${escapeHtml(skill.desc)}</p>`
          + facts([["Kích hoạt", skill.auto || penalty ? "Tự động" : `Đấu máy ${kbd(cpuKey)} · Hai người ${kbd(keyA)} / ${kbd(keyB)}`], ["Thời gian", skillTiming(skill)], ["Thể lực", !skill.auto && !penalty ? Math.round(rules.cost * 100) + "% × hệ số thể lực (cầu thủ bền 100 tốn một nửa, 50 tốn đủ)" : "Không tốn"], ["Số lần", penalty ? "Mỗi lượt sút" : skill.auto ? "Tự bật khi bị tấn công · hồi chiêu " + rules.cooldown + " phút" : "Không giới hạn · hồi chiêu " + rules.cooldown + " phút đồng hồ trận"]]);
      }
    });
    keymapRenders.add(() => browser.render());
  }

  /* Ratings and build */
  const STAT_EFFECTS = {
    speed: "Tốc chạy của cầu thủ (AI và khi bạn điều khiển).",
    dribbling: "Giữ bóng khi bị áp sát; lách qua pha vào bóng; đấu với thủ môn lao ra.",
    passing: "Đường chuyền sệt ít bị cắt hơn.",
    longPass: "Ít chuyền dài quá tay ra biên.",
    finishing: "Khả năng ghi bàn khi sút (chế độ chơi).",
    heading: "Đánh đầu khi đón bóng tạt; không chiến ở phạt góc.",
    defending: "Thắng tranh chấp, cướp bóng.",
    strength: "Tranh chấp vai, không chiến.",
    stamina: "Tốc độ mất thể lực; quyết định khi nào bị thay.",
    goalkeeping: "Cứu thua, ôm bóng khi lao ra."
  };
  const BODY_ITEMS = {
    height: ["Chiều cao", "cm", "Cao thắng không chiến và đánh đầu nhiều hơn; thủ môn cao cứu thua rộng hơn. Người thấp (trọng tâm thấp) khó bị cướp bóng hơn và chạy nhanh hơn một chút."],
    weight: ["Cân nặng", "kg", "Nặng tranh chấp vai khỏe hơn nhưng chậm hơn một chút. Tính từ chiều cao và chỉ số khối cơ thể."],
    reach: ["Tầm với", "m", "Độ cao với tay qua đầu: giúp không chiến và giúp thủ môn bắt bóng bổng."],
    sweep: ["Tầm quét chân", "m", "Chân dài với bóng xa hơn khi tranh bóng và khi xoạc."]
  };
  function renderStatsGuide(container) {
    const rules = gameData.stats;
    const tone = v => levelOf(v);
    makeBrowser(container, {
      cls: "stats-browser", title: "Chỉ số &amp; hình thể",
      lead: "Thang 1–99 · xanh ≥80, vàng 65–79, đỏ dưới 65.",
      tabs: () => [
        { label: "Chỉ số", items: rules.keys.map(k => ({ key: "stat:" + k, html: `<button type="button" class="br-item stat-row" data-br data-nav data-key="stat:${k}"><b class="code-cap">${rules.short[k]}</b><span><b>${rules.labels[k]}</b><small>${STAT_EFFECTS[k]}</small></span></button>` })) },
        { label: "Hình thể", items: Object.entries(BODY_ITEMS).map(([k, [name, unit]]) => ({ key: "body:" + k, html: `<button type="button" class="br-item stat-row" data-br data-nav data-key="body:${k}"><b class="code-cap">${unit}</b><span><b>${name}</b><small>${BODY_ITEMS[k][2].split(";")[0]}</small></span></button>` })) },
        { label: "OVR theo vị trí", items: Object.keys(rules.weights).map(r => ({ key: "ovr:" + r, html: `<button type="button" class="br-item stat-row" data-br data-nav data-key="ovr:${r}"><b class="code-cap" style="--cap:${ROLE_COLORS[r]}">${LINE_LABEL[r]}</b><span><b>${ROLE_GROUPS[r]}</b><small>OVR = trung bình có trọng số các chỉ số quan trọng ở vị trí này.</small></span></button>` })) }
      ],
      detail: key => {
        const [kind, id] = key.split(":");
        if (kind === "stat") {
          return `<div class="bd-hero"><b class="bd-code">${rules.short[id]}</b><div><span class="bd-kicker">Chỉ số</span><h3>${rules.labels[id]}</h3></div></div><p class="bd-text">${STAT_EFFECTS[id]}</p>`
            + '<h4 class="bd-h">Mức nền theo vị trí</h4>' + bars(Object.keys(rules.base).map(r => { const v = Math.max(rules.range[0], rules.base[r][id]); return [ROLE_GROUPS[r], v - 20, 75, v, tone(v)]; }))
            + '<h4 class="bd-h">Trọng số trong OVR</h4>' + bars(Object.keys(rules.weights).map(r => [ROLE_GROUPS[r], rules.weights[r][id] ?? 0, .7, rules.weights[r][id] ? Math.round(rules.weights[r][id] * 100) + "%" : "—"]))
            + '<h4 class="bd-h">Lối chơi</h4><p class="bd-text">Lối chơi không đổi chỉ số: nó quyết định cầu thủ tự làm gì khi không được điều khiển.</p>';
        }
        if (kind === "body") {
          const [name, unit, text] = BODY_ITEMS[id], body = gameData.body;
          const ranges = id === "height" ? bars(Object.entries(body.height).map(([r, [lo, hi]]) => [ROLE_GROUPS[r], hi - 150, 55, lo + "–" + hi + " cm"])) : "";
          return `<div class="bd-hero"><b class="bd-code">${unit}</b><div><span class="bd-kicker">Hình thể</span><h3>${name}</h3></div></div><p class="bd-text">${text}</p>`
            + (ranges ? '<h4 class="bd-h">Theo vị trí</h4>' + ranges : "")
            + (id === "weight" ? facts([["Chỉ số khối cơ thể", body.bmi.join("–").replace(/\./g, ",")], ["Giới hạn", "45–110 kg"]]) : "")
            + (id === "reach" || id === "sweep" ? facts([["Tỉ lệ tay/chân", body.limbs.map(v => v.toFixed(2).replace(".", ",")).join("–")], ["Tính từ", id === "reach" ? "Chiều cao × tay" : "Chiều cao × chân"]]) : "")
            + "";
        }
        const weights = Object.entries(rules.weights[id]).sort((a, b) => b[1] - a[1]);
        return `<div class="bd-hero"><b class="bd-code" style="background:${ROLE_COLORS[id]}">${LINE_LABEL[id]}</b><div><span class="bd-kicker">OVR</span><h3>${ROLE_GROUPS[id]}</h3></div></div><p class="bd-text">OVR là trung bình có trọng số; cầu thủ đá trái vị trí bị tính theo vị trí đang đá.</p>`
          + bars(weights.map(([k, w]) => [rules.labels[k], w, .7, Math.round(w * 100) + "%"]));
      }
    });
  }

  /* Playing styles */
  const STYLE_HOME = { FW: [.53, .27], MF: [.37, .5], DF: [.2, .3], GK: [.03, .5] };
  function styleTraits(s) {
    const t = [], attack = s.phase === "attack";
    if (attack) {
      if (s.push > .05) t.push("Dâng cao khi có bóng"); if (s.push < -.03) t.push("Lùi về nhận bóng");
      if (s.width > 1.15) t.push("Ôm sát biên"); if (s.width < .6 && s.width !== 1) t.push("Đá trung lộ");
      if (s.swing > 0) t.push("Dạt về phía có bóng"); if (s.swing < 0) t.push("Rình phía xa bóng");
      if (s.lurk) t.push("Chờ ở rìa vòng cấm"); if (s.roam > 1.2) t.push("Đi khắp mặt sân"); if (s.cap > .1) t.push("Được phép dâng lên");
      if (s.shoot > 0) t.push("Sút sớm, sút xa"); if (s.dribble > .15) t.push("Thích đi bóng"); if (s.dribble < 0) t.push("Ít rê, chơi một chạm");
      if (s.cross) t.push("Hay tạt bóng"); if (s.combo > 1.5) t.push("Phối hợp nhiều"); if (s.chain > 1) t.push("Chuyền nhiều nhịp");
      if (s.long > .4) t.push("Chuyền dài"); if (s.short) t.push("Triển khai ngắn"); if (s.header) t.push("Đánh đầu tốt");
      if (s.target.through) t.push("Được tìm bằng bóng chọc khe"); if (s.target.box) t.push("Được tạt vào"); if (s.target.long) t.push("Được phất dài tới"); if (s.target.short) t.push("Được chuyền ngắn tới");
      if (s.line > .02) t.push("Thủ môn đứng cao");
    } else {
      if (s.drop > .05) t.push("Đứng cao khi mất bóng"); if (s.drop < -.05) t.push("Lùi sâu khi mất bóng");
      if (s.press > .3) t.push("Áp sát mạnh"); if (s.press < -.3) t.push("Ít áp sát"); if (s.pressHigh) t.push("Pressing từ tuyến đầu");
      if (s.outlet) t.push("Điểm nhận bóng phản công"); if (s.tackle) t.push("Vào bóng quyết liệt"); if (s.intercept) t.push("Cắt đường chuyền");
      if (s.mark) t.push("Kèm người"); if (s.screen) t.push("Che đường bóng tới khung thành"); if (s.roam > 1.2) t.push("Lên xuống liên tục");
      if (s.width < .6 && s.width !== 1) t.push("Thu vào trung lộ");
      if (s.line > .03) t.push("Dâng tuyến"); if (s.line < 0) t.push("Đứng thấp"); if (s.rush > 0) t.push("Lao ra sớm"); if (s.rush < 0) t.push("Ít lao ra");
      if (s.save) t.push("Cứu thua tốt hơn"); if (s.confidence) t.push("Tự tin bắt bóng bổng");
    }
    return t;
  }
  /** Where a style takes a man compared with his plain position, drawn on a small pitch (his goal at the bottom). */
  function styleDiagram(s, role) {
    const home = STYLE_HOME[role], attack = s.phase === "attack";
    let d = home[0] + (role === "GK" ? s.line * 2 : (attack ? .08 + s.push : -.07 + s.drop)), w = .5 + (home[1] - .5) * s.width;
    if (attack && s.lurk) d += (.64 - d) * s.lurk;
    if (!attack && s.screen) { d -= .08 * s.screen; w += (.5 - w) * s.screen; }
    w += s.swing * .3;
    const P = ([dd, ww]) => [(8 + ww * 104).toFixed(1), (150 - dd / .75 * 138).toFixed(1)], [x0, y0] = P(home), [x1, y1] = P([clamp(d, .02, .8), clamp(w, .06, .94)]);
    const by = Number(y1) < 40 ? Number(y1) + 18 : Number(y1) - 14;
    const ball = s.swing ? `<circle class="sd-ball" cx="104" cy="${by.toFixed(1)}" r="5"/><text class="sd-note" x="104" y="${(by - 9).toFixed(1)}">bóng</text>` : "";
    const ring = r => Math.min(r, Number(x1) - 4, 116 - Number(x1), Number(y1) - 4, 156 - Number(y1)).toFixed(1);
    const roam = s.roam > 1.2 ? `<circle class="sd-roam" cx="${x1}" cy="${y1}" r="${ring(10 * s.roam)}"/>` : "";
    const rush = s.rush > 0 ? `<circle class="sd-roam" cx="${x1}" cy="${y1}" r="${ring(14 + s.rush * 5)}"/>` : "";
    return `<svg class="style-diagram" viewBox="0 0 120 160" role="img" aria-label="Vị trí điển hình"><rect x="4" y="4" width="112" height="152" rx="6"/><path d="M4 80h112M40 156v-16h40v16M40 4v16h40V4"/><circle cx="60" cy="80" r="14"/>${roam}${rush}${ball}`
      + `<circle class="sd-home" cx="${x0}" cy="${y0}" r="6"/><path class="sd-arrow" d="M${x0} ${y0}L${x1} ${y1}"/><circle class="sd-spot" cx="${x1}" cy="${y1}" r="7" style="fill:${ROLE_COLORS[role]}"/></svg>`;
  }
  function renderStyleLegend(container) {
    makeBrowser(container, {
      cls: "style-browser", title: "Phong cách chơi",
      lead: "Một kiểu khi có bóng, một kiểu khi mất bóng.",
      tabs: () => Object.entries(ROLE_GROUPS).map(([role, labelText]) => ({ label: labelText, items: [["attack", "Khi có bóng"], ["defense", "Khi mất bóng"]].flatMap(([phase, group]) =>
        Object.entries(gameData.playstyles[phase]).filter(([, s]) => s.roles.includes(role)).map(([id, s]) => ({ key: phase + ":" + id + ":" + role, group,
          html: `<button type="button" class="br-item style-row" data-br data-nav data-key="${phase}:${id}:${role}"><i class="phase-dot" data-phase="${phase}"></i><span><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.tag)}</small></span></button>` }))) })),
      detail: key => {
        const [phase, id, role] = key.split(":"), s = gameData.playstyles[phase][id];
        return `<div class="bd-hero bd-hero-style">${styleDiagram(s, role)}<div><span class="bd-kicker">${phase === "attack" ? "Khi có bóng · tấn công" : "Khi mất bóng · phòng ngự"}</span><h3>${escapeHtml(s.name)}</h3><p class="bd-sub">${escapeHtml(s.tag)}</p>${chip(ROLE_GROUPS[role], ROLE_COLORS[role])}</div></div>`
          + `<p class="bd-text">${escapeHtml(s.desc)}</p><h4 class="bd-h">Cách chơi</h4><div class="bd-chips">${styleTraits(s).map(x => chip(x)).join("")}</div>`;
      }
    });
  }

  /* Keyboard picture, shared by the key layouts and the controls */
  const KB_ROWS = [
    ["Escape", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
    ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"]
  ];
  const KB_NAMES = { Escape: "Esc", Tab: "Tab", Enter: "Enter", Space: "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  /** marks: code → { text, slot, hot } */
  function keyboardHtml(marks, caption = "") {
    const key = code => {
      const m = marks.get(code);
      return `<span class="kb-key" data-code="${code}"${m ? ` data-slot="${m.slot ?? "A"}"` : ""}${m?.hot ? " data-hot" : ""}${code === "Space" ? ' data-wide' : ""}><b>${escapeHtml(KB_NAMES[code] ?? label(code))}</b>${m ? `<small>${escapeHtml(m.text)}</small>` : ""}</span>`;
    };
    const missing = [...marks.keys()].filter(code => !KB_ROWS.flat().includes(code) && !["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code));
    return '<div class="kb" aria-hidden="true">' + KB_ROWS.map((row, i) => `<div class="kb-row" style="--indent:${[0, 0, 1.2, 1.8][i]}">${row.map(key).join("")}</div>`).join("")
      + `<div class="kb-row kb-bottom"><span class="kb-gap"></span>${key("Space")}<span class="kb-arrows">${key("ArrowUp")}${key("ArrowLeft")}${key("ArrowDown")}${key("ArrowRight")}</span></div></div>`
      + (missing.length ? `<p class="kb-more">Phím khác: ${missing.map(code => kbd(code) + " " + escapeHtml(marks.get(code).text)).join(" · ")}</p>` : "") + (caption ? `<p class="kb-caption">${caption}</p>` : "");
  }
  const SHORT_ACTION = { up: "Lên", down: "Xuống", left: "Trái", right: "Phải", switch: "Đổi", sprint: "Chạy", pass: "Chuyền", shoot: "Sút", press: "Bám", challenge: "Tranh", special: "Skill", pause: "Dừng" };
  function marksFor(sets, hot = []) {
    const marks = new Map();
    for (const [slot, set] of sets) for (const action of keymap.ACTIONS) if (set?.[action]) marks.set(set[action], { text: SHORT_ACTION[action], slot, hot: hot.includes(action) && sets.length === 1 });
    return marks;
  }

  /* Controls: one tab per player of each mode, and the menus */
  const MOVE_GROUP = ["up", "left", "down", "right"];
  const ACTION_NOTES = {
    move: "Di chuyển theo hướng màn hình. Penalty: trái, giữa, phải.",
    switch: "Đổi sang người gần bóng; giữ để đổi liên tục. Có bóng: gọi đồng đội chạy chỗ.",
    sprint: "Giữ để chạy nhanh.",
    pass: "Giữ nạp lực, thả để chuyền. Bấm 2 lần: chuyền siêu tốc. Phạt góc: " + gameData.corners[0].name.toLowerCase() + ".",
    shoot: "Có bóng: giữ nạp lực, thả để sút; bấm 2 lần: sút thần sầu. Không bóng: xoạc. Phạt góc: " + gameData.corners[1].name.toLowerCase() + ".",
    press: "Giữ để áp sát. Phạt góc: " + gameData.corners[2].name.toLowerCase() + ".",
    challenge: "Bấm khi gần đối thủ để tranh bóng. Phạt góc: " + gameData.corners[3].name.toLowerCase() + ".",
    special: "Dùng skill; hồi chiêu 10 phút.",
    pause: "Tạm dừng. Hai người: mỗi bên 3 lượt, 60 giây mỗi lượt."
  };
  const MENU_KEYS = [
    ["nav", "Chọn trong menu", ["ArrowUp", "ArrowDown", "KeyW", "KeyS"], "↑ ↓ (hoặc W S) di chuyển con trỏ trong mọi menu."],
    ["side", "Đổi giá trị · đổi đội · đổi trang", ["ArrowLeft", "ArrowRight", "KeyA", "KeyD"], "← → đổi giá trị ở hàng cài đặt, đổi đội trong Kế hoạch trận, đổi trang thông tin cầu thủ."],
    ["enter", "Xác nhận", ["Enter"], "Mở mục đang chọn; ở màn chuẩn bị là vào sân."],
    ["space", "Bắt đầu · tạm dừng · tiếp tục", ["Space"], "Trong trận: bắt đầu, tạm dừng và tiếp tục."],
    ["esc", "Menu trận · quay lại", ["Escape"], "Trong trận mở menu trận; ở các màn khác quay lại màn trước."],
    ["tabs", "Đổi nhóm", ["KeyQ", "KeyE"], "Q E đổi nhóm trong Thông tin game và đổi mục trong Kế hoạch trận."],
    ["sub", "Thay người", ["KeyX"], "Trong Kế hoạch trận: chọn người ra và người vào."],
    ["peek", "Xem nhanh chỉ số", ["Tab"], "Giữ Tab khi đang đá để xem hai thẻ chỉ số mà không dừng trận."]
  ];
  function controlsItems(set) {
    if (!set) return MENU_KEYS.map(([id, title, codes]) => ({ key: "menu:" + id, html: `<button type="button" class="br-item ctl-row" data-br data-nav data-key="menu:${id}"><span class="km-cap">${codes.slice(0, 2).map(c => `<kbd>${escapeHtml(KB_NAMES[c] ?? label(c))}</kbd>`).join("")}</span><span><b>${title}</b></span></button>` }));
    return [{ key: "move", html: `<button type="button" class="br-item ctl-row" data-br data-nav data-key="move"><span class="km-cap">${MOVE_GROUP.map(a => kbd(set[a])).join("")}</span><span><b>Di chuyển</b><small>Theo hướng màn hình</small></span></button>` },
      ...[...GUIDE_ACTIONS, "special", "pause"].map(a => ({ key: a, html: `<button type="button" class="br-item ctl-row" data-br data-nav data-key="${a}"><span class="km-cap">${kbd(set[a])}</span><span><b>${a === "special" ? "Skill" : a === "pause" ? "Tạm dừng · menu trận" : GUIDE_LABELS[GUIDE_ACTIONS.indexOf(a)]}</b><small>${a === "special" || a === "pause" ? "Bấm" : GUIDE_GESTURES[GUIDE_ACTIONS.indexOf(a)]}</small></span></button>` }))];
  }
  function controlsDetail(key, tab) {
    const set = tab.set;
    if (!set) {
      const [, id] = key.split(":"), [, title, codes, text] = MENU_KEYS.find(m => m[0] === id);
      return `<h3 class="bd-title">${title}</h3><p class="bd-text">${text}</p>` + keyboardHtml(new Map(codes.map(c => [c, { text: title.split(" ")[0], slot: "M", hot: true }])));
    }
    const actions = key === "move" ? MOVE_GROUP : [key], title = key === "move" ? "Di chuyển" : key === "special" ? "Skill" : key === "pause" ? "Tạm dừng · menu trận" : GUIDE_LABELS[GUIDE_ACTIONS.indexOf(key)];
    return `<h3 class="bd-title">${title} ${actions.map(a => kbd(set[a])).join("")}</h3><p class="bd-text">${ACTION_NOTES[key === "move" ? "move" : key]}</p>` + keyboardHtml(marksFor([[tab.slot, set]], actions), tab.caption ?? "");
  }
  function makeControlsBrowser(container, sources, { title = "Điều khiển", lead = "", onLeave } = {}) {
    return makeBrowser(container, {
      cls: "controls-browser", title, lead, onLeave,
      tabs: () => sources().map(src => ({ ...src, items: controlsItems(src.set) })),
      detail: controlsDetail
    });
  }
  let controlsInfo = null;
  function renderControlsGuide() {
    const pane = document.querySelector('#screen-info .info-pane[data-pane="controls"]');
    if (!pane) return;
    refreshControls("cpu"); refreshControls("local");
    if (!controlsInfo) controlsInfo = makeControlsBrowser(pane, () => [
      { label: "Đấu với máy", slot: "A", set: bindingsOf("cpu").A, caption: "Bạn · đấu với máy" },
      { label: "Hai người · A", slot: "A", set: bindingsOf("local").A, caption: "Người A" },
      { label: "Hai người · B", slot: "B", set: bindingsOf("local").B, caption: "Người B" },
      { label: "Trong menu", slot: "M", set: null }
    ], { lead: "Đổi phím ở mục Layout phím." });
    else controlsInfo.render();
  }

  /* Difficulty and rules */
  const RULE_ITEMS = [
    ["time", "Thời lượng", "2–10 phút bóng lăn, hai hiệp, đổi sân giữa hiệp. Hiệp phụ và luân lưu tuỳ chọn ở màn chuẩn bị."],
    ["corner", "Phạt góc", "Chỉ có phạt góc khi bóng chạm hậu vệ chắn đường hoặc thủ môn đẩy ra. Người đá góc chọn một trong bốn kiểu: " + gameData.corners.map(c => c.name.toLowerCase()).join(", ") + "."],
    ["free", "Đá phạt · phạt góc", "Đội phòng ngự luôn lùi 5 m khi chờ đá phạt/phạt góc, dù người đá chờ bao lâu. Người chạy chỗ, người kèm và hàng rào giữ nguyên vị trí cho tới khi bóng được đá."],
    ["goalkick", "Phát bóng", "Bóng qua vạch cuối sân: thủ môn đi về đứng trước khung thành, bóng đặt trước gôn và mọi người chờ; thủ môn phải chuyền để đưa bóng vào cuộc (đội người chơi: nhấn phím chuyền), không được dẫn bóng."],
    ["stamina", "Thể lực", "Cầu thủ mất sức dần trong cả trận, nhanh hơn khi chạy nhiều; dưới 70% thể lực mọi chỉ số giảm dần (tới −20% khi kiệt sức) và chạy chậm lại. Skill tốn 25%, sút thần sầu 15%, chuyền siêu tốc 4,5%, nhân hệ số theo chỉ số Thể lực: bền 100 chỉ tốn một nửa, 50 tốn đủ, 30 tốn thêm 20%."],
    ["odds", "Thủ môn và tỉ lệ skill", "Các tỉ lệ cố định chỉ là mốc ở chỉ số 82: skill sút vào 70% (thủ môn giỏi bớt tới 8 điểm, tiền đạo giỏi thêm tới 4), skill thủ môn giảm thủng lưới theo mức của skill ±5 điểm, penalty đoán đúng bắt 100/80/80/20% ±8 điểm theo Bắt bóng (và ∓5 theo Dứt điểm người sút)."],
    ["swap", "Đổi vị trí · OVR theo vị trí", "Mỗi cầu thủ có OVR riêng cho từng vị trí (TM/HV/TV/TĐ); OVR đội là trung bình của 6 người theo vị trí đang đá. Trong Kế hoạch trận có thể đổi chỗ hai người trên sân; đổi sơ đồ hay thay người tự động sẽ tự xếp lại cho OVR đội cao nhất."],
    ["goal", "Sau bàn thắng", "Trọng tài chỉ thổi giao bóng khi hai đội đã về hết nửa sân nhà."],
    ["cards", "Thẻ phạt", "Tranh bóng: 30% lỗi nhẹ, 15% lỗi đáng thẻ vàng, 5% lỗi nặng. Xoạc trúng người: 50% cướp bóng, 50% thẻ đỏ."],
    ["injury", "Chấn thương", "Xe cấp cứu đưa đi, không vào lại trận đó; đôi khi quay lại ngồi ghế dự bị với băng gạc. Luôn có người dự bị vào thay nếu còn."],
    ["subs", "Thay người", "Chỉ lúc bóng chết. Tự động thay người là tùy chọn; tự chọn trong Kế hoạch trận (trước giờ bóng lăn đổi ngay). Người vào do bạn chọn đá đúng chỗ người ra; thay người tự động thì đội tự xếp lại vị trí."],
    ["tactics", "Chiến thuật", "Sơ đồ bạn chọn được giữ nguyên; bật Tự động đổi chiến thuật để máy đổi theo tỉ số. Mỗi lần đổi sơ đồ, cầu thủ được xếp lại vị trí cho OVR đội cao nhất. Bị đuổi người thì đội tự bớt một vị trí cùng kiểu."],
    ["switch", "Tự động đổi người", "Mặc định bật: khi mất bóng, con trỏ tự nhảy sang đồng đội gần bóng nhất (hoặc gần điểm bóng rơi); người bạn vừa chọn tay được giữ 1,2 giây. Tắt trong Kế hoạch trận → Hỗ trợ hoặc ở màn chuẩn bị."]
  ];
  const PEN_ITEMS = [
    ["wrong", "Thủ môn đoán sai hướng", 100, "Sút khác hướng thủ môn đổ người luôn vào lưới."],
    ["saver", "Đoán đúng · thủ môn có Bắt pen", 0, "Thủ môn có Bắt pen đoán đúng thì bắt được khoảng 100%; nếu người sút có Sút pen thì còn bắt khoảng 80%. Mỗi mốc dịch tới ±8 điểm theo chỉ số Bắt bóng của thủ môn và ∓5 điểm theo Dứt điểm của người sút."],
    ["plain", "Đoán đúng · không có Bắt pen", 20, "Thủ môn không có Bắt pen đoán đúng thì bắt khoảng 80%; người sút có Sút pen thì chỉ còn bắt khoảng 20%. Dịch theo chỉ số như trên."],
    ["who", "Ai có skill penalty", 30, "Chỉ khoảng 30% cầu thủ sân có Sút pen và 50% thủ môn có Bắt pen. Skill penalty tự bật ở mọi lượt sút, không cần bấm phím."]
  ];
  function renderRulesGuide(container) {
    const levels = gameData.difficulty;
    makeBrowser(container, {
      cls: "rules-browser", title: "Độ khó &amp; luật",
      lead: "Độ khó chỉ áp dụng cho đội máy.",
      tabs: () => [
        { label: "Độ khó", items: Object.entries(levels).map(([id, d]) => ({ key: "level:" + id, html: `<button type="button" class="br-item level-row" data-br data-nav data-key="level:${id}" data-level-id="${id}"><b class="level-dot"></b><span><b>${d.name}</b><small>${(d.stats > 0 ? "+" : "") + d.stats} chỉ số đội máy</small></span></button>` })) },
        { label: "Penalty", items: PEN_ITEMS.map(([id, title]) => ({ key: "pen:" + id, html: `<button type="button" class="br-item rule-row" data-br data-nav data-key="pen:${id}"><span><b>${title}</b></span></button>` })) },
        { label: "Trận đấu", items: RULE_ITEMS.map(([id, title]) => ({ key: "rule:" + id, html: `<button type="button" class="br-item rule-row" data-br data-nav data-key="rule:${id}"><span><b>${title}</b></span></button>` })) }
      ],
      detail: key => {
        const [kind, id] = key.split(":");
        if (kind === "level") {
          const d = levels[id];
          return `<div class="bd-hero"><b class="bd-code" data-level-id="${id}">${d.name.slice(0, 1)}</b><div><span class="bd-kicker">Độ khó máy</span><h3>${d.name}</h3></div></div>`
            + bars([["Chỉ số cả đội", d.stats + 10, 20, (d.stats > 0 ? "+" : "") + d.stats], ["Tranh bóng", d.tackle, 1.6, "×" + d.tackle], ["Đọc đường chuyền", d.intercept, 1.6, "×" + d.intercept], ["Dứt điểm", d.finishing, 1.3, "×" + d.finishing], ["Thủ môn", d.keeper + .1, .2, (d.keeper > 0 ? "+" : "") + Math.round(d.keeper * 100) + " điểm %"], ["Ra quyết định", 2 - d.think, 1.6, d.think === 1 ? "bình thường" : d.think > 1 ? "chậm " + Math.round((d.think - 1) * 100) + "%" : "nhanh " + Math.round((1 - d.think) * 100) + "%"]]);
        }
        if (kind === "pen") {
          const [, title, goal, text] = PEN_ITEMS.find(p => p[0] === id);
          return `<h3 class="bd-title">${title}</h3><div class="bd-gauge" style="--v:${goal}"><b>${goal}%</b><small>${id === "who" ? "cầu thủ sân có Sút pen" : "khả năng vào lưới"}</small></div><p class="bd-text">${text}</p>`;
        }
        const [, title, text] = RULE_ITEMS.find(r => r[0] === id);
        return `<h3 class="bd-title">${title}</h3><p class="bd-text">${text}</p>`;
      }
    });
  }

  /** Redraws every key hint in a mode's panel (pitch guide, controls sheet, skill keys) from the layouts in use. */
  function renderPanelKeys(panel) {
    const mode = panel.dataset.mode;
    refreshControls(mode);
    const bindings = bindingsOf(mode);
    for (const guide of panel.querySelectorAll(".pad-help")) if (bindings[guide.dataset.slot]) renderGuide(guide, bindings[guide.dataset.slot]);
    panel.controlsBrowser?.render();
    for (const special of panel.querySelectorAll(".special-button kbd")) {
      const slot = special.closest("[data-slot]").dataset.slot;
      if (bindings[slot]) special.textContent = label(bindings[slot].special);
    }
    const session = sessions.get(mode);
    if (session) { session.hudNodes = null; session.restartHints = null; updateHud(session); }
    highlightPads();
  }
  const writeText = (node, value) => { const text = String(value); if (node.textContent !== text) node.textContent = text; };
  const pendingShots = new Map(), chargeStarts = new Map();
  let activeMode = "watch";
  let watcher = null;

  function acceptsKeys(session) {
    const focused = document.activeElement;
    return !!session && !session.paused && session === sessions.get(activeMode) && session.arena.contains(focused) && !focused.matches("button, input, select, textarea");
  }
  /** Sends held directions to the engine. The engine decides whether the current phase lets anyone move. */
  function applyKeys(session = sessions.get(activeMode)) {
    if (!session) return;
    const live = acceptsKeys(session);
    for (const [slot, b] of Object.entries(bindingsOf(session.options.mode))) {
      session.api.setInput(slot, !live ? {} : {
        x: Number(keys.has(b.right)) - Number(keys.has(b.left)),
        y: Number(keys.has(b.down)) - Number(keys.has(b.up)), sprint: keys.has(b.sprint),
        pressing: keys.has(b.press) && session.api.cornerSlot() !== slot
      });
    }
  }
  function stopSwitchRepeats() {
    for (const repeat of switchRepeats.values()) clearTimeout(repeat.timer);
    switchRepeats.clear();
  }
  function releaseKeys() {
    keys.clear();
    stopSwitchRepeats();
    highlightPads();
    cancelKicks();
    for (const session of sessions.values()) {
      session.api.setInput("A"); session.api.setInput("B");
    }
  }
  function cancelKicks() {
    for (const pending of pendingShots.values()) clearTimeout(pending.timer);
    pendingShots.clear(); chargeStarts.clear();
    for (const session of sessions.values()) { session.api.cancelCharge("A"); session.api.cancelCharge("B"); }
  }
  function highlightPads() {
    for (const key of document.querySelectorAll(".pad-key, .action-key")) key.classList.toggle("is-held", keys.has(key.dataset.code));
  }
  function repeatSwitch(session, code, slot) {
    const previous = switchRepeats.get(code);
    if (previous) clearTimeout(previous.timer);
    const repeat = { timer: null };
    switchRepeats.set(code, repeat);
    const advance = () => {
      if (switchRepeats.get(code) !== repeat) return;
      // On the ball the key calls one run per press; holding it does not keep calling.
      if (!keys.has(code) || !acceptsKeys(session) || session.api.status().ended || session.api.status().players.find(p => p.slot === slot)?.hasBall) {
        switchRepeats.delete(code); return;
      }
      session.api.action(slot, "switch"); updateHud(session);
      repeat.timer = setTimeout(advance, gameData.controls.switchRepeatMs);
    };
    repeat.timer = setTimeout(advance, gameData.controls.switchHoldDelayMs);
  }
  const focusOn = node => node?.focus({ preventScroll: true });

  /* ------------------------------ in-game menus ------------------------------ */
  // A match (or the watched match) has one menu over the stage: before kick-off, when paused and at full time.
  // Sheets open from it: the squads with every rating, and this match's controls.
  function buildOverlay(arena, items) {
    const overlay = document.createElement("div"); overlay.className = "start-overlay"; overlay.hidden = true;
    overlay.innerHTML = '<div class="pause-layout"><div class="pause-menu" role="menu" aria-label="Menu trận">'
      + items.map(([act, text, extra = ""]) => `<button type="button" class="menu-item${extra}" role="menuitem" data-nav data-act="${act}"><span class="menu-item-text">${text}</span></button>`).join("")
      + '</div><div class="pause-card"><span class="pause-kicker"></span><strong class="pause-title"></strong><span class="pause-text"></span><span class="pause-prompts"><span><kbd>↑</kbd><kbd>↓</kbd> Chọn</span><span><kbd>Enter</kbd> Xác nhận</span><span><kbd>F</kbd> Toàn màn hình</span><span class="pause-prompt-space"><kbd>Space</kbd> <i>Tiếp tục</i></span></span></div></div>';
    arena.append(overlay);
    return overlay;
  }
  function buildSheet(arena, name, title, body) {
    const sheet = document.createElement("div"); sheet.className = "sheet"; sheet.dataset.sheet = name; sheet.hidden = true; sheet.tabIndex = -1;
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", title);
    sheet.innerHTML = '<div class="sheet-head"><button type="button" class="sheet-back" data-nav data-act="close-sheet"><span aria-hidden="true">‹</span> Quay lại <kbd>Esc</kbd></button><h2>' + title + '</h2><span class="sheet-peek-note">Thả <kbd>Tab</kbd> để đá tiếp</span></div><div class="sheet-body">' + body + "</div>";
    arena.append(sheet);
    sheet.querySelector(".sheet-back").addEventListener("click", () => closeSheet(sheet));
    return sheet;
  }
  const SQUAD_SHEET = '<div class="player-status"></div>';
  function setBackdropInert(arena, sheet, on) {
    for (const child of arena.children) if (child !== sheet) child.inert = on;
  }
  function openSheet(view, name, opener) {
    const sheet = view.arena.querySelector('.sheet[data-sheet="' + name + '"]');
    if (!sheet) return;
    sheet.classList.remove("is-peek"); sheet.hidden = false; sheet.opener = opener ?? null;
    setBackdropInert(view.arena, sheet, true);
    sheet.querySelector(".sheet-body").scrollTop = 0;
    focusOn(sheet.querySelector(".sheet-back"));
  }
  function closeSheet(sheet) {
    setBackdropInert(sheet.parentElement, sheet, false);
    sheet.hidden = true; sheet.classList.remove("is-peek");
    const opener = sheet.opener; sheet.opener = null;
    if (opener && !opener.closest("[hidden]")) focusOn(opener);
  }
  function closeSheets(root) {
    for (const sheet of root.querySelectorAll(".sheet")) { if (!sheet.hidden) setBackdropInert(sheet.parentElement, sheet, false); sheet.hidden = true; sheet.classList.remove("is-peek"); sheet.opener = null; }
  }
  /** Holding Tab during play shows the rating cards over the pitch without stopping the match. */
  function peek(view, on) {
    const sheet = view?.arena.querySelector('.sheet[data-sheet="squad"]');
    if (!sheet) return;
    if (on) { if (sheet.hidden) { sheet.classList.add("is-peek"); sheet.hidden = false; } }
    else if (sheet.classList.contains("is-peek")) { sheet.hidden = true; sheet.classList.remove("is-peek"); }
  }
  const endPeeks = () => { for (const view of [watchView, ...sessions.values()]) peek(view, false); };
  /** Shows the match menu: "start" before kick-off, "pause", "end" at full time; null hides it. */
  function showOverlay(view, kind, focusMenu = false) {
    const overlay = view.overlay;
    if (!kind) {
      const hadFocus = overlay.contains(document.activeElement);
      overlay.hidden = true;
      if (hadFocus) focusOn(view.arena);
      syncPauseTools(view);
      return;
    }
    const state = view.api?.status?.();
    if (state?.ended && view !== watchView) kind = "end";
    overlay.hidden = false; overlay.dataset.kind = kind;
    const score = state ? `${shortOf(view, "R")} ${state.score.R} – ${state.score.B} ${shortOf(view, "B")}` : "";
    const minute = state && !state.ended && !view.awaitingStart ? ` · ${state.extraTime ? "Hiệp phụ · " : ""}${state.minute}'` : "";
    const timeout = view.timeout, who = timeout ? (view.options?.mode === "cpu" ? "Bạn" : "Người " + timeout.slot) : "";
    const kicker = view === watchView ? "Chỉ xem · tạm dừng" : kind === "pause" && timeout ? `Tạm dừng của ${who} · lượt ${timeout.used}/${TIMEOUTS}` : { start: "Sẵn sàng", pause: "Tạm dừng", end: "Hết trận" }[kind];
    const title = kind === "end" ? (state.winner ? `${nameOf(view, state.winner)} chiến thắng!` : "Hai đội hòa!") : view.awaitingStart ? `${nameOf(view, "R")} vs ${nameOf(view, "B")}` : score + minute;
    const text = kind === "end" ? score + (state.penalty ? ` · Luân lưu ${state.penalty.score.R}–${state.penalty.score.B}` : "")
      : kind === "start" ? "Nhấn Space để bắt đầu trận đấu" : view === watchView ? "Nhấn Space để xem tiếp" : kind === "pause" && timeout ? `Còn ${timeoutLeft(view)} giây · Space để đá tiếp` : "Nhấn Space để tiếp tục trận đấu";
    writeText(overlay.querySelector(".pause-kicker"), kicker);
    writeText(overlay.querySelector(".pause-title"), title);
    overlay.querySelector(".pause-text").innerHTML = escapeHtml(text).replace("Space", "<kbd>Space</kbd>");
    const resume = overlay.querySelector('[data-act="resume"]');
    resume.hidden = kind === "end";
    writeText(resume.querySelector(".menu-item-text"), kind === "start" ? "Bắt đầu" : "Tiếp tục");
    overlay.querySelector(".pause-prompt-space").hidden = kind === "end";
    writeText(overlay.querySelector(".pause-prompt-space i"), kind === "start" ? "Bắt đầu" : "Tiếp tục");
    overlay.querySelector('[data-act="restart"]')?.classList.toggle("is-featured", kind === "end");
    // In a two-player match the squads and tactics can only be touched during a side's own timeout.
    const plan = overlay.querySelector('[data-act="plan"]');
    if (plan && view !== watchView) plan.hidden = view.options?.mode === "local" && kind === "pause" && !view.timeout;
    if (focusMenu) focusOn((kind === "end" && overlay.querySelector('[data-act="restart"]')) || [...overlay.querySelectorAll(".menu-item")].find(item => !item.hidden));
    syncPauseTools(view);
  }
  function syncPauseTools(view) {
    const button = view.arena.querySelector(".arena-tools .pause");
    if (!button) return;
    const resume = !view.overlay.hidden && view.overlay.dataset.kind !== "end", text = resume ? (view.awaitingStart ? "Bắt đầu" : "Tiếp tục") + " (Space)" : "Tạm dừng (Space)";
    button.classList.toggle("is-paused", resume);
    button.setAttribute("aria-label", text); button.title = text;
  }
  // Two-player matches: each side may stop the clock three times for a minute to change players or tactics.
  const TIMEOUTS = 3, TIMEOUT_SECONDS = 60;
  const timeoutLeft = view => view.timeout ? Math.max(0, Math.ceil((view.timeout.until - performance.now()) / 1000)) : 0;
  /** A pause asked for by a player: free against the computer, one of his timeouts in a two-player match. */
  function requestPause(session, slot) {
    if (session.paused || session.api.status().ended) return;
    if (session.options.mode !== "local" || session.awaitingStart) { setPaused(session, true, true); return; }
    const left = session.timeouts[slot] ?? 0;
    if (left <= 0) { session.flash = { text: `Người ${slot} đã hết ${TIMEOUTS} lượt tạm dừng · chỉ mở menu`, until: performance.now() + 2500 }; session.timeout = null; setPaused(session, true, true); return; }
    session.timeouts[slot] = left - 1;
    session.timeout = { slot, used: TIMEOUTS - left + 1, until: performance.now() + TIMEOUT_SECONDS * 1000 };
    setPaused(session, true, true);
  }
  function setPaused(session, paused, focusMenu = false) {
    session.paused = paused;
    if (!paused) { session.awaitingStart = false; session.timeout = null; closeSheets(session.arena); }
    // Kicks and switch repeats stop, but directions still held carry on as soon as play resumes.
    stopSwitchRepeats(); cancelKicks();
    if (paused) session.api.pause(); else session.api.play();
    peek(session, false);
    showOverlay(session, paused ? (session.awaitingStart ? "start" : "pause") : null, focusMenu);
    if (!paused && sessions.get(activeMode) === session && route.sub === "match") focusOn(session.arena);
    applyKeys(session); highlightPads();
    updateHud(session);
  }
  function resumeView(view, key) {
    if (view === watchView) { setWatchPaused(false); return true; }
    if (view.api.status().ended) return false;
    const kind = view.overlay.dataset.kind;
    if (key === "Escape" && kind === "start") { focusOn(view.arena); return true; }
    setPaused(view, false);
    return true;
  }

  /* ------------------------------ fullscreen ------------------------------ */
  // The whole game goes full screen, from any screen. Esc stays a game key there where the browser allows it.
  const fsElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  const canFullscreen = !!(game.requestFullscreen || game.webkitRequestFullscreen);
  let escLocked = false;
  function syncFullscreen() {
    const on = !!fsElement();
    game.classList.toggle("is-fullscreen", on);
    for (const button of document.querySelectorAll("[data-fullscreen]")) {
      const text = on ? "Thu nhỏ" : "Toàn màn hình";
      button.hidden = !canFullscreen;
      button.classList.toggle("is-expanded", on);
      button.setAttribute("aria-pressed", String(on)); button.setAttribute("aria-label", text); button.title = text;
      const visible = button.querySelector(".fullscreen-label");
      if (visible) visible.textContent = text;
    }
    if (!on && escLocked) { escLocked = false; try { navigator.keyboard?.unlock?.(); } catch {} }
  }
  async function toggleFullscreen() {
    cancelKicks();
    try {
      if (fsElement()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.());
      else {
        await (game.requestFullscreen ? game.requestFullscreen({ navigationUI: "hide" }) : game.webkitRequestFullscreen?.());
        navigator.keyboard?.lock?.(["Escape"]).then(() => { escLocked = !!fsElement(); }, () => {});
      }
    } catch {}
    syncFullscreen();
    const session = sessions.get(activeMode);
    if (route.sub === "match" && session && !session.paused) focusOn(session.arena);
    else if (route.name === "watch" && !watchView.paused) focusOn(watchArena);
    else if (document.activeElement?.matches?.("[data-fullscreen]") || document.activeElement === document.body) focusCursor();
    applyKeys();
  }
  function focusCursor() {
    const screen = screenOf(route);
    if (screen === "menu") focusOn(mainMenu.lastItem ?? mainMenu.querySelector(".menu-item"));
    else if (screen === "setup") { const panel = document.getElementById(SCREENS[route.name]); focusOn(panel.lastOpt?.isConnected ? panel.lastOpt : panel.querySelector(".opt")); }
    else if (screen === "info") focusOn(infoScreen.querySelector(".info-nav .is-current"));
    else {
      const view = currentView();
      if (view && !view.overlay.hidden) focusOn([...view.overlay.querySelectorAll(".menu-item")].find(item => !item.hidden));
      else if (view) focusOn(view.arena);
    }
  }
  for (const button of document.querySelectorAll("[data-fullscreen]")) button.addEventListener("click", toggleFullscreen);
  game.addEventListener("mousedown", event => { if (event.target.closest(".prompt, [data-fullscreen], .arena-tools .tool")) event.preventDefault(); });
  for (const type of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(type, () => {
    syncFullscreen(); cancelKicks();
    const session = sessions.get(activeMode);
    if (session && route.sub === "match" && !session.arena.contains(document.activeElement)) focusOn(session.arena);
    applyKeys();
  });

  /* ------------------------------ in-game dialog ------------------------------ */
  const dialog = game.querySelector(".game-dialog");
  let dialogAnswer = null;
  function gameConfirm(message, yes = "Đồng ý") {
    dialogAnswer?.(false);
    const back = document.activeElement;
    dialog.querySelector(".dialog-text").textContent = message;
    dialog.querySelector('[data-answer="yes"]').textContent = yes;
    dialog.hidden = false;
    focusOn(dialog.querySelector('[data-answer="no"]'));
    return new Promise(resolve => {
      dialogAnswer = answer => { dialogAnswer = null; dialog.hidden = true; if (back?.isConnected) focusOn(back); resolve(answer); };
    });
  }
  dialog.addEventListener("click", event => {
    const button = event.target.closest("[data-answer]");
    if (button) dialogAnswer?.(button.dataset.answer === "yes");
  });

  /* ------------------------------ screens ------------------------------ */
  // One game, several screens: the menu (over a live match), watching, match setup and play for each mode, and the
  // game info screen with its sections. The URL hash holds the screen so the browser's back button works.
  const SCREENS = { menu: "panel-watch", watch: "panel-watch", cpu: "panel-cpu", local: "panel-local", info: "screen-info" };
  const TITLES = { menu: "Menu chính", watch: "Chỉ xem", cpu: "Đấu với máy", local: "Hai người", info: "Thông tin game" };
  const PANES = { teams: "Đội bóng", skills: "Bảng skill", stats: "Chỉ số & hình thể", styles: "Phong cách chơi", keys: "Layout phím", controls: "Điều khiển", rules: "Độ khó & luật" };
  let route = { name: "", sub: null }, infoReturn = null;
  const pathOf = r => r.name + (r.sub ? "/" + r.sub : "");
  function parseRoute() {
    const [name, sub] = location.hash.replace(/^#\/?/, "").split("/");
    return { name: name in SCREENS ? name : "menu", sub: sub || null };
  }
  function go(path) {
    const next = "#/" + path;
    if (location.hash === next) showRoute();
    // Moving between sections of Game info replaces the entry, so Back leaves the info screen.
    else if (route.name === "info" && path.startsWith("info/")) { history.replaceState(null, "", next); showRoute(); }
    else location.hash = next;
  }
  function backTarget() {
    if (route.name === "watch") return "menu";
    if (route.name === "cpu" || route.name === "local") return route.sub === "match" ? route.name : sessions.has(route.name) ? route.name + "/match" : "menu";
    if (route.name === "info") return infoReturn ? pathOf(infoReturn) : "menu";
    return null;
  }
  const backLabel = path => path === "menu" ? "Menu chính" : path.endsWith("/match") ? "Về trận đấu" : TITLES[path.split("/")[0]] ?? "Quay lại";
  const screenOf = r => r.name === "cpu" || r.name === "local" ? (r.sub === "match" ? "match" : "setup") : r.name;
  const PROMPTS = {
    menu: [["↑ ↓", "Chọn"], ["Enter", "Vào", "enter"], ["F", "Toàn màn hình", "fullscreen"]],
    setup: [["↑ ↓", "Chọn mục"], ["← →", "Đổi"], ["Enter", "Vào sân", "start"], ["F", "Toàn màn hình", "fullscreen"], ["Esc", "Quay lại", "back"]],
    info: [["↑ ↓ ← →", "Chọn"], ["Q E", "Đổi nhóm"], ["Enter", "Chọn / đổi phím"], ["F", "Toàn màn hình", "fullscreen"], ["Esc", "Quay lại", "back"]]
  };
  const promptBar = game.querySelector(".prompt-bar");
  function renderPrompts(screen) {
    promptBar.innerHTML = (PROMPTS[screen] ?? []).map(([key, text, act]) => act
      ? `<button type="button" class="prompt" data-prompt="${act}"><kbd>${key}</kbd>${text}</button>`
      : `<span class="prompt"><kbd>${key}</kbd>${text}</span>`).join("");
  }
  promptBar.addEventListener("click", event => {
    const act = event.target.closest("[data-prompt]")?.dataset.prompt;
    if (act === "back") { const back = backTarget(); if (back) go(back); }
    else if (act === "start") startMatch(document.getElementById(SCREENS[route.name]));
    else if (act === "enter") (mainMenu.lastItem ?? mainMenu.querySelector(".menu-item")).click();
    else if (act === "fullscreen") toggleFullscreen();
  });
  const navBack = game.querySelector(".nav-back");
  navBack.addEventListener("click", () => { const back = backTarget(); if (back) go(back); });
  function showRoute() {
    const next = parseRoute();
    if (next.name === "info" && !(next.sub in PANES)) next.sub = "skills";
    if ((next.name === "cpu" || next.name === "local") && next.sub === "match" && !sessions.has(next.name)) next.sub = null;
    if (next.name === "info" && route.name !== "info") infoReturn = route.name && route.name !== "menu" ? { ...route } : null;
    const previous = route;
    route = next;
    dialogAnswer?.(false);
    if (capture) { capture = null; renderKeymaps(); }
    releaseKeys(); endPeeks();
    watchArena.tabIndex = next.name === "menu" ? -1 : 0;
    for (const session of sessions.values()) { closeSheets(session.arena); session.timeout = null; setPaused(session, true); }
    activeMode = next.name === "menu" || next.name === "watch" ? "watch" : next.name;
    const screen = screenOf(next);
    game.dataset.screen = screen;
    game.dataset.route = "#/" + pathOf(next);
    for (const section of document.querySelectorAll(".screen")) section.hidden = section.id !== SCREENS[next.name];
    watchPanel.classList.toggle("is-attract", next.name === "menu");
    mainMenu.hidden = next.name !== "menu";
    if (next.name !== "watch" || previous.name !== "watch") { watchView.paused = false; closeSheets(watchArena); showOverlay(watchView, null); }
    if (activeMode === "watch" && !document.hidden && !watchView.paused) watcher?.play(); else watcher?.pause();
    if (next.name === "cpu" || next.name === "local") {
      const panel = document.getElementById(SCREENS[next.name]), inMatch = next.sub === "match";
      panel.querySelector(".setup").hidden = inMatch;
      panel.querySelector(".match-screen").hidden = !inMatch;
      renderSetup(panel);
    }
    if (next.name === "info") showPane(next.sub);
    const back = backTarget();
    navBack.hidden = !back || next.name === "menu";
    writeText(navBack.querySelector(".nav-back-label"), back ? backLabel(back) : "");
    const detail = next.name === "info" ? PANES[next.sub] : screen === "setup" ? "Chuẩn bị trận" : "";
    game.querySelector(".crumbs").innerHTML = next.name === "menu" ? "" : `<b>${TITLES[next.name]}</b>${detail ? `<span aria-hidden="true">›</span>${escapeHtml(detail)}` : ""}`;
    document.title = (next.name === "menu" ? "" : TITLES[next.name] + " · ") + "PTSC Cup 6v6";
    renderPrompts(screen);
    // Every screen opens with its cursor on something, like a console menu.
    const sameScreen = previous.name === next.name && screenOf(previous) === screen;
    if (screen === "menu") focusOn(mainMenu.lastItem ?? mainMenu.querySelector(".menu-item"));
    else if (screen === "watch") watchView.paused ? showOverlay(watchView, "pause", true) : focusOn(watchArena);
    else if (screen === "match") { const session = sessions.get(next.name); if (session.awaitingStart) showOverlay(session, "start", true); else if (!session.paused) focusOn(session.arena); else showOverlay(session, "pause", true); }
    else if (screen === "setup") { const panel = document.getElementById(SCREENS[next.name]); if (!sameScreen || !panel.contains(document.activeElement)) focusOn(panel.lastOpt?.isConnected ? panel.lastOpt : panel.querySelector(".opt")); }
    else if (screen === "info" && !infoScreen.querySelector(".info-panes").contains(document.activeElement)) focusOn(infoScreen.querySelector(`.info-nav [data-pane="${next.sub}"]`));
  }
  const infoScreen = document.getElementById("screen-info");
  function showPane(name) {
    for (const tab of infoScreen.querySelectorAll(".info-nav [data-pane]")) { const on = tab.dataset.pane === name; tab.setAttribute("aria-selected", String(on)); tab.classList.toggle("is-current", on); }
    for (const pane of infoScreen.querySelectorAll(".info-pane")) pane.hidden = pane.dataset.pane !== name;
    if (infoScreen.dataset.pane !== name) { infoScreen.dataset.pane = name; infoScreen.querySelector(".info-panes").scrollTop = 0; }
  }
  infoScreen.querySelector(".info-nav").addEventListener("click", event => {
    const tab = event.target.closest("[data-pane]");
    if (!tab) return;
    event.preventDefault(); go("info/" + tab.dataset.pane); focusOn(tab);
  });
  window.addEventListener("hashchange", showRoute);

  /* ------------------------------ main menu and watching ------------------------------ */
  const watchPanel = document.getElementById("panel-watch"), watchArena = watchPanel.querySelector(".arena");
  const mainMenu = watchPanel.querySelector(".main-menu");
  const watchView = { panel: watchPanel, arena: watchArena, overlay: null, paused: false, get api() { return watcher; } };
  function showPreview(item) {
    mainMenu.lastItem = item;
    writeText(mainMenu.querySelector(".menu-preview-kicker"), item.dataset.kicker);
    writeText(mainMenu.querySelector(".menu-preview-title"), item.querySelector("b").textContent);
    writeText(mainMenu.querySelector(".menu-preview-text"), item.dataset.desc);
    for (const other of mainMenu.querySelectorAll(".menu-item")) other.classList.toggle("is-current", other === item);
  }
  mainMenu.addEventListener("focusin", event => { const item = event.target.closest(".menu-item"); if (item) showPreview(item); });
  showPreview(mainMenu.querySelector(".menu-item"));
  function newWatch() {
    watcher?.destroy();
    const host = document.getElementById("watch-match"), rng = rngFrom(host.dataset.seed), [a, b] = clubs.randomPair(rng);
    watcher = window.PTSCFootball.mount(host, { squads: { R: clubs.pickSquad(a, rng), B: clubs.pickSquad(b, rng) }, teams: clubs.teamOption(a, b) });
    paintTeams(watchPanel, watcher);
    if (activeMode !== "watch" || watchView.paused || document.hidden) watcher.pause();
    watchView.cardsFor = null;
  }
  function setWatchPaused(paused, focusMenu = false) {
    watchView.paused = paused;
    peek(watchView, false);
    if (!paused) closeSheets(watchArena);
    if (paused || document.hidden || activeMode !== "watch") watcher?.pause(); else watcher?.play();
    showOverlay(watchView, paused ? "pause" : null, focusMenu);
    if (!paused && route.name === "watch") focusOn(watchArena);
  }
  function initWatch() {
    watchView.overlay = buildOverlay(watchArena, [["resume", "Tiếp tục"], ["new-watch", "Trận mới"], ["plan", "Đội hình &amp; chỉ số"], ["menu", "Menu chính"]]);
    buildSheet(watchArena, "squad", "Chỉ số nhanh", SQUAD_SHEET);
    buildPlanSheet(watchView);
    watchView.overlay.addEventListener("click", event => {
      const button = event.target.closest("[data-act]"), act = button?.dataset.act;
      if (act === "resume") setWatchPaused(false);
      else if (act === "new-watch") { newWatch(); setWatchPaused(false); }
      else if (act === "plan") openPlan(watchView, button);
      else if (act === "menu") go("menu");
    });
    watchPanel.querySelector(".pause").addEventListener("click", () => setWatchPaused(!watchView.paused, !watchView.paused));
    watchArena.addEventListener("pointerdown", event => { if (route.name === "watch" && !event.target.closest("button, .start-overlay, .sheet")) focusOn(watchArena); });
    const energy = document.createElement("div"); energy.className = "arena-energy";
    watchArena.querySelector(".arena-surface").append(energy);
    buildTeamCards(watchArena.querySelector(".player-status"), cardOrder("watch", "R", watchView));
    buildEnergyBoxes(energy, cardOrder("watch", "R", watchView));
  }
  function updateWatchHud() {
    if (activeMode !== "watch" || !watcher?.status) return;
    // The cards carry the clubs' names; a new match means new clubs.
    if (watchView.cardsFor !== watcher) { watchView.cardsFor = watcher; buildTeamCards(watchArena.querySelector(".player-status"), cardOrder("watch", "R", watchView)); buildEnergyBoxes(watchArena.querySelector(".arena-energy"), cardOrder("watch", "R", watchView)); }
    const state = watcher.status(), ctx = { id: "watch", leftTeam: state.leftTeam, paused: false, ended: state.ended, shorts: { R: shortOf(watchView, "R"), B: shortOf(watchView, "B") } };
    for (const card of watchArena.querySelector(".player-status").cards ?? []) updateTeamCard(card, state.teams?.[card.dataset.team], ctx);
    for (const box of watchArena.querySelector(".arena-energy").children) updateEnergyBox(box, state.teams?.[box.dataset.team], ctx);
  }

  /* ------------------------------ game plan: line-up, player info, tactics, substitutions ------------------------------ */
  // Like a console's game plan: both sides with a pitch and a list; any player opens his info and ratings; the side
  // you control can make substitutions, pick a shape and switch the automatic coach on or off.
  const PLAN_TABS = [["lineup", "Đội hình"], ["tactics", "Chiến thuật"], ["support", "Hỗ trợ"]];
  const CELEBRATION_NAMES = { fist: "Vung nắm đấm", mate: "Ôm đồng đội", arms: "Dang tay", airplane: "Máy bay", pointMate: "Chỉ tay cảm ơn", badge: "Hôn huy hiệu", dance: "Nhảy múa", kneeSlide: "Trượt gối", shush: "Suỵt", siu: "SIUU", sky: "Chỉ lên trời", heart: "Trái tim", flip: "Lộn nhào", armsFolded: "Khoanh tay", salute: "Chào kiểu nhà binh", earCup: "Khum tai", pray: "Quỳ cầu nguyện" };
  /** In a two-player match only the side whose timeout it is may change its squad or tactics. */
  function mayCoach(view, t) {
    const session = view.panel ? sessions.get(view.panel.dataset.mode) : null;
    if (!session || session.options.mode !== "local" || session.awaitingStart || !session.timeout) return true;
    return (session.timeout.slot === "A" ? "R" : "B") === t;
  }
  const LINE_LABEL = { GK: "TM", DF: "HV", MF: "TV", FW: "TĐ" };
  const RADAR = [["SÚT", s => s.finishing], ["CHUYỀN", s => (s.passing + s.longPass) / 2], ["RÊ", s => s.dribbling], ["TỐC", s => s.speed], ["SỨC", s => (s.strength + s.heading) / 2], ["THỦ", s => s.defending]];
  const statTone = v => v >= 85 ? "top" : v >= 75 ? "good" : v >= 65 ? "fair" : "low";
  const posBadge = line => `<span class="pos-badge" data-line="${line}">${LINE_LABEL[line] ?? line}</span>`;
  const PLAN_SHEET = '<div class="plan-tabs" role="tablist" aria-label="Kế hoạch trận">' + PLAN_TABS.map(([id, text]) => `<button type="button" class="plan-tab" role="tab" tabindex="-1" data-tab="${id}">${text}</button>`).join("") + '</div>'
    + '<div class="plan-teams"><section class="plan-team" data-col="0"></section><section class="plan-team" data-col="1"></section></div>'
    + '<div class="plan-foot"><p class="plan-status" role="status" aria-live="polite"></p><p class="plan-prompts"></p></div>';
  function figureSvg(api, id, viewBox, cls) {
    return `<svg class="${cls}" viewBox="${viewBox}" aria-hidden="true"><g fill="none" stroke="var(--color-ink)" stroke-linecap="round" stroke-linejoin="round">${api?.figure?.(id) ?? ""}</g></svg>`;
  }
  function radarSvg(stats) {
    const point = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [50 + Math.cos(a) * r * 33, 50 + Math.sin(a) * r * 33]; };
    const ring = r => RADAR.map((_, i) => point(i, r).map(v => v.toFixed(1)).join(",")).join(" ");
    const shape = RADAR.map(([, f], i) => point(i, Math.max(.08, clamp01((f(stats) - 30) / 65))).map(v => v.toFixed(1)).join(",")).join(" ");
    return `<svg class="radar" viewBox="0 0 100 100" role="img" aria-label="${RADAR.map(([k, f]) => k + " " + Math.round(f(stats))).join(", ")}"><polygon class="radar-ring" points="${ring(1)}"/><polygon class="radar-ring" points="${ring(.5)}"/><polygon class="radar-shape" points="${shape}"/>`
      + RADAR.map(([k], i) => { const [x, y] = point(i, 1.3); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${k}</text>`; }).join("") + "</svg>";
  }
  /** A shape drawn small: a vertical pitch with a dot per player. */
  function shapeSvg(shape) {
    const home = shape.keeper ? shape.home : [[0.03, 0.5], ...shape.home], lines = shape.keeper ? shape.lines : ["GK", ...shape.lines];
    return '<svg class="shape-mini" viewBox="0 0 40 56" aria-hidden="true"><rect x="1" y="1" width="38" height="54" rx="3"/><path d="M1 28h38M14 55v-6h12v6M14 1v6h12V1"/>'
      + home.map(([d, w], i) => `<circle cx="${(4 + w * 32).toFixed(1)}" cy="${(52 - d / .72 * 46).toFixed(1)}" r="3" data-line="${lines[i]}"/>`).join("") + "</svg>";
  }
  function planOrder(view) {
    const a = view.options?.teamA;
    return a ? [a, opposite(a)] : ["R", "B"];
  }
  const planWho = (view, controller) => controller === "cpu" || controller === "auto" ? "Máy" : view.options?.mode === "cpu" ? "Bạn" : "Người " + controller;
  const findPlanPlayer = (data, t, id) => data?.[t] && [...data[t].players, ...data[t].bench].find(p => p.id === id);
  function planRow(t, p, col, data, ui) {
    const queued = data[t].queue.find(q => q.off === p.id || q.on === p.id), picking = ui.pick?.team === t && ui.pick.id === p.id;
    const choosable = ui.pick?.team === t && !picking && (ui.pick.onPitch ? (p.canOn && ui.pick.canOff) || (ui.pick.canSwap && p.onPitch && p.canSwap) : p.canOff);
    const flags = (queued ? queued.off === p.id ? '<i class="flag off" title="Sẽ ra sân">▼</i>' : '<i class="flag on" title="Sẽ vào sân">▲</i>' : "")
      + (p.yellows ? '<i class="flag card" title="Thẻ vàng"></i>' : "") + (p.injured ? '<i class="flag hurt" title="Chấn thương">+</i>' : "");
    const state = picking ? "pick" : choosable ? "choose" : queued ? (queued.off === p.id ? "off" : "on") : "";
    const sub = `#${p.num} · ${p.posName ? p.posName + " · " : ""}${p.attack.name} / ${p.defense.name}`;
    return `<button type="button" class="plan-row" data-nav data-col="${col}" data-key="${t}:${p.id}" data-team="${t}" data-id="${p.id}"${state ? ` data-state="${state}"` : ""}${p.injured ? " data-hurt" : ""}>`
      + posBadge(p.onPitch ? p.line ?? p.role : p.role) + `<span class="plan-name"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(sub)}</small></span>`
      + `<span class="plan-energy" title="Thể lực ${Math.round(p.energy * 100)}%"><i style="width:${Math.round(p.energy * 100)}%"></i></span><span class="plan-flags">${flags}</span><b class="plan-ovr" data-level="${levelOf(p.ovr ?? 0)}">${p.ovr ?? "–"}</b></button>`;
  }
  /** The side's strength as it stands: the mean overall of the six in the lines they play, the sum, attack and defence. */
  const ratingHtml = r => r ? `<div class="plan-rating" title="OVR đội: trung bình OVR theo vị trí đang đá của những người trên sân · Sức mạnh: tổng OVR · Công: tiền vệ và tiền đạo · Thủ: hậu vệ và thủ môn"><span><small>OVR đội</small><b data-level="${levelOf(r.ovr)}">${r.ovr}</b></span><span><small>Sức mạnh</small><b>${r.sum}</b></span><span><small>Công</small><b>${r.attack}</b></span><span><small>Thủ</small><b>${r.defense}</b></span></div>` : "";
  function planColumn(view, t, col) {
    const ui = view.planUI, data = ui.data, d = data[t], api = view.api;
    const club = d.team, badge = club?.logo ? `<img class="plan-logo" src="${escapeHtml(club.logo)}" alt="" width="40" height="40" loading="lazy">` : `<span class="kit-shirt" style="background:var(--team-${t})" aria-hidden="true"></span>`;
    const head = `<header class="plan-head" data-team="${t}">${badge}<div class="plan-title"><b>${escapeHtml(club?.name ?? DEFAULT_NAMES[t])}</b><small>${escapeHtml(planWho(view, d.controller))}${d.coached ? "" : " · chỉ xem"}</small></div>${ratingHtml(d.rating)}<div class="plan-formation"><b>${d.shape}</b><small>${escapeHtml(d.shapeName)}</small></div></header>`;
    const tokens = d.players.map(p => {
      const [dd, w] = p.spot ?? [0.3, 0.5], queued = d.queue.some(q => q.off === p.id), top = dd <= .05 ? 91 : 79 - (dd - .1) / .6 * 70;
      return `<button type="button" class="pp-token" tabindex="-1" data-team="${t}" data-id="${p.id}" style="left:${(10 + w * 80).toFixed(1)}%;top:${top.toFixed(1)}%;z-index:${Math.round(100 - top)}"${queued ? ' data-state="off"' : ""}>`
        + figureSvg(api, p.id, "-17 -97 38 40", "pp-face") + `<span class="pp-tag">${posBadge(p.line ?? p.role)}<b>${p.ovr ?? ""}</b></span><span class="pp-name">${escapeHtml(p.name)}</span></button>`;
    }).join("");
    const pitch = `<div class="plan-pitch" aria-hidden="true"><i class="pp-lines"></i>${tokens}</div>`;
    let pane = "";
    if (ui.tab === "lineup") {
      pane = '<div class="plan-list" role="list">' + d.players.map(p => planRow(t, p, col, data, ui)).join("")
        + `<p class="plan-sep">Dự bị</p>` + (d.bench.length ? d.bench.map(p => planRow(t, p, col, data, ui)).join("") : '<p class="plan-empty">Không có cầu thủ dự bị.</p>') + "</div>";
    } else if (ui.tab === "tactics") {
      pane = '<div class="plan-list">' + d.shapes.map(s => {
        const current = s.id === d.shape, tag = d.coached ? "button" : "div";
        return `<${tag} ${d.coached ? `type="button" data-nav data-col="${col}" data-key="${t}:shape:${s.id}" ` : ""}class="plan-shape" data-team="${t}" data-shape="${s.id}" aria-pressed="${current}">${shapeSvg(s)}<span><b>${s.id}</b><small>${escapeHtml(s.name)}</small>${s.desc && s.desc !== s.name ? `<em>${escapeHtml(s.desc)}</em>` : ""}</span><span class="shape-end">${current ? '<i class="plan-check">Đang dùng</i>' : ""}<b class="shape-ovr" data-level="${levelOf(s.ovr ?? 0)}" title="OVR đội nếu dùng sơ đồ này">${s.ovr ?? "–"}</b></span></${tag}>`;
      }).join("")
        + (d.coached ? `<button type="button" class="plan-toggle plan-arrange" data-nav data-col="${col}" data-key="${t}:arrange" data-team="${t}" data-arrange><span><b>Tự xếp vị trí tối ưu</b><small>Đặt từng người vào chỗ cho OVR đội cao nhất với sơ đồ đang dùng (đổi sơ đồ và thay người tự động cũng tự xếp lại).</small></span><b class="toggle-state">Xếp</b></button>` : "")
        + `<p class="plan-note">${d.coached ? d.auto.tactics ? "Máy đổi sơ đồ theo tỉ số." : "Số bên phải: OVR đội với sơ đồ đó." : "Máy tự chọn sơ đồ."}</p></div>`;
    } else {
      const toggle = (key, title, desc, on, attr) => `<button type="button" class="plan-toggle" data-nav data-col="${col}" data-key="${t}:${key}" data-team="${t}" ${attr} aria-pressed="${on}"><span><b>${title}</b><small>${desc}</small></span><b class="toggle-state">${on ? "Bật" : "Tắt"}</b></button>`;
      pane = d.coached ? '<div class="plan-list">'
        + toggle("auto:tactics", "Tự động đổi chiến thuật", "Máy đổi sơ đồ theo tỉ số: giữ chắc khi dẫn, dồn lên khi bị dẫn.", d.auto.tactics, 'data-auto="tactics"')
        + toggle("auto:subs", "Tự động thay người", "Máy đưa người dự bị khỏe vào thay cầu thủ mệt ở lúc bóng chết, rồi tự xếp lại vị trí.", d.auto.subs, 'data-auto="subs"')
        + toggle("autoswitch", "Tự động đổi người", "Mất bóng: con trỏ tự nhảy sang đồng đội gần bóng nhất; người bạn vừa chọn tay được giữ 1,2 giây.", !!d.autoSwitch, "data-autoswitch")
        + (col === 0 && view.panel?.setup ? toggle("support", "Hỗ trợ ngắm", "Chuyền tới đồng đội gần hướng ngắm, sút trúng khung thành.", !!view.panel.setup.values.support, "data-support") : "")
        + "</div>" : '<p class="plan-note">Máy tự quyết cho đội này.</p>';
    }
    return head + `<div class="plan-main"${ui.detail?.team === t ? " inert" : ""}>${pitch}<div class="plan-pane">${pane}</div></div>` + (ui.detail?.team === t ? planDetail(view) : "");
  }
  function planDetail(view) {
    const ui = view.planUI, { team: t, id, page } = ui.detail, p = findPlanPlayer(ui.data, t, id), d = ui.data[t];
    if (!p) return "";
    const b = p.body, queued = d.queue.find(q => q.off === id || q.on === id);
    const top = `<div class="pd-top">${figureSvg(view.api, id, "-26 -98 56 66", "pd-face")}<div class="pd-id"><span class="pd-num">#${p.num}</span><strong>${escapeHtml(p.name)}</strong><span class="pd-pos">${posBadge(p.onPitch ? p.line ?? p.role : p.role)}<small>${p.posName ? escapeHtml(p.posName) + " · " : ""}${p.roleName ? escapeHtml(p.roleName) : "Sở trường: " + (LINE_LABEL[p.natural] ?? p.natural)}${p.onPitch ? "" : " · dự bị"}</small></span></div><div class="pd-ovr"><b data-level="${levelOf(p.ovr ?? 0)}">${p.ovr ?? "–"}</b><small>OVR</small></div>${radarSvg(p.stats)}</div>`;
    const clubTeam = d.team, pdArt = `<svg viewBox="-26 -98 56 66" aria-hidden="true"><g fill="none" stroke="var(--color-ink)" stroke-linecap="round" stroke-linejoin="round">${view.api?.figure?.(id) ?? ""}</g></svg>`;
    const oddsText = p.odds ? (p.odds.penaltySave != null ? `Skill sút của đối thủ vào ${p.odds.skillShot}% · đoán đúng pen bắt ${p.odds.penaltySave}%` : `Skill sút vào ${p.odds.skillShot}% · pen vào ${p.odds.penaltyScore}% khi thủ môn đoán đúng`) : "";
    const card = page === 0 && p.ovrs ? playerCardHtml(p, { art: pdArt, logo: clubTeam?.logo ?? "", club: clubTeam?.name ?? "", color: clubTeam?.colors?.shirt ?? "#1d2340", rows: [
      ["Đang đá", `${posBadge(p.onPitch ? p.line ?? p.role : p.role)} OVR <b>${p.ovr ?? "–"}</b>${p.onPitch ? "" : " · dự bị"}`], ["Vai trò", escapeHtml(p.roleName || "–")],
      ...skillRows(p.skill?.id, p.setPieces?.map(x => x.id) ?? [], p.penaltySkill?.id),
      ["Thể lực", `${Math.round(p.energy * 100)}% · skill tốn ${p.skillCost}%`], oddsText && ["Tỉ lệ", oddsText]].filter(Boolean) }) : "";
    const info = page === 0
      ? card + `<dl class="pd-info"><div><dt>Chiều cao</dt><dd>${b.height} cm</dd></div><div><dt>Cân nặng</dt><dd>${b.weight} kg</dd></div><div><dt>Tầm với</dt><dd>${b.reach.toFixed(2).replace(".", ",")} m</dd></div><div><dt>Thể lực</dt><dd>${Math.round(p.energy * 100)}%</dd></div><div><dt>Thẻ</dt><dd>${p.yellows ? p.yellows + " vàng" : "Chưa có"}</dd></div><div><dt>Tình trạng</dt><dd>${p.injured ? "Chấn thương" : p.subbing ? "Đang thay người" : queued ? (queued.off === id ? "Sẽ ra sân" : "Sẽ vào sân") : p.onPitch ? "Trên sân" : "Dự bị"}</dd></div></dl>`
        + (p.summary ? `<p class="pd-summary">${escapeHtml(p.summary)}${p.celebration ? ` · Ăn mừng: <b>${escapeHtml(CELEBRATION_NAMES[p.celebration] ?? p.celebration)}</b>` : ""}</p>` : "")
        + `<div class="pd-styles"><div class="pd-style atk"><small>Có bóng</small><b>${escapeHtml(p.attack.name)}</b><em>${escapeHtml(p.attack.tag)}</em><p>${escapeHtml(p.attack.desc)}</p></div><div class="pd-style def"><small>Mất bóng</small><b>${escapeHtml(p.defense.name)}</b><em>${escapeHtml(p.defense.tag)}</em><p>${escapeHtml(p.defense.desc)}</p></div></div>`
        + (p.skill ? `<div class="pd-skill"><svg viewBox="0 0 24 24" aria-hidden="true">${skillBadge(p.skill.id, p.skill.icon, "pd-" + p.id)}</svg><span><b>${escapeHtml(p.skill.name)}${p.skill.used ? (p.skill.cooldown == null ? " · đã dùng" : " · hồi chiêu " + p.skill.cooldown + "'") : ""}</b><small>${escapeHtml(p.skill.desc)}</small>${p.penaltySkill ? `<small class="pd-pen">Penalty: ${escapeHtml(p.penaltySkill.name)}</small>` : ""}</span></div>` : "")
      : '<ol class="pd-stats">' + gameData.stats.keys.map(k => `<li><b data-tone="${statTone(p.stats[k])}">${p.stats[k]}</b><span>${gameData.stats.labels[k]}</span><i><i style="width:${Math.round(clamp01((p.stats[k] - 35) / 60) * 100)}%"></i></i></li>`).join("") + "</ol>";
    const canSwap = d.coached && (queued || (p.onPitch ? p.canOff || p.canSwap : p.canOn));
    const nowLine = p.onPitch ? p.line ?? p.role : p.role;
    const lines = p.ovrs ? `<div class="pd-lines" title="OVR nếu đá ở từng vị trí"><em>OVR theo vị trí</em>${["GK", "DF", "MF", "FW"].map(l => `<span${nowLine === l ? ' class="is-now"' : ""}><small>${LINE_LABEL[l]}</small><b data-level="${levelOf(p.ovrs[l] ?? 0)}">${p.ovrs[l] ?? "–"}</b></span>`).join("")}</div>` : "";
    return `<div class="plan-detail" tabindex="-1" role="region" aria-label="Thông tin ${escapeHtml(p.name)}"><div class="pd-head"><b>${page === 0 ? "Thông tin cầu thủ" : "Chỉ số"}</b><span class="pd-pages"><kbd>←</kbd><kbd>→</kbd> ${page + 1}/2 · <kbd>↑</kbd><kbd>↓</kbd> đổi người</span></div>${page === 0 && card ? "" : top}<div class="pd-body">${page === 0 && card ? "" : lines}${info}</div>`
      + `<div class="pd-actions"><button type="button" class="secondary" data-nav data-pd="page">${page === 0 ? "Xem chỉ số ›" : "‹ Thông tin"}</button>${canSwap ? `<button type="button" class="secondary" data-nav data-pd="sub">${queued ? "Hủy lượt thay" : p.onPitch ? "Thay / đổi vị trí" : "Thay người"} <kbd>X</kbd></button>` : ""}<button type="button" class="secondary" data-nav data-pd="close">Quay lại <kbd>Esc</kbd></button></div></div>`;
  }
  const PLAN_PROMPTS = {
    lineup: "<span><kbd>Q</kbd><kbd>E</kbd> Đổi mục</span><span><kbd>↑</kbd><kbd>↓</kbd> Chọn</span><span><kbd>←</kbd><kbd>→</kbd> Đổi đội</span><span><kbd>Enter</kbd> Xem cầu thủ</span><span><kbd>X</kbd> Thay / đổi vị trí</span><span><kbd>Esc</kbd> Quay lại</span>",
    tactics: "<span><kbd>Q</kbd><kbd>E</kbd> Đổi mục</span><span><kbd>↑</kbd><kbd>↓</kbd> Chọn</span><span><kbd>←</kbd><kbd>→</kbd> Đổi đội</span><span><kbd>Enter</kbd> Dùng sơ đồ</span><span><kbd>Esc</kbd> Quay lại</span>",
    support: "<span><kbd>Q</kbd><kbd>E</kbd> Đổi mục</span><span><kbd>↑</kbd><kbd>↓</kbd> Chọn</span><span><kbd>Enter</kbd> Bật / Tắt</span><span><kbd>Esc</kbd> Quay lại</span>",
    detail: "<span><kbd>←</kbd><kbd>→</kbd> Trang</span><span><kbd>↑</kbd><kbd>↓</kbd> Đổi cầu thủ</span><span><kbd>X</kbd> Thay / đổi vị trí</span><span><kbd>Esc</kbd> Quay lại</span>",
    pick: "<span><kbd>↑</kbd><kbd>↓</kbd> Chọn người</span><span><kbd>Enter</kbd> Xác nhận</span><span><kbd>Esc</kbd> Hủy</span>"
  };
  function renderPlan(view, focusKey) {
    const sheet = view.arena.querySelector('.sheet[data-sheet="plan"]'), ui = view.planUI;
    const data = view.api?.plan?.();
    if (!sheet || !data) return;
    ui.data = data;
    // The portraits use the match's own colours, once its stylesheet has them.
    if (!sheet.style.getPropertyValue("--color-ink")) for (const [k, v] of Object.entries(view.api.palette?.() ?? {})) if (v) sheet.style.setProperty(k, v);
    const keep = focusKey ?? document.activeElement?.closest?.("[data-key]")?.dataset.key ?? (ui.detail && sheet.contains(document.activeElement) ? "detail" : null);
    for (const tab of sheet.querySelectorAll(".plan-tab")) { const on = tab.dataset.tab === ui.tab; tab.classList.toggle("is-current", on); tab.setAttribute("aria-selected", String(on)); }
    planOrder(view).forEach((t, col) => {
      const column = sheet.querySelector(`.plan-team[data-col="${col}"]`);
      column.dataset.team = t;
      column.innerHTML = planColumn(view, t, col);
    });
    sheet.dataset.mode = ui.detail ? "detail" : ui.pick ? "pick" : "list";
    sheet.querySelector(".plan-prompts").innerHTML = PLAN_PROMPTS[sheet.dataset.mode === "list" ? ui.tab : sheet.dataset.mode];
    const pick = ui.pick && findPlanPlayer(data, ui.pick.team, ui.pick.id);
    writeText(sheet.querySelector(".plan-status"), pick ? (pick.onPitch ? `Chọn người dự bị vào thay ${pick.name}${ui.pick.canSwap ? ", hoặc một người trên sân để đổi vị trí" : ""} · Esc để hủy` : `Chọn người ra sân để ${pick.name} vào · Esc để hủy`) : ui.note ?? "");
    if (ui.detail) focusOn(sheet.querySelector(".plan-detail"));
    else if (keep && keep !== "detail") focusOn(sheet.querySelector(`[data-key="${CSS.escape(keep)}"]`) ?? firstPlanItem(sheet, 0));
  }
  const planItems = (sheet, col) => [...sheet.querySelectorAll(`.plan-team[data-col="${col}"] [data-nav]`)];
  const firstPlanItem = (sheet, col) => planItems(sheet, col)[0] ?? planItems(sheet, 1 - col)[0] ?? sheet.querySelector(".sheet-back");
  function openPlan(view, opener) {
    view.planUI ??= { tab: "lineup" };
    // The plan always opens on the line-up; a tab chosen last time is not kept.
    Object.assign(view.planUI, { tab: "lineup", detail: null, pick: null, note: "" });
    const sheet = view.arena.querySelector('.sheet[data-sheet="plan"]');
    openSheet(view, "plan", opener);
    renderPlan(view, null);
    focusOn(firstPlanItem(sheet, 0));
  }
  function setPlanTab(view, step) {
    const ui = view.planUI, at = PLAN_TABS.findIndex(([id]) => id === ui.tab);
    ui.tab = typeof step === "string" ? step : PLAN_TABS[(at + step + PLAN_TABS.length) % PLAN_TABS.length][0];
    ui.pick = null; ui.detail = null; ui.note = "";
    const sheet = view.arena.querySelector('.sheet[data-sheet="plan"]'), col = document.activeElement?.closest?.("[data-col]")?.dataset.col ?? "0";
    renderPlan(view, "none");
    focusOn(firstPlanItem(sheet, Number(col)));
  }
  function openDetail(view, t, id) {
    view.planUI.detail = { team: t, id, page: view.planUI.detail?.page ?? 0 };
    view.planUI.pick = null;
    renderPlan(view);
  }
  function closeDetail(view) {
    const d = view.planUI.detail;
    view.planUI.detail = null;
    renderPlan(view, d ? `${d.team}:${d.id}` : null);
  }
  /** Starts a substitution from one man, cancels a queued one, or explains why he cannot go off (or on). */
  function startPick(view, t, id) {
    const ui = view.planUI, d = ui.data[t], p = findPlanPlayer(ui.data, t, id);
    if (!p) return;
    if (!d.coached) { ui.note = "Chỉ thay người được cho đội bạn điều khiển."; renderPlan(view); return; }
    if (!mayCoach(view, t)) { ui.note = "Chỉ bên đang xin tạm dừng được thay người."; renderPlan(view); return; }
    if (view.api.status().ended) { ui.note = "Trận đấu đã kết thúc."; renderPlan(view); return; }
    if (d.queue.some(q => q.off === id || q.on === id)) { view.api.cancelSub(t, id); ui.note = `Đã hủy lượt thay của ${p.name}.`; ui.detail = null; renderPlan(view, `${t}:${id}`); return; }
    if (p.onPitch ? !p.canOff && !p.canSwap : !p.canOn) {
      ui.note = p.role === "GK" && p.onPitch ? "Không có thủ môn dự bị để thay, và thủ môn không đổi vị trí." : p.injured ? `${p.name} đang bị thương.` : p.subbing ? `${p.name} đang được thay ra.` : `${p.name} chưa thay được lúc này.`;
      renderPlan(view); return;
    }
    // On the pitch: a substitute to come on for him, or a team-mate on the pitch to change places with.
    const other = p.onPitch ? [...(p.canOff ? d.bench.filter(x => x.canOn) : []), ...(p.canSwap ? d.players.filter(x => x.id !== id && x.canSwap) : [])] : d.players.filter(x => x.canOff);
    if (!other.length) { ui.note = p.onPitch ? "Không còn ai để thay hay đổi vị trí." : "Không có ai trên sân để thay ra."; renderPlan(view); return; }
    ui.detail = null; ui.note = ""; ui.pick = { team: t, id, onPitch: p.onPitch, canSwap: !!p.canSwap, canOff: !!p.canOff };
    renderPlan(view, `${t}:${other[0].id}`);
  }
  function completePick(view, t, id) {
    const data = team => view.planUI.data[team];
    const ui = view.planUI, pick = ui.pick, p = findPlanPlayer(ui.data, t, id), first = pick && findPlanPlayer(ui.data, pick.team, pick.id);
    if (!pick || !p || !first) return;
    if (t !== pick.team || id === pick.id) { ui.pick = null; renderPlan(view, `${pick.team}:${pick.id}`); return; }
    if (p.onPitch && pick.onPitch && pick.canSwap && p.canSwap) {
      // Two men on the pitch change places in the line-up, at once.
      const result = view.api.swapSlots(t, pick.id, id);
      ui.pick = null;
      ui.note = result.ok ? `Đã đổi vị trí: ${first.name} ↔ ${p.name}.` : result.reason;
      renderPlan(view, `${t}:${id}`);
      return;
    }
    if (p.onPitch === pick.onPitch) {
      const able = p.onPitch ? p.canOff : p.canOn;
      ui.pick = able ? { team: t, id, onPitch: p.onPitch } : pick;
      ui.note = able ? "" : `${p.name} chưa thay được lúc này.`;
      renderPlan(view, `${t}:${able ? (p.onPitch ? data(t).bench : data(t).players).find(x => p.onPitch ? x.canOn : x.canOff)?.id ?? id : id}`);
      return;
    }
    const [off, on] = pick.onPitch ? [first, p] : [p, first];
    const result = view.api.queueSub(t, off.id, on.id);
    ui.pick = null;
    ui.note = !result.ok ? result.reason : result.now ? `Đã đổi đội hình: ${on.name} đá chính thay ${off.name}.` : `Sẽ thay ở lần bóng chết tới: ${on.name} vào, ${off.name} ra.`;
    renderPlan(view, `${t}:${off.id}`);
  }
  function planActivate(view, el) {
    const ui = view.planUI, t = el.dataset.team;
    if (el.matches(".plan-row, .pp-token")) { if (ui.pick) completePick(view, t, el.dataset.id); else openDetail(view, t, el.dataset.id); }
    else if (el.matches(".plan-shape[data-shape]") && ui.data[t]?.coached) {
      if (!mayCoach(view, t)) { ui.note = "Chỉ bên đang xin tạm dừng được đổi chiến thuật."; renderPlan(view, el.dataset.key); return; }
      const result = view.api.setShape(t, el.dataset.shape);
      ui.note = result.ok ? `${ui.data[t].team?.name ?? DEFAULT_NAMES[t]} đá ${el.dataset.shape}.${result.moved ? ` Đã xếp lại ${result.moved} vị trí cho OVR đội cao nhất.` : ""}` : "Sơ đồ này không dùng được lúc này.";
      renderPlan(view, el.dataset.key);
    } else if (el.matches("[data-arrange]")) {
      if (!mayCoach(view, t)) { ui.note = "Chỉ bên đang xin tạm dừng được xếp lại đội hình."; renderPlan(view, el.dataset.key); return; }
      const result = view.api.arrange(t);
      ui.note = !result.ok ? "Không xếp được lúc này." : result.moved ? `Đã xếp lại ${result.moved} vị trí.` : "Đội hình đã ở vị trí tối ưu.";
      renderPlan(view, el.dataset.key);
    } else if (el.matches("[data-autoswitch]")) {
      const on = !ui.data[t].autoSwitch;
      view.api.setAutoSwitch(on);
      if (view.panel?.setup) { view.panel.setup.values.autoSwitch = on; renderSetup(view.panel); }
      ui.note = "Tự động đổi người " + (on ? "bật." : "tắt.");
      renderPlan(view, el.dataset.key);
    } else if (el.matches("[data-auto]")) {
      if (!mayCoach(view, t)) { ui.note = "Chỉ bên đang xin tạm dừng được đổi tùy chọn này."; renderPlan(view, el.dataset.key); return; }
      const key = el.dataset.auto, on = !ui.data[t].auto[key];
      view.api.setAuto(t, { [key]: on });
      ui.note = (key === "tactics" ? "Tự động đổi chiến thuật " : "Tự động thay người ") + (on ? "bật." : "tắt.");
      renderPlan(view, el.dataset.key);
    } else if (el.matches("[data-support]")) {
      view.panel.overlay.querySelector('[data-act="support"]').click();
      renderPlan(view, el.dataset.key);
    }
  }
  function buildPlanSheet(view) {
    const sheet = buildSheet(view.arena, "plan", "Kế hoạch trận", PLAN_SHEET);
    sheet.classList.add("plan-sheet");
    sheet.addEventListener("click", event => {
      const tab = event.target.closest(".plan-tab");
      if (tab) { setPlanTab(view, tab.dataset.tab); return; }
      const action = event.target.closest("[data-pd]")?.dataset.pd, ui = view.planUI;
      if (action === "page") { ui.detail.page = 1 - ui.detail.page; renderPlan(view); return; }
      if (action === "sub") { startPick(view, ui.detail.team, ui.detail.id); return; }
      if (action === "close") { closeDetail(view); return; }
      const item = event.target.closest(".plan-row, .pp-token, .plan-shape[data-shape], [data-auto], [data-support], [data-arrange], [data-autoswitch]");
      if (item && !item.closest(".plan-detail")) planActivate(view, item);
    });
  }
  /** Keys inside the game plan; true when handled. */
  function planKey(view, sheet, event, dir) {
    const ui = view.planUI, code = event.code;
    if (!ui) return false;
    if (ui.detail) {
      if (code === "Escape") { closeDetail(view); return true; }
      if (dir === "left" || dir === "right") { ui.detail.page = 1 - ui.detail.page; renderPlan(view); return true; }
      if (dir === "up" || dir === "down") {
        const d = ui.data[ui.detail.team], all = [...d.players, ...d.bench], at = all.findIndex(p => p.id === ui.detail.id);
        ui.detail.id = all[(at + (dir === "down" ? 1 : -1) + all.length) % all.length].id; renderPlan(view); return true;
      }
      if (code === "KeyX" && !event.repeat) { startPick(view, ui.detail.team, ui.detail.id); return true; }
      return (code === "Enter" || code === "Space") && document.activeElement?.matches?.(".plan-detail");
    }
    if (code === "Escape" && ui.pick) { const pick = ui.pick; ui.pick = null; renderPlan(view, `${pick.team}:${pick.id}`); return true; }
    if ((code === "KeyQ" || code === "PageUp") && !event.repeat) { setPlanTab(view, -1); return true; }
    if ((code === "KeyE" || code === "PageDown") && !event.repeat) { setPlanTab(view, 1); return true; }
    const current = document.activeElement?.closest?.("[data-col]"), col = Number(current?.dataset.col ?? 0);
    if (dir === "up" || dir === "down") {
      const items = planItems(sheet, col), at = items.indexOf(current);
      if (!items.length) return false;
      { const next = items[at < 0 ? 0 : (at + (dir === "down" ? 1 : -1) + items.length) % items.length]; focusOn(next); next.scrollIntoView?.({ block: "nearest" }); }
      return true;
    }
    if (dir === "left" || dir === "right") {
      const at = Math.max(0, planItems(sheet, col).indexOf(current)), items = planItems(sheet, 1 - col);
      if (items.length) focusOn(items[Math.min(at, items.length - 1)]);
      return true;
    }
    if (code === "KeyX" && !event.repeat && current?.matches(".plan-row")) { startPick(view, current.dataset.team, current.dataset.id); return true; }
    return false;
  }

  /* ------------------------------ match setup ------------------------------ */
  // Settings are rows like a console's match settings: ↑↓ picks a row, ←→ (or the arrows) changes it, Enter kicks off.
  const onOff = [[false, "Tắt"], [true, "Bật"]];
  function layoutSummary(layout) {
    if (!layout) return "";
    const k = layout.keys;
    return "Di chuyển " + ["up", "left", "down", "right"].map(a => label(k[a])).join(" ") + " · " + ["pass", "shoot", "switch", "sprint", "press", "challenge", "special", "pause"].map(a => keymap.LABELS[a] + " " + label(k[a])).join(" · ");
  }
  const LINE_NAMES = { GK: "TM", DF: "HV", MF: "TV", FW: "TĐ" };
  function clubDesc(id, who) {
    const t = clubs.get(id);
    if (!t) return "";
    const lines = ["GK", "DF", "MF", "FW"].map(r => t.players.filter(p => p.role === r).length + " " + LINE_NAMES[r]).join(" · ");
    const best = [...t.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(p => p.short).join(", ");
    return `${who} dẫn dắt ${t.name} (${t.country}) · OVR ${clubs.strength(t)} · ${t.players.length} cầu thủ: ${lines}. Mỗi trận bốc ngẫu nhiên 9 người (1 TM, 3 HV, 2 TV, 3 TĐ). Ngôi sao: ${best}.`;
  }
  function setupSpecs(panel) {
    const mode = panel.dataset.mode, cpu = mode === "cpu";
    let savedLevel = "normal";
    try { const stored = localStorage.getItem("ptsc-football.difficulty"); if (stored && Object.hasOwn(gameData.difficulty, stored)) savedLevel = stored; } catch {}
    const levelNote = d => (d.stats > 0 ? "+" : "") + d.stats + " chỉ số đội máy · tranh bóng ×" + d.tackle + " · dứt điểm ×" + d.finishing + " · ra quyết định ×" + d.think;
    const keyRow = slot => ({ key: "keys" + slot, label: cpu ? "Bố trí phím" : "Phím người " + slot,
      values: () => keymap.list().map(layout => [layout.id, layout.name + (layout.builtIn && !keymap.isOriginal(layout.id) ? " (đã sửa)" : "")]),
      get: () => keymap.assigned(mode, slot)?.id, set: id => keymap.assign(mode, slot, id),
      desc: id => layoutSummary(keymap.get(id)) });
    return [
      { key: "clubA", label: cpu ? "Đội của bạn" : "Đội người A", initial: clubs.get(savedClubs[mode + "A"]) ? savedClubs[mode + "A"] : clubIds()[0], values: () => clubs.list().map(t => [t.id, t.name]),
        desc: id => clubDesc(id, cpu ? "Bạn" : "Người A"), changed: id => rememberClub(mode + "A", id) },
      { key: "clubB", label: cpu ? "Đội máy" : "Đội người B", initial: clubs.get(savedClubs[mode + "B"]) || savedClubs[mode + "B"] === "random" ? savedClubs[mode + "B"] : clubIds()[1], values: () => [...(cpu ? [["random", "Ngẫu nhiên"]] : []), ...clubs.list().map(t => [t.id, t.name])],
        desc: id => id === "random" ? "Máy bốc một đội bất kỳ khác đội của bạn khi vào sân." : clubDesc(id, cpu ? "Máy" : "Người B"), changed: id => rememberClub(mode + "B", id) },
      cpu && { key: "level", label: "Độ khó máy", initial: savedLevel, values: () => Object.entries(gameData.difficulty).map(([id, d]) => [id, d.name]),
        desc: v => gameData.difficulty[v].name + ": " + levelNote(gameData.difficulty[v]) + ". Đội của bạn không đổi.",
        changed: v => { try { localStorage.setItem("ptsc-football.difficulty", v); } catch {} } },
      !cpu && { key: "side", label: "Sân bắt đầu của B", initial: "right", values: () => [["left", "Sân trái"], ["right", "Sân phải"]],
        desc: v => `Người B bắt đầu ở ${v === "left" ? "sân trái" : "sân phải"}; hai đội đổi sân giữa hiệp.` },
      { key: "duration", label: "Thời gian", initial: 2, values: () => [2, 4, 6, 10].map(min => [min, min + " phút"]), desc: v => `${v} phút bóng lăn, chia hai hiệp.` },
      { key: "extraTime", label: "Hiệp phụ nếu hòa", initial: false, values: () => onOff, desc: () => "Hòa sau thời gian chính thức thì đá thêm hiệp phụ." },
      { key: "penalties", label: "Luân lưu nếu vẫn hòa", initial: false, values: () => onOff, desc: () => "Vẫn hòa thì phân thắng thua bằng loạt sút luân lưu." },
      { key: "support", label: cpu ? "Hỗ trợ ngắm" : "Hỗ trợ ngắm (A và B)", initial: true, values: () => onOff,
        desc: () => "Chuyền tới đồng đội gần hướng ngắm và sút trúng khung thành. Đổi được ngay trong trận (Esc → menu).",
        changed: v => { sessions.get(mode)?.api.setSupport(v); syncSupport(panel); } },
      { key: "autoTactics", label: "Tự động đổi chiến thuật", initial: false, values: () => onOff,
        desc: v => v ? "Máy đổi sơ đồ theo tỉ số cho đội của bạn: giữ chắc khi dẫn, dồn lên khi bị dẫn." : "Sơ đồ bạn chọn trong Kế hoạch trận được giữ nguyên suốt trận." },
      { key: "autoSubs", label: "Tự động thay người", initial: true, values: () => onOff,
        desc: v => v ? "Máy đưa người dự bị khỏe vào thay cầu thủ mệt ở lúc bóng chết rồi tự xếp lại vị trí; bạn vẫn tự thay được." : "Chỉ thay người khi bạn chọn trong Kế hoạch trận (chấn thương vẫn được thay)." },
      { key: "autoSwitch", label: cpu ? "Tự động đổi người" : "Tự động đổi người (A và B)", initial: true, values: () => onOff,
        desc: v => v ? "Mất bóng: con trỏ tự nhảy sang đồng đội gần bóng nhất (hoặc gần điểm bóng rơi); người bạn vừa chọn tay được giữ 1,2 giây. Đổi được trong Kế hoạch trận → Hỗ trợ." : "Chỉ đổi người bằng phím đổi người.",
        changed: v => { sessions.get(mode)?.api.setAutoSwitch(v); } },
      keyRow("A"), !cpu && keyRow("B")
    ].filter(Boolean);
  }
  function buildSetup(panel) {
    const specs = setupSpecs(panel), list = panel.querySelector(".opt-list");
    panel.setup = { specs: new Map(specs.map(spec => [spec.key, spec])), values: Object.fromEntries(specs.filter(spec => !spec.get).map(spec => [spec.key, spec.initial])), note: null };
    list.innerHTML = specs.map(spec => `<div class="opt" data-opt="${spec.key}" data-nav tabindex="0" role="slider" aria-label="${escapeHtml(spec.label)}" aria-valuemin="0"><span class="opt-label">${escapeHtml(spec.label)}</span><button type="button" class="opt-arrow opt-prev" tabindex="-1" aria-label="${escapeHtml(spec.label)}: lựa chọn trước"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><span class="opt-value"></span><button type="button" class="opt-arrow opt-next" tabindex="-1" aria-label="${escapeHtml(spec.label)}: lựa chọn sau"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>`).join("")
      + '<button type="button" class="opt opt-link keymap-open" data-nav><span class="opt-label">Tùy chỉnh phím</span><span class="opt-value">Mở bộ sửa phím <span aria-hidden="true">›</span></span></button>';
    list.addEventListener("click", event => {
      const row = event.target.closest(".opt");
      if (!row) return;
      if (row.classList.contains("keymap-open")) { go("info/keys"); return; }
      focusOn(row);
      stepOpt(panel, row, event.target.closest(".opt-prev") ? -1 : 1);
    });
    list.addEventListener("focusin", event => { const row = event.target.closest(".opt"); if (row) { panel.lastOpt = row; panel.setup.note = null; describe(panel, row); } });
    panel.querySelector(".start").addEventListener("click", () => startMatch(panel));
    keymapRenders.add(() => renderSetup(panel));
    renderSetup(panel);
  }
  const optValue = (panel, spec) => spec.get ? spec.get() : panel.setup.values[spec.key];
  function stepOpt(panel, row, dir) {
    const spec = panel.setup.specs.get(row.dataset.opt);
    if (!spec) return;
    const values = spec.values(), current = optValue(panel, spec), count = values.length;
    const at = Math.max(0, values.findIndex(([v]) => v === current));
    let clash = null, changed = false;
    for (let n = 1; n < count && !changed; n++) {
      const [value] = values[((at + dir * n) % count + count) % count];
      if (spec.set) { const result = spec.set(value); if (result.ok) changed = true; else clash ??= result.clash; }
      else { panel.setup.values[spec.key] = value; spec.changed?.(value); changed = true; }
    }
    // A layout that would share keys with the other player is skipped; say so when nothing else is left.
    panel.setup.note = !changed && clash ? "Không đổi được: các layout khác trùng phím " + clash.map(label).join(", ") + " với người còn lại. Sửa layout ở Thông tin game → Layout phím." : null;
    renderSetup(panel);
    describe(panel, row);
  }
  function describe(panel, row) {
    if (!row) return;
    const spec = panel.setup.specs.get(row?.dataset.opt), desc = panel.querySelector(".opt-desc");
    const text = panel.setup.note ?? (spec ? spec.desc(optValue(panel, spec)) : row?.classList.contains("keymap-open") ? "Đổi phím, tạo layout mới hoặc khôi phục phím gốc." : "");
    writeText(desc, text); desc.dataset.tone = panel.setup.note ? "error" : "";
  }
  function renderSetup(panel) {
    if (!panel.setup) return;
    for (const row of panel.querySelectorAll(".opt[data-opt]")) {
      const spec = panel.setup.specs.get(row.dataset.opt), values = spec.values(), current = optValue(panel, spec);
      const index = Math.max(0, values.findIndex(([v]) => v === current)), text = values[index]?.[1] ?? "";
      row.dataset.value = String(current);
      row.querySelector(".opt-value").innerHTML = (spec.swatch ? `<i class="swatch ${current === "R" ? "red" : "blue"}" aria-hidden="true"></i>` : "") + escapeHtml(text);
      row.setAttribute("aria-valuemax", String(values.length - 1)); row.setAttribute("aria-valuenow", String(index)); row.setAttribute("aria-valuetext", text);
    }
    renderMatchup(panel);
    if (panel.contains(document.activeElement)) describe(panel, document.activeElement.closest(".opt"));
  }
  function optionsFor(panel) {
    const v = panel.setup.values, mode = panel.dataset.mode, teamA = "R", teamB = "B";
    return { mode, duration: v.duration, extraTime: v.extraTime, penalties: v.penalties, support: v.support, difficulty: v.level ?? "normal", autoTactics: v.autoTactics, autoSubs: v.autoSubs, autoSwitch: v.autoSwitch,
      clubA: v.clubA, clubB: v.clubB, teamA, leftTeam: mode === "local" ? (v.side === "left" ? teamB : teamA) : "R" };
  }
  function renderMatchup(panel) {
    const o = optionsFor(panel), cpu = o.mode === "cpu", teamB = opposite(o.teamA);
    const side = team => o.leftTeam === team ? "sân trái" : "sân phải";
    const who = cpu ? ["Bạn", "Máy"] : ["Người A", "Người B"];
    const clubA = clubs.get(o.clubA), clubB = o.clubB === "random" ? null : clubs.get(o.clubB);
    const kits = clubA && clubB ? clubs.kitsFor(clubA.id, clubB.id) : null;
    const team = (t, name) => {
      const club = t === "R" ? clubA : clubB, kit = kits?.[t];
      const art = club ? `<img class="vs-logo" src="${escapeHtml(club.logo)}" alt="" width="64" height="64" loading="lazy"><img class="vs-kit" src="${escapeHtml(kit?.image ?? club.kits.home.image)}" alt="" width="60" height="94" loading="lazy">` : '<span class="vs-logo vs-unknown" aria-hidden="true">?</span>';
      return `<div class="vs-team" data-team="${t}">${art}<b>${escapeHtml(club?.name ?? "Ngẫu nhiên")}</b><small>${name} · ${side(t)}${club ? " · OVR " + clubs.strength(club) : ""}${kit ? " · áo " + (kit.kit === "home" ? "sân nhà" : "sân khách") : ""}</small></div>`;
    };
    const facts = [["Thời gian", o.duration + " phút"], cpu && ["Độ khó", gameData.difficulty[o.difficulty]?.name ?? "Thường"], ["Hiệp phụ", o.extraTime ? "Có" : "Không"], ["Luân lưu", o.penalties ? "Có" : "Không"], ["Hỗ trợ ngắm", o.support ? "Bật" : "Tắt"], ["Tự động", [o.autoTactics && "chiến thuật", o.autoSubs && "thay người", o.autoSwitch && "đổi người"].filter(Boolean).join(", ") || "Tắt"]].filter(Boolean);
    const html = `<div class="vs">${team(o.teamA, who[0])}<span class="vs-mark">VS</span>${team(teamB, who[1])}</div><dl class="vs-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
      + (sessions.has(o.mode) ? '<p class="vs-note">Trận đang dở sẽ được thay bằng trận mới.</p>' : "");
    const matchup = panel.querySelector(".matchup");
    if (matchup.innerHTML !== html) matchup.innerHTML = html;
    panel.querySelector(".start").innerHTML = `<span>${sessions.has(o.mode) ? "Trận mới" : "Vào sân"}</span><kbd>Enter</kbd>`;
  }
  function syncSupport(panel) {
    const button = panel.querySelector(".support-button"), on = panel.setup.values.support;
    if (!button) return;
    button.setAttribute("aria-pressed", String(on));
    button.querySelector(".menu-item-text").innerHTML = 'Hỗ trợ ngắm <b class="toggle-state">' + (on ? "Bật" : "Tắt") + "</b>";
  }
  function startMatch(panel, { rematch = false } = {}) {
    releaseKeys();
    const mode = panel.dataset.mode;
    const previous = sessions.get(mode);
    previous?.penaltyView.clearTimers(); previous?.api.destroy();
    const options = optionsFor(panel), arena = panel.querySelector(".arena");
    const host = panel.querySelector(".match-host"); host.replaceChildren();
    // The two clubs and a fresh nine from each; a rematch keeps the clubs but draws again.
    const keep = rematch && previous?.options?.clubA && previous?.options?.clubB;
    const idA = keep ? previous.options.clubA : resolveClub(options.clubA), idB = keep ? previous.options.clubB : resolveClub(options.clubB, idA), rng = rngFrom(host.dataset.seed);
    options.clubA = idA; options.clubB = idB;
    options.squads = { R: clubs.pickSquad(idA, rng), B: clubs.pickSquad(idB, rng) };
    options.teams = clubs.teamOption(idA, idB);
    const api = window.PTSCFootball.mount(host, options);
    paintTeams(panel, api);
    api.pause();
    const penaltyKeys = slot => {
      const set = bindingsOf(mode)[slot] ?? {};
      return { left: label(set.left), center: label(set.down), right: label(set.right), special: label(set.special) };
    };
    const session = { panel, arena, api, options, paused: true, awaitingStart: true, overlay: panel.overlay, timeouts: { A: TIMEOUTS, B: TIMEOUTS }, timeout: null, flash: null,
      penaltyView: new window.PTSCPenaltyView(panel.querySelector(".penalty-host"), api, { keys: penaltyKeys }) };
    sessions.set(mode, session); panel.__session = session;
    closeSheets(arena);
    panel.querySelector(".arena-energy").hidden = false;
    playerCards(session); updateHud(session); renderSetup(panel); syncSupport(panel);
    go(mode + "/match");
  }

  /* ------------------------------ cards and HUD ------------------------------ */
  const ROLE_NAMES = { GK: "Thủ môn", DF: "Hậu vệ", MF: "Tiền vệ", FW: "Tiền đạo" };
  const levelOf = v => v >= 80 ? "high" : v >= 65 ? "mid" : "low";
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const isHuman = controller => controller === "A" || controller === "B";
  /** Who is on each card: the controlled sides first, then the computer's (or Đỏ then Xanh when watching). */
  function cardOrder(mode, teamA, view) {
    const item = (team, controller) => ({ team, controller, name: nameOf(view, team) });
    if (mode === "local") return [item(teamA, "A"), item(opposite(teamA), "B")];
    if (mode === "cpu") return [item(teamA, "A"), item(opposite(teamA), "cpu")];
    return [item("R", "auto"), item("B", "auto")];
  }
  const controllerLabel = (controller, name) => controller === "cpu" ? "Máy · " + name : controller === "auto" ? name : "Người " + controller + " · " + name;
  /** Big, readable cards: overall rating, name, build, stamina, skill, ten ratings and both playing styles. */
  function buildTeamCards(container, order) {
    container.replaceChildren();
    container.cards = order.map(({ team, controller, name }) => {
      const card = document.createElement("article");
      card.className = "player-card"; card.dataset.team = team; card.dataset.controller = controller;
      if (isHuman(controller)) card.dataset.slot = controller;
      const stats = gameData.stats.keys.map(k => '<div class="pc-stat" data-stat="' + k + '" title="' + gameData.stats.labels[k] + '"><b>–</b><span>' + gameData.stats.short[k] + '</span><i><i></i></i></div>').join("");
      card.innerHTML = '<div class="pc-head"><div class="pc-ovr"><b data-f="ovr">–</b><small>OVR</small></div>'
        + '<div class="pc-id"><span class="pc-tag" data-f="tag">' + escapeHtml(controllerLabel(controller, name)) + '</span><strong data-f="name">Chuẩn bị</strong><span class="pc-meta" data-f="meta"></span></div>'
        + '<div class="pc-skill" data-f="skillBox"><svg viewBox="0 0 24 24" aria-hidden="true"></svg><span><b data-f="skillShort"></b><small data-f="skillState"></small></span></div></div>'
        + '<div class="pc-energy"><span>Thể lực</span><b data-f="energy">100%</b><div class="pc-bar"><i data-f="energyBar"></i></div></div>'
        + '<div class="pc-stats">' + stats + '</div>'
        + '<div class="pc-styles"><span class="chip atk"><small>Có bóng</small><b data-f="atk"></b></span><span class="chip def"><small>Mất bóng</small><b data-f="def"></b></span></div>'
        + '<p class="pc-skill-desc" data-f="skillDesc"></p>'
        + (isHuman(controller) ? '<div class="charge-hud"><span class="charge-text">Giữ phím chuyền/sút để nạp lực</span><progress max="1" value="0" aria-label="Lực chuyền hoặc sút"></progress></div>' : "");
      card.fields = Object.fromEntries([...card.querySelectorAll("[data-f]")].map(n => [n.dataset.f, n]));
      card.stats = [...card.querySelectorAll("[data-stat]")].map(n => ({ key: n.dataset.stat, node: n, value: n.querySelector("b"), bar: n.querySelector("i i") }));
      container.append(card);
      return card;
    });
  }
  function skillStateText(skill, paused) {
    return paused ? "Tạm dừng" : skill.active ? (skill.auto ? skill.minutesLeft + "' còn lại" : Math.ceil(skill.remaining) + "s") : skill.label;
  }
  function updateTeamCard(card, info, ctx) {
    if (!info?.name) return;
    const f = card.fields, b = info.body, skill = info.special;
    writeText(f.ovr, info.ovr ?? "–"); f.ovr.dataset.level = levelOf(info.ovr ?? 0);
    writeText(f.name, info.name + (info.number != null ? " #" + info.number : ""));
    const side = ctx.leftTeam === info.team ? "sân trái" : "sân phải";
    writeText(f.meta, (ROLE_NAMES[info.role] ?? "") + (b ? " · " + (b.height / 100).toFixed(2).replace(".", "m") + " · " + b.weight + "kg" : "") + " · " + side + (info.hasBall ? " · có bóng" : ""));
    const percent = Math.round(info.energy * 100);
    writeText(f.energy, percent + "%"); f.energyBar.style.width = percent + "%"; card.classList.toggle("is-low", info.energy < .35);
    for (const s of card.stats) {
      const v = info.stats?.[s.key] ?? 0;
      writeText(s.value, v || "–"); s.node.dataset.level = levelOf(v); s.bar.style.width = Math.round(clamp01((v - 35) / 60) * 100) + "%";
    }
    writeText(f.atk, info.style?.attack.name || "–"); f.atk.title = info.style?.attack.desc ?? "";
    writeText(f.def, info.style?.defense.name || "–"); f.def.title = info.style?.defense.desc ?? "";
    if (f.skillBox.dataset.kind !== String(skill.kind)) {
      f.skillBox.dataset.kind = String(skill.kind);
      f.skillBox.querySelector("svg").innerHTML = skill.kind ? skillBadge(skill.kind, skill.icon, "card-" + ctx.id + "-" + card.dataset.team) : "";
    }
    writeText(f.skillShort, skill.kind ? skill.short || skill.name : "Không có");
    writeText(f.skillState, skillStateText(skill, ctx.paused));
    f.skillBox.classList.toggle("is-active", skill.active); f.skillBox.classList.toggle("is-unavailable", !skill.ready && !skill.active);
    const key = ctx.keyFor?.(card.dataset.controller);
    writeText(f.skillDesc, skill.kind ? (key ? key + " · " : "") + skill.name + ": " + skill.desc : "");
  }
  /** The in-pitch stamina and skill boxes, one per side. */
  function buildEnergyBoxes(container, order) {
    container.innerHTML = order.map(({ team, controller }) => '<div class="energy-player" data-team="' + team + '" data-slot="' + (isHuman(controller) ? controller : "cpu") + '" data-controller="' + controller + '"><span class="energy-name">' + controller + '</span><strong>100%</strong><progress max="1" value="1" aria-label="Thể lực"></progress><div class="special-button is-unavailable" role="img"><svg viewBox="0 0 24 24" aria-hidden="true"></svg>' + (isHuman(controller) ? "<kbd></kbd>" : "") + '<span class="skill-short"></span><span class="skill-state">Sẵn sàng</span></div></div>').join("");
  }
  function updateEnergyBox(box, info, ctx) {
    if (!box || !info?.name) return;
    const controller = box.dataset.controller, prefix = controller === "cpu" ? "Máy" : controller === "auto" ? (ctx.shorts?.[info.team] ?? info.team) : controller;
    writeText(box.querySelector(".energy-name"), prefix + " · " + (info.short || info.name) + (info.ovr ? " · " + info.ovr : ""));
    writeText(box.querySelector("strong"), Math.round(info.energy * 100) + "%");
    box.querySelector("progress").value = info.energy; box.classList.toggle("is-low", info.energy < .35);
    const button = box.querySelector(".special-button"), skill = info.special;
    if (button.dataset.kind !== String(skill.kind)) {
      button.dataset.kind = String(skill.kind);
      button.querySelector("svg").innerHTML = skill.kind ? skillBadge(skill.kind, skill.icon, "box-" + ctx.id + "-" + box.dataset.team) : "";
    }
    const state = skillStateText(skill, ctx.paused);
    writeText(button.querySelector(".skill-state"), state);
    writeText(button.querySelector(".skill-short"), skill.kind ? skill.short || skill.name : "Không có");
    button.classList.toggle("is-active", skill.active); button.classList.toggle("is-used", skill.used && !skill.active);
    button.classList.toggle("is-unavailable", ctx.paused || ctx.ended || !skill.ready);
    button.title = skill.kind ? skill.name + " · " + skill.desc + " · " + state : "Không có skill";
    button.setAttribute("aria-label", prefix + ": " + button.title);
  }
  function playerCards(session) {
    const order = cardOrder(session.options.mode, session.options.teamA, session);
    buildTeamCards(session.arena.querySelector(".player-status"), order);
    buildEnergyBoxes(session.panel.querySelector(".arena-energy"), order);
    renderPanelKeys(session.panel);
  }
  function updateHud(session) {
    session.hudNodes ??= new Map();
    const q = selector => {
      if (!session.hudNodes.has(selector)) session.hudNodes.set(selector, session.panel.querySelector(selector));
      return session.hudNodes.get(selector);
    };
    const state = session.api.status(), bindings = bindingsOf(session.options.mode);
    if (!!state.refBreak !== !!session.refStopped) {
      session.refStopped = !!state.refBreak;
      // A referee stoppage cancels kicks but preserves held movement keys.
      for (const [slot, pending] of pendingShots) if (pending.session === session) {
        clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot);
      }
      chargeStarts.clear(); session.api.cancelCharge("A"); session.api.cancelCharge("B");
    }
    // Phases that block movement (celebrations, penalties) end without a key event; re-send held keys each tick.
    const accepts = session.api.acceptsMovement();
    if (accepts !== session.acceptedMovement) { session.acceptedMovement = accepts; applyKeys(session); }
    session.penaltyView.update(state, session.paused);
    q(".arena-hints").hidden = !!state.penalty || state.ended;
    const restartChoice = q(".restart-choice"), corner = state.corner, kickoff = state.kickoff, freeKick = state.freeKick, goalKick = state.goalKick;
    restartChoice.hidden = state.ended || !!state.penalty || !(corner?.slot || kickoff?.slot || freeKick?.slot || goalKick?.slot);
    const restartSlot = corner?.slot ?? kickoff?.slot ?? freeKick?.slot ?? goalKick?.slot;
    for (const guide of q(".arena-hints").querySelectorAll(".pad-help")) guide.hidden = !restartChoice.hidden && guide.dataset.slot === restartSlot;
    if (!restartChoice.hidden) {
      const restart = corner ?? kickoff ?? freeKick ?? goalKick, set = bindings[restart.slot];
      restartChoice.dataset.slot = restart.slot;
      const text = state.refBreak ? "Chờ trọng tài quay lại" : `${corner ? "Phạt góc" : freeKick ? "Đá phạt" : goalKick ? "Phát bóng" : "Giao bóng"} · ${restart.name}${restart.ready ? "" : " · đang vào vị trí"}`;
      writeText(restartChoice.querySelector(".restart-label"), text);
      const hints = !set ? "" : corner ? gameData.corners.map((c, i) => `<span>${kbd(set[CORNER_ACTIONS[i]])} ${c.name}</span>`).join("")
        : freeKick ? `<span>Giữ/thả ${kbd(set.pass)} chuyền</span><span>${kbd(set.shoot)} sút</span>` : goalKick ? `<span>Giữ/thả ${kbd(set.pass)} chuyền phát bóng</span>` : `<span>${kbd(set.pass)} Chuyền giao bóng</span>`;
      const hintNode = restartChoice.querySelector(".restart-keys");
      if (session.restartHints !== hints) { hintNode.innerHTML = hints; session.restartHints = hints; }
      restartChoice.classList.toggle("is-preparing", !restart.ready || !!state.refBreak);
    }
    const result = q(".arena-result");
    result.hidden = !state.ended;
    if (state.ended) {
      result.querySelector("strong").textContent = state.winner ? `${nameOf(session, state.winner)} chiến thắng!` : "Hai đội hòa!";
      result.querySelector("span").textContent = `${shortOf(session, "R")} ${state.score.R}–${state.score.B} ${shortOf(session, "B")}${state.penalty ? ` · PEN ${state.penalty.score.R}–${state.penalty.score.B}` : ""}`;
    }
    const status = q(".match-status");
    q(".pause").disabled = state.ended;
    if (state.ended) {
      const outcome = state.winner ? `${nameOf(session, state.winner)} thắng` : "Hai đội hòa";
      writeText(status, state.penalty || state.note?.includes("thiếu người") ? state.note : `Hết giờ · ${outcome} · ${shortOf(session, "R")} ${state.score.R}–${state.score.B} ${shortOf(session, "B")}`);
      session.api.setInput("A"); session.api.setInput("B");
      // After the final whistle has had its moment, the full-time menu comes up.
      session.endedAt ??= performance.now();
      if (!session.endShown && performance.now() - session.endedAt > 2200) {
        session.endShown = true; peek(session, false);
        const watching = sessions.get(activeMode) === session && route.sub === "match";
        showOverlay(session, "end", watching && (document.activeElement === session.arena || session.overlay.contains(document.activeElement)));
      }
    } else {
      const phase = { reset: "Chuẩn bị giao bóng", celebrate: "Bàn thắng!", halftime: "Nghỉ giữa hiệp · đổi sân" }[state.phase];
      writeText(status, session.awaitingStart ? "Nhấn Space để bắt đầu trận đấu" : session.paused ? "Đang tạm dừng" : phase ?? (state.stoppage ? state.note || "Chuẩn bị đưa bóng trở lại" : `${state.extraTime ? "Hiệp phụ · " : ""}${state.minute}' · ${shortOf(session, "R")} ${state.score.R}–${state.score.B} ${shortOf(session, "B")}`));
    }
    // A timeout counts down on the menu card and lets play go on when it runs out; a refused pause flashes a note.
    if (session.timeout && session.paused) {
      if (performance.now() >= session.timeout.until && !document.hidden && document.hasFocus()) setPaused(session, false);
      else { const left = timeoutLeft(session); if (session.shownLeft !== left) { session.shownLeft = left; showOverlay(session, "pause"); } }
    }
    const flash = q(".arena-flash");
    if (flash) { const show = session.flash && performance.now() < session.flash.until; flash.hidden = !show; if (show) writeText(flash, session.flash.text); }
    const ctx = { id: session.options.mode, leftTeam: state.leftTeam, paused: session.paused && !session.awaitingStart, ended: state.ended, keyFor: c => bindings[c] ? label(bindings[c].special) : "", shorts: { R: shortOf(session, "R"), B: shortOf(session, "B") } };
    const cards = session.arena.querySelector(".player-status").cards ?? [];
    for (const card of cards) updateTeamCard(card, state.teams?.[card.dataset.team], ctx);
    for (const box of q(".arena-energy").children) updateEnergyBox(box, state.teams?.[box.dataset.team], ctx);
    for (const player of state.players) {
      const switchButton = q('.switch-action[data-slot="' + player.slot + '"]');
      if (switchButton) switchButton.disabled = session.paused || state.ended;
      const kbdNode = q(".arena-energy").querySelector('[data-slot="' + player.slot + '"] kbd');
      if (kbdNode && bindings[player.slot]) writeText(kbdNode, label(bindings[player.slot].special));
      const slideButton = q('.slide-action[data-slot="' + player.slot + '"]');
      if (slideButton) {
        slideButton.disabled = session.paused || state.ended || !player.ready || (!player.hasBall && !player.slideReady);
        writeText(slideButton.querySelector(".action-label"), player.hasBall ? "Sút" : "Xoạc");
      }
      const card = cards.find(c => c.dataset.slot === player.slot);
      if (!card) continue;
      card.querySelector("progress").value = player.charge?.power ?? 0;
      writeText(card.querySelector(".charge-text"), player.charge ? (player.charge.action === "pass" ? "Lực chuyền" : "Lực sút") + ": " + Math.round(player.charge.power * 100) + "%" : player.pressing ? "Đang bám người · giữ phím áp sát" : "Giữ chuyền/sút để nạp lực · bấm 2 lần: siêu tốc / thần sầu");
    }
  }

  /* ------------------------------ key layouts ------------------------------ */
  let capture = null;
  const keymapRenders = new Set();
  const renderKeymaps = () => { for (const render of keymapRenders) render(); };
  /** The key-layout editor (Game info · Layout phím): pick a layout, rebind, overwrite or save as new, assign. */
  function setupKeymapEditor(container) {
    const targets = [["cpu", "A", "Đấu với máy · Bạn"], ["local", "A", "Hai người · A"], ["local", "B", "Hai người · B"]];
    const arrow = (cls, text, d) => `<button type="button" class="opt-arrow ${cls}" tabindex="-1" aria-label="${text}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></button>`;
    const editor = document.createElement("div"); editor.className = "keymap browser keymap-browser";
    editor.innerHTML = '<header class="br-head"><h2 class="pane-title">Layout phím</h2><p class="pane-lead">Lưu trong trình duyệt này. Chọn một phím, nhấn <kbd>Enter</kbd> rồi bấm phím mới (<kbd>Esc</kbd> để hủy). Không dùng được Space, Esc, Tab, Ctrl/Alt và F1–F12; phím đã có trong layout sẽ được hoán đổi.</p></header>'
      + '<div class="br-body"><div class="br-list keymap-list">'
      + '<div class="opt keymap-pick" data-br data-nav data-side tabindex="0" role="slider" aria-label="Layout đang sửa"><span class="opt-label">Layout đang sửa</span>' + arrow("opt-prev", "Layout trước", "M15 5l-7 7 7 7") + '<span class="opt-value"></span>' + arrow("opt-next", "Layout sau", "M9 5l7 7-7 7") + "</div>"
      + '<label class="opt keymap-name-row"><span class="opt-label">Tên layout</span><input class="keymap-name" data-br data-nav maxlength="40" autocomplete="off" aria-label="Tên layout"></label>'
      + '<p class="br-sep">Phím</p><div class="keymap-grid">' + keymap.ACTIONS.map(action => `<button type="button" class="br-item keymap-key" data-br data-nav data-action="${action}"><span class="km-label">${keymap.LABELS[action]}</span><span class="km-cap"></span></button>`).join("") + "</div>"
      + '<p class="keymap-status" role="status"></p>'
      + '<p class="br-sep">Lưu</p><div class="keymap-actions"><button type="button" class="menu-item keymap-save" data-br data-nav>Ghi đè layout</button><button type="button" class="menu-item keymap-save-new" data-br data-nav>Lưu thành layout mới</button><button type="button" class="menu-item keymap-restore" data-br data-nav>Khôi phục gốc</button><button type="button" class="menu-item keymap-delete" data-br data-nav>Xóa layout</button></div>'
      + '<p class="br-sep">Dùng layout này cho</p><div class="keymap-actions keymap-targets">' + targets.map(([mode, slot, name]) => `<button type="button" class="menu-item keymap-use" data-br data-nav data-mode="${mode}" data-slot="${slot}" data-name="${name}"><span class="menu-item-text">${name}<b class="toggle-state"></b></span></button>`).join("") + "</div>"
      + '</div><aside class="br-detail keymap-preview" aria-hidden="true"></aside></div>';
    container.append(editor);
    const pick = editor.querySelector(".keymap-pick"), nameInput = editor.querySelector(".keymap-name"), status = editor.querySelector(".keymap-status"), preview = editor.querySelector(".keymap-preview");
    let editingId = keymap.assigned("cpu", "A").id, draft = null, dirty = false, hot = null;
    const say = (message, tone = "") => { status.textContent = message; status.dataset.tone = tone; };
    const layoutName = layout => layout.name + (layout.builtIn && !keymap.isOriginal(layout.id) ? " (đã sửa)" : "");
    function loadDraft(id) {
      const layout = keymap.get(id) ?? keymap.assigned("cpu", "A");
      editingId = layout.id; draft = { ...layout.keys }; dirty = false; nameInput.value = layout.name;
    }
    function drawPreview() {
      const used = targets.filter(([mode, slot]) => keymap.assigned(mode, slot)?.id === editingId).map(t => t[2]);
      preview.innerHTML = `<h3 class="bd-title">${escapeHtml(nameInput.value || "Layout")}${dirty ? ' <span class="bd-chip" style="--chip:#d29b10">Chưa lưu</span>' : ""}</h3>`
        + keyboardHtml(marksFor([["A", draft]], hot ? [hot] : []))
        + '<div class="bd-chips">' + (used.length ? used.map(u => chip("Đang dùng: " + u, "#3db86b")).join("") : chip("Chưa dùng cho chế độ nào")) + "</div>";
    }
    function render() {
      if (!keymap.get(editingId)) loadDraft(keymap.assigned("cpu", "A").id);
      const layouts = keymap.list(), at = layouts.findIndex(l => l.id === editingId), layout = keymap.get(editingId);
      writeText(pick.querySelector(".opt-value"), layoutName(layout));
      pick.dataset.value = editingId; pick.setAttribute("aria-valuetext", layoutName(layout)); pick.setAttribute("aria-valuenow", String(at)); pick.setAttribute("aria-valuemax", String(layouts.length - 1));
      for (const button of editor.querySelectorAll(".keymap-key")) {
        const listening = capture?.button === button;
        button.classList.toggle("is-listening", listening);
        button.querySelector(".km-cap").innerHTML = listening ? "Nhấn phím…" : kbd(draft[button.dataset.action]);
      }
      editor.querySelector(".keymap-delete").hidden = layout.builtIn;
      editor.querySelector(".keymap-restore").hidden = !layout.builtIn;
      editor.querySelector(".keymap-restore").disabled = keymap.isOriginal(editingId) && !dirty;
      editor.querySelector(".keymap-save").textContent = dirty ? "Ghi đè layout *" : "Ghi đè layout";
      for (const use of editor.querySelectorAll(".keymap-use")) {
        const on = keymap.assigned(use.dataset.mode, use.dataset.slot).id === editingId;
        use.classList.toggle("is-current", on); use.setAttribute("aria-pressed", String(on));
        writeText(use.querySelector(".toggle-state"), on ? "Đang dùng" : "Dùng");
      }
      drawPreview();
    }
    async function stepLayout(dir) {
      const layouts = keymap.list(), at = layouts.findIndex(l => l.id === editingId), next = layouts[(at + dir + layouts.length) % layouts.length];
      if (!next || next.id === editingId) return;
      if (dirty && !await gameConfirm("Bỏ các thay đổi chưa lưu của layout đang sửa?", "Bỏ thay đổi")) return;
      loadDraft(next.id); say(""); render();
    }
    loadDraft(editingId);
    keymapRenders.add(render);
    pick.addEventListener("click", event => { focusOn(pick); stepLayout(event.target.closest(".opt-prev") ? -1 : 1); });
    nameInput.addEventListener("input", () => { dirty = true; render(); });
    editor.addEventListener("focusin", event => { const key = event.target.closest(".keymap-key"); const next = key?.dataset.action ?? null; if (next !== hot) { hot = next; drawPreview(); } });
    for (const button of editor.querySelectorAll(".keymap-key")) button.addEventListener("click", () => {
      capture = capture?.button === button ? null : { button, assign: code => {
        const action = button.dataset.action, previous = draft[action];
        const other = keymap.ACTIONS.find(a => a !== action && draft[a] === code);
        draft[action] = code;
        if (other) draft[other] = previous;
        dirty = true;
        say(other ? "Đã hoán đổi: " + keymap.LABELS[action] + " = " + label(code) + ", " + keymap.LABELS[other] + " = " + label(previous) + "." : keymap.LABELS[action] + " = " + label(code) + ". Nhớ chọn “Ghi đè layout” để lưu.");
      } };
      render();
    });
    function store(id) {
      const result = keymap.save(id, nameInput.value, draft);
      if (!result.ok) {
        say(result.error === "clash" ? "Chưa lưu: layout này đang dùng cho chế độ hai người và sẽ trùng phím " + result.clash.map(label).join(", ") + " với người còn lại." : "Chưa lưu: layout không hợp lệ.", "error");
        return;
      }
      editingId = result.id; dirty = false; render();
      say((id ? "Đã ghi đè" : "Đã lưu mới") + " “" + keymap.get(result.id).name + "”." + (result.stored ? " Lưu trong trình duyệt này." : " Trình duyệt không cho lưu; chỉ áp dụng trong lần mở này."), "ok");
    }
    editor.querySelector(".keymap-save").addEventListener("click", () => store(editingId));
    editor.querySelector(".keymap-save-new").addEventListener("click", () => {
      const base = nameInput.value.trim() || "Layout của tôi";
      if (keymap.list().some(layout => layout.name === base)) nameInput.value = base + " (" + keymap.list().length + ")";
      store(null);
    });
    for (const use of editor.querySelectorAll(".keymap-use")) use.addEventListener("click", () => {
      if (dirty) store(editingId);
      if (dirty) return;
      const result = keymap.assign(use.dataset.mode, use.dataset.slot, editingId);
      say(result.ok ? use.dataset.name + " dùng “" + keymap.get(editingId).name + "”." : "Không dùng được: trùng phím " + result.clash.map(label).join(", ") + " với người còn lại.", result.ok ? "ok" : "error");
    });
    editor.querySelector(".keymap-restore").addEventListener("click", () => {
      const result = keymap.restore(editingId);
      if (result.ok) { loadDraft(editingId); say("Đã khôi phục phím gốc.", "ok"); render(); if (!editor.contains(document.activeElement)) focusOn(pick); }
      else say("Chưa khôi phục: trùng phím " + (result.clash?.map(label).join(", ") ?? "") + " với người còn lại.", "error");
    });
    editor.querySelector(".keymap-delete").addEventListener("click", async () => {
      const layout = keymap.get(editingId);
      if (!layout || layout.builtIn || !await gameConfirm("Xóa layout “" + layout.name + "”?", "Xóa")) return;
      if (editingId !== layout.id) return;
      keymap.remove(editingId); loadDraft(keymap.assigned("cpu", "A").id); say("Đã xóa “" + layout.name + "”.", "ok"); render();
      focusOn(pick);
    });
    browserKeys(editor, { onSide: (row, dir) => stepLayout(dir), onLeave: leaveToNav });
    render();
  }
  // While a key cell is listening, the next key press is the new binding and nothing else sees it.
  window.addEventListener("keydown", event => {
    if (!capture) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    const pending = capture;
    if (event.code === "Escape") { capture = null; renderKeymaps(); return; }
    if (keymap.reserved(event.code)) {
      pending.button.closest(".keymap").querySelector(".keymap-status").textContent = `Phím ${event.key === " " ? "Space" : event.code || event.key} được dành cho trình duyệt/tạm dừng, hãy chọn phím khác.`;
      return;
    }
    capture = null; pending.assign(event.code);
    renderKeymaps();
    pending.button.focus();
  }, true);
  document.addEventListener("pointerdown", event => {
    if (capture && !event.target.closest(".keymap-key")) { capture = null; renderKeymaps(); }
  });
  keymap.onChange(() => {
    releaseKeys();
    for (const panel of document.querySelectorAll(".game-panel")) renderPanelKeys(panel);
    renderKeymaps(); renderControlsGuide();
  });
  window.addEventListener("storage", event => { if (event.key === null || event.key?.startsWith("ptsc-football.key-layouts")) keymap.reload(); });

  /* ------------------------------ match panels ------------------------------ */
  for (const panel of document.querySelectorAll(".game-panel")) {
    const arena = panel.querySelector(".arena"), surface = arena.querySelector(".arena-surface");
    const mode = panel.dataset.mode, slots = mode === "local" ? ["A", "B"] : ["A"];
    buildSetup(panel);
    panel.overlay = buildOverlay(arena, [["resume", "Tiếp tục"], ["support", "Hỗ trợ ngắm", " support-button"], ["plan", "Kế hoạch trận"], ["controls", "Điều khiển"], ["restart", "Trận mới"], ["setup", "Cài đặt trận"], ["info", "Thông tin game"], ["menu", "Menu chính"]]);
    buildSheet(arena, "squad", "Chỉ số nhanh", SQUAD_SHEET);
    panel.planView = { panel, arena, planUI: null, get api() { return sessions.get(mode)?.api; }, get options() { return sessions.get(mode)?.options; } };
    buildPlanSheet(panel.planView);
    const controlsSheet = buildSheet(arena, "controls", "Điều khiển trận này", '<div class="sheet-controls"></div>');
    controlsSheet.classList.add("browser-sheet");
    panel.controlsBrowser = makeControlsBrowser(controlsSheet.querySelector(".sheet-controls"), () => [...slots.map(slot => ({ label: mode === "cpu" ? "Bạn" : "Người " + slot, slot, set: bindingsOf(mode)[slot], caption: mode === "cpu" ? "Bạn" : "Người " + slot })), { label: "Trong menu", slot: "M", set: null }],
      { title: "", lead: "Giữ <kbd>Tab</kbd> để xem nhanh chỉ số.", onLeave: () => false });
    syncSupport(panel);
    panel.overlay.addEventListener("click", event => {
      const button = event.target.closest("[data-act]"), act = button?.dataset.act, session = sessions.get(mode);
      if (!act || !session) return;
      if (act === "resume") resumeView(session);
      else if (act === "support") {
        panel.setup.values.support = !panel.setup.values.support;
        session.api.setSupport(panel.setup.values.support);
        syncSupport(panel); renderSetup(panel);
      } else if (act === "plan") openPlan(panel.planView, button);
      else if (act === "controls") { openSheet(session, act, button); panel.controlsBrowser.render(false); focusOn(arena.querySelector('.sheet[data-sheet="controls"] .br-item')); }
      else if (act === "restart") startMatch(panel, { rematch: true });
      else if (act === "setup") go(mode);
      else if (act === "info") go("info/skills");
      else if (act === "menu") go("menu");
    });
    const penaltyHost = document.createElement("div"); penaltyHost.className = "penalty-host"; penaltyHost.hidden = true;
    const restartChoice = document.createElement("div"); restartChoice.className = "restart-choice"; restartChoice.hidden = true;
    restartChoice.innerHTML = '<span class="restart-label"></span><div class="restart-keys"></div>';
    const energy = document.createElement("div"); energy.className = "arena-energy"; energy.hidden = true;
    const result = document.createElement("div"); result.className = "arena-result"; result.hidden = true;
    result.innerHTML = '<strong></strong><span></span>';
    surface.insertBefore(penaltyHost, surface.querySelector(".arena-hints"));
    surface.append(restartChoice, energy, result);
    renderPanelKeys(panel);
    // The pitch guide's switch and shoot/slide keys can be clicked too.
    surface.querySelector(".arena-hints").addEventListener("click", event => {
      const button = event.target.closest(".slide-action, .switch-action");
      const session = sessions.get(mode);
      if (!button || !session) return;
      if (button.classList.contains("switch-action")) session.api.action(button.dataset.slot, "switch");
      else if (!session.paused) {
        const player = session.api.status().players.find(p => p.slot === button.dataset.slot);
        session.api.action(button.dataset.slot, player?.hasBall ? "shoot" : "slide");
      }
      focusOn(arena); updateHud(session);
    });
    panel.querySelector(".pause").addEventListener("click", () => {
      const session = sessions.get(mode);
      if (!session || session.api.status().ended) return;
      if (session.paused) resumeView(session); else { session.timeout = null; setPaused(session, true, true); }
    });
    const flash = document.createElement("p"); flash.className = "arena-flash"; flash.hidden = true; flash.setAttribute("role", "status");
    surface.append(flash);
    arena.addEventListener("pointerdown", event => { if (sessions.has(mode) && !event.target.closest("button, .start-overlay, .sheet")) focusOn(arena); });
    // Leaving the pitch for another control stops movement; keys are still tracked until they are released.
    arena.addEventListener("focusout", event => { if (!arena.contains(event.relatedTarget)) { stopSwitchRepeats(); cancelKicks(); applyKeys(); } });
    arena.addEventListener("focusin", () => applyKeys());
  }

  /* ------------------------------ keyboard: menus ------------------------------ */
  // Menus answer to the arrows (and W A S D when nothing is being typed), Enter, Space and Esc, like a console pad.
  const NAV_KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
  const navItems = scope => [...scope.querySelectorAll("[data-nav]")].filter(el => !el.disabled && !el.closest("[hidden], [inert]") && el.getClientRects().length);
  function moveFocus(scope, delta) {
    const items = navItems(scope);
    if (!items.length) return null;
    const at = items.indexOf(document.activeElement?.closest?.("[data-nav]"));
    const next = at < 0 ? items[delta > 0 ? 0 : items.length - 1] : items[(at + delta + items.length) % items.length];
    focusOn(next); next.scrollIntoView?.({ block: "nearest" });
    return next;
  }
  function currentView() {
    if (route.name === "watch") return watchView;
    return route.sub === "match" ? sessions.get(route.name) ?? null : null;
  }
  window.addEventListener("keydown", event => {
    if (event.defaultPrevented || capture || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Escape" && fsElement() && !escLocked) return; // the browser leaves full screen
    const active = document.activeElement, typing = !!active?.matches?.("input, select, textarea");
    let dir = NAV_KEYS[event.code] ?? null;
    if (dir && event.code.startsWith("Key") && (typing || event.repeat)) dir = null;
    if (dir && typing) dir = null;
    const vertical = dir === "up" || dir === "down", delta = dir === "up" || dir === "left" ? -1 : 1;
    const handled = () => event.preventDefault();
    if (!dialog.hidden) {
      if (event.code === "Escape") { handled(); dialogAnswer?.(false); }
      else if (event.code === "Tab") { handled(); moveFocus(dialog, event.shiftKey ? -1 : 1); }
      else if (dir) { handled(); moveFocus(dialog, delta); }
      return;
    }
    // F toggles full screen from any menu; while the pitch has the keyboard it is a player's key instead.
    if (event.code === "KeyF" && !typing && !event.repeat && !active?.matches?.(".arena")) { handled(); toggleFullscreen(); return; }
    const view = currentView();
    if (view) {
      const sheet = [...view.arena.querySelectorAll(".sheet")].find(s => !s.hidden && !s.classList.contains("is-peek"));
      if (sheet) {
        if (sheet.dataset.sheet === "plan" && planKey(view === watchView ? watchView : view.panel.planView, sheet, event, dir)) { handled(); return; }
        const browser = sheet.querySelector(".browser");
        if (browser && !active?.closest?.("[data-br]") && sheet.contains(active) && (dir || ["KeyQ", "KeyE", "PageUp", "PageDown"].includes(event.code))) { handled(); backToEntry(browser, event); return; }
        if (event.code === "Escape") { handled(); closeSheet(sheet); }
        else if (event.code === "Tab") { handled(); moveFocus(sheet, event.shiftKey ? -1 : 1); }
        else if (vertical) { handled(); sheet.querySelector(".sheet-body").scrollBy({ top: delta * 90 }); }
        return;
      }
      const overlay = view.overlay;
      if (!overlay.hidden && overlay.contains(active)) {
        if (vertical) { handled(); if (!event.repeat) moveFocus(overlay, delta); }
        else if ((event.code === "Escape" || event.code === "Space") && !event.repeat && overlay.dataset.kind !== "end") { handled(); resumeView(view, event.code); }
        return;
      }
      if (!overlay.hidden && active === view.arena && (vertical || event.code === "Enter")) { handled(); focusCursor(); return; }
      if (view === watchView && active === watchArena) {
        if ((event.code === "Escape" || event.code === "Space") && !event.repeat) { handled(); setWatchPaused(!watchView.paused, true); }
        else if (event.code === "Tab" && !watchView.paused) { handled(); if (!event.repeat) peek(watchView, true); }
      }
      return;
    }
    if (route.name === "menu") {
      if (vertical) { handled(); moveFocus(mainMenu, delta); }
      else if (event.code === "Space" && active?.matches?.(".menu-item")) { handled(); active.click(); }
      return;
    }
    if (event.code === "Escape" && !(route.name === "info" && infoScreen.querySelector(".info-panes").contains(active))) { const back = backTarget(); if (back) { handled(); go(back); } return; }
    if (route.name === "cpu" || route.name === "local") {
      const panel = document.getElementById(SCREENS[route.name]), setup = panel.querySelector(".setup"), row = active?.closest?.(".opt[data-opt]");
      if (vertical) { handled(); moveFocus(setup, delta); }
      else if (dir && row) { handled(); stepOpt(panel, row, delta); }
      else if (dir === "right" && active?.matches?.(".keymap-open")) { handled(); go("info/keys"); }
      else if (event.code === "Space" && row && !event.repeat) { handled(); stepOpt(panel, row, 1); }
      else if (event.code === "Enter" && row && !event.repeat) { handled(); startMatch(panel); }
      return;
    }
    if (route.name === "info") {
      const nav = infoScreen.querySelector(".info-nav"), panes = infoScreen.querySelector(".info-panes");
      if (nav.contains(active) || active === document.body || !active) {
        if (vertical) { handled(); const tab = moveFocus(nav, delta); if (tab) go("info/" + tab.dataset.pane); }
        else if (dir === "right") { handled(); const pane = infoScreen.querySelector(".info-pane:not([hidden])"); focusOn(spatial(pane, null, "down") ?? panes); }
      } else if (panes.contains(active) && !active.closest("[data-br], input, select, textarea")) {
        const pane = infoScreen.querySelector(".info-pane:not([hidden])");
        if (event.code === "Escape" || dir === "left") { handled(); focusOn(nav.querySelector(".is-current")); }
        else if (dir || ["KeyQ", "KeyE", "PageUp", "PageDown"].includes(event.code)) { handled(); backToEntry(pane, event); }
      }
    }
  });
  // A console-style cursor: pointing at a menu entry selects it.
  // Only a real mouse movement moves the cursor: a menu opening under a resting pointer keeps its own selection.
  let lastPointer = "";
  game.addEventListener("pointermove", event => {
    const at = event.clientX + "," + event.clientY;
    if (event.pointerType !== "mouse" || at === lastPointer) return;
    lastPointer = at;
    if (document.activeElement?.matches?.("input, select, textarea")) return;
    const item = event.target.closest(".menu-item, .opt, .info-nav a, .setup .start, .sheet-back, .plan-row, .plan-shape[data-nav], .plan-toggle, .br-item, .keymap-pick");
    if (item && item !== document.activeElement && !item.closest("[hidden]") && !capture) focusOn(item);
  });

  /* ------------------------------ keyboard: play ------------------------------ */
  window.addEventListener("keydown", event => {
    const session = sessions.get(activeMode);
    if (!session || route.sub !== "match" || !session.arena.contains(document.activeElement)) return;
    // The menu has the keyboard, but a direction held over it still counts once play starts or resumes.
    if (document.activeElement.closest(".start-overlay") && !event.ctrlKey && !event.metaKey && !event.altKey) { const b = lookup(session.options.mode, event.code); if (b && MOVE_ACTIONS.has(b.action)) keys.add(event.code); return; }
    if (document.activeElement.closest(".sheet")) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Tab") {
      if (!session.paused && document.activeElement === session.arena && !session.api.status().ended) { event.preventDefault(); if (!event.repeat) peek(session, true); }
      return;
    }
    const mode = session.options.mode, bound = lookup(mode, event.code);
    if (!bound && event.code !== "Space" && event.code !== "Escape") return;
    if (event.code === "Escape" && fsElement() && !escLocked) { releaseKeys(); return; }
    if (event.code !== "Escape" && document.activeElement.matches("button, input, select, textarea")) return;
    event.preventDefault();
    if (event.code === "Space" || event.code === "Escape" || bound?.action === "pause") {
      if (event.repeat) return;
      if (session.api.status().ended) { session.endShown = true; showOverlay(session, "end", true); return; }
      // Paused with the pitch focused: Esc (or a pause key) puts the cursor on the menu, Space plays on.
      if (session.paused) { if (event.code === "Space") setPaused(session, false); else showOverlay(session, session.awaitingStart ? "start" : "pause", true); return; }
      if (event.code === "Escape") { session.timeout = null; setPaused(session, true, true); return; }
      requestPause(session, bound?.action === "pause" ? bound.slot : "A");
      return;
    }
    const { slot, action } = bound, state = session.api.status();
    // A shoot-out, or a penalty played live on the pitch (the 3D view): left, centre, right pick the way.
    if ((state.phase === "penalties" || state.penalty?.kind === "live") && PENALTY_ACTIONS[action]) {
      if (!event.repeat && !session.paused && !state.ended) { session.api.choosePenalty(slot, PENALTY_ACTIONS[action]); updateHud(session); }
      return;
    }
    const cornerPress = action === "press" && session.api.cornerSlot() === slot;
    if (MOVE_ACTIONS.has(action) && !cornerPress) {
      // Held keys are recorded even while paused, and re-sent on every press so a lost input recovers.
      keys.add(event.code); applyKeys(session); highlightPads();
      return;
    }
    if (action === "switch") {
      // Every physical press is accepted immediately; held repeats use our timer, independent of the OS delay.
      if (!event.repeat) {
        keys.add(event.code); session.api.action(slot, "switch"); updateHud(session); highlightPads();
        repeatSwitch(session, event.code, slot);
      }
      return;
    }
    if (action === "special") {
      if (!event.repeat && (!session.paused || session.awaitingStart)) {
        const pending = pendingShots.get(slot);
        if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); }
        chargeStarts.delete(slot); session.api.cancelCharge(slot);
        session.api.action(slot, "special"); updateHud(session);
      }
      return;
    }
    if (session.paused || state.ended) return;
    if (event.repeat && !keys.has(event.code)) return;
    if (state.corner?.slot === slot) {
      const index = CORNER_ACTIONS.indexOf(action);
      if (index !== -1) {
        if (!event.repeat && state.corner.ready) session.api.takeCorner(slot, gameData.corners[index].id);
        updateHud(session); return;
      }
    }
    keys.add(event.code);
    if (!event.repeat) {
      const player = state.players.find(p => p.slot === slot);
      const act = action === "shoot" && !player?.hasBall && state.freeKick?.slot !== slot ? "slide" : action;
      if (act === "pass" || act === "shoot") {
        const pending = pendingShots.get(slot);
        if (pending?.session === session && pending.action === act) {
          // The second of two quick taps: a special shot, or a rapid pass.
          clearTimeout(pending.timer); pendingShots.delete(slot);
          session.api.releaseCharge(slot, act === "shoot" ? { special: true, power: Math.max(.55, pending.power) } : { rapid: true });
        } else {
          if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot); }
          if (session.api.beginCharge(slot, act)) chargeStarts.set(slot, performance.now());
        }
      } else if (act === "challenge" || act === "slide") {
        const pending = pendingShots.get(slot);
        if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot); }
        chargeStarts.delete(slot);
        session.api.action(slot, act);
      }
    }
    updateHud(session);
    highlightPads();
  }, true);
  window.addEventListener("keyup", event => {
    if (event.code === "Tab") endPeeks();
    const repeat = switchRepeats.get(event.code);
    if (repeat) { clearTimeout(repeat.timer); switchRepeats.delete(event.code); }
    keys.delete(event.code); applyKeys();
    highlightPads();
    const session = sessions.get(activeMode);
    if (!session || session.paused || !session.arena.contains(document.activeElement)) return;
    const bound = lookup(session.options.mode, event.code);
    if (!bound || !["pass", "shoot"].includes(bound.action) || !chargeStarts.has(bound.slot)) return;
    const { slot, action } = bound;
    const elapsed = performance.now() - chargeStarts.get(slot); chargeStarts.delete(slot);
    const charge = session.api.status().players.find(p => p.slot === slot)?.charge;
    if (!charge || charge.action !== action) return;
    if (elapsed < 220) {
      // A short tap waits a moment for a second one (a special shot, a rapid pass); otherwise it is an ordinary kick.
      session.api.freezeCharge(slot);
      const pending = { session, action, power: charge.power, timer: null };
      pending.timer = setTimeout(() => {
        if (pendingShots.get(slot) !== pending) return;
        pendingShots.delete(slot);
        if (!session.paused && sessions.get(activeMode) === session) session.api.releaseCharge(slot);
        else session.api.cancelCharge(slot);
      }, action === "shoot" ? 230 : 200);
      pendingShots.set(slot, pending);
    } else session.api.releaseCharge(slot);
  }, true);
  function suspend() {
    if (capture) { capture = null; renderKeymaps(); }
    releaseKeys(); endPeeks(); watcher?.pause();
    for (const session of sessions.values()) { session.timeout = null; setPaused(session, true); }
  }
  window.addEventListener("blur", suspend);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("focus", () => { if (activeMode === "watch" && !document.hidden && !watchView.paused) watcher?.play(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else if (activeMode === "watch" && !watchView.paused) watcher?.play();
  });
  for (const type of ["copy", "cut", "selectstart", "dragstart"]) document.addEventListener(type, event => { if (!event.target.closest?.("input, textarea")) event.preventDefault(); });
  initWatch(); newWatch();
  {
    const pane = name => infoScreen.querySelector('.info-pane[data-pane="' + name + '"]');
    renderTeamsGuide(pane("teams")); renderSkillLegend(pane("skills")); renderStatsGuide(pane("stats")); renderStyleLegend(pane("styles"));
    setupKeymapEditor(pane("keys")); renderControlsGuide(); renderRulesGuide(pane("rules"));
  }
  syncFullscreen();
  if (!location.hash) history.replaceState(null, "", "#/menu");
  showRoute();
  setInterval(() => { const session = sessions.get(activeMode); if (session) updateHud(session); else updateWatchHud(); highlightPads(); }, 250);
})();
