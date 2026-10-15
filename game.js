(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[role=tab]")];
  const panels = [...document.querySelectorAll("[role=tabpanel]")];
  const sessions = new Map();
  const keys = new Set();
  const switchRepeats = new Map();
  const names = { R: "Đỏ", B: "Xanh" };
  const opposite = team => team === "R" ? "B" : "R";
  const bindings = {
    A: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", sprint: "KeyT", press: "KeyV", actions: { KeyR: "switch", KeyF: "pass", KeyG: "shoot", KeyB: "challenge", KeyE: "special" } },
    B: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", sprint: "KeyI", press: "KeyN", actions: { KeyU: "switch", KeyJ: "pass", KeyK: "shoot", KeyM: "challenge", KeyO: "special" } }
  };
  const gameData = window.PTSCFootball.data;
  const defaultSkillIcon = gameData.skills.freeKick.icon;
  function skillBadge(kind, icon, id) {
    const role = gameData.skills[kind]?.role ?? "MF", color = gameData.skillRules.colors[role];
    return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#123a62"/></radialGradient></defs><circle cx="12" cy="12" r="11.2" fill="#16456b" stroke="#2b92da" stroke-width="1.4"/><circle cx="12" cy="12" r="9.2" fill="url(#${id})" stroke="#8dd1fb" stroke-width="1"/><path d="M5 7Q12 1 19 7" fill="none" stroke="#d2f0ff" stroke-width="1" opacity=".7"/><path d="M3 16Q12 23 21 16" fill="none" stroke="#4bbcf5" stroke-width="1.3"/><g transform="translate(4,4) scale(.66)" fill="none" stroke="${role === "DF" ? "#acffbd" : role === "GK" ? "#ffe3d4" : "#fff1b0"}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${icon || defaultSkillIcon}</g>`;
  }
  for (const guide of document.querySelectorAll(".pad-help")) {
    const slot = guide.dataset.slot, b = bindings[slot];
    const labels = slot === "A" ? { up: "W", left: "A", down: "S", right: "D" } : { up: "↑", left: "←", down: "↓", right: "→" };
    const actionKeys = slot === "A" ? ["R", "T", "F", "G", "V", "B"] : ["U", "I", "J", "K", "N", "M"];
    const actions = ["Đổi người", "Chạy nhanh", "Chuyền", "Sút / xoạc", "Áp sát", "Tranh bóng"];
    const gestures = ["Bấm", "Giữ", "Giữ → thả", "Giữ → thả / bấm", "Giữ", "Bấm"];
    guide.innerHTML = `<div class="movement-help"><strong>NGƯỜI ${slot}</strong><div class="pad-diagram"><img src="assets/control-pad.svg" alt="Pad di chuyển của người ${slot}" width="343" height="343"><span class="pad-player">${slot}</span>${Object.entries(labels).map(([direction, label]) => `<span class="pad-key pad-${direction}" data-code="${b[direction]}">${label}</span>`).join("")}</div></div><div class="action-grid">${actionKeys.map((key, i) => {
      const clickable = (i === 0 || i === 3) && !!guide.closest(".controls"), tag = clickable ? "button" : "div";
      return `<${tag} class="action-key${clickable ? i === 0 ? " switch-action" : " slide-action" : ""}" data-code="Key${key}" data-action="${["switch", "sprint", "pass", "shoot", "press", "challenge"][i]}"${clickable ? ` type="button" data-slot="${slot}" disabled` : ""}><kbd>${key}</kbd><span><span class="action-label">${actions[i]}</span><small>${gestures[i]}</small></span></${tag}>`;
    }).join("")}</div>`;
  }
  const handledKeys = new Set(["Space", "Escape", ...Object.values(bindings).flatMap(b => [b.up, b.down, b.left, b.right, b.sprint, b.press, ...Object.keys(b.actions)])]);
  const padKeys = [...document.querySelectorAll(".pad-key, .action-key")];
  const writeText = (node, value) => { const text = String(value); if (node.textContent !== text) node.textContent = text; };
  const pendingShots = new Map(), chargeStarts = new Map();
  let activeMode = "watch";
  let watcher = document.getElementById("watch-match").__ptscFootball;

  function applyKeys(session = sessions.get(activeMode)) {
    if (!session) return;
    const state = session.api.status();
    const arena = session.panel.querySelector(".arena");
    const acceptsInput = !session.paused && !state.ended && session === sessions.get(activeMode) && document.activeElement === arena;
    for (const [slot, b] of Object.entries(bindings)) {
      session.api.setInput(slot, !acceptsInput ? {} : {
        x: Number(keys.has(b.right)) - Number(keys.has(b.left)),
        y: Number(keys.has(b.down)) - Number(keys.has(b.up)), sprint: keys.has(b.sprint),
        pressing: keys.has(b.press) && !state.players.find(p => p.slot === slot)?.hasBall
      });
    }
  }
  function releaseKeys() {
    keys.clear();
    for (const repeat of switchRepeats.values()) clearTimeout(repeat.timer);
    switchRepeats.clear();
    highlightPads();
    for (const pending of pendingShots.values()) clearTimeout(pending.timer);
    pendingShots.clear(); chargeStarts.clear();
    for (const session of sessions.values()) {
      session.api.setInput("A"); session.api.setInput("B");
      session.api.cancelCharge("A"); session.api.cancelCharge("B");
    }
  }
  function highlightPads() {
    for (const key of padKeys) key.classList.toggle("is-held", keys.has(key.dataset.code));
  }
  function repeatSwitch(session, code, slot) {
    const previous = switchRepeats.get(code);
    if (previous) clearTimeout(previous.timer);
    const repeat = { timer: null };
    switchRepeats.set(code, repeat);
    const advance = () => {
      const arena = session.panel.querySelector(".arena");
      if (switchRepeats.get(code) !== repeat) return;
      if (!keys.has(code) || sessions.get(activeMode) !== session || !arena.contains(document.activeElement) || session.api.status().ended) {
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
    releaseKeys();
    if (paused) session.api.pause(); else session.api.play();
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

  function optionsFor(panel) {
    const teamA = panel.querySelector('input[name$="-team"]:checked').value;
    const teamB = opposite(teamA);
    const sideB = panel.querySelector('input[name="local-side"]:checked')?.value ?? "right";
    return { mode: panel.dataset.mode, duration: Number(panel.querySelector(".duration").value), extraTime: panel.querySelector(".extra-time").checked, penalties: panel.querySelector(".penalties").checked,
      support: panel.querySelector(".support").checked, teamA, leftTeam: panel.dataset.mode === "local" ? sideB === "left" ? teamB : teamA : "R" };
  }
  function setupSummary(panel) {
    const options = optionsFor(panel), sideA = options.leftTeam === options.teamA ? "trái" : "phải";
    const description = options.mode === "cpu" ? `Bạn: đội ${names[options.teamA]} · Máy: đội ${names[opposite(options.teamA)]}`
      : `A: đội ${names[options.teamA]}, sân ${sideA} · B: đội ${names[opposite(options.teamA)]}, sân ${sideA === "trái" ? "phải" : "trái"}`;
    panel.querySelector(".setup-summary").textContent = description + (sessions.has(options.mode) ? " · Áp dụng khi bắt đầu trận mới." : "");
  }
  function playerCards(session) {
    const cards = session.panel.querySelector(".player-status");
    cards.replaceChildren();
    const players = [{ slot: "A", team: session.options.teamA }];
    if (session.options.mode === "local") players.push({ slot: "B", team: opposite(session.options.teamA) });
    for (const player of players) {
      const card = document.createElement("article");
      card.className = "player-card"; card.dataset.slot = player.slot; card.dataset.team = player.team;
      const title = document.createElement("strong");
      const label = document.createElement("div"); label.className = "energy-label";
      const energyLabel = document.createElement("span"); energyLabel.textContent = "Thể lực";
      const percent = document.createElement("span"); percent.className = "percent";
      const meter = document.createElement("meter"); meter.min = 0; meter.max = 1; meter.low = .35; meter.high = .6; meter.optimum = 1;
      meter.setAttribute("aria-label", `Thể lực người ${player.slot}`);
      const power = document.createElement("div"); power.className = "charge-hud";
      power.innerHTML = '<span class="charge-text">Giữ phím chuyền/sút để nạp lực</span><progress max="1" value="0" aria-label="Lực chuyền hoặc sút"></progress>';
      label.append(energyLabel, percent); card.append(title, label, meter, power); cards.append(card);
    }
  }
  function updateHud(session) {
    session.hudNodes ??= new Map();
    const q = selector => {
      if (!session.hudNodes.has(selector)) session.hudNodes.set(selector, session.panel.querySelector(selector));
      return session.hudNodes.get(selector);
    };
    const state = session.api.status();
    if (!!state.refBreak !== !!session.refStopped) {
      session.refStopped = !!state.refBreak;
      // A referee stoppage cancels kicks but preserves held movement keys.
      for (const [slot, pending] of pendingShots) if (pending.session === session) {
        clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot);
      }
      chargeStarts.clear(); session.api.cancelCharge("A"); session.api.cancelCharge("B");
    }
    if (session === sessions.get(activeMode)) applyKeys(session);
    session.penaltyView.update(state, session.paused);
    q(".arena-hints").hidden = !!state.penalty || state.ended;
    const restartChoice = q(".restart-choice"), corner = state.corner, kickoff = state.kickoff, freeKick = state.freeKick;
    restartChoice.hidden = state.ended || !(corner?.slot || kickoff?.slot || freeKick?.slot);
    if (!restartChoice.hidden) {
      const restart = corner ?? kickoff ?? freeKick;
      restartChoice.querySelector(".restart-label").textContent = state.refBreak ? "Chờ trọng tài quay lại" : corner ? `Phạt góc · ${restart.slot} · ${restart.name}${restart.ready ? " · chọn kiểu đá" : " · đang vào vị trí"}` : freeKick ? `Đá phạt · ${restart.slot} · ${restart.name} · ${restart.ready ? `giữ rồi thả ${restart.slot === "A" ? "F/G" : "J/K"}` : "đang vào vị trí"}` : `${restart.slot} · ${restart.name} · ${restart.ready ? `nhấn ${restart.slot === "A" ? "F" : "J"} để giao bóng` : "đang vào vị trí"}`;
      for (const button of restartChoice.querySelectorAll(".corner-kind")) { button.hidden = !corner; button.disabled = session.paused || !restart.ready; }
      const passButton = restartChoice.querySelector(".kickoff-pass");
      passButton.hidden = !kickoff; passButton.disabled = session.paused || !restart.ready;
      passButton.textContent = `${restart.slot === "A" ? "F" : "J"} · Chuyền giao bóng`;
      for (const button of restartChoice.querySelectorAll(".free-kick-action")) {
        button.hidden = !freeKick; button.disabled = session.paused || !restart.ready;
      }
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
      const result = state.winner ? `Đội ${names[state.winner]} thắng` : "Hai đội hòa";
      status.textContent = state.penalty || state.note?.includes("thiếu người") ? state.note : `Hết giờ · ${result} · Đỏ ${state.score.R}–${state.score.B} Xanh`;
      pause.disabled = true;
      session.api.setInput("A"); session.api.setInput("B");
    } else {
      pause.disabled = false;
      const phase = { reset: "Chuẩn bị giao bóng", celebrate: "Bàn thắng!", halftime: "Nghỉ giữa hiệp · đổi sân" }[state.phase];
      status.textContent = session.awaitingStart ? "Nhấn Space để bắt đầu trận đấu" : session.paused ? "Đang tạm dừng" : phase ?? (state.stoppage ? state.note || "Chuẩn bị đưa bóng trở lại" : `${state.extraTime ? "Hiệp phụ · " : ""}${state.minute}' · Đỏ ${state.score.R}–${state.score.B} Xanh`);
    }
    for (const player of state.players) {
      q(`.switch-action[data-slot="${player.slot}"]`).disabled = false;
      const onField = q(`.arena-energy [data-slot="${player.slot}"]`);
      const percent = Math.round(player.energy * 100);
      onField.dataset.team = player.team; onField.classList.toggle("is-low", player.energy < .35);
      writeText(onField.querySelector(".energy-name"), `${player.slot} · ${player.name || "Chuẩn bị"}`);
      writeText(onField.querySelector("strong"), percent + "%");
      onField.querySelector("progress").value = player.energy;
      const skillButton = onField.querySelector(".special-button"), skill = player.special;
      if (skillButton.dataset.kind !== skill.kind) {
        skillButton.dataset.kind = skill.kind ?? "";
        skillButton.querySelector("svg").innerHTML = skillBadge(skill.kind, skill.icon, `skill-${session.options.mode}-${player.slot}`);
      }
      const skillState = skill.active ? `${Math.ceil(skill.remaining)}s` : skill.primed ? "Đã chuẩn bị" : skill.used ? "Đã dùng" : player.energy < gameData.skillRules.cost ? "Thiếu lực" : skill.defenseOnly && !skill.defending ? "Chỉ phòng thủ" : skill.ready ? "Sẵn sàng" : "Chờ";
      writeText(skillButton.querySelector(".skill-state"), skillState);
      skillButton.classList.toggle("is-active", skill.active);
      skillButton.classList.toggle("is-used", skill.used && !skill.active);
      skillButton.disabled = (session.paused && !session.awaitingStart) || state.ended || !skill.ready;
      skillButton.title = `${skill.name} · ${skillState} · ${Math.round(gameData.skillRules.cost * 100)}% thể lực · ${gameData.skillRules.usesPerMatch} lần/cầu thủ/trận`;
      skillButton.setAttribute("aria-label", `${player.slot}: ${skillButton.title}`);
      const slideButton = q(`.slide-action[data-slot="${player.slot}"]`);
      if (slideButton) {
        slideButton.disabled = session.paused || state.ended || !player.ready || (!player.hasBall && !player.slideReady);
        writeText(slideButton.querySelector(".action-label"), player.hasBall ? "Sút" : "Xoạc");
      }
      const card = q(`.player-card[data-slot="${player.slot}"]`);
      if (!card) continue;
      const side = state.leftTeam === player.team ? "trái" : "phải";
      writeText(card.querySelector("strong"), `${player.slot} · ${names[player.team]} · ${player.name || "Chuẩn bị"}${player.number ? " #" + player.number : ""} · sân ${side}${player.hasBall ? " · có bóng" : ""}`);
      card.querySelector("meter").value = player.energy;
      writeText(card.querySelector(".percent"), percent + "%");
      card.querySelector("progress").value = player.charge?.power ?? 0;
      card.querySelector(".charge-text").textContent = player.charge ? `${player.charge.action === "pass" ? "Lực chuyền" : "Lực sút"}: ${Math.round(player.charge.power * 100)}%` : player.pressing ? "Đang pressing · áp sát" : "Giữ phím chuyền/sút để nạp lực";
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
      releaseKeys();
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (arena.classList.contains("fullscreen-fallback")) { arena.classList.remove("fullscreen-fallback"); document.body.classList.remove("has-fullscreen"); }
      else if (arena.requestFullscreen) {
        try { await arena.requestFullscreen(); } catch { arena.classList.add("fullscreen-fallback"); document.body.classList.add("has-fullscreen"); }
      } else { arena.classList.add("fullscreen-fallback"); document.body.classList.add("has-fullscreen"); }
      syncFullscreenButton();
      arena.focus({ preventScroll: true });
    }
    fullscreen.addEventListener("click", toggleFullscreen);
    arena.addEventListener("keydown", event => {
      if (event.code === "Escape" && arena.classList.contains("fullscreen-fallback")) { event.preventDefault(); event.stopPropagation(); toggleFullscreen(); }
    });
    document.addEventListener("fullscreenchange", () => {
      syncFullscreenButton();
      releaseKeys();
      if (arena.closest('[role="tabpanel"]').id === "panel-" + activeMode) arena.focus({ preventScroll: true });
    });
  }
  for (const panel of document.querySelectorAll(".game-panel")) {
    const form = panel.querySelector("form");
    const arena = panel.querySelector(".arena");
    const matchOptions = document.createElement("fieldset"); matchOptions.className = "match-options";
    matchOptions.innerHTML = '<legend>Thời gian &amp; phân thắng thua</legend><label>Thời lượng <select class="duration" aria-label="Thời lượng trận đấu"><option value="2">2 phút</option><option value="4">4 phút</option><option value="6">6 phút</option><option value="10">10 phút</option></select></label><label><input type="checkbox" class="extra-time">Hiệp phụ nếu hòa</label><label><input type="checkbox" class="penalties">Luân lưu nếu vẫn hòa</label>';
    form.insertBefore(matchOptions, form.querySelector(".setup-summary"));
    const overlay = document.createElement("div"); overlay.className = "start-overlay"; overlay.hidden = true;
    overlay.innerHTML = '<span>Nhấn <kbd>Space</kbd> để bắt đầu trận đấu</span>';
    arena.querySelector(".arena-surface").append(overlay);
    const penaltyHost = document.createElement("div"); penaltyHost.className = "penalty-host"; penaltyHost.hidden = true;
    arena.querySelector(".arena-surface").append(penaltyHost);
    const restartChoice = document.createElement("div"); restartChoice.className = "restart-choice"; restartChoice.hidden = true;
    restartChoice.innerHTML = `<span class="restart-label"></span><div><button type="button" class="kickoff-pass" hidden>Chuyền giao bóng</button><button type="button" class="free-kick-action" data-action="pass" hidden>Giữ: chuyền</button><button type="button" class="free-kick-action" data-action="shoot" hidden>Giữ: sút</button>${gameData.corners.map(c => `<button type="button" class="corner-kind" data-kind="${c.id}" hidden>${c.name}</button>`).join("")}</div>`;
    arena.querySelector(".arena-surface").append(restartChoice);
    for (const button of restartChoice.querySelectorAll("button")) button.addEventListener("click", () => {
      if (button.matches(".free-kick-action")) return;
      const session = sessions.get(panel.dataset.mode);
      if (!session) return;
      const state = session.api.status(), slot = state.corner?.slot ?? state.kickoff?.slot ?? state.freeKick?.slot;
      if (!slot) return;
      arena.focus({ preventScroll: true });
      if (!session.paused && button.matches(".corner-kind")) session.api.takeCorner(slot, button.dataset.kind);
      else if (!session.paused) session.api.action(slot, "pass", { power: .25 });
      updateHud(session);
    });
    for (const button of restartChoice.querySelectorAll(".free-kick-action")) {
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        const session = sessions.get(panel.dataset.mode), slot = session?.api.status().freeKick?.slot;
        if (!session || session.paused || !slot) return;
        arena.focus({ preventScroll: true });
        if (session.api.beginCharge(slot, button.dataset.action)) { button.chargeSlot = slot; button.setPointerCapture(event.pointerId); updateHud(session); }
      });
      button.addEventListener("pointerup", () => {
        const session = sessions.get(panel.dataset.mode), slot = button.chargeSlot; button.chargeSlot = null;
        if (session && slot && !session.paused) session.api.releaseCharge(slot);
        if (session) updateHud(session); arena.focus({ preventScroll: true });
      });
      button.addEventListener("pointercancel", () => { sessions.get(panel.dataset.mode)?.api.cancelCharge(button.chargeSlot); button.chargeSlot = null; });
    }
    const energy = document.createElement("div"); energy.className = "arena-energy"; energy.hidden = true;
    energy.innerHTML = (panel.dataset.mode === "local" ? ["A", "B"] : ["A"]).map(slot => `<div class="energy-player" data-slot="${slot}"><span class="energy-name">${slot}</span><strong>100%</strong><progress max="1" value="1" aria-label="Thể lực người ${slot}"></progress><button type="button" class="special-button" data-slot="${slot}" disabled><svg viewBox="0 0 24 24" aria-hidden="true">${defaultSkillIcon}</svg><kbd>${slot === "A" ? "E" : "O"}</kbd><span class="skill-state">Chờ</span></button></div>`).join("");
    arena.querySelector(".arena-surface").append(energy);
    for (const button of energy.querySelectorAll(".special-button")) button.addEventListener("click", () => {
      const session = sessions.get(panel.dataset.mode);
      if (!session || (session.paused && !session.awaitingStart)) return;
      arena.focus({ preventScroll: true }); session.api.action(button.dataset.slot, "special"); updateHud(session);
    });
    const result = document.createElement("div"); result.className = "arena-result"; result.hidden = true;
    result.innerHTML = '<strong></strong><span></span>';
    arena.querySelector(".arena-surface").append(result);
    const restart = document.createElement("button"); restart.type = "button"; restart.className = "arena-restart";
    restart.setAttribute("aria-label", "Bắt đầu trận mới"); restart.title = "Bắt đầu trận mới";
    restart.innerHTML = '<span aria-hidden="true">↻</span> Trận mới';
    arena.querySelector(".arena-surface").append(restart);
    restart.addEventListener("click", () => form.requestSubmit());
    form.addEventListener("change", () => setupSummary(panel));
    setupSummary(panel);
    panel.querySelector(".support").addEventListener("change", event => {
      const session = sessions.get(panel.dataset.mode);
      session?.api.setSupport(event.target.checked);
      if (session && !session.paused) arena.focus({ preventScroll: true });
    });
    for (const button of panel.querySelectorAll(".slide-action")) {
      button.addEventListener("click", () => {
        const session = sessions.get(panel.dataset.mode);
        if (session && !session.paused) {
          const player = session.api.status().players.find(p => p.slot === button.dataset.slot);
          session.api.action(button.dataset.slot, player?.hasBall ? "shoot" : "slide"); arena.focus({ preventScroll: true }); updateHud(session);
        }
      });
    }
    for (const button of panel.querySelectorAll(".switch-action")) {
      button.addEventListener("click", () => {
        const session = sessions.get(panel.dataset.mode);
        if (!session) return;
        session.api.action(button.dataset.slot, "switch"); updateHud(session); arena.focus({ preventScroll: true });
      });
    }
    form.addEventListener("submit", event => {
      event.preventDefault(); releaseKeys();
      const mode = panel.dataset.mode;
      sessions.get(mode)?.api.destroy();
      const options = optionsFor(panel);
      const host = panel.querySelector(".match-host"); host.replaceChildren();
      const api = window.PTSCFootball.mount(host, options);
      api.pause();
      const session = { panel, api, options, paused: true, awaitingStart: true,
        penaltyView: new window.PTSCPenaltyView(penaltyHost, (slot, direction) => {
          const current = sessions.get(mode);
          if (current === session && !session.paused) { api.choosePenalty(slot, direction); updateHud(session); arena.focus({ preventScroll: true }); }
        }) };
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
    arena.addEventListener("focusout", event => { if (!arena.contains(event.relatedTarget)) releaseKeys(); });
  }
  document.addEventListener("keydown", event => {
    const session = sessions.get(activeMode);
    if (!session || !session.panel.querySelector(".arena").contains(document.activeElement) || !handledKeys.has(event.code)) return;
    if (event.code === "Escape" && document.fullscreenElement) { releaseKeys(); return; }
    if (event.code !== "Escape" && document.activeElement.matches("button, input, select, textarea")) return;
    event.preventDefault();
    if (event.code === "Space" || event.code === "Escape") {
      if (event.code === "Escape" && session.panel.querySelector(".arena").classList.contains("fullscreen-fallback")) {
        session.panel.querySelector(".fullscreen").click(); return;
      }
      if (!event.repeat && !session.api.status().ended) setPaused(session, event.code === "Escape" ? true : !session.paused);
      return;
    }
    const switchBinding = Object.entries(bindings).find(([, binding]) => binding.actions[event.code] === "switch");
    if (switchBinding) {
      // Every physical press is accepted immediately; held repeats use our timer, independent of the OS delay.
      if (!event.repeat) {
        const slot = switchBinding[0];
        keys.add(event.code); session.api.action(slot, "switch"); updateHud(session); highlightPads();
        repeatSwitch(session, event.code, slot);
      }
      return;
    }
    const specialBinding = Object.entries(bindings).find(([, binding]) => binding.actions[event.code] === "special");
    if (session.awaitingStart && specialBinding && !event.repeat) {
      session.api.action(specialBinding[0], "special"); updateHud(session); return;
    }
    if (session.paused || session.api.status().ended) return;
    if (event.repeat && !keys.has(event.code)) return;
    if (session.api.status().phase === "penalties") {
      if (!event.repeat) for (const [slot, b] of Object.entries(bindings)) {
        const direction = event.code === b.left ? "left" : event.code === b.right ? "right" : event.code === b.down || event.code === b.up ? "center" : null;
        if (direction) session.api.choosePenalty(slot, direction);
      }
      updateHud(session); return;
    }
    keys.add(event.code); applyKeys(session);
    if (!event.repeat) for (const [slot, binding] of Object.entries(bindings)) {
      const player = session.api.status().players.find(p => p.slot === slot);
      const bound = binding.actions[event.code];
      const action = bound === "shoot" && !player?.hasBall && session.api.status().freeKick?.slot !== slot ? "slide" : bound;
      if (action === "pass" || action === "shoot") {
        const pending = pendingShots.get(slot);
        if (action === "shoot" && pending?.session === session) {
          clearTimeout(pending.timer); pendingShots.delete(slot);
          session.api.releaseCharge(slot, { special: true, power: Math.max(.55, pending.power) });
        } else {
          if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot); }
          if (session.api.beginCharge(slot, action)) chargeStarts.set(slot, performance.now());
        }
      } else if (action === "challenge" || action === "slide" || action === "special") {
        const pending = pendingShots.get(slot);
        if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot); }
        chargeStarts.delete(slot);
        session.api.action(slot, action);
      } else if (action) session.api.action(slot, action);
    }
    highlightPads();
  });
  window.addEventListener("keyup", event => {
    const repeat = switchRepeats.get(event.code);
    if (repeat) { clearTimeout(repeat.timer); switchRepeats.delete(event.code); }
    keys.delete(event.code); applyKeys();
    highlightPads();
    const session = sessions.get(activeMode);
    if (!session || session.paused || !session.panel.querySelector(".arena").contains(document.activeElement)) return;
    for (const [slot, binding] of Object.entries(bindings)) {
      const action = binding.actions[event.code];
      if (!["pass", "shoot"].includes(action) || !chargeStarts.has(slot)) continue;
      const elapsed = performance.now() - chargeStarts.get(slot); chargeStarts.delete(slot);
      const charge = session.api.status().players.find(p => p.slot === slot)?.charge;
      if (!charge || charge.action !== action) continue;
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
    }
  }, true);
  function suspend() {
    releaseKeys(); watcher?.pause();
    for (const session of sessions.values()) setPaused(session, true);
  }
  window.addEventListener("blur", suspend);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pointercancel", releaseKeys);
  window.addEventListener("focus", () => { if (activeMode === "watch" && !document.hidden) watcher?.play(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else if (activeMode === "watch") watcher?.play();
  });
  setInterval(() => { const session = sessions.get(activeMode); if (session) updateHud(session); highlightPads(); }, 250);
})();
