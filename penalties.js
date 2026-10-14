(() => {
  "use strict";
  const names = { R: "Đỏ", B: "Xanh" }, colors = { R: "#e45248", B: "#397eca" };
  const positions = { left: 242, center: 320, right: 398 };
  class PenaltyView {
    constructor(host, choose) {
      this.host = host; this.turn = null; this.phase = null;
      host.hidden = true;
      host.innerHTML = `<svg class="penalty-scene" viewBox="0 0 640 360" role="img" aria-label="Luân lưu: nhìn từ sau cầu thủ sút về khung thành">
        <rect width="640" height="360" fill="#356630"/><path d="M0 0H640V133H0Z" fill="#394b56"/>
        <path d="M0 18H640M0 45H640M0 72H640M0 98H640" stroke="#87998e" stroke-width="6"/>
        <path d="M0 9H640M0 35H640M0 61H640M0 87H640" stroke="#f2d8b3" stroke-width="8" stroke-dasharray="2 8" opacity=".6"/>
        <path d="M0 112H640V144H0Z" fill="#13232c"/><text x="320" y="133" fill="#fff" text-anchor="middle" font-size="16" font-weight="800">PTSC CUP · LUÂN LƯU</text>
        <path d="M0 145H640V171H0ZM0 214H640V252H0ZM0 303H640V360H0Z" fill="#427a37"/>
        <path d="M175 148L34 323H606L465 148M256 150L212 212H428L384 150M0 158H640" fill="none" stroke="#e7efcb" stroke-width="2"/>
        <path d="M242 268Q320 291 398 268" fill="none" stroke="#e7efcb" stroke-width="2"/>
        <path d="M182 178V83H458V178M182 83L197 73H443L458 83M197 73V164H443V73M182 178L197 164M458 178L443 164" fill="#efffff10" stroke="#f1f2e0" stroke-width="4"/>
        <path d="M199 85V164m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79m14-79v79M197 88H443M197 101H443M197 114H443M197 127H443M197 140H443M197 153H443" stroke="#eef9ef" stroke-width=".8" opacity=".45"/>
        <ellipse cx="320" cy="273" rx="12" ry="3" fill="#173b22" opacity=".5"/>
        <g data-pen="keeper" style="transform-origin:320px 151px"><ellipse cx="320" cy="176" rx="15" ry="3" fill="#153e28" opacity=".4"/><circle cx="320" cy="119" r="7" fill="#e2b582" stroke="#22313b" stroke-width="1.5"/>
          <path d="M313 128L305 138L298 145M327 128L335 138L343 145" stroke="#ffd452" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M311 126H329L331 149H309Z" fill="#f8d548" stroke="#263837" stroke-width="1.5"/>
          <path d="M313 152L307 174M327 152L333 174" stroke="#232d34" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M302 176H311M329 176H338" stroke="#eef8e5" stroke-width="4" stroke-linecap="round"/></g>
        <g data-pen="shooter"><ellipse cx="251" cy="326" rx="23" ry="5" fill="#173b22" opacity=".4"/><path d="M236 238L228 270M262 238L273 267" stroke="#d3a177" stroke-width="9" fill="none" stroke-linecap="round"/>
          <circle cx="249" cy="222" r="11" fill="#d3a177" stroke="#243132" stroke-width="2"/><path d="M239 220Q237 207 251 210Q261 209 261 220" fill="#27312c"/>
          <path data-pen="kit" d="M234 235L264 235L269 274H230Z" fill="#e45248" stroke="#26323a" stroke-width="2"/><text x="249" y="259" text-anchor="middle" fill="#fff" font-size="16" font-weight="900">7</text>
          <path d="M232 274H267L264 290H234Z" fill="#f4f4e8" stroke="#26323a" stroke-width="2"/><path d="M240 289L236 318M258 289L264 318" fill="none" stroke="#d3a177" stroke-width="9"/>
          <path d="M236 310V321M263 310L265 321" stroke="#fff" stroke-width="9"/><path d="M229 325H241M260 325H274" stroke="#162d32" stroke-width="6" stroke-linecap="round"/></g>
        <path data-pen="aim" d="M320 271L320 173" fill="none" stroke="#64f2d2" stroke-width="5" opacity="0"/>
        <g data-pen="ball" style="transform-origin:320px 270px"><circle cx="320" cy="270" r="7" fill="#fff" stroke="#263340" stroke-width="1.5"/><path d="M318 267L322 267L323 271L320 274L317 271Z" fill="#263340"/></g>
      </svg><div class="penalty-score" aria-live="polite"></div><p class="penalty-message" role="status"></p><div class="penalty-choices"></div>`;
      this.controls = host.querySelector(".penalty-choices");
      for (const slot of ["A", "B"]) {
        const card = document.createElement("div"); card.className = "penalty-player"; card.dataset.slot = slot;
        card.innerHTML = `<strong></strong><div>${["left", "center", "right"].map((direction, i) => `<button type="button" data-direction="${direction}">${["← Trái", "↓ Giữa", "Phải →"][i]}</button>`).join("")}</div><small></small>`;
        card.addEventListener("click", event => { const button = event.target.closest("button"); if (button) choose(slot, button.dataset.direction); });
        this.controls.append(card);
      }
    }
    update(state, paused) {
      const p = state.penalty;
      this.host.hidden = !p;
      if (!p) return;
      const scoreHtml = `<small>Trận: Đỏ ${state.score.R}–${state.score.B} Xanh · PEN</small>` + ["R", "B"].map(team => `<div><b style="color:${colors[team]}">${names[team]} ${p.score[team]}</b><span>${p.history[team].map(goal => `<i class="${goal ? "goal" : "saved"}"></i>`).join("")}${"<i></i>".repeat(Math.max(0, 5 - p.history[team].length))}</span></div>`).join("");
      if (this.scoreHtml !== scoreHtml) { this.host.querySelector(".penalty-score").innerHTML = scoreHtml; this.scoreHtml = scoreHtml; }
      const message = p.phase === "finished" ? state.note : paused ? "Đang tạm dừng" : p.phase === "result" ? p.last.goal ? "VÀO!" : "THỦ MÔN CẢN PHÁ!" : `Lượt ${Math.floor(p.turn / 2) + 1} · Đội ${names[p.attack]} sút${p.turn >= 10 ? " · lượt quyết định" : ""}`;
      const messageNode = this.host.querySelector(".penalty-message");
      if (messageNode.textContent !== message) messageNode.textContent = message;
      for (const card of this.controls.children) {
        const player = p.players.find(item => item.slot === card.dataset.slot);
        card.hidden = !player;
        if (!player) continue;
        card.querySelector("strong").textContent = `${player.slot} · ${names[player.team]} · ${player.role === "attack" ? "Sút" : "Thủ môn"}`;
        card.querySelector("small").textContent = player.locked && p.phase === "choose" ? "Đã chọn · chờ đối thủ" : player.slot === "A" ? "A / S / D" : "← / ↓ / →";
        for (const button of card.querySelectorAll("button")) button.disabled = paused || player.locked || p.phase !== "choose";
      }
      if (this.turn === p.turn && this.phase === p.phase) return;
      this.turn = p.turn; this.phase = p.phase;
      const ball = this.host.querySelector('[data-pen="ball"]'), keeper = this.host.querySelector('[data-pen="keeper"]'), shooter = this.host.querySelector('[data-pen="shooter"]'), aim = this.host.querySelector('[data-pen="aim"]');
      this.host.querySelector('[data-pen="kit"]').setAttribute("fill", colors[p.attack]);
      ball.style.transform = ""; keeper.style.transform = ""; shooter.style.transform = ""; aim.setAttribute("opacity", "0");
      if (p.phase === "result" || p.phase === "finished") {
        const shotX = positions[p.last.shot], diveX = positions[p.last.dive];
        aim.setAttribute("d", `M320 270L${shotX} 158`); aim.setAttribute("opacity", ".55");
        // Every choice is concealed until both players have committed.
        ball.style.transform = `translate(${shotX - 320}px, -112px) scale(.6)`;
        keeper.style.transform = `translate(${diveX - 320}px, 0) rotate(${p.last.dive === "left" ? -65 : p.last.dive === "right" ? 65 : 0}deg)`;
        shooter.style.transform = "translate(24px, -8px)";
      }
    }
  }
  window.PTSCPenaltyView = PenaltyView;
})();
