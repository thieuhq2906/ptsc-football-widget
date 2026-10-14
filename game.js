(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[role=tab]")];
  const panels = [...document.querySelectorAll("[role=tabpanel]")];
  const sessions = new Map();
  const keys = new Set();
  const names = { R: "Đỏ", B: "Xanh" };
  const opposite = team => team === "R" ? "B" : "R";
  const bindings = {
    A: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", sprint: "ShiftLeft", actions: { KeyF: "pass", KeyG: "shoot", KeyH: "tackle", KeyQ: "switch" } },
    B: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", sprint: "ShiftRight", actions: { KeyN: "pass", KeyM: "shoot", Comma: "tackle", KeyL: "switch" } }
  };
  const handledKeys = new Set(["Space", "Escape", ...Object.values(bindings).flatMap(b => [b.up, b.down, b.left, b.right, b.sprint, ...Object.keys(b.actions)])]);
  let activeMode = "watch";
  let watcher = document.getElementById("watch-match").__ptscFootball;

  function applyKeys(session = sessions.get(activeMode)) {
    if (!session) return;
    for (const [slot, b] of Object.entries(bindings)) {
      session.api.setInput(slot, session.paused ? {} : {
        x: Number(keys.has(b.right)) - Number(keys.has(b.left)),
        y: Number(keys.has(b.down)) - Number(keys.has(b.up)), sprint: keys.has(b.sprint)
      });
    }
  }
  function releaseKeys() {
    keys.clear();
    for (const session of sessions.values()) {
      session.api.setInput("A"); session.api.setInput("B");
    }
  }
  function setPaused(session, paused) {
    session.paused = paused;
    releaseKeys();
    if (paused) session.api.pause(); else session.api.play();
    session.panel.querySelector(".pause").textContent = paused ? "Tiếp tục" : "Tạm dừng";
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
    return { mode: panel.dataset.mode, teamA, leftTeam: panel.dataset.mode === "local" ? sideB === "left" ? teamB : teamA : "R" };
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
      label.append(energyLabel, percent); card.append(title, label, meter); cards.append(card);
    }
  }
  function updateHud(session) {
    const state = session.api.status();
    const status = session.panel.querySelector(".match-status");
    const pause = session.panel.querySelector(".pause");
    if (state.ended) {
      const result = state.winner ? `Đội ${names[state.winner]} thắng` : "Hai đội hòa";
      status.textContent = `Hết giờ · ${result} · Đỏ ${state.score.R}–${state.score.B} Xanh`;
      pause.disabled = true;
      session.api.setInput("A"); session.api.setInput("B");
    } else {
      pause.disabled = false;
      const phase = { reset: "Chuẩn bị giao bóng", celebrate: "Bàn thắng!", halftime: "Nghỉ giữa hiệp · đổi sân" }[state.phase];
      status.textContent = session.paused ? "Đang tạm dừng · Nhấn Tiếp tục để chơi" : phase ?? (state.stoppage ? state.note || "Chuẩn bị đưa bóng trở lại" : `${state.minute}' · Đỏ ${state.score.R}–${state.score.B} Xanh`);
    }
    for (const player of state.players) {
      const card = session.panel.querySelector(`.player-card[data-slot="${player.slot}"]`);
      if (!card) continue;
      const side = state.leftTeam === player.team ? "trái" : "phải";
      card.querySelector("strong").textContent = `${player.slot} · ${names[player.team]} · ${player.name || "Chuẩn bị"}${player.number ? " #" + player.number : ""} · sân ${side}${player.hasBall ? " · có bóng" : ""}`;
      card.querySelector("meter").value = player.energy;
      card.querySelector(".percent").textContent = Math.round(player.energy * 100) + "%";
    }
  }
  for (const panel of document.querySelectorAll(".game-panel")) {
    const form = panel.querySelector("form");
    const arena = panel.querySelector(".arena");
    form.addEventListener("change", () => setupSummary(panel));
    setupSummary(panel);
    form.addEventListener("submit", event => {
      event.preventDefault(); releaseKeys();
      const mode = panel.dataset.mode;
      sessions.get(mode)?.api.destroy();
      const options = optionsFor(panel);
      const host = panel.querySelector(".match-host"); host.replaceChildren();
      const api = window.PTSCFootball.mount(host, options);
      const session = { panel, api, options, paused: false };
      sessions.set(mode, session);
      form.querySelector(".start").textContent = "Bắt đầu trận mới";
      panel.querySelector(".pause").textContent = "Tạm dừng";
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
    event.preventDefault();
    if (event.code === "Space" || event.code === "Escape") {
      if (!event.repeat && !session.api.status().ended) setPaused(session, event.code === "Escape" ? true : !session.paused);
      return;
    }
    if (session.paused || session.api.status().ended) return;
    keys.add(event.code); applyKeys(session);
    if (!event.repeat) for (const [slot, binding] of Object.entries(bindings)) {
      const action = binding.actions[event.code];
      if (action) session.api.action(slot, action);
    }
  });
  document.addEventListener("keyup", event => {
    keys.delete(event.code); applyKeys();
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
  setInterval(() => { const session = sessions.get(activeMode); if (session) updateHud(session); }, 250);
})();
