(() => {
  "use strict";
  const names = { R: "Đỏ", B: "Xanh" }, colors = { R: "var(--art-red)", B: "var(--art-blue)" };
  const positions = { left: 242, center: 320, right: 398 };
  let sceneId = 0;
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  function supporters() {
    return Array.from({ length: 3 }, (_, row) => `<g transform="translate(0 ${48 + row * 22})">${Array.from({ length: 27 }, (_, i) => {
      const shirt = ["var(--art-red)", "var(--color-card)", "var(--art-blue)", "var(--color-sun)"][(i + row * 3) % 4];
      return `<g transform="translate(${8 + i * 24 + row % 2 * 10} 0)"><path d="M-6 9Q-6-1 0-1Q6-1 6 9Z" fill="${shirt}"/><circle cy="-5" r="4.8" fill="var(--art-skin)"/></g>`;
    }).join("")}<path d="M0 13H640" stroke-width="3"/></g>`).join("");
  }
  function footballer(keeper = false) {
    const kit = keeper ? "keeper-kit" : "kit";
    return `<ellipse cy="2" rx="17" ry="5" fill="var(--art-shadow)" stroke="none" opacity=".25"/>
      <path d="M-7-24-9-9-12 0M7-24 9-9 12 0" stroke-width="9"/>
      <path d="M-7-24-9-9M7-24 9-9" stroke="var(--art-skin)" stroke-width="5.5"/>
      <path d="M-9-9-12 0M9-9 12 0" stroke="var(--color-card)" stroke-width="5.5"/>
      <ellipse cx="-14" cy="1" rx="7" ry="3.6" fill="var(--art-shorts)" stroke-width="1.8"/><ellipse cx="14" cy="1" rx="7" ry="3.6" fill="var(--art-shorts)" stroke-width="1.8"/>
      <path d="M-6-27H6" stroke-width="23"/><path d="M-6-27H6" stroke="var(--art-shorts)" stroke-width="18.5"/>
      <path d="M-10-48-19-36-22-26M10-48 19-36 22-26" stroke-width="8"/>
      <path d="M-10-48-19-36-22-26M10-48 19-36 22-26" stroke="var(--art-skin)" stroke-width="4.6"/>
      <path d="M0-31V-49" stroke-width="26"/><path data-pen="${kit}" d="M0-31V-49" stroke="${keeper ? "var(--art-gk-b)" : colors.R}" stroke-width="21.5"/>
      ${keeper ? '<circle cx="-22" cy="-26" r="4.5" fill="var(--color-card)" stroke-width="1.8"/><circle cx="22" cy="-26" r="4.5" fill="var(--color-card)" stroke-width="1.8"/>' : '<text data-pen="number" y="-36" fill="var(--color-card)" stroke="none" text-anchor="middle" font-family="var(--font-mono)" font-size="11" font-weight="700">7</text>'}
      <circle cy="-70" r="14.5" fill="var(--art-skin)" stroke-width="2.5"/>
      ${keeper ? '<path d="M-15-70Q-15-86 0-86Q15-86 15-74Q4-78-15-70Z" fill="var(--art-hair)" stroke-width="2"/><circle cx="-5" cy="-69" r="1.8" fill="var(--color-ink)" stroke="none"/><circle cx="5" cy="-69" r="1.8" fill="var(--color-ink)" stroke="none"/><path d="M-3-62Q0-60 3-62" stroke-width="1.7"/>' : '<path d="M-14-67Q-18-83-6-86Q7-94 15-79L14-67Q8-73 0-71Q-8-72-14-67Z" fill="var(--art-hair)" stroke-width="2"/>'}`;
  }
  class PenaltyView {
    constructor(host, api) {
      this.host = host; this.api = api; this.turn = null; this.phase = null;
      const net = `penalty-net-${++sceneId}`;
      host.hidden = true;
      host.innerHTML = `<svg class="penalty-scene" viewBox="0 0 640 360" role="img" aria-label="Penalty: góc sau cầu thủ sút, phong cách hoạt hình PTSC Cup" fill="none" stroke="var(--color-ink)" stroke-linecap="round" stroke-linejoin="round">
        <defs><pattern id="${net}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0L8 8M8 0L0 8" stroke="var(--color-card)" stroke-width=".8" opacity=".65"/></pattern></defs>
        <rect width="640" height="360" fill="var(--color-sky-soft)" stroke="none"/>
        <path d="M0 26H640V119H0Z" fill="var(--art-stand-deep)" stroke-width="3"/>
        <path d="M0 35H640V53H0ZM0 79H640V97H0Z" fill="var(--art-stand)" stroke-width="2"/>
        <g stroke-width="1.8">${supporters()}</g>
        <path d="M0 115H640V140H0Z" fill="var(--color-card)" stroke-width="3"/>
        <g fill="var(--color-ink)" stroke="none" font-family="var(--font-mono)" font-size="10" font-weight="700" text-anchor="middle" letter-spacing="2"><text x="82" y="132">PTSC CUP</text><text data-pen="title" x="320" y="132">LUÂN LƯU</text><text x="556" y="132">PTSC CUP</text></g>
        <path d="M0 140H640V360H0Z" fill="var(--art-grass)" stroke="none"/>
        <path d="M0 155H640V178H0ZM0 209H640V253H0ZM0 309H640V360H0Z" fill="var(--art-grass-2)" stroke="none"/>
        <g stroke="var(--color-card)" stroke-width="2.8"><path d="M0 181H640M161 181 20 342H620L479 181M265 181 231 225H409L375 181M320 268h.1"/><path d="M238 284Q320 320 402 284"/></g>
        <ellipse cx="320" cy="271" rx="5" ry="2" fill="var(--color-card)" stroke="none"/>
        <path d="M182 182 199 166H441L458 182" fill="var(--art-shadow)" opacity=".12" stroke="none"/>
        <g fill="url(#${net})" stroke="var(--color-card)" stroke-width="1.4"><path d="M199 76H441V166H199Z"/><path d="M182 88 199 76V166L182 182ZM458 88 441 76V166L458 182ZM182 88 199 76H441L458 88Z"/></g>
        <path d="M199 166V76H441V166M182 88 199 76M458 88 441 76" stroke="var(--color-card)" stroke-width="3"/>
        <path d="M182 182V88H458V182" stroke-width="8"/><path d="M182 182V88H458V182" stroke="var(--color-card)" stroke-width="4.5"/>
        <g data-pen="keeper" style="transform-origin:320px 169px"><g transform="translate(320 181) scale(.72)">${footballer(true)}</g></g>
        <path data-pen="aim" d="M320 270L320 158" stroke="#6ef5a2" stroke-width="5" opacity="0"/>
        <g data-pen="shooter"><g transform="translate(252 326) scale(1.05)">${footballer()}</g></g>
        <ellipse cx="320" cy="274" rx="9" ry="3" fill="var(--art-shadow)" stroke="none" opacity=".25"/>
        <g data-pen="ball" style="transform-origin:320px 270px"><circle cx="320" cy="270" r="7" fill="var(--color-card)" stroke-width="1.7"/><path d="M318 267L322 267L323 271L320 274L317 271Z" fill="var(--color-ink)" stroke="none"/><path d="m314 267 2-2m8 1 2 2m-9 7 3 1" stroke-width="1"/></g>
      </svg><div class="penalty-score" aria-live="polite"></div><p class="penalty-message" role="status"></p><div class="penalty-choices"></div>`;
      this.controls = host.querySelector(".penalty-choices");
      for (const slot of ["A", "B"]) {
        const card = document.createElement("div"); card.className = "penalty-player"; card.dataset.slot = slot;
        const keys = slot === "A" ? ["A", "S", "D"] : ["←", "↓", "→"];
        card.innerHTML = `<strong></strong><div>${keys.map((key, i) => `<span><kbd>${key}</kbd> ${["Trái", "Giữa", "Phải"][i]}</span>`).join("")}</div><small></small>`;
        this.controls.append(card);
      }
    }
    update(state, paused) {
      const p = state.penalty;
      this.host.hidden = !p || p.phase === "finished";
      if (!p || p.phase === "finished") return;
      if (!this.paletteApplied) {
        for (const [name, value] of Object.entries(this.api.palette())) if (value) this.host.style.setProperty(name, value);
        this.paletteApplied = true;
      }
      text(this.host.querySelector('[data-pen="title"]'), p.kind === "inMatch" ? "PENALTY" : "LUÂN LƯU");
      const scoreHtml = `<small>Trận: Đỏ ${state.score.R}–${state.score.B} Xanh · ${p.kind === "inMatch" ? "Penalty" : "PEN"}</small>` + (p.kind === "inMatch" ? "" : ["R", "B"].map(team => `<div><b style="color:${colors[team]}">${names[team]} ${p.score[team]}</b><span>${p.history[team].map(goal => `<i class="${goal ? "goal" : "saved"}"></i>`).join("")}${"<i></i>".repeat(Math.max(0, 5 - p.history[team].length))}</span></div>`).join(""));
      if (this.scoreHtml !== scoreHtml) { this.host.querySelector(".penalty-score").innerHTML = scoreHtml; this.scoreHtml = scoreHtml; }
      const message = p.phase === "finished" ? state.note : paused ? "Đang tạm dừng" : p.phase === "result" ? p.last.goal ? "VÀO!" : "THỦ MÔN CẢN PHÁ!" : p.kind === "inMatch" ? `Penalty · Đội ${names[p.attack]} sút` : `Lượt ${Math.floor(p.turn / 2) + 1} · Đội ${names[p.attack]} sút${p.turn >= 10 ? " · lượt quyết định" : ""}`;
      const messageNode = this.host.querySelector(".penalty-message");
      if (messageNode.textContent !== message) messageNode.textContent = message;
      for (const card of this.controls.children) {
        const player = p.players.find(item => item.slot === card.dataset.slot);
        card.hidden = !player;
        if (!player) continue;
        text(card.querySelector("strong"), `${player.slot} · ${names[player.team]} · ${player.role === "attack" ? "Sút" : "Thủ môn"}`);
        text(card.querySelector("small"), paused ? "Tạm dừng" : player.locked && p.phase === "choose" ? "Đã chốt · đợi đối thủ" : p.phase === "choose" ? "Bấm phím để chốt" : "");
        card.classList.toggle("is-locked", paused || player.locked || p.phase !== "choose");
      }
      if (this.turn === p.turn && this.phase === p.phase) return;
      this.turn = p.turn; this.phase = p.phase;
      const ball = this.host.querySelector('[data-pen="ball"]'), keeper = this.host.querySelector('[data-pen="keeper"]'), shooter = this.host.querySelector('[data-pen="shooter"]'), aim = this.host.querySelector('[data-pen="aim"]');
      this.host.querySelector('[data-pen="kit"]').setAttribute("stroke", colors[p.attack]);
      this.host.querySelector('[data-pen="keeper-kit"]').setAttribute("stroke", p.attack === "R" ? "var(--art-gk-b)" : "var(--art-gk-r)");
      const selected = state.players.find(player => player.team === p.attack);
      text(this.host.querySelector('[data-pen="number"]'), String(selected?.number ?? 7));
      ball.style.transform = ""; keeper.style.transform = ""; shooter.style.transform = ""; aim.setAttribute("opacity", "0");
      if (p.phase === "result" || p.phase === "finished") {
        const shotX = positions[p.last.shot], diveX = positions[p.last.dive];
        aim.setAttribute("d", `M320 270L${shotX} 158`); aim.setAttribute("opacity", ".55");
        // Every choice is concealed until both players have committed.
        ball.style.transform = `translate(${shotX - 320}px, -112px) scale(.6)`;
        keeper.style.transform = `translate(${diveX - 320}px, 0) rotate(${p.last.dive === "left" ? -65 : p.last.dive === "right" ? 65 : 0}deg)`;
        shooter.style.transform = "translate(57px, -44px)";
      }
    }
  }
  window.PTSCPenaltyView = PenaltyView;
})();
