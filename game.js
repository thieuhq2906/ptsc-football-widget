(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[role=tab]")];
  const panels = [...document.querySelectorAll("[role=tabpanel]")];
  const sessions = new Map();
  const keys = new Set();
  const names = { R: "Đỏ", B: "Xanh" };
  const opposite = team => team === "R" ? "B" : "R";
  const bindings = {
    A: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", sprint: "KeyT", press: "KeyV", actions: { KeyR: "switch", KeyF: "pass", KeyG: "shoot", KeyB: "challenge" } },
    B: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", sprint: "KeyI", press: "KeyN", actions: { KeyU: "switch", KeyJ: "pass", KeyK: "shoot", KeyM: "challenge" } }
  };
  for (const guide of document.querySelectorAll(".pad-help")) {
    const slot = guide.dataset.slot, b = bindings[slot];
    const labels = slot === "A" ? { up: "W", left: "A", down: "S", right: "D" } : { up: "↑", left: "←", down: "↓", right: "→" };
    const actionKeys = slot === "A" ? ["R", "T", "F", "G", "V", "B"] : ["U", "I", "J", "K", "N", "M"];
    const actions = ["Đổi người", "Chạy nhanh", "Chuyền", "Sút / xoạc", "Áp sát", "Tranh bóng"];
    const gestures = ["Bấm", "Giữ", "Giữ → thả", "Giữ → thả / bấm", "Giữ", "Bấm"];
    guide.innerHTML = `<div class="movement-help"><strong>NGƯỜI ${slot}</strong><div class="pad-diagram"><img src="assets/control-pad.svg" alt="Pad di chuyển của người ${slot}" width="343" height="343"><span class="pad-player">${slot}</span>${Object.entries(labels).map(([direction, label]) => `<span class="pad-key pad-${direction}" data-code="${b[direction]}">${label}</span>`).join("")}</div></div><div class="action-grid">${actionKeys.map((key, i) => {
      const clickable = i === 3 && !!guide.closest(".controls"), tag = clickable ? "button" : "div";
      return `<${tag} class="action-key${clickable ? " slide-action" : ""}" data-code="Key${key}" data-action="${["switch", "sprint", "pass", "shoot", "press", "challenge"][i]}"${clickable ? ` type="button" data-slot="${slot}" disabled` : ""}><kbd>${key}</kbd><span><span class="action-label">${actions[i]}</span><small>${gestures[i]}</small></span></${tag}>`;
    }).join("")}</div>`;
  }
  const handledKeys = new Set(["Space", "Escape", ...Object.values(bindings).flatMap(b => [b.up, b.down, b.left, b.right, b.sprint, b.press, ...Object.keys(b.actions)])]);
  const pendingShots = new Map(), chargeStarts = new Map();
  let activeMode = "watch";
  let watcher = document.getElementById("watch-match").__ptscFootball;

  function applyKeys(session = sessions.get(activeMode)) {
    if (!session) return;
    const state = session.api.status();
    for (const [slot, b] of Object.entries(bindings)) {
      session.api.setInput(slot, session.paused ? {} : {
        x: Number(keys.has(b.right)) - Number(keys.has(b.left)),
        y: Number(keys.has(b.down)) - Number(keys.has(b.up)), sprint: keys.has(b.sprint),
        pressing: keys.has(b.press) && !state.players.find(p => p.slot === slot)?.hasBall
      });
    }
  }
  function releaseKeys() {
    keys.clear();
    highlightPads();
    for (const pending of pendingShots.values()) clearTimeout(pending.timer);
    pendingShots.clear(); chargeStarts.clear();
    for (const session of sessions.values()) {
      session.api.setInput("A"); session.api.setInput("B");
      session.api.cancelCharge("A"); session.api.cancelCharge("B");
    }
  }
  function highlightPads() {
    for (const key of document.querySelectorAll(".pad-key, .action-key")) key.classList.toggle("is-held", keys.has(key.dataset.code));
  }
  function setPaused(session, paused) {
    session.paused = paused;
    if (!paused) session.awaitingStart = false;
    session.panel.querySelector(".start-overlay").hidden = !session.awaitingStart;
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
    if (session === sessions.get(activeMode)) applyKeys(session);
    const state = session.api.status();
    session.penaltyView.update(state, session.paused);
    session.panel.querySelector(".arena-hints").hidden = !!state.penalty;
    const status = session.panel.querySelector(".match-status");
    const pause = session.panel.querySelector(".pause");
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
      const slideButton = session.panel.querySelector(`.slide-action[data-slot="${player.slot}"]`);
      if (slideButton) {
        slideButton.disabled = session.paused || state.ended || !player.ready || (!player.hasBall && !player.slideReady);
        slideButton.querySelector(".action-label").textContent = player.hasBall ? "Sút" : "Xoạc";
      }
      const card = session.panel.querySelector(`.player-card[data-slot="${player.slot}"]`);
      if (!card) continue;
      const side = state.leftTeam === player.team ? "trái" : "phải";
      card.querySelector("strong").textContent = `${player.slot} · ${names[player.team]} · ${player.name || "Chuẩn bị"}${player.number ? " #" + player.number : ""} · sân ${side}${player.hasBall ? " · có bóng" : ""}`;
      card.querySelector("meter").value = player.energy;
      card.querySelector(".percent").textContent = Math.round(player.energy * 100) + "%";
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
      form.querySelector(".start").textContent = "Bắt đầu trận mới";
      panel.querySelector(".pause").textContent = "Bắt đầu";
      overlay.hidden = false;
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
    arena.addEventListener("focusout", releaseKeys);
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
    if (session.paused || session.api.status().ended) return;
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
      const action = bound === "shoot" && !player?.hasBall ? "slide" : bound;
      if (action === "pass" || action === "shoot") {
        const pending = pendingShots.get(slot);
        if (action === "shoot" && pending?.session === session) {
          clearTimeout(pending.timer); pendingShots.delete(slot);
          session.api.releaseCharge(slot, { special: true, power: Math.max(.55, pending.power) });
        } else {
          if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot); }
          if (session.api.beginCharge(slot, action)) chargeStarts.set(slot, performance.now());
        }
      } else if (action === "challenge" || action === "slide") {
        const pending = pendingShots.get(slot);
        if (pending) { clearTimeout(pending.timer); pendingShots.delete(slot); session.api.cancelCharge(slot); }
        chargeStarts.delete(slot);
        session.api.action(slot, action);
      } else if (action) session.api.action(slot, action);
    }
    highlightPads();
  });
  document.addEventListener("keyup", event => {
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
  });
  function suspend() {
    releaseKeys(); watcher?.pause();
    for (const session of sessions.values()) setPaused(session, true);
  }
  window.addEventListener("blur", suspend);
  window.addEventListener("focus", () => { if (activeMode === "watch" && !document.hidden) watcher?.play(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else if (activeMode === "watch") watcher?.play();
  });
  setInterval(() => { const session = sessions.get(activeMode); if (session) updateHud(session); highlightPads(); }, 250);
})();
