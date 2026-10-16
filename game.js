(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[role=tab]")];
  const panels = [...document.querySelectorAll("[role=tabpanel]")];
  const sessions = new Map();
  // Physical keys held down. Tracked while paused too, so a direction held through Space keeps working.
  const keys = new Set();
  const switchRepeats = new Map();
  const names = { R: "Đỏ", B: "Xanh" };
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
    const slot = guide.dataset.slot, clickableArea = !!guide.closest(".controls");
    guide.innerHTML = `<div class="movement-help"><strong>NGƯỜI ${slot}</strong><div class="pad-diagram"><img src="assets/control-pad.svg" alt="Pad di chuyển của người ${slot}" width="343" height="343"><span class="pad-player">${slot}</span>${["up", "left", "down", "right"].map(direction => `<span class="pad-key pad-${direction}" data-code="${escapeHtml(set[direction])}">${escapeHtml(label(set[direction]))}</span>`).join("")}</div></div><div class="action-grid">${GUIDE_ACTIONS.map((action, i) => {
      const clickable = clickableArea && (action === "switch" || action === "shoot"), tag = clickable ? "button" : "div";
      return `<${tag} class="action-key${clickable ? action === "switch" ? " switch-action" : " slide-action" : ""}" data-code="${escapeHtml(set[action])}" data-action="${action}"${clickable ? ` type="button" data-slot="${slot}" disabled` : ""}>${kbd(set[action])}<span><span class="action-label">${GUIDE_LABELS[i]}</span><small>${GUIDE_GESTURES[i]}</small></span></${tag}>`;
    }).join("")}</div>`;
  }
  function renderAdvanced(details, set) {
    const slot = details.dataset.slot;
    details.innerHTML = `<summary>Người ${slot} · thao tác nâng cao</summary><p>${kbd(set.special)}: skill theo tình huống, tốn 40%, chung một lượt/cầu thủ/trận; penalty dùng trước khi chốt hướng.</p><p>${kbd(set.shoot)} ×2 nhanh khi có bóng: sút thần sầu, cần 23% thể lực, tốn 18%, lấy đà 0,6 giây.</p><p>Giữ ${kbd(set.pass)}/${kbd(set.shoot)} rồi thả: chuyền/sút theo lực nạp; lực mạnh cho bóng cao hơn.</p><p>Giữ ${kbd(set.press)} áp sát; bấm ${kbd(set.challenge)} khi đủ gần để tranh bóng: 30% lỗi nhẹ, 50% cướp bóng, 15% lỗi đáng nhận vàng, 5% lỗi nặng; thẻ xét theo mức độ.</p><p>${kbd(set.shoot)} khi phòng ngự: xoạc tự bám đối thủ trong 5,5m. Khi trúng: 50% cướp bóng / 50% thẻ đỏ; riêng 30% gây chấn thương.</p><p>Penalty/luân lưu: ${kbd(set.left)} trái · ${kbd(set.down)} giữa · ${kbd(set.right)} phải.</p>`;
  }
  /** A legend of every skill pictogram, its one-word label and full name. */
  function renderSkillLegend(panel) {
    const roles = { FW: "Tiền đạo", MF: "Tiền vệ", DF: "Hậu vệ", GK: "Thủ môn" };
    // Skills grouped by the situation they are for.
    const situations = [
      ["Tấn công", skill => skill.contexts.includes("attack")],
      ["Phòng ngự", skill => skill.contexts.includes("defense") && !skill.auto],
      ["Thủ môn · tự kích hoạt 5 phút", skill => skill.auto],
      ["Đá phạt & phạt góc", skill => skill.contexts.some(c => ["directFreeKick", "cornerAttack", "cornerDefense"].includes(c))],
      ["Penalty", skill => skill.contexts.some(c => ["penaltyAttack", "penaltyDefense"].includes(c))]
    ];
    const skillItem = ([kind, skill]) => {
      const context = skill.auto ? "Tự bật khi bị tấn công" : skill.contexts.map(c => gameData.skillContexts[c].label).join(" / ");
      const badge = skillBadge(kind, skill.icon, `legend-${panel.dataset.mode}-${kind}`);
      return `<div class="skill-legend-item"><svg viewBox="0 0 24 24" aria-hidden="true">${badge}</svg><span><b>${escapeHtml(skill.short)} <em>${escapeHtml(skill.name)}</em></b><small>${escapeHtml(skill.desc ?? "")}</small><small class="skill-when">${escapeHtml(context)}</small></span></div>`;
    };
    const skills = Object.entries(gameData.skills);
    const legend = document.createElement("details"); legend.className = "advanced skill-legend"; legend.open = true;
    legend.innerHTML = `<summary>Bảng skill · nhìn icon là hiểu</summary>${situations.map(([title, test]) => `<section class="legend-group"><h3>${title}</h3><div class="skill-legend-grid">${skills.filter(([, skill]) => test(skill)).map(skillItem).join("")}</div></section>`).join("")}`;
    panel.querySelector(".advanced-grid").after(legend);
    // Playing styles by zone of the pitch, attacking and defensive side by side.
    const styleItem = style => `<div class="style-legend-item"><b>${escapeHtml(style.name)} <span>${escapeHtml(style.en)}</span></b><small>${escapeHtml(style.desc)}</small></div>`;
    const column = (phase, role) => Object.values(gameData.playstyles[phase]).filter(style => style.roles.includes(role)).map(styleItem).join("");
    const styles = document.createElement("details"); styles.className = "advanced style-legend";
    styles.innerHTML = `<summary>Bảng lối chơi · mỗi cầu thủ có 1 kiểu tấn công + 1 kiểu phòng ngự</summary>${Object.entries(roles).map(([role, title]) => `<section class="legend-group"><h3>${title}</h3><div class="style-zone"><div><h4>Khi có bóng · tấn công</h4>${column("attack", role)}</div><div><h4>Khi mất bóng · phòng ngự</h4>${column("defense", role)}</div></div></section>`).join("")}`;
    legend.after(styles);
  }
  /** Both squads with every rating; redrawn only when someone comes on or off. */
  function renderRoster(session) {
    const roster = session.api.roster?.();
    if (!roster) return;
    const key = JSON.stringify(Object.values(roster).map(list => list.map(p => [p.name, p.onPitch, p.role, p.injured])));
    if (session.rosterKey === key) return;
    session.rosterKey = key;
    const roles = { GK: "TM", DF: "HV", MF: "TV", FW: "TĐ" }, keys = gameData.stats.keys;
    const cell = v => `<td data-level="${v >= 80 ? "high" : v >= 65 ? "mid" : "low"}">${v}</td>`;
    const table = (t, list) => `<div class="roster-team" data-team="${t}"><h3>Đội ${names[t]}</h3><div class="roster-scroll"><table><thead><tr><th>#</th><th>Cầu thủ</th><th>VT</th><th>OVR</th><th title="Chiều cao">CAO</th><th title="Cân nặng">NẶNG</th>${keys.map(k => `<th title="${gameData.stats.labels[k]}">${gameData.stats.short[k]}</th>`).join("")}<th>Skill</th><th>Lối chơi (tấn công · phòng ngự)</th></tr></thead><tbody>${list.map(p => `<tr class="${p.onPitch ? "" : "is-bench"}"><td>${p.num}</td><td>${escapeHtml(p.name)}${p.onPitch ? "" : " <small>dự bị</small>"}</td><td>${roles[p.role] ?? p.role}</td><td class="ovr">${p.ovr ?? "–"}</td><td>${p.body.height}</td><td>${p.body.weight}</td>${keys.map(k => cell(p.stats[k])).join("")}<td class="styles">${escapeHtml(p.skillName)}${p.penaltySkill ? " · " + escapeHtml(gameData.skills[p.penaltySkill].short) : ""}</td><td class="styles">${escapeHtml(p.attack)} · ${escapeHtml(p.defense)}</td></tr>`).join("")}</tbody></table></div></div>`;
    session.panel.querySelector(".roster-body").innerHTML = Object.entries(roster).map(([t, list]) => table(t, list)).join("");
    session.panel.querySelector(".roster").hidden = false;
  }
  /** Redraws every key hint in a panel from the layouts its players use. */
  function renderPanelKeys(panel) {
    const mode = panel.dataset.mode;
    refreshControls(mode);
    const bindings = bindingsOf(mode);
    for (const guide of panel.querySelectorAll(".pad-help")) if (bindings[guide.dataset.slot]) renderGuide(guide, bindings[guide.dataset.slot]);
    for (const details of panel.querySelectorAll(".advanced")) if (bindings[details.dataset.slot]) renderAdvanced(details, bindings[details.dataset.slot]);
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
  let watcher = document.getElementById("watch-match").__ptscFootball;

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
  function setPaused(session, paused) {
    session.paused = paused;
    if (!paused) session.awaitingStart = false;
    const overlay = session.panel.querySelector(".start-overlay");
    overlay.hidden = !paused;
    overlay.querySelector("span").innerHTML = session.awaitingStart ? 'Nhấn <kbd>Space</kbd> để bắt đầu trận đấu' : 'Nhấn <kbd>Space</kbd> để tiếp tục trận đấu';
    // Kicks and switch repeats stop, but directions still held carry on as soon as play resumes.
    stopSwitchRepeats(); cancelKicks();
    if (paused) session.api.pause(); else session.api.play();
    applyKeys(session); highlightPads();
    session.panel.querySelector(".pause").textContent = session.awaitingStart ? "Bắt đầu" : paused ? "Tiếp tục" : "Tạm dừng";
    updateHud(session);
  }
  function selectTab(mode) {
    releaseKeys();
    watcher?.pause();
    for (const session of sessions.values()) setPaused(session, true);
    activeMode = mode;
    tabs.forEach(tab => {
      const selected = tab.dataset.tab === mode;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.id !== "panel-" + mode; });
    if (mode === "watch" && !document.hidden) watcher?.play();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
    tab.addEventListener("keydown", event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault(); selectTab(tabs[next].dataset.tab); tabs[next].focus();
    });
  });
  document.getElementById("new-watch").addEventListener("click", () => {
    watcher?.destroy();
    watcher = window.PTSCFootball.mount(document.getElementById("watch-match"));
    if (activeMode !== "watch") watcher.pause();
  });
  const watchRestart = document.createElement("button"); watchRestart.type = "button"; watchRestart.className = "arena-restart";
  watchRestart.setAttribute("aria-label", "Xem trận mới"); watchRestart.title = "Xem trận mới";
  watchRestart.innerHTML = '<span aria-hidden="true">↻</span> Trận mới';
  document.querySelector("#panel-watch .arena-surface").append(watchRestart);
  watchRestart.addEventListener("click", () => document.getElementById("new-watch").click());

  const watchPanel = document.getElementById("panel-watch");
  const watchView = { panel: watchPanel, api: null, rosterKey: null };
  function initWatchHud() {
    const energy = document.createElement("div"); energy.className = "arena-energy";
    watchPanel.querySelector(".arena-surface").append(energy);
    const cards = document.createElement("div"); cards.className = "player-status";
    const roster = document.createElement("details"); roster.className = "advanced roster"; roster.open = true; roster.hidden = true;
    roster.innerHTML = '<summary>Đội hình &amp; chỉ số · OVR tính theo vị trí đang đá</summary><div class="roster-body"></div>';
    watchPanel.querySelector(".watch-actions").after(cards, roster);
    buildTeamCards(cards, cardOrder("watch"));
    buildEnergyBoxes(energy, cardOrder("watch"));
  }
  function updateWatchHud() {
    if (activeMode !== "watch" || !watcher?.status) return;
    if (watchView.api !== watcher) { watchView.api = watcher; watchView.rosterKey = null; }
    const state = watcher.status(), ctx = { id: "watch", leftTeam: state.leftTeam, paused: false, ended: state.ended };
    for (const card of watchPanel.querySelector(".player-status").cards ?? []) updateTeamCard(card, state.teams?.[card.dataset.team], ctx);
    for (const box of watchPanel.querySelector(".arena-energy").children) updateEnergyBox(box, state.teams?.[box.dataset.team], ctx);
    renderRoster(watchView);
  }
  function optionsFor(panel) {
    const teamA = panel.querySelector('input[name$="-team"]:checked').value;
    const teamB = opposite(teamA);
    const sideB = panel.querySelector('input[name="local-side"]:checked')?.value ?? "right";
    return { mode: panel.dataset.mode, duration: Number(panel.querySelector(".duration").value), extraTime: panel.querySelector(".extra-time").checked, penalties: panel.querySelector(".penalties").checked,
      support: panel.querySelector(".support").checked, difficulty: panel.querySelector(".difficulty")?.value ?? "normal", teamA, leftTeam: panel.dataset.mode === "local" ? sideB === "left" ? teamB : teamA : "R" };
  }
  function setupSummary(panel) {
    const options = optionsFor(panel), sideA = options.leftTeam === options.teamA ? "trái" : "phải";
    const description = options.mode === "cpu" ? `Bạn: đội ${names[options.teamA]} · Máy: đội ${names[opposite(options.teamA)]} (${gameData.difficulty[options.difficulty]?.name ?? "Thường"})`
      : `A: đội ${names[options.teamA]}, sân ${sideA} · B: đội ${names[opposite(options.teamA)]}, sân ${sideA === "trái" ? "phải" : "trái"}`;
    panel.querySelector(".setup-summary").textContent = description + (sessions.has(options.mode) ? " · Áp dụng khi bắt đầu trận mới." : "");
  }
  const ROLE_NAMES = { GK: "Thủ môn", DF: "Hậu vệ", MF: "Tiền vệ", FW: "Tiền đạo" };
  const levelOf = v => v >= 80 ? "high" : v >= 65 ? "mid" : "low";
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const isHuman = controller => controller === "A" || controller === "B";
  /** Who is on each card: the controlled sides first, then the computer's (or Đỏ then Xanh when watching). */
  function cardOrder(mode, teamA) {
    if (mode === "local") return [{ team: teamA, controller: "A" }, { team: opposite(teamA), controller: "B" }];
    if (mode === "cpu") return [{ team: teamA, controller: "A" }, { team: opposite(teamA), controller: "cpu" }];
    return [{ team: "R", controller: "auto" }, { team: "B", controller: "auto" }];
  }
  const controllerLabel = (controller, team) => controller === "cpu" ? "Máy · " + names[team] : controller === "auto" ? "Đội " + names[team] : "Người " + controller + " · " + names[team];
  /** Big, readable cards: overall rating, name, build, stamina, skill, ten ratings and both playing styles. */
  function buildTeamCards(container, order) {
    container.replaceChildren();
    container.cards = order.map(({ team, controller }) => {
      const card = document.createElement("article");
      card.className = "player-card"; card.dataset.team = team; card.dataset.controller = controller;
      if (isHuman(controller)) card.dataset.slot = controller;
      const stats = gameData.stats.keys.map(k => '<div class="pc-stat" data-stat="' + k + '" title="' + gameData.stats.labels[k] + '"><b>–</b><span>' + gameData.stats.short[k] + '</span><i><i></i></i></div>').join("");
      card.innerHTML = '<div class="pc-head"><div class="pc-ovr"><b data-f="ovr">–</b><small>OVR</small></div>'
        + '<div class="pc-id"><span class="pc-tag" data-f="tag">' + escapeHtml(controllerLabel(controller, team)) + '</span><strong data-f="name">Chuẩn bị</strong><span class="pc-meta" data-f="meta"></span></div>'
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
    const controller = box.dataset.controller, prefix = controller === "cpu" ? "Máy" : controller === "auto" ? names[info.team] : controller;
    writeText(box.querySelector(".energy-name"), prefix + " · " + info.name + (info.ovr ? " · " + info.ovr : ""));
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
    const order = cardOrder(session.options.mode, session.options.teamA);
    buildTeamCards(session.panel.querySelector(".player-status"), order);
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
    renderRoster(session);
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
    const restartChoice = q(".restart-choice"), corner = state.corner, kickoff = state.kickoff, freeKick = state.freeKick;
    restartChoice.hidden = state.ended || !!state.penalty || !(corner?.slot || kickoff?.slot || freeKick?.slot);
    const restartSlot = corner?.slot ?? kickoff?.slot ?? freeKick?.slot;
    for (const guide of q(".arena-hints").querySelectorAll(".pad-help")) guide.hidden = !restartChoice.hidden && guide.dataset.slot === restartSlot;
    if (!restartChoice.hidden) {
      const restart = corner ?? kickoff ?? freeKick, set = bindings[restart.slot];
      restartChoice.dataset.slot = restart.slot;
      const text = state.refBreak ? "Chờ trọng tài quay lại" : `${corner ? "Phạt góc" : freeKick ? "Đá phạt" : "Giao bóng"} · ${restart.name}${restart.ready ? "" : " · đang vào vị trí"}`;
      writeText(restartChoice.querySelector(".restart-label"), text);
      const hints = !set ? "" : corner ? gameData.corners.map((c, i) => `<span>${kbd(set[CORNER_ACTIONS[i]])} ${c.name}</span>`).join("")
        : freeKick ? `<span>Giữ/thả ${kbd(set.pass)} chuyền</span><span>${kbd(set.shoot)} sút</span>` : `<span>${kbd(set.pass)} Chuyền giao bóng</span>`;
      const hintNode = restartChoice.querySelector(".restart-keys");
      if (session.restartHints !== hints) { hintNode.innerHTML = hints; session.restartHints = hints; }
      restartChoice.classList.toggle("is-preparing", !restart.ready || !!state.refBreak);
    }
    const result = q(".arena-result");
    result.hidden = !state.ended;
    if (state.ended) {
      result.querySelector("strong").textContent = state.winner ? `Đội ${names[state.winner]} chiến thắng!` : "Hai đội hòa!";
      result.querySelector("span").textContent = `Đỏ ${state.score.R}–${state.score.B} Xanh${state.penalty ? ` · PEN ${state.penalty.score.R}–${state.penalty.score.B}` : ""}`;
    }
    const status = q(".match-status");
    const pause = q(".pause");
    if (state.ended) {
      const outcome = state.winner ? `Đội ${names[state.winner]} thắng` : "Hai đội hòa";
      status.textContent = state.penalty || state.note?.includes("thiếu người") ? state.note : `Hết giờ · ${outcome} · Đỏ ${state.score.R}–${state.score.B} Xanh`;
      pause.disabled = true;
      session.api.setInput("A"); session.api.setInput("B");
    } else {
      pause.disabled = false;
      const phase = { reset: "Chuẩn bị giao bóng", celebrate: "Bàn thắng!", halftime: "Nghỉ giữa hiệp · đổi sân" }[state.phase];
      status.textContent = session.awaitingStart ? "Nhấn Space để bắt đầu trận đấu" : session.paused ? "Đang tạm dừng" : phase ?? (state.stoppage ? state.note || "Chuẩn bị đưa bóng trở lại" : `${state.extraTime ? "Hiệp phụ · " : ""}${state.minute}' · Đỏ ${state.score.R}–${state.score.B} Xanh`);
    }
    const ctx = { id: session.options.mode, leftTeam: state.leftTeam, paused: session.paused && !session.awaitingStart, ended: state.ended, keyFor: c => bindings[c] ? label(bindings[c].special) : "" };
    const cards = q(".player-status").cards ?? [];
    for (const card of cards) updateTeamCard(card, state.teams?.[card.dataset.team], ctx);
    for (const box of q(".arena-energy").children) updateEnergyBox(box, state.teams?.[box.dataset.team], ctx);
    for (const player of state.players) {
      const switchButton = q('.switch-action[data-slot="' + player.slot + '"]');
      if (switchButton) switchButton.disabled = false;
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
      writeText(card.querySelector(".charge-text"), player.charge ? (player.charge.action === "pass" ? "Lực chuyền" : "Lực sút") + ": " + Math.round(player.charge.power * 100) + "%" : player.pressing ? "Đang bám người · giữ phím áp sát" : "Giữ phím chuyền/sút để nạp lực");
    }
  }
  for (const arena of document.querySelectorAll(".arena")) {
    const fullscreen = arena.querySelector(".fullscreen");
    function syncFullscreenButton() {
      const expanded = document.fullscreenElement === arena || arena.classList.contains("fullscreen-fallback");
      fullscreen.classList.toggle("is-expanded", expanded);
      fullscreen.setAttribute("aria-label", expanded ? "Thu nhỏ" : "Toàn màn hình");
      fullscreen.setAttribute("title", expanded ? "Thu nhỏ" : "Toàn màn hình");
      fullscreen.setAttribute("aria-pressed", String(expanded));
    }
    async function toggleFullscreen() {
      cancelKicks();
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (arena.classList.contains("fullscreen-fallback")) { arena.classList.remove("fullscreen-fallback"); document.body.classList.remove("has-fullscreen"); }
      else if (arena.requestFullscreen) {
        try { await arena.requestFullscreen(); } catch { arena.classList.add("fullscreen-fallback"); document.body.classList.add("has-fullscreen"); }
      } else { arena.classList.add("fullscreen-fallback"); document.body.classList.add("has-fullscreen"); }
      syncFullscreenButton();
      arena.focus({ preventScroll: true });
      applyKeys();
    }
    fullscreen.addEventListener("click", toggleFullscreen);
    arena.addEventListener("keydown", event => {
      if (event.code === "Escape" && arena.classList.contains("fullscreen-fallback")) { event.preventDefault(); event.stopPropagation(); toggleFullscreen(); }
    });
    document.addEventListener("fullscreenchange", () => {
      syncFullscreenButton();
      cancelKicks();
      if (arena.closest('[role="tabpanel"]').id === "panel-" + activeMode) arena.focus({ preventScroll: true });
      applyKeys();
    });
  }

  /* ------------------------------ key layouts ------------------------------ */
  let capture = null;
  function setupKeymap(panel) {
    const mode = panel.dataset.mode, slots = mode === "local" ? ["A", "B"] : ["A"];
    const form = panel.querySelector("form");
    const assign = document.createElement("fieldset"); assign.className = "keymap-assign";
    assign.innerHTML = `<legend>Bố trí phím</legend><div class="keymap-assign-row">${slots.map(slot => `<label>${mode === "cpu" ? "Bạn" : "Người " + slot} <select data-slot="${slot}" aria-label="Bố trí phím người ${slot}"></select></label>`).join("")}<button type="button" class="link-button keymap-open">Tùy chỉnh phím…</button></div>`;
    form.insertBefore(assign, form.querySelector(".setup-summary"));
    const editor = document.createElement("details"); editor.className = "keymap";
    editor.innerHTML = `<summary>Tùy chỉnh phím · lưu trong trình duyệt này</summary>
      <div class="keymap-head"><label>Layout đang sửa <select class="keymap-edit" aria-label="Chọn layout để sửa"></select></label><label>Tên <input class="keymap-name" maxlength="40" autocomplete="off"></label></div>
      <p class="keymap-help">Bấm vào ô phím rồi nhấn phím mới. <kbd>Esc</kbd> để hủy. Không dùng được Space, Esc, Tab, Ctrl/Alt và F1–F12. Trùng phím trong layout sẽ được hoán đổi.</p>
      <div class="keymap-grid">${keymap.ACTIONS.map(action => `<div class="keymap-row"><span>${keymap.LABELS[action]}</span><button type="button" class="keymap-key" data-action="${action}"></button></div>`).join("")}</div>
      <p class="keymap-status" role="status"></p>
      <div class="keymap-actions"><button type="button" class="secondary keymap-save">Ghi đè layout</button><button type="button" class="secondary keymap-save-new">Lưu thành layout mới</button>${slots.map(slot => `<button type="button" class="secondary keymap-use" data-slot="${slot}">Dùng cho ${mode === "cpu" ? "bạn" : "người " + slot}</button>`).join("")}<button type="button" class="secondary keymap-restore">Khôi phục gốc</button><button type="button" class="secondary keymap-delete">Xóa layout</button></div>`;
    panel.querySelector(".controls").after(editor);
    const editSelect = editor.querySelector(".keymap-edit"), nameInput = editor.querySelector(".keymap-name"), status = editor.querySelector(".keymap-status");
    let editingId = keymap.assigned(mode, "A").id, draft = null, dirty = false;
    const say = (message, tone = "") => { status.textContent = message; status.dataset.tone = tone; };
    function loadDraft(id) {
      const layout = keymap.get(id) ?? keymap.assigned(mode, "A");
      editingId = layout.id; draft = { ...layout.keys }; dirty = false; nameInput.value = layout.name;
    }
    function fillSelect(select, value) {
      const options = keymap.list().map(layout => { const option = new Option(layout.name + (layout.builtIn && !keymap.isOriginal(layout.id) ? " (đã sửa)" : ""), layout.id); return option; });
      select.replaceChildren(...options); select.value = value;
    }
    function render() {
      for (const select of assign.querySelectorAll("select")) fillSelect(select, keymap.assigned(mode, select.dataset.slot).id);
      if (!keymap.get(editingId)) loadDraft(keymap.assigned(mode, "A").id);
      fillSelect(editSelect, editingId);
      for (const button of editor.querySelectorAll(".keymap-key")) {
        const listening = capture?.button === button;
        button.classList.toggle("is-listening", listening);
        button.innerHTML = listening ? "Nhấn phím…" : kbd(draft[button.dataset.action]);
      }
      const layout = keymap.get(editingId);
      editor.querySelector(".keymap-delete").hidden = layout.builtIn;
      editor.querySelector(".keymap-restore").hidden = !layout.builtIn;
      editor.querySelector(".keymap-restore").disabled = keymap.isOriginal(editingId) && !dirty;
      editor.querySelector(".keymap-save").textContent = dirty ? "Ghi đè layout *" : "Ghi đè layout";
      for (const use of editor.querySelectorAll(".keymap-use")) use.classList.toggle("is-current", keymap.assigned(mode, use.dataset.slot).id === editingId);
    }
    loadDraft(editingId);
    panel.keymapRender = render;
    assign.querySelector(".keymap-open").addEventListener("click", () => { editor.open = true; editor.scrollIntoView({ behavior: "smooth", block: "start" }); });
    for (const select of assign.querySelectorAll("select")) select.addEventListener("change", () => {
      const result = keymap.assign(mode, select.dataset.slot, select.value);
      if (!result.ok) {
        select.value = keymap.assigned(mode, select.dataset.slot).id;
        say(`Không dùng được: trùng phím ${result.clash.map(label).join(", ")} với người còn lại. Hãy sửa một layout trước.`, "error");
        editor.open = true;
      } else say(`Người ${select.dataset.slot} dùng “${keymap.get(select.value).name}”.${result.stored ? "" : " Trình duyệt không cho lưu; chỉ áp dụng trong lần mở này."}`);
    });
    editSelect.addEventListener("change", () => {
      if (dirty && !confirm("Bỏ các thay đổi chưa lưu của layout đang sửa?")) { editSelect.value = editingId; return; }
      loadDraft(editSelect.value); say(""); render();
    });
    nameInput.addEventListener("input", () => { dirty = true; render(); });
    for (const button of editor.querySelectorAll(".keymap-key")) button.addEventListener("click", () => {
      capture = capture?.button === button ? null : { button, assign: code => {
        const action = button.dataset.action, previous = draft[action];
        const other = keymap.ACTIONS.find(a => a !== action && draft[a] === code);
        draft[action] = code;
        if (other) draft[other] = previous;
        dirty = true;
        say(other ? `Đã hoán đổi: ${keymap.LABELS[action]} = ${label(code)}, ${keymap.LABELS[other]} = ${label(previous)}.` : `${keymap.LABELS[action]} = ${label(code)}. Nhớ bấm “Ghi đè layout” để lưu.`);
      } };
      render();
    });
    function store(id) {
      const result = keymap.save(id, nameInput.value, draft);
      if (!result.ok) {
        say(result.error === "clash" ? `Chưa lưu: layout này đang dùng cho chế độ hai người và sẽ trùng phím ${result.clash.map(label).join(", ")} với người còn lại.` : "Chưa lưu: layout không hợp lệ.", "error");
        return;
      }
      editingId = result.id; dirty = false; render();
      say(`${id ? "Đã ghi đè" : "Đã lưu mới"} “${keymap.get(result.id).name}”.${result.stored ? " Lưu trong trình duyệt này." : " Trình duyệt không cho lưu; chỉ áp dụng trong lần mở này."}`, "ok");
    }
    editor.querySelector(".keymap-save").addEventListener("click", () => store(editingId));
    editor.querySelector(".keymap-save-new").addEventListener("click", () => {
      const base = nameInput.value.trim() || "Layout của tôi";
      if (keymap.list().some(layout => layout.name === base)) nameInput.value = `${base} (${keymap.list().length})`;
      store(null);
    });
    for (const use of editor.querySelectorAll(".keymap-use")) use.addEventListener("click", () => {
      if (dirty) store(editingId);
      if (dirty) return;
      const result = keymap.assign(mode, use.dataset.slot, editingId);
      say(result.ok ? `Người ${use.dataset.slot} dùng “${keymap.get(editingId).name}”.` : `Không dùng được: trùng phím ${result.clash.map(label).join(", ")} với người còn lại.`, result.ok ? "ok" : "error");
    });
    editor.querySelector(".keymap-restore").addEventListener("click", () => {
      const result = keymap.restore(editingId);
      if (result.ok) { loadDraft(editingId); say("Đã khôi phục phím gốc.", "ok"); render(); }
      else say(`Chưa khôi phục: trùng phím ${result.clash?.map(label).join(", ")} với người còn lại.`, "error");
    });
    editor.querySelector(".keymap-delete").addEventListener("click", () => {
      const layout = keymap.get(editingId);
      if (!layout || layout.builtIn || !confirm(`Xóa layout “${layout.name}”?`)) return;
      keymap.remove(editingId); loadDraft(keymap.assigned(mode, "A").id); say(`Đã xóa “${layout.name}”.`, "ok"); render();
    });
    render();
  }
  // While a key cell is listening, the next key press is the new binding and nothing else sees it.
  window.addEventListener("keydown", event => {
    if (!capture) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const pending = capture;
    if (event.code === "Escape") { capture = null; for (const panel of document.querySelectorAll(".game-panel")) panel.keymapRender?.(); return; }
    if (keymap.reserved(event.code)) {
      pending.button.closest(".keymap").querySelector(".keymap-status").textContent = `Phím ${event.key === " " ? "Space" : event.code || event.key} được dành cho trình duyệt/tạm dừng, hãy chọn phím khác.`;
      return;
    }
    capture = null; pending.assign(event.code);
    for (const panel of document.querySelectorAll(".game-panel")) panel.keymapRender?.();
    pending.button.focus();
  }, true);
  document.addEventListener("pointerdown", event => {
    if (capture && !event.target.closest(".keymap-key")) { capture = null; for (const panel of document.querySelectorAll(".game-panel")) panel.keymapRender?.(); }
  });
  keymap.onChange(() => {
    releaseKeys();
    for (const panel of document.querySelectorAll(".game-panel")) { renderPanelKeys(panel); panel.keymapRender?.(); }
  });
  window.addEventListener("storage", event => { if (event.key === null || event.key?.startsWith("ptsc-football.key-layouts")) keymap.reload(); });

  for (const panel of document.querySelectorAll(".game-panel")) {
    const form = panel.querySelector("form");
    const arena = panel.querySelector(".arena");
    const matchOptions = document.createElement("fieldset"); matchOptions.className = "match-options";
    const difficulty = panel.dataset.mode === "cpu" ? '<label>Độ khó máy <select class="difficulty" aria-label="Độ khó của máy">' + Object.entries(gameData.difficulty).map(([id, d]) => '<option value="' + id + '"' + (id === "normal" ? " selected" : "") + ">" + d.name + "</option>").join("") + "</select></label>" : "";
    matchOptions.innerHTML = '<legend>Thời gian &amp; phân thắng thua</legend>' + difficulty + '<label>Thời lượng <select class="duration" aria-label="Thời lượng trận đấu"><option value="2">2 phút</option><option value="4">4 phút</option><option value="6">6 phút</option><option value="10">10 phút</option></select></label><label><input type="checkbox" class="extra-time">Hiệp phụ nếu hòa</label><label><input type="checkbox" class="penalties">Luân lưu nếu vẫn hòa</label>';
    form.insertBefore(matchOptions, form.querySelector(".setup-summary"));
    const levelSelect = matchOptions.querySelector(".difficulty");
    if (levelSelect) {
      try { const saved = localStorage.getItem("ptsc-football.difficulty"); if (saved && saved in gameData.difficulty) levelSelect.value = saved; } catch {}
      levelSelect.addEventListener("change", () => { try { localStorage.setItem("ptsc-football.difficulty", levelSelect.value); } catch {} });
    }
    const overlay = document.createElement("div"); overlay.className = "start-overlay"; overlay.hidden = true;
    overlay.innerHTML = '<span>Nhấn <kbd>Space</kbd> để bắt đầu trận đấu</span>';
    arena.querySelector(".arena-surface").append(overlay);
    const penaltyHost = document.createElement("div"); penaltyHost.className = "penalty-host"; penaltyHost.hidden = true;
    arena.querySelector(".arena-surface").append(penaltyHost);
    const restartChoice = document.createElement("div"); restartChoice.className = "restart-choice"; restartChoice.hidden = true;
    restartChoice.innerHTML = '<span class="restart-label"></span><div class="restart-keys"></div>';
    arena.querySelector(".arena-surface").append(restartChoice);
    const energy = document.createElement("div"); energy.className = "arena-energy"; energy.hidden = true;
    energy.innerHTML = "";
    arena.querySelector(".arena-surface").append(energy);
    const result = document.createElement("div"); result.className = "arena-result"; result.hidden = true;
    result.innerHTML = '<strong></strong><span></span>';
    arena.querySelector(".arena-surface").append(result);
    const restart = document.createElement("button"); restart.type = "button"; restart.className = "arena-restart";
    restart.setAttribute("aria-label", "Bắt đầu trận mới"); restart.title = "Bắt đầu trận mới";
    restart.innerHTML = '<span aria-hidden="true">↻</span> Trận mới';
    arena.querySelector(".arena-surface").append(restart);
    restart.addEventListener("click", () => form.requestSubmit());
    setupKeymap(panel);
    renderPanelKeys(panel);
    renderSkillLegend(panel);
    const roster = document.createElement("details"); roster.className = "advanced roster"; roster.open = true; roster.hidden = true;
    roster.innerHTML = '<summary>Đội hình &amp; chỉ số · OVR tính theo vị trí đang đá</summary><div class="roster-body"></div>';
    panel.querySelector(".player-status").after(roster);
    form.addEventListener("change", event => { if (!event.target.closest(".keymap-assign")) setupSummary(panel); });
    setupSummary(panel);
    panel.querySelector(".support").addEventListener("change", event => {
      const session = sessions.get(panel.dataset.mode);
      session?.api.setSupport(event.target.checked);
      if (session && !session.paused) arena.focus({ preventScroll: true });
    });
    // Guides are redrawn when layouts change, so their buttons are handled by delegation.
    panel.querySelector(".controls").addEventListener("click", event => {
      const button = event.target.closest(".slide-action, .switch-action");
      const session = sessions.get(panel.dataset.mode);
      if (!button || !session) return;
      if (button.classList.contains("switch-action")) session.api.action(button.dataset.slot, "switch");
      else if (!session.paused) {
        const player = session.api.status().players.find(p => p.slot === button.dataset.slot);
        session.api.action(button.dataset.slot, player?.hasBall ? "shoot" : "slide");
      }
      arena.focus({ preventScroll: true }); updateHud(session);
    });
    form.addEventListener("submit", event => {
      event.preventDefault(); releaseKeys();
      const mode = panel.dataset.mode;
      sessions.get(mode)?.api.destroy();
      const options = optionsFor(panel);
      const host = panel.querySelector(".match-host"); host.replaceChildren();
      const api = window.PTSCFootball.mount(host, options);
      api.pause();
      const penaltyKeys = slot => {
        const set = bindingsOf(mode)[slot] ?? {};
        return { left: label(set.left), center: label(set.down), right: label(set.right), special: label(set.special) };
      };
      const session = { panel, arena, api, options, paused: true, awaitingStart: true,
        penaltyView: new window.PTSCPenaltyView(penaltyHost, api, { keys: penaltyKeys }) };
      sessions.set(mode, session);
      energy.hidden = false;
      form.querySelector(".start").textContent = "Bắt đầu trận mới";
      panel.querySelector(".pause").textContent = "Bắt đầu";
      overlay.hidden = false;
      overlay.querySelector("span").innerHTML = 'Nhấn <kbd>Space</kbd> để bắt đầu trận đấu';
      playerCards(session); updateHud(session); setupSummary(panel);
      arena.focus({ preventScroll: true });
    });
    panel.querySelector(".pause").addEventListener("click", () => {
      const session = sessions.get(panel.dataset.mode);
      if (!session || session.api.status().ended) return;
      setPaused(session, !session.paused);
      if (!session.paused) arena.focus({ preventScroll: true });
    });
    arena.addEventListener("pointerdown", () => { if (sessions.has(panel.dataset.mode)) arena.focus({ preventScroll: true }); });
    // Leaving the pitch for another control stops movement; keys are still tracked until they are released.
    arena.addEventListener("focusout", event => { if (!arena.contains(event.relatedTarget)) { stopSwitchRepeats(); cancelKicks(); applyKeys(); } });
    arena.addEventListener("focusin", () => applyKeys());
  }
  window.addEventListener("keydown", event => {
    const session = sessions.get(activeMode);
    if (!session || !session.arena.contains(document.activeElement)) return;
    const mode = session.options.mode, bound = lookup(mode, event.code);
    if (!bound && event.code !== "Space" && event.code !== "Escape") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Escape" && document.fullscreenElement) { releaseKeys(); return; }
    if (event.code !== "Escape" && document.activeElement.matches("button, input, select, textarea")) return;
    event.preventDefault();
    if (event.code === "Space" || event.code === "Escape") {
      if (event.code === "Escape" && session.arena.classList.contains("fullscreen-fallback")) {
        session.panel.querySelector(".fullscreen").click(); return;
      }
      if (!event.repeat && !session.api.status().ended) setPaused(session, event.code === "Escape" ? true : !session.paused);
      return;
    }
    const { slot, action } = bound, state = session.api.status();
    if (state.phase === "penalties" && PENALTY_ACTIONS[action]) {
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
        if (act === "shoot" && pending?.session === session) {
          clearTimeout(pending.timer); pendingShots.delete(slot);
          session.api.releaseCharge(slot, { special: true, power: Math.max(.55, pending.power) });
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
    if (action === "shoot" && elapsed < 220) {
      session.api.freezeCharge(slot);
      const pending = { session, power: charge.power, timer: null };
      pending.timer = setTimeout(() => {
        if (pendingShots.get(slot) !== pending) return;
        pendingShots.delete(slot);
        if (!session.paused && sessions.get(activeMode) === session) session.api.releaseCharge(slot);
        else session.api.cancelCharge(slot);
      }, 230);
      pendingShots.set(slot, pending);
    } else session.api.releaseCharge(slot);
  }, true);
  function suspend() {
    releaseKeys(); watcher?.pause();
    for (const session of sessions.values()) setPaused(session, true);
  }
  window.addEventListener("blur", suspend);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("focus", () => { if (activeMode === "watch" && !document.hidden) watcher?.play(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else if (activeMode === "watch") watcher?.play();
  });
  initWatchHud();
  setInterval(() => { const session = sessions.get(activeMode); if (session) updateHud(session); else updateWatchHud(); highlightPads(); }, 250);
})();
