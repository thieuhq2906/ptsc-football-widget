(() => {
  "use strict";
  const names = { R: "Đỏ", B: "Xanh" }, colors = { R: "var(--art-red)", B: "var(--art-blue)" };
  const markers = { A: "#6ef5a2", B: "#73e9ff" };
  // Where the ball ends up in the goal mouth, and where the keeper's body lands for each choice.
  const shots = { left: [236, 126], center: [320, 116], right: [404, 126] };
  const dives = { left: { x: 262, y: 168, pose: "dive", flip: true }, center: { x: 320, y: 181, pose: "gkHigh", flip: false }, right: { x: 378, y: 168, pose: "dive", flip: false } };
  const SHOOTER_START = { x: 244, y: 336, s: 1.38 }, SHOOTER_KICK = { x: 305, y: 283, s: 1.16 };
  const KEEPER = { x: 320, y: 181, s: .86 }, BALL = [320, 272];
  let sceneId = 0;
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const place = (node, x, y, sx = 1, sy = sx) => { node.style.transform = `translate(${x}px, ${y}px) scale(${sx}, ${sy})`; };
  function supporters() {
    return Array.from({ length: 3 }, (_, row) => `<g transform="translate(0 ${50 + row * 22})">${Array.from({ length: 27 }, (_, i) => {
      const shirt = ["var(--art-red)", "var(--color-card)", "var(--art-blue)", "var(--color-sun)"][(i + row * 3) % 4];
      const skin = (i + row) % 3 ? "var(--art-skin)" : "var(--art-skin-2)";
      return `<g transform="translate(${8 + i * 24 + row % 2 * 10} 0)"><path d="M-6 9Q-6-1 0-1Q6-1 6 9Z" fill="${shirt}"/><circle cy="-5" r="4.6" fill="${skin}"/></g>`;
    }).join("")}<path d="M0 13H640" stroke-width="3"/></g>`).join("");
  }
  class PenaltyView {
    constructor(host, api, options = {}) {
      this.host = host; this.api = api; this.keys = options.keys ?? (slot => slot === "A" ? { left: "A", center: "S", right: "D", special: "E" } : { left: "←", center: "↓", right: "→", special: "O" });
      this.turn = null; this.phase = null; this.cast = null; this.timers = [];
      const net = `penalty-net-${++sceneId}`;
      host.hidden = true;
      host.innerHTML = `<svg class="penalty-scene" viewBox="0 0 640 360" role="img" aria-label="Penalty: góc sau cầu thủ sút, cùng phong cách sân chính" fill="none" stroke="var(--color-ink)" stroke-linecap="round" stroke-linejoin="round">
        <defs><pattern id="${net}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0L8 8M8 0L0 8" stroke="var(--color-card)" stroke-width=".8" opacity=".7"/></pattern></defs>
        <rect width="640" height="360" fill="var(--color-sky-soft)" stroke="none"/>
        <path d="M0 28H640V121H0Z" fill="var(--art-stand-deep)" stroke-width="2.5"/>
        <path d="M0 37H640V55H0ZM0 81H640V99H0Z" fill="var(--art-stand)" stroke-width="2"/>
        <g stroke-width="1.6">${supporters()}</g>
        <path d="M-4 117H644V141H-4Z" fill="var(--color-card)" stroke-width="2.5"/>
        <g fill="var(--color-ink)" stroke="none" font-family="var(--font-mono)" font-size="10" font-weight="700" text-anchor="middle" letter-spacing="2"><text x="92" y="133">PTSC CUP</text><text data-pen="title" x="548" y="133">LUÂN LƯU</text></g>
        <path d="M0 141H640V360H0Z" fill="var(--art-surround)" stroke="none"/>
        <path d="M-10 150H650L700 360H-60Z" fill="var(--art-grass)" stroke-width="3"/>
        <path d="M-12 158H652L657 180H-17ZM-22 203H662L671 245H-31ZM-41 290H681L700 360H-60Z" fill="var(--art-grass-2)" stroke="none"/>
        <g stroke="var(--color-card)" stroke-width="2.8"><path d="M-12 182H652M152 182 34 336H606L488 182M262 182 236 222H404L378 182"/><path d="M244 300Q320 334 396 300"/></g>
        <ellipse cx="320" cy="273" rx="4.5" ry="1.8" fill="var(--color-card)" stroke="none"/>
        <path d="M182 182 199 166H441L458 182" fill="var(--art-shadow)" opacity=".14" stroke="none"/>
        <g data-pen="net"><g fill="url(#${net})" stroke="var(--color-card)" stroke-width="1.4"><path d="M199 76H441V166H199Z"/><path d="M182 88 199 76V166L182 182ZM458 88 441 76V166L458 182ZM182 88 199 76H441L458 88Z"/></g>
        <path d="M199 166V76H441V166M182 88 199 76M458 88 441 76" stroke="var(--color-card)" stroke-width="2.6"/></g>
        <path d="M182 182V88H458V182" stroke-width="8"/><path d="M182 182V88H458V182" stroke="var(--color-card)" stroke-width="4.5"/>
        <ellipse data-pen="keeper-shadow" cx="320" cy="182" rx="15" ry="4" fill="var(--art-shadow)" stroke="none" opacity=".22"/>
        <g data-pen="keeper" class="pen-actor"></g>
        <path data-pen="trail" d="" stroke="var(--color-card)" stroke-width="4" stroke-dasharray="2 9" opacity="0"/>
        <ellipse data-pen="ball-shadow" cx="${BALL[0]}" cy="${BALL[1] + 3}" rx="8" ry="2.8" fill="var(--art-shadow)" stroke="none" opacity=".25"/>
        <g data-pen="ball" class="pen-actor"><circle r="7" fill="var(--color-card)" stroke-width="1.8"/><path d="M-2-3H2L3 1 0 4-3 1Z" fill="var(--color-ink)" stroke="none"/><path d="m-6-3 2-2m8 1 2 2m-9 7 3 1" stroke-width="1"/></g>
        <ellipse data-pen="shooter-shadow" cx="0" cy="0" rx="15" ry="4.5" fill="var(--art-shadow)" stroke="none" opacity=".22" class="pen-actor"/>
        <g data-pen="shooter" class="pen-actor"></g>
        <g data-pen="markers" stroke="#163c32" stroke-width="1" font-family="var(--font-mono)" font-size="11" font-weight="700" text-anchor="middle"></g>
        <g data-pen="burst" opacity="0" stroke="var(--art-gold)" stroke-width="3"><path d="M0-22V-34M16-16 25-25M22 0H34M16 16 25 25M-16-16-25-25M-22 0H-34M-16 16-25 25"/></g>
      </svg><div class="penalty-score" aria-live="polite"></div><p class="penalty-message" role="status"></p><div class="penalty-choices"></div>`;
      this.svg = host.querySelector("svg");
      this.nodes = Object.fromEntries([...host.querySelectorAll("[data-pen]")].map(node => [node.dataset.pen, node]));
      this.controls = host.querySelector(".penalty-choices");
      for (const slot of ["A", "B"]) {
        const card = document.createElement("div"); card.className = "penalty-player"; card.dataset.slot = slot;
        card.innerHTML = `<strong></strong><div class="penalty-keys"></div><small class="penalty-lock"></small><small class="penalty-skill"></small>`;
        this.controls.append(card);
      }
    }
    clearTimers() { for (const timer of this.timers) clearTimeout(timer); this.timers = []; }
    later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
    pose(role, name, phase = 0) {
      const node = this.nodes[role === "keeper" ? "keeper" : "shooter"];
      const markup = this.api.penaltyFigure?.(role, name, { back: role === "taker", phase }) ?? "";
      const key = name + ":" + phase.toFixed(1) + ":" + this.cast;
      if (node.dataset.key !== key) { node.innerHTML = `<g class="pen-body">${markup}</g>`; node.dataset.key = key; }
    }
    stage({ shooter, keeper, ball, instant }) {
      this.svg.classList.toggle("is-instant", !!instant);
      const { nodes } = this;
      if (shooter) { place(nodes.shooter, shooter.x, shooter.y, shooter.s); place(nodes["shooter-shadow"], shooter.x, shooter.y, shooter.s); }
      if (keeper) { place(nodes.keeper, keeper.x, keeper.y, keeper.flip ? -KEEPER.s : KEEPER.s, KEEPER.s); place(nodes["keeper-shadow"], keeper.x - 320, 0, 1); }
      if (ball) place(nodes.ball, ball.x, ball.y, ball.s);
      if (instant) void this.svg.getBoundingClientRect();
    }
    reset() {
      this.clearTimers();
      this.pose("taker", "ready"); this.pose("keeper", "keeper");
      this.stage({ shooter: SHOOTER_START, keeper: { x: KEEPER.x, y: KEEPER.y }, ball: { x: BALL[0], y: BALL[1], s: 1 }, instant: true });
      this.nodes.trail.setAttribute("opacity", "0"); this.nodes.burst.setAttribute("opacity", "0");
      this.nodes["ball-shadow"].setAttribute("opacity", ".25");
      this.host.classList.remove("is-goal", "is-saved", "is-kicking");
      this.revealed = false;
    }
    play(last) {
      this.clearTimers();
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const [shotX, shotY] = shots[last.shot], dive = dives[last.actualDive ?? last.dive];
      const finish = () => {
        this.revealed = true;
        if (this.last) this.update(...this.last);
        this.pose("taker", "powerFollow");
        this.pose("keeper", dive.pose === "dive" ? "diveLand" : "gkChest");
        if (last.goal) {
          this.host.classList.add("is-goal");
          const burst = this.nodes.burst; burst.setAttribute("transform", `translate(${shotX} ${shotY})`); burst.setAttribute("opacity", "1");
        } else {
          this.host.classList.add("is-saved");
          // A parry: the ball comes off the keeper and drops away from goal.
          const away = last.shot === "left" ? -1 : last.shot === "right" ? 1 : (last.turn % 2 ? 1 : -1);
          this.stage({ ball: { x: shotX + away * 46, y: 214, s: .74 } });
        }
      };
      if (reduce) {
        this.pose("taker", "powerFollow"); this.pose("keeper", dive.pose);
        this.stage({ shooter: SHOOTER_KICK, keeper: dive, ball: { x: shotX, y: shotY, s: .58 }, instant: true });
        return finish();
      }
      this.host.classList.add("is-kicking");
      this.stage({ shooter: SHOOTER_KICK });
      for (let i = 0; i < 5; i++) this.later(i * 80, () => this.pose("taker", "run", i * 1.25));
      this.later(400, () => this.pose("taker", "powerBack"));
      this.later(520, () => {
        this.pose("taker", "powerKick");
        this.nodes.trail.setAttribute("d", `M${BALL[0]} ${BALL[1]}Q${(BALL[0] + shotX) / 2} ${shotY - 30} ${shotX} ${shotY}`);
        this.nodes.trail.setAttribute("opacity", ".55"); this.nodes["ball-shadow"].setAttribute("opacity", "0");
        this.stage({ ball: { x: shotX, y: shotY, s: .58 } });
      });
      this.later(560, () => { this.pose("keeper", dive.pose); this.stage({ keeper: dive }); });
      this.later(1020, finish);
    }
    update(state, paused) {
      const p = state.penalty;
      this.last = [state, paused];
      this.host.hidden = !p || p.phase === "finished";
      if (!p || p.phase === "finished") { this.clearTimers(); this.turn = null; this.phase = null; return; }
      if (!this.paletteApplied) {
        for (const [name, value] of Object.entries(this.api.palette())) if (value) this.host.style.setProperty(name, value);
        this.paletteApplied = !!this.host.style.getPropertyValue("--color-ink");
      }
      text(this.nodes.title, p.kind === "inMatch" ? "PENALTY" : "LUÂN LƯU");
      const team = t => `<span class="pen-team${p.attack === t ? " is-attacking" : ""}"><i class="pen-dot" style="background:${colors[t]}"></i>${names[t].toUpperCase()}</span>`;
      const marks = t => `<span class="pen-marks">${p.history[t].map(goal => `<i class="${goal ? "goal" : "saved"}"></i>`).join("")}${"<i></i>".repeat(Math.max(0, 5 - p.history[t].length))}</span>`;
      const scoreHtml = p.kind === "inMatch"
        ? `<div class="pen-bug"><span class="pen-cup">PENALTY</span>${team("R")}<b>${state.score.R}–${state.score.B}</b>${team("B")}</div>`
        : `<div class="pen-bug"><span class="pen-cup">PEN</span>${team("R")}<b>${p.score.R}–${p.score.B}</b>${team("B")}</div><div class="pen-history">${marks("R")}<small>Trận ${state.score.R}–${state.score.B}</small>${marks("B")}</div>`;
      // The result stays hidden until the ball arrives.
      const reveal = p.phase !== "result" || this.revealed || this.turn !== p.turn;
      if (reveal && this.scoreHtml !== scoreHtml) { this.host.querySelector(".penalty-score").innerHTML = scoreHtml; this.scoreHtml = scoreHtml; }
      const message = paused ? "Đang tạm dừng" : p.phase === "result" && !reveal ? "Sút…" : p.phase === "result" ? p.last.skillWinner === "attack" ? "VÀO! BẢN LĨNH CHẤM PHẠT!" : p.last.skillWinner === "defense" ? "NGƯỜI HÙNG BẮT PEN!" : p.last.goal ? "VÀO!" : "THỦ MÔN CẢN PHÁ!"
        : p.kind === "inMatch" ? `Penalty · Đội ${names[p.attack]} sút` : `Lượt ${Math.floor(p.turn / 2) + 1} · Đội ${names[p.attack]} sút${p.turn >= 10 ? " · lượt quyết định" : ""}`;
      text(this.host.querySelector(".penalty-message"), message);
      for (const card of this.controls.children) {
        const player = p.players.find(item => item.slot === card.dataset.slot);
        card.hidden = !player;
        if (!player) continue;
        card.dataset.team = player.team;
        const actor = p.actors?.[player.role === "attack" ? "taker" : "keeper"];
        text(card.querySelector("strong"), `${player.slot} · ${player.role === "attack" ? "Sút" : "Bắt"} · ${actor?.name ?? names[player.team]}`);
        const keys = this.keys(player.slot), keyHtml = ["left", "center", "right"].map((dir, i) => `<span><kbd>${keys[dir]}</kbd> ${["Trái", "Giữa", "Phải"][i]}</span>`).join("");
        const keyNode = card.querySelector(".penalty-keys");
        if (keyNode.innerHTML !== keyHtml) keyNode.innerHTML = keyHtml;
        text(card.querySelector(".penalty-lock"), paused ? "Tạm dừng" : player.locked && p.phase === "choose" ? "Đã chốt · đợi đối thủ" : p.phase === "choose" ? "Bấm phím để chốt hướng" : "");
        const skill = state.players.find(item => item.slot === player.slot)?.special;
        text(card.querySelector(".penalty-skill"), !skill?.kind ? "Không có skill pen" : `${skill.name} · tự bật`);
        card.classList.toggle("is-locked", paused || player.locked || p.phase !== "choose");
      }
      const cast = `${p.actors?.taker?.id}:${p.actors?.keeper?.id}`;
      if (this.turn === p.turn && this.phase === p.phase && this.cast === cast) return;
      const newTurn = this.turn !== p.turn || this.cast !== cast;
      this.turn = p.turn; this.phase = p.phase; this.cast = cast;
      // Markers over the people each player controls, as on the pitch.
      const markerHtml = p.players.map(player => {
        const [x, y] = player.role === "attack" ? [SHOOTER_START.x + 4, SHOOTER_START.y - 100 * SHOOTER_START.s] : [KEEPER.x + 4, KEEPER.y - 100 * KEEPER.s];
        return `<path d="M${x - 6} ${y - 14}H${x + 6}L${x} ${y}Z" fill="${markers[player.slot]}"/><text x="${x}" y="${y - 18}" fill="#fff" stroke="#1d2340" stroke-width="2" paint-order="stroke">${player.slot}</text>`;
      }).join("");
      this.nodes.markers.innerHTML = markerHtml;
      if (p.phase === "choose" || newTurn) this.reset();
      this.nodes.markers.setAttribute("opacity", p.phase === "choose" ? "1" : "0");
      // Every choice is concealed until both players have committed.
      if (p.phase === "result" && p.last) this.play(p.last);
    }
  }
  window.PTSCPenaltyView = PenaltyView;
})();
