// Run with Node and Playwright installed: node tests/game-browser.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "test-results");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + (name === "/" ? "/index.html" : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream"); res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    // Human dead balls (kick-off, free kick, corner) wait for the player; tests take them straight away.
    await page.addInitScript(() => {
      window.__takeRestart = api => {
        const state = api.status(), restart = [state.kickoff, state.freeKick, state.goalKick].find(r => r?.slot && r.ready);
        if (restart) return api.action(restart.slot, "pass");
        if (state.corner?.slot && state.corner.ready) return api.takeCorner(state.corner.slot, state.corner.options[0].id);
        return false;
      };
      window.__stepPlay = (api, seconds) => { window.__takeRestart(api); return api.__step(seconds); };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.getElementById("watch-match").__ptscFootball);
    const route = async hash => {
      await page.evaluate(h => { location.hash = h; }, hash);
      await page.waitForFunction(h => document.getElementById("game").dataset.route === h, hash);
    };
    const startMatch = async mode => {
      if (!(await page.evaluate(m => document.getElementById("game").dataset.route === "#/" + m, mode))) await route("#/" + mode);
      await page.locator(`#panel-${mode} .start`).click();
      await page.waitForFunction(m => document.getElementById("game").dataset.route === "#/" + m + "/match", mode);
    };
    const choose = async (mode, opt, value) => {
      const row = page.locator(`#panel-${mode} .opt[data-opt="${opt}"]`);
      for (let i = 0; i < 12 && (await row.getAttribute("data-value")) !== String(value); i++) await row.locator(".opt-next").click();
      assert.equal(await row.getAttribute("data-value"), String(value), `${mode} ${opt} must reach ${value}`);
    };
    assert.equal(await page.evaluate(() => location.hash), "#/menu", "The game opens on the main menu");
    assert(await page.locator("#panel-watch .main-menu").isVisible(), "The menu plays over a live match");
    assert.equal(await page.locator(".main-menu .menu-item").count(), 4);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.go), "cpu", "The menu opens with its cursor on the first entry");
    assert.equal(await page.locator('body > :not(main):not(script)').count(), 0, "Nothing lives outside the game stage");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.go), "local", "Arrows move the menu cursor");
    assert.match(await page.locator(".menu-preview-title").textContent(), /Hai người/);
    await page.keyboard.press("ArrowUp"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/cpu" && !document.getElementById("panel-cpu").hidden);
    assert(await page.locator("#panel-cpu .setup").isVisible(), "Choosing a mode opens its setup screen");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.opt), "clubA", "Setup opens with the cursor on the first row");
    const firstClub = await page.locator('#panel-cpu .opt[data-opt="clubA"]').getAttribute("data-value");
    await page.keyboard.press("ArrowRight");
    const nextClub = await page.locator('#panel-cpu .opt[data-opt="clubA"]').getAttribute("data-value");
    assert(nextClub !== firstClub && await page.evaluate(id => !!PTSCTeams.get(id), nextClub), "Left/right change a setting: " + firstClub + " -> " + nextClub);
    assert(await page.evaluate(() => !!document.querySelector("#panel-cpu .matchup .vs-logo[src*='assets/teams/']")), "The matchup card shows the club badges");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/menu");
    await page.locator('.menu-item[data-go="cpu"]').click();
    await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/cpu");
    await page.locator(".nav-back").click();
    await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/menu");
    console.log("PASS main menu, keyboard cursor, setting rows, Esc and back button");
    // A match mounted on a hidden screen and shown in the same frame must still run in real time.
    for (let attempt = 0; attempt < 3; attempt++) {
      await route("#/menu"); await page.keyboard.press("Enter"); await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/cpu");
      await page.locator("#panel-cpu .start").click(); await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/cpu/match");
      await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.__state().T > .4, null, { timeout: 4000 }).catch(() => assert.fail("The match clock runs after kick-off"));
      await page.keyboard.press("Escape");
    }
    await route("#/menu");
    console.log("PASS matches started from the menu run in real time");

    const narrativeSides = await page.evaluate(() => {
      const sides = [];
      for (let seed = 1; seed <= 16; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none" });
        const goals = api.__stats().storyGoals;
        sides.push(goals[goals.length - 1][0]); api.destroy(); host.remove();
      }
      return sides;
    });
    assert(narrativeSides.includes("R") && narrativeSides.includes("B"), "Watch narratives must favour both colours");
    console.log("PASS watch narratives support both colours");

    const watchResults = [];
    for (let seed = 1; seed <= 6; seed++) {
      watchResults.push(await page.evaluate(seed => {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none" });
        for (let i = 0; i < 300 && !api.status().ended; i++) api.__step(2);
        const state = api.status(); api.destroy(); host.remove();
        return { seed, ended: state.ended, winner: state.winner, score: state.score };
      }, seed));
    }
    assert(watchResults.every(result => result.ended), "Every sampled watch match must finish");
    assert(watchResults.some(result => result.winner === "R") && watchResults.some(result => result.winner === "B"), "Actual watch matches must let either side win");
    console.log("PASS six complete watch matches with both Red and Blue winners");

    const actions = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "local", seed: 7, still: 0, fonts: "none" });
      let passed = false;
      for (let i = 0; i < 300 && !passed; i++) {
        api.__step(.1);
        const carrier = api.status().players.find(player => player.hasBall);
        if (carrier) passed = api.action(carrier.slot, "pass");
      }
      api.__step(.4);
      const flight = api.__state();
      for (let i = 0; i < 300 && !api.status().players.some(player => player.hasBall); i++) api.__step(.1);
      const state = api.status();
      api.destroy(); host.remove(); return { passed, flight, state };
    });
    assert(actions.passed && actions.flight.kind === "pass", "Human passing must launch a pass");
    assert(actions.state.players.some(player => player.hasBall), "Receiver control must follow possession");
    console.log("PASS human passing and automatic receiver selection");

    const defending = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "local", seed: 11, still: 0, fonts: "none" });
      let accepted = false, switched = false;
      for (let i = 0; i < 800 && !accepted; i++) {
        const state = api.status();
        // Two-player kick-offs wait for the taker's pass.
        if (__takeRestart(api)) { api.__step(.05); continue; }
        const carrier = state.players.find(player => player.hasBall);
        const defender = state.players.find(player => carrier && player.team !== carrier.team);
        if (defender && defender.ready) {
          if (!switched) { switched = api.action(defender.slot, "switch"); api.__step(.05); continue; }
          const dx = (carrier.position[0] - defender.position[0]) * 684 + (carrier.position[1] - defender.position[1]) * 352;
          const dy = (carrier.position[0] - defender.position[0]) * -387 + (carrier.position[1] - defender.position[1]) * 231;
          const scale = Math.max(1, Math.abs(dx), Math.abs(dy));
          api.setInput(defender.slot, { x: dx / scale, y: dy / scale, sprint: true });
          accepted = api.action(defender.slot, "tackle");
        }
        api.__step(.05);
      }
      api.destroy(); host.remove(); return { accepted, switched };
    });
    assert(defending.switched && defending.accepted, "Human defensive switch and tackle must work");
    console.log("PASS defensive player switching and nearby tackling");

    const aiming = await page.evaluate(() => {
      function fixture(seed = 7) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none", support: false });
        let carrier;
        for (let i = 0; i < 600 && !carrier; i++) {
          __stepPlay(api, .05); carrier = api.status().players.find(p => p.ready && p.hasBall);
        }
        if (!carrier) throw new Error("No ready carrier in aiming fixture");
        return { api, host, carrier, done() { api.destroy(); host.remove(); } };
      }
      const directions = [];
      for (const action of ["pass", "shoot"]) for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const f = fixture();
        f.api.setInput(f.carrier.slot, { x, y }); f.api.setInput(f.carrier.slot);
        f.api.__step(0);
        const aim = f.api.status().players.find(p => p.slot === f.carrier.slot).aim;
        const arrow = f.host.shadowRoot.querySelector(`[data-id="aim-${f.carrier.slot}"]`).getAttribute("d");
        const accepted = f.api.action(f.carrier.slot, action), kick = f.api.__state().kick;
        directions.push({ action, x, y, aim, arrow, accepted, kick }); f.done();
      }
      const supportPass = fixture();
      supportPass.api.setSupport(true); supportPass.api.setInput(supportPass.carrier.slot, { x: 0, y: -1 });
      const passed = supportPass.api.action(supportPass.carrier.slot, "pass"), passPlan = supportPass.api.__state().kick;
      for (let i = 0; i < 240 && supportPass.api.__state().owner !== passPlan.receiver; i++) supportPass.api.__step(.05);
      const received = supportPass.api.status(), passOwner = supportPass.api.__state().owner;
      supportPass.done();
      const supportedShots = [], keepers = [];
      for (let seed = 1; seed <= 8; seed++) {
        const f = fixture(seed); f.api.setSupport(true); f.api.setInput(f.carrier.slot, { x: 0, y: -1 });
        const accepted = f.api.action(f.carrier.slot, "shoot"), plan = f.api.__state().kick;
        let keeper = null;
        for (let i = 0; i < 160 && !f.api.status().ended; i++) {
          f.api.__step(.05);
          keeper = f.api.status().players.find(p => p.role === "GK" && p.hasBall);
          if (keeper) break;
          if (f.api.status().phase === "celebrate") break;
        }
        let keeperPass = null;
        if (keeper) {
          for (let i = 0; i < 80 && !f.api.status().players.find(p => p.slot === keeper.slot)?.ready; i++) f.api.__step(.05);
          keeperPass = f.api.action(keeper.slot, "pass");
          f.api.__step(.4);
          keepers.push({ seed, keeper, keeperPass, afterPassRole: f.api.status().players.find(p => p.slot === keeper.slot).role });
        }
        supportedShots.push({ seed, accepted, plan, state: f.api.__state() }); f.done();
      }
      const sliding = fixture(11);
      const defender = sliding.api.status().players.find(p => !p.hasBall && p.ready);
      sliding.api.setInput(defender.slot, { x: 0, y: -1 });
      const energy = defender.energy, accepted = sliding.api.action(defender.slot, "slide");
      const cooldownBlocked = !sliding.api.action(defender.slot, "slide"); sliding.api.__step(.2);
      const slid = sliding.api.status().players.find(p => p.slot === defender.slot);
      const sprites = [...sliding.host.shadowRoot.querySelectorAll("svg [transform]")].length;
      const stats = sliding.api.__stats(); sliding.done();
      return { directions, passed, passPlan, received, passOwner, supportedShots, keepers, slide: { accepted, cooldownBlocked, energy, slid, sprites, stats } };
    });
    for (const result of aiming.directions) {
      assert(result.accepted && result.arrow.startsWith("M"));
      assert.deepEqual(result.aim, [result.x, result.y], "Aim must persist after key release");
      const du = result.kick.target[0] - result.kick.origin[0], dv = result.kick.target[1] - result.kick.origin[1];
      const dx = du * 684 + dv * 352, dy = du * -387 + dv * 231;
      const dot = (dx * result.x + dy * result.y) / Math.hypot(dx, dy);
      assert(dot > .999, `Free ${result.action} must follow its screen direction`);
    }
    assert(aiming.passed && aiming.passPlan.assisted && aiming.passPlan.receiver);
    assert.equal(aiming.passOwner, aiming.passPlan.receiver);
    assert(aiming.received.players.some(p => p.hasBall && p.name === aiming.passOwner), "Receiver must immediately be selected");
    for (const shot of aiming.supportedShots) {
      assert(shot.accepted && shot.plan.assisted);
      assert(shot.plan.target[1] > .4 && shot.plan.target[1] < .6, "Support shots must aim inside goal posts");
      assert(shot.plan.target[0] === 0 || shot.plan.target[0] === 1);
    }
    assert(aiming.keepers.length > 0, "Goalkeepers must still be able to save support shots");
    assert(aiming.keepers.every(result => result.keeperPass), "Ball-holding keepers must be selected and able to pass");
    assert(aiming.keepers.every(result => result.afterPassRole !== "GK"), "Control must leave the keeper after releasing the ball");
    assert(aiming.slide.accepted && aiming.slide.cooldownBlocked && aiming.slide.stats.slides === 1);
    assert(aiming.slide.slid.energy < aiming.slide.energy, "Sliding must consume stamina");
    console.log("PASS persistent aim arrows, free passing/shooting in all four directions, accurate support, keeper control, slide and cooldown");

    await route("#/local");
    await page.evaluate(() => { document.querySelector("#panel-local .match-host").dataset.seed = "42"; });
    for (const [idA, idB] of [["liverpool", "man-utd"], ["real-madrid", "juventus"]]) for (const side of ["left", "right"]) {
      await route("#/local");
      await choose("local", "clubA", idA); await choose("local", "clubB", idB);
      await choose("local", "side", side);
      await startMatch("local");
      const state = await page.evaluate(() => {
        const api = document.querySelector("#panel-local .match-host").__ptscFootball;
        api.pause(); api.__step(3);
        for (let i = 0; i < 60 && api.status().phase !== "play"; i++) api.__step(.5);
        api.__step(.7);
        const roster = api.roster(), teams = api.teams();
        return { status: api.status(), stats: api.__stats(), teams, roster, clubs: Object.fromEntries(["R", "B"].map(t => [t, PTSCTeams.get(teams[t].id).players.map(p => p.name)])) };
      });
      assert.equal(state.status.players[0].team, "R"); assert.equal(state.status.players[1].team, "B");
      assert.equal(state.status.leftTeam, side === "left" ? "B" : "R");
      assert.equal(state.stats.onPitch.R, 6); assert.equal(state.stats.onPitch.B, 6);
      assert.equal(state.stats.storyGoals.length, 0, "Play modes must not script goals");
      assert.equal(state.teams.R.id, idA); assert.equal(state.teams.B.id, idB);
      for (const t of ["R", "B"]) {
        const nine = state.roster[t];
        assert.equal(nine.length, 9, "Nine players per side");
        assert(nine.every(p => state.clubs[t].includes(p.name)), "Every player comes from his club: " + JSON.stringify(nine.map(p => p.name)));
        const lines = { GK: 0, DF: 0, MF: 0, FW: 0 }; for (const p of nine) lines[p.role]++;
        assert.deepEqual(lines, { GK: 1, DF: 3, MF: 2, FW: 3 }, "One keeper, three defenders, two midfielders, three forwards: " + JSON.stringify(lines));
        assert.equal(new Set(nine.map(p => p.num)).size, 9, "Shirt numbers are unique");
        assert(nine.every(p => Object.values(p.stats).every(v => v >= 1 && v <= 99)), "Fixed ratings are used as given");
      }
      assert(state.teams.R.colors.kit === "home", "The first club wears its home kit");
      if (idA === "liverpool") assert.equal(state.teams.B.colors.kit, "away", "A red-on-red clash puts the second club in its away kit");
      if (idA === "real-madrid") assert.equal(state.teams.B.colors.kit, "away", "White on white-striped puts Juventus in pink");
      assert.notEqual(state.teams.R.colors.gk, state.teams.R.colors.shirt);
    }
    console.log("PASS club selection for both sides, random nines spread over the lines, kit clashes resolved");

    // New matches wait for Space; the engine loop is then frozen so the test steps it by hand.
    await page.locator("#panel-local .arena").focus(); await page.keyboard.press("Space");
    const before = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball; api.pause();
      for (let i = 0; i < 600 && !(api.status().players.every(player => player.ready) && api.status().players.some(player => player.hasBall)); i++) __stepPlay(api, .1);
      return api.status();
    });
    assert.equal(before.phase, "play");
    assert(before.players.every(player => player.ready), "Both players must be ready before testing movement");
    await page.keyboard.down("d"); await page.keyboard.down("ArrowLeft");
    const after = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      api.__step(.15); return api.status();
    });
    await page.keyboard.up("d"); await page.keyboard.up("ArrowLeft");
    const screenX = position => position[0] * 684 + position[1] * 352;
    assert(screenX(after.players[0].position) > screenX(before.players[0].position), "A must move screen right: " + JSON.stringify({ before, after }));
    assert(screenX(after.players[1].position) < screenX(before.players[1].position), "B must move screen left simultaneously: " + JSON.stringify({ before, after }));
    assert(after.players[0].energy < before.players[0].energy && after.players[1].energy < before.players[1].energy);
    console.log("PASS simultaneous keyboard control, screen direction, energy loss");

    const possessionSlot = after.players.find(p => p.hasBall)?.slot;
    assert(possessionSlot, "Kickoff should leave a human carrier: " + JSON.stringify({ before: before.players.map(p => [p.slot, p.hasBall, p.ready]), after: after.players.map(p => [p.slot, p.hasBall]), phase: after.phase, stop: after.stoppage, note: after.note }));
    const shotsBefore = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().shots);
    await page.keyboard.press(possessionSlot === "A" ? "g" : "k");
    await page.waitForFunction(shots => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().shots > shots, shotsBefore);
    const shotsAfter = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().shots);
    assert.equal(shotsAfter, shotsBefore + 1, "Shoot key must shoot");
    console.log("PASS human shooting key");

    await page.keyboard.press("Escape");
    assert(await page.locator("#panel-local .start-overlay").isVisible(), "Esc opens the match menu");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.act), "resume", "The match menu opens on Resume");
    await page.locator("#panel-local .support-button").click();
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.status().support), false);
    assert.equal(await page.locator("#panel-local .support-button").getAttribute("aria-pressed"), "false");
    await page.locator("#panel-local .support-button").click();
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.status().support), true);
    await page.keyboard.press("Space");
    assert(await page.locator("#panel-local .start-overlay").isHidden(), "Space resumes from the match menu");
    assert.equal(await page.evaluate(() => document.activeElement.className), "arena", "Support toggle should return keyboard focus to the pitch");
    const slideSlot = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      for (let i = 0; i < 400 && !api.status().players.some(p => p.slideReady); i++) __stepPlay(api, .05);
      return api.status().players.find(p => p.slideReady)?.slot;
    });
    assert(slideSlot, "A defender must become ready to slide");
    const slidesBefore = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().slides ?? 0);
    await page.locator("#panel-local .arena").focus();
    await page.keyboard.press(slideSlot === "A" ? "g" : "k");
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().slides), slidesBefore + 1);
    console.log("PASS live support toggle and slide key binding");
    const buttonSlot = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      for (let i = 0; i < 500 && !api.status().players.some(p => p.slideReady); i++) __stepPlay(api, .05);
      return api.status().players.find(p => p.slideReady)?.slot;
    });
    const slideButton = page.locator(`#panel-local .slide-action[data-slot="${buttonSlot}"]`);
    await page.waitForFunction(slot => !document.querySelector(`#panel-local .slide-action[data-slot="${slot}"]`).disabled, buttonSlot);
    const beforeButton = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().slides ?? 0);
    await slideButton.click();
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().slides), beforeButton + 1);
    assert.equal(await page.evaluate(() => document.activeElement.className), "arena");
    console.log("PASS visible slide button and keyboard focus restoration");

    const mechanics = await page.evaluate(() => {
      const counts = { foul: 0, win: 0, yellow: 0, red: 0 };
      for (let i = 0; i < 100; i++) counts[PTSCFootball.rules.challengeOutcome((i + .5) / 100)]++;
      function fixture(seed) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none" });
        for (let i = 0; i < 700 && !api.status().players.some(p => p.hasBall && p.ready); i++) __stepPlay(api, .05);
        return { api, host, destroy() { api.destroy(); host.remove(); } };
      }
      const kicks = [];
      // A defender may win the ball during a long charge; the first seed where the carrier keeps it is measured.
      for (const action of ["pass", "shoot"]) for (const hold of [.1, .75]) {
        let sample = null;
        for (const seed of [7, 3, 5, 9, 11, 13, 17, 19]) {
          const f = fixture(seed), owner = f.api.status().players.find(p => p.hasBall && p.ready);
          const started = f.api.beginCharge(owner.slot, action); f.api.__step(hold);
          const charging = f.api.status().players.find(p => p.slot === owner.slot).charge;
          const barVisible = Number(f.host.shadowRoot.querySelector(`[data-id="power-${owner.slot}"]`).getAttribute("opacity"));
          const released = f.api.releaseCharge(owner.slot), kick = f.api.__state().kick;
          sample = { action, hold, seed, started, charging, barVisible, released, kick }; f.destroy();
          if (released) break;
        }
        kicks.push(sample);
      }
      const special = fixture(7), shooter = special.api.status().players.find(p => p.hasBall && p.ready);
      const beforeEnergy = shooter.energy;
      special.api.beginCharge(shooter.slot, "shoot");
      const specialAccepted = special.api.releaseCharge(shooter.slot, { special: true, power: .6 });
      const specialState = special.api.status().players.find(p => p.slot === shooter.slot), specialKick = special.api.__state().kick;
      special.destroy();
      const outcomes = [], pressSamples = [];
      for (let seed = 1; seed <= 128; seed++) {
        const f = fixture(seed); let attempted = false, actor = null;
        const first = f.api.status(), owner = first.players.find(p => p.hasBall), defender = first.players.find(p => !p.hasBall);
        if (!owner || !defender) { f.destroy(); continue; }
        const distance = (a,b) => Math.hypot((a.position[0]-b.position[0])*45,(a.position[1]-b.position[1])*30);
        const initialDistance = distance(owner, defender), foulsBefore = f.api.__stats().challenges ?? 0;
        let cardsBefore = null;
        f.api.setInput(defender.slot, { pressing: true }); f.api.__step(.5);
        const later = f.api.status();
        pressSamples.push({ initialDistance, distance: distance(later.players.find(p=>p.slot===owner.slot),later.players.find(p=>p.slot===defender.slot)), noChallenge: (f.api.__stats().challenges ?? 0) === foulsBefore });
        for (let i = 0; i < 500 && !attempted; i++) {
          const state = f.api.status(), holder = state.players.find(p => p.hasBall && p.role !== "GK");
          const d = state.players.find(p => holder && p.team !== holder.team);
          if (d) { f.api.setInput(d.slot, { pressing: true }); if (d.ready) { const stats = f.api.__stats(); cardsBefore = { yellows: stats.yellows, reds: stats.reds }; attempted = f.api.action(d.slot, "challenge"); actor = d; } }
          __stepPlay(f.api, .05);
        }
        if (attempted) {
          // Cards come after any argument; count them once the referee has finished with the stoppage.
          f.api.__step(.3);
          for (let i = 0; i < 120 && f.api.status().stoppage && f.api.status().phase === "play" && !f.api.status().freeKick?.ready; i++) f.api.__step(.1);
          const stats = f.api.__stats(), results = stats.challengeResults;
          if (results) {
            const outcome = Object.keys(results).find(key => results[key] > 0);
            const cards = [...f.host.shadowRoot.querySelectorAll('[data-id^="yellow-"]')].filter(n => Number(n.getAttribute('opacity')) === 1).length;
            outcomes.push({ seed, outcome, yellows: stats.yellows - cardsBefore.yellows, reds: stats.reds - cardsBefore.reds, cards });
          }
        }
        f.destroy();
        if (seed >= 32 && ["foul", "win", "yellow", "red"].every(kind => outcomes.some(p => p.outcome === kind))) break;
      }
      return { counts, kicks, pressSamples, outcomes, specialAccepted, beforeEnergy, specialState, specialKick };
    });
    assert.deepEqual(mechanics.counts, { foul: 30, win: 50, yellow: 15, red: 5 });
    for (const action of ["pass", "shoot"]) {
      const [low, high] = mechanics.kicks.filter(k => k.action === action);
      assert(low.started && high.started && low.released && high.released);
      assert(low.barVisible > 0 && high.barVisible > 0);
      assert(high.kick.power > low.kick.power && high.kick.arc > low.kick.arc);
      if (action === "shoot") assert(high.kick.height > low.kick.height);
    }
    assert(mechanics.specialAccepted && mechanics.specialKick.special);
    assert(mechanics.beforeEnergy - mechanics.specialState.energy >= .07 && mechanics.beforeEnergy - mechanics.specialState.energy <= .19, "A special shot costs about 15% times the stamina factor");
    assert(mechanics.pressSamples.every(p => p.noChallenge), "Holding press must not trigger advanced challenges");
    assert(mechanics.pressSamples.some(p => p.distance < p.initialDistance - .5), "Pressing must automatically close distance");
    assert(mechanics.outcomes.some(p => p.outcome === "yellow" && p.yellows > 0 && p.cards > 0), "Yellow card must appear above a genuinely booked player");
    // A red-graded challenge is a straight red only when the match drew the red-card plan; otherwise it is booked.
    assert(mechanics.outcomes.filter(p => p.outcome === "red").every(p => p.reds + p.yellows > 0), "Red-graded challenges must always be carded: " + JSON.stringify(mechanics.outcomes));
    assert(mechanics.outcomes.filter(p => p.outcome === "foul").every(p => p.yellows === 0 && p.reds === 0), "Foul-only category must never add a card");
    console.log("PASS charged low/high passes and shots, special shot stamina, hold pressing, exact probability thresholds, actual yellow/red cards and overhead indicators");

    await page.locator("#panel-local .fullscreen").click();
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById("game"));
    assert.equal(await page.locator("#panel-local .arena-hints").evaluate(el => getComputedStyle(el).opacity), "0.3");
    assert(!/×2|thần sầu|30%|nhấn hai/i.test(await page.locator("#panel-local .arena-hints").textContent()), "In-pitch guide must only show basic controls");
    await page.screenshot({ path: path.join(artifacts, "fullscreen.png") });
    await page.locator("#panel-local .fullscreen").click();
    await page.waitForFunction(() => !document.fullscreenElement);
    console.log("PASS fullscreen, 30% opacity basic guide, advanced instructions outside pitch");

    await startMatch("local"); await page.keyboard.press("Space");
    const readyForSkill = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      api.pause();
      for (let i = 0; i < 500 && !api.status().players.some(p => p.hasBall && p.ready); i++) __stepPlay(api, .05);
      return api.status().players.find(p => p.hasBall && p.ready);
    });
    const shootKey = readyForSkill.slot === "A" ? "g" : "k";
    await page.keyboard.press(shootKey); await page.keyboard.press(shootKey);
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().specialShots), 1);
    console.log("PASS two quick shoot taps trigger exactly one advanced special shot");

    await startMatch("local"); await page.keyboard.press("Space");
    const pressingSlot = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball; api.pause();
      for (let i = 0; i < 500 && !api.status().players.some(p => p.hasBall && p.ready); i++) __stepPlay(api, .05);
      return api.status().players.find(p => !p.hasBall).slot;
    });
    const pressKey = pressingSlot === "A" ? "v" : "n";
    await page.keyboard.down(pressKey);
    const heldPress = await page.evaluate(slot => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      const metres = (a,b) => Math.hypot((a.position[0]-b.position[0])*45,(a.position[1]-b.position[1])*30);
      const initial = api.status().players, before = metres(initial[0],initial[1]);
      const readyClose = () => { const s = api.status(), d = s.players.find(p => p.slot === slot), c = s.players.find(p => p.slot !== slot); return metres(...s.players) <= 2.3 && d.ready && c.hasBall && api.__state().owner === c.name && api.__state().ball === "carried"; };
      for (let i = 0; i < 200 && !readyClose(); i++) __stepPlay(api, .05);
      return { before, after: metres(...api.status().players), state: api.status(), challenges: api.__stats().challenges ?? 0 };
    }, pressingSlot);
    await page.keyboard.up(pressKey); await page.waitForTimeout(350);
    assert((heldPress.after < heldPress.before || heldPress.before <= 2.3) && heldPress.challenges === 0, JSON.stringify({ before: heldPress.before, after: heldPress.after, challenges: heldPress.challenges, players: heldPress.state.players.map(p => [p.slot, p.hasBall, p.pressing, p.position, p.ready]), phase: heldPress.state.phase, stop: heldPress.state.stoppage, note: heldPress.state.note }));
    // Whoever is defending at that moment closes in (the ball may have changed hands), then uses his challenge key.
    const challenger = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      const metres = (a,b) => Math.hypot((a.position[0]-b.position[0])*45,(a.position[1]-b.position[1])*30);
      for (let i = 0; i < 600; i++) {
        const s = api.status(), c = s.players.find(p => p.hasBall), d = s.players.find(p => !p.hasBall);
        const live = c && d && api.__state().owner === c.name && api.__state().ball === "carried";
        if (live && d.ready && metres(c, d) <= 2.3) { api.setInput(d.slot, {}); return d.slot; }
        for (const p of s.players) api.setInput(p.slot, { pressing: live && p === d });
        __stepPlay(api, .05);
      }
      return null;
    });
    assert(challenger, "A defender must get close enough to challenge");
    await page.keyboard.press(challenger === "A" ? "b" : "m");
    const doublePress = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball; api.__step(.2); return api.__stats();
    });
    assert.equal(doublePress.challenges, 1);
    console.log("PASS hold-to-press closes in without challenging; the challenge key triggers one challenge");

    const halftime = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      const initial = api.status().leftTeam;
      api.__fastForward(31);
      for (let i = 0; i < 80 && api.status().leftTeam === initial; i++) __stepPlay(api, .5);
      return { initial, state: api.status() };
    });
    assert.notEqual(halftime.state.leftTeam, halftime.initial, "Both selected sides must swap at halftime");
    console.log("PASS selected sides swap at halftime");

    await page.locator("#panel-local .pause").click();
    const paused = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__state().T);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__state().T), paused);
    console.log("PASS pause freezes match");
    // In a two-player match the plan opens only during a side's own timeout (Q is player A's).
    await page.locator('#panel-local [data-act="resume"]').click(); await page.keyboard.press("KeyQ"); await page.waitForTimeout(150);
    await page.locator('#panel-local [data-act="plan"]').click();
    assert(await page.locator('#panel-local .sheet[data-sheet="plan"]').isVisible(), "The game plan opens from the match menu");
    assert.equal(await page.locator('#panel-local .plan-team').count(), 2);
    await page.keyboard.press("Escape");
    assert(await page.locator('#panel-local .sheet[data-sheet="plan"]').isHidden());
    assert.equal(await page.evaluate(() => document.activeElement.dataset.act), "plan", "Closing a sheet returns to its menu entry");
    await page.locator('#panel-local [data-act="resume"]').click();
    assert(await page.locator("#panel-local .start-overlay").isHidden());
    await page.keyboard.down("Tab");
    assert(await page.locator('#panel-local .sheet[data-sheet="squad"].is-peek').isVisible(), "Holding Tab shows the rating cards during play");
    await page.keyboard.up("Tab");
    assert(await page.locator('#panel-local .sheet[data-sheet="squad"]').isHidden(), "Releasing Tab hides them");
    console.log("PASS match menu: game plan sheet, Esc back to its entry, Tab peek");
    await page.locator("#panel-local").screenshot({ path: path.join(artifacts, "two-player.png") });

    await route("#/cpu");
    await page.evaluate(() => { document.querySelector("#panel-cpu .match-host").dataset.seed = "42"; });
    await choose("cpu", "clubA", "psg"); await choose("cpu", "clubB", "random");
    await startMatch("cpu");
    const cpu = await page.evaluate(() => {
      const api = document.querySelector("#panel-cpu .match-host").__ptscFootball;
      api.pause();
      for (let i = 0; i < 800 && !api.status().ended && (api.__stats().shots === 0 || api.__stats().subs === 0); i++) __stepPlay(api, .5);
      return { status: api.status(), stats: api.__stats(), energy: api.__energy() };
    });
    assert.equal(cpu.status.players.length, 1); assert.equal(cpu.status.players[0].team, "R");
    assert.equal(cpu.status.teamInfo.R.id, "psg"); assert.notEqual(cpu.status.teamInfo.B.id, "psg", "A random opponent is never your own club");
    assert(cpu.stats.shots > 0, "CPU must play and shoot: " + JSON.stringify(cpu));
    assert(cpu.stats.subs > 0, "Original automatic substitutions must still happen");
    assert(Object.values(cpu.energy).some(energy => energy < .85), "Original fatigue must still happen");
    console.log(`PASS CPU opposition, fatigue, ${cpu.stats.subs} automatic substitutions`);

    const drawnMatch = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "local", seed: 3, still: 0, fonts: "none" });
      api.__step(3); api.__fastForward(31); api.__step(30); api.__fastForward(61);
      for (let i = 0; i < 160 && !api.status().ended; i++) __stepPlay(api, .5);
      const ended = api.status(); api.__step(20); const later = api.status();
      api.destroy(); host.remove(); return { ended, later };
    });
    assert(drawnMatch.ended.ended && drawnMatch.ended.phase === "draw", "Human play must allow a draw: " + JSON.stringify(drawnMatch));
    assert.equal(drawnMatch.ended.winner, null);
    assert.equal(drawnMatch.later.phase, "draw", "Finished human games must not automatically restart");
    console.log("PASS human draw and finished-game lifecycle");
    await page.locator("#panel-cpu").screenshot({ path: path.join(artifacts, "cpu.png") });

    // Free kicks wait for a human however long it takes; defenders stay 5 m away the whole time.
    const freeKickGap = await page.evaluate(() => {
      const gaps = [];
      for (let seed = 1; seed <= 12 && gaps.length < 4; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "cpu", seed, still: 0, fonts: "none", duration: 6 });
        let waited = 0;
        for (let i = 0; i < 3000 && !api.status().ended && gaps.length < 4; i++) {
          const s = api.status();
          if (s.freeKick?.slot === "A" && s.freeKick.ready && ++waited > 80) { gaps.push(api.__fkDistance()); api.action("A", "pass"); waited = 0; }
          else if (s.freeKick?.slot !== "A") { __takeRestart(api); if (i % 5 === 0) { api.setInput("A", { pressing: true }); api.action("A", "challenge"); } }
          api.__step(.1);
        }
        api.destroy(); host.remove();
      }
      return gaps;
    });
    assert(freeKickGap.length > 0 && freeKickGap.every(gap => gap >= 4.9), "Opponents must keep their distance from a waiting free kick: " + JSON.stringify(freeKickGap));
    console.log("PASS defenders keep 5 m from a free kick the player is still waiting to take");

    // Key layouts: edit, overwrite, save as new, persist across reloads, refuse two-player clashes.
    await route("#/cpu");
    await page.locator("#panel-cpu .keymap-open").click();
    await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/info/keys");
    const editor = page.locator("#screen-info .keymap");
    assert(await editor.isVisible(), "The setup link opens the key layout editor");
    await editor.locator('.keymap-key[data-action="up"]').click();
    await page.keyboard.press("Space");
    assert.match(await editor.locator(".keymap-status").textContent(), /dành cho/, "Space stays reserved for pause");
    await page.keyboard.press("KeyQ");
    await editor.locator('.keymap-key[data-action="special"]').click();
    await page.keyboard.press("KeyD");
    assert.match(await editor.locator(".keymap-status").textContent(), /hoán đổi/, "A key already in the layout is swapped");
    await editor.locator(".keymap-save").click();
    await editor.locator(".keymap-name").fill("Bộ phím thử");
    await editor.locator(".keymap-save-new").click();
    await page.locator(".nav-back").click();
    await page.waitForFunction(() => document.getElementById("game").dataset.route === "#/cpu");
    const savedLayouts = await page.evaluate(() => JSON.parse(localStorage.getItem("ptsc-football.key-layouts.v1")));
    const editedA = savedLayouts.layouts.find(layout => layout.id === "default-a"), custom = savedLayouts.layouts.find(layout => layout.name === "Bộ phím thử");
    assert.deepEqual([editedA.keys.up, editedA.keys.special, editedA.keys.right], ["KeyQ", "KeyD", "KeyE"]);
    assert(custom && custom.id.startsWith("custom-"));
    await choose("cpu", "keysA", custom.id);
    await page.reload();
    await page.waitForFunction(() => window.PTSCKeymap);
    assert.equal(await page.evaluate(() => PTSCKeymap.assigned("cpu", "A").name), "Bộ phím thử", "Layout choice survives a reload");
    assert.equal(await page.locator("#panel-cpu .arena-hints .pad-up").textContent(), "Q", "Guides draw the chosen layout");
    assert(await page.evaluate(() => { const key = document.querySelector("#panel-cpu .controls-browser .kb-key[data-code=\"KeyQ\"]"); return !!key && key.hasAttribute("data-slot"); }), "The controls keyboard marks the chosen keys");
    await route("#/local");
    const rowB = page.locator('#panel-local .opt[data-opt="keysB"]'), seenB = new Set();
    for (let i = 0; i < 4; i++) { await rowB.locator(".opt-next").click(); seenB.add(await rowB.getAttribute("data-value")); }
    assert.deepEqual([...seenB], ["default-b"], "Two players can never share keys");
    assert.equal(await page.locator("#panel-local .opt-desc").getAttribute("data-tone"), "error", "Refused layouts are explained");
    console.log("PASS key layouts: capture, swap, overwrite, save as new, persistence, two-player clash guard");

    // Movement: a direction held through Space (start, pause, resume) keeps moving without pressing it again.
    await route("#/cpu");
    await startMatch("cpu");
    await page.keyboard.down("KeyE");
    await page.keyboard.press("Space");
    const heldStart = await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.__selected("A").input);
    await page.keyboard.press("Space"); await page.keyboard.press("Space");
    const heldResume = await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.__selected("A").input);
    await page.keyboard.up("KeyE");
    const released = await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.__selected("A").input);
    assert.equal(heldStart.x, 1, "Custom right key held before Space must move at kick-off");
    assert.equal(heldResume.x, 1, "Held direction must survive pause and resume");
    assert.equal(released.x, 0);
    await page.evaluate(() => { localStorage.clear(); PTSCKeymap.reload(); });
    console.log("PASS held directions survive start/pause/resume with a custom layout");

    // Penalty scene: the match's own figures, the taker from behind, choices hidden until the ball arrives.
    await route("#/local");
    await startMatch("local"); await page.keyboard.press("Space");
    await page.evaluate(() => { const api = document.querySelector("#panel-local .match-host").__ptscFootball; api.pause(); api.__penalties(); });
    await page.waitForFunction(() => !document.querySelector("#panel-local .penalty-host").hidden);
    const penaltyScene = await page.evaluate(() => {
      const host = document.querySelector("#panel-local .penalty-host"), api = document.querySelector("#panel-local .match-host").__ptscFootball;
      const restartHidden = document.querySelector("#panel-local .restart-choice").hidden;
      api.choosePenalty("A", "left"); api.choosePenalty("B", "right");
      return { shooter: host.querySelector('[data-pen="shooter"] path') !== null, keeper: host.querySelector('[data-pen="keeper"] text')?.textContent, restartHidden, early: host.querySelector(".penalty-message").textContent };
    });
    await page.waitForTimeout(400);
    const earlyMessage = await page.locator("#panel-local .penalty-message").textContent();
    await page.waitForTimeout(1100);
    assert(penaltyScene.shooter && penaltyScene.keeper, "Penalty actors are drawn with the match rig and shirt numbers");
    assert(penaltyScene.restartHidden, "Restart hints must not overlap the penalty choices");
    assert.equal(earlyMessage, "Sút…", "The result stays hidden while the ball is in flight");
    assert.match(await page.locator("#panel-local .penalty-message").textContent(), /VÀO|CẢN|CỨU|BẮT/);
    await page.locator("#panel-local .arena").screenshot({ path: path.join(artifacts, "penalty.png") });
    console.log("PASS penalty scene in match style, hidden result until the ball arrives, no overlapping hints");

    // Skill pictograms: one distinct icon and a one- or two-word label per skill; keeper skills switch on by themselves.
    const skillData = await page.evaluate(() => Object.values(PTSCFootball.data.skills).map(s => ({ icon: s.icon, short: s.short, auto: !!s.auto, role: s.role })));
    assert.equal(new Set(skillData.map(s => s.icon)).size, skillData.length, "Every skill has its own icon");
    assert(skillData.every(s => s.short && s.short.split(" ").length <= 2), "Every skill has a one- or two-word label");
    assert(skillData.filter(s => s.role === "GK" && s.auto).length === 3, "The three keeper skills are automatic");
    await route("#/info/skills");
    const listedSkills = new Set();
    for (const tab of await page.locator("#screen-info .skill-browser .br-tab").all()) { await tab.click(); for (const key of await page.locator("#screen-info .skill-browser .br-item").evaluateAll(items => items.map(i => i.dataset.key))) listedSkills.add(key); }
    assert.equal(listedSkills.size, skillData.length, "Every skill is in the skill browser");
    await page.locator("#screen-info .skill-browser .br-item").first().focus();
    assert(await page.locator("#screen-info .skill-browser .br-detail .bd-badge").isVisible(), "The skill under the cursor has its card");
    await page.keyboard.press("KeyQ");
    assert.equal(await page.locator("#screen-info .skill-browser .br-tab.is-current").textContent(), "Đá phạt & góc", "Q goes to the previous group");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.pane), "skills", "Esc goes back to the section list");
    const keeperAuto = await page.evaluate(() => {
      const runs = [];
      for (let seed = 1; seed <= 6; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none", duration: 10 });
        let active = null;
        for (let i = 0; i < 2000 && !api.status().ended && !active; i++) {
          __stepPlay(api, .2);
          const keeper = api.__keeperSkills().find(k => k.active);
          if (keeper) active = keeper;
        }
        runs.push({ seed, used: api.__stats().keeperAutoSkills ?? 0, active, minuteNow: api.status().minute });
        api.destroy(); host.remove();
      }
      return runs;
    });
    const activated = keeperAuto.filter(r => r.active);
    assert(activated.length > 0, "Keeper skills must switch themselves on: " + JSON.stringify(keeperAuto));
    assert(activated.every(r => r.active.minutesLeft >= 4 && r.active.minutesLeft <= 5), "A keeper skill lasts five match minutes: " + JSON.stringify(activated));
    console.log("PASS distinct skill pictograms with short labels; keeper skills switch on by themselves for five minutes");

    // After a goal nobody kicks off until both sides are back in their own half, the idle selected man included.
    const kickoffShape = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "local", seed: 5, still: 0, fonts: "none" });
      __stepPlay(api, 3);
      api.__shotFrom([0.9, 0.5], { goalProbability: 1, style: "kick" });
      let sawReset = false, kickoff = null;
      for (let i = 0; i < 600 && !kickoff; i++) {
        api.__step(.1);
        const s = api.status();
        if (s.phase === "reset") sawReset = true;
        if (sawReset && s.kickoff) kickoff = { players: api.__players(), score: s.score };
      }
      api.destroy(); host.remove();
      return { sawReset, kickoff };
    });
    assert(kickoffShape.sawReset && kickoffShape.kickoff, "The goal must lead to a kick-off");
    assert(kickoffShape.kickoff.players.every(p => p.d <= .51), "Everyone is back in his own half at the whistle: " + JSON.stringify(kickoffShape.kickoff.players.filter(p => p.d > .51)));
    console.log("PASS kick-off waits for both teams to be back in their own half");

    // Injury: off to the near touchline, into an ambulance, never back in the match; sometimes back on the bench strapped up.
    const injury = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "local", seed: 9, still: 0, fonts: "none" });
      __stepPlay(api, 3);
      const name = api.__injure("leg");
      let back = null, left = false;
      for (let i = 0; i < 900; i++) {
        __stepPlay(api, .1);
        const onPitch = api.__players().some(p => p.name === name);
        if (!onPitch) left = true;
        else if (left) return { name, rejoined: true };
        if (!back && (api.__stats().injuredReturns ?? 0) > 0) back = api.__bench().find(b => b.name === name);
      }
      const stats = api.__stats(); api.destroy(); host.remove();
      return { name, left, rejoined: false, ambulances: stats.ambulances, back };
    });
    assert(injury.left && !injury.rejoined, "An injured man leaves and never plays again in that match: " + JSON.stringify(injury));
    assert.equal(injury.ambulances, 1, "An ambulance takes the injured man away");
    assert(injury.back && injury.back.bandage === "leg" && !injury.back.off, "He can come back to the bench strapped up: " + JSON.stringify(injury));
    console.log("PASS injuries: ambulance, no return to play, back on the touchline with a bandage");

    // Playing styles: an attacking and a defensive one per player, suited to his position, each changing where he plays.
    const styles = await page.evaluate(() => {
      const acc = { attack: {}, defense: {} }, roles = [];
      for (let seed = 1; seed <= 10; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none" });
        for (const p of api.__players()) roles.push([p.role, p.attack, p.defense]);
        for (let i = 0; i < 900 && !api.status().ended; i++) {
          api.__step(.2);
          if (api.status().phase !== "play" || api.status().stoppage) continue;
          for (const p of api.__players()) {
            const phase = p.poss ? "attack" : "defense", id = p[phase], a = acc[phase][id] ??= { d: 0, n: 0 };
            a.d += p.d; a.n++;
          }
        }
        api.destroy(); host.remove();
      }
      const mean = table => Object.fromEntries(Object.entries(table).map(([k, a]) => [k, a.d / a.n]));
      return { roles, attack: mean(acc.attack), defense: mean(acc.defense) };
    });
    const styleTable = await page.evaluate(() => PTSCFootball.data.playstyles);
    assert(Object.keys(styleTable.attack).length < 22 && Object.keys(styleTable.defense).length < 22, "Only a selection of styles suits a small pitch");
    assert(styles.roles.every(([role, attack, defense]) => styleTable.attack[attack]?.roles.includes(role) && styleTable.defense[defense]?.roles.includes(role)), "Every player has an attacking and a defensive style for his position");
    const ordered = (phase, low, high) => {
      const table = styles[phase];
      if (table[low] != null && table[high] != null) assert(table[low] < table[high], `${low} must play deeper than ${high}: ` + JSON.stringify(table));
    };
    ordered("attack", "pivot", "drill"); ordered("attack", "metronome", "lateArrival"); ordered("attack", "launcher", "stepUp");
    ordered("defense", "shadow", "coiled"); ordered("defense", "shield", "breaker"); ordered("defense", "bulwark", "trap"); ordered("defense", "lineGuard", "libero");
    assert(Object.values(styleTable.attack).concat(Object.values(styleTable.defense)).every(st => st.name && st.tag && st.desc && !("en" in st)), "Every style has its own name, a short tag and a description");
    assert(await page.locator("#screen-info .style-browser .br-tab").count() === 4, "Styles are grouped by zone");
    assert(await page.locator("#screen-info .skill-browser .br-tab").count() === 5, "Skills are grouped by situation");
    console.log("PASS attacking and defensive playing styles fit positions, change where players stand, grouped legends");

    // Ratings: every player has ten, in range, shaped by his styles; squads can be supplied as data with fixed ratings.
    const ratings = await page.evaluate(() => {
      const rules = PTSCFootball.data.stats, all = [];
      for (let seed = 1; seed <= 12; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none" });
        for (const list of Object.values(api.roster())) all.push(...list);
        api.destroy(); host.remove();
      }
      const custom = { R: { players: [
        { name: "Thủ Thành", head: "buzz", skin: 1, num: 1, stats: { goalkeeping: 92 } }, { name: "Hậu A", head: "spiky", skin: 1, num: 2 }, { name: "Hậu B", head: "curly", skin: 2, num: 3 },
        { name: "Tiền Vệ", head: "beard", skin: 1, num: 8 }, { name: "Sát Thủ", head: "quiff", skin: 2, num: 9, stats: { finishing: 95, speed: 90 }, attack: "drill", defense: "coiled" },
        { name: "Cánh Phải", head: "glasses", skin: 1, num: 11 }], bench: [{ name: "Dự Bị", head: "buzz", skin: 2, num: 12, natural: "DF" }] } };
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "cpu", seed: 4, still: 0, fonts: "none", squads: JSON.stringify(custom) });
      const roster = api.roster(); api.destroy(); host.remove();
      return { rules: { keys: rules.keys, range: rules.range }, all, roster };
    });
    assert(ratings.all.every(p => ratings.rules.keys.every(k => p.stats[k] >= ratings.rules.range[0] && p.stats[k] <= ratings.rules.range[1]) && p.ovr >= 35 && p.ovr <= 95), "Ratings stay within 35–95");
    const mean = (list, key) => list.reduce((s, p) => s + p.stats[key], 0) / list.length;
    const forwards = ratings.all.filter(p => p.role === "FW");
    assert(mean(ratings.all.filter(p => p.role === "GK"), "goalkeeping") > 70 && mean(ratings.all.filter(p => p.role !== "GK"), "goalkeeping") < 40, "Only keepers can keep goal");
    const striker = ratings.roster.R.find(p => p.name === "Sát Thủ");
    assert(striker && striker.stats.finishing === 95 && striker.stats.speed === 90 && striker.attack === "Mũi khoan" && striker.defense === "Lò xo", "Squads given as data keep fixed ratings and styles: " + JSON.stringify(striker));
    assert.equal(ratings.roster.R.find(p => p.name === "Thủ Thành").stats.goalkeeping, 92);
    assert(ratings.roster.B.some(p => p.name === "Vũ"), "A team without custom data keeps the default squad");
    const localPlan = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.plan());
    assert(["R", "B"].every(t => localPlan[t].players.length === 6 && [...localPlan[t].players, ...localPlan[t].bench].every(p => Object.keys(p.stats).length === 10)), "Both squads are listed with ratings");
    const styleFree = await page.evaluate(() => {
      const base = { name: "A", head: "buzz", skin: 1, num: 9, stats: { speed: 80, dribbling: 80, passing: 80, longPass: 80, finishing: 80, heading: 80, defending: 80, strength: 80, stamina: 80, goalkeeping: 20 } };
      const squad = attack => ({ players: [{ ...base, name: "K", num: 1, stats: { ...base.stats, goalkeeping: 80 } }, { ...base, name: "D1", num: 2 }, { ...base, name: "D2", num: 3 }, { ...base, name: "M", num: 4 }, { ...base, name: "F1", num: 5, attack }, { ...base, name: "F2", num: 6 }] });
      const read = attack => { const host = document.createElement("div"); document.body.append(host); const api = PTSCFootball.mount(host, { mode: "local", seed: 2, still: 0, fonts: "none", squads: { R: squad(attack) } }); const p = api.roster().R.find(x => x.name === "F1"); api.destroy(); host.remove(); return { stats: p.stats, attack: p.attack, height: p.body.height }; };
      return [read("pivot"), read("slalom")];
    });
    assert.deepEqual(styleFree[0].stats, styleFree[1].stats, "A playing style changes behaviour, never the ratings");
    assert.notEqual(styleFree[0].attack, styleFree[1].attack);
    console.log("PASS player ratings: ten per player in range, fixed by data, untouched by playing styles, roster tables");

    // Skills: always work, defensive ones last half as long again, and positions sometimes get the other kind.
    const skillMix = await page.evaluate(() => {
      const rules = PTSCFootball.data.skillRules, skills = PTSCFootball.data.skills, rows = [];
      let uses = 0, successes = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none" });
        for (const list of Object.values(api.roster())) rows.push(...list.filter(p => p.onPitch).map(p => ({ role: p.role, skill: p.skill, pen: p.penaltySkill })));
        if (seed <= 6) { for (let i = 0; i < 1200 && !api.status().ended; i++) api.__step(.25); const st = api.__stats(); uses += st.specialUses ?? 0; successes += st.specialFired ?? 0; }
        api.destroy(); host.remove();
      }
      const isAttack = id => skills[id]?.contexts.includes("attack");
      return { rules, rows, uses, successes, attackingDefenders: rows.filter(r => r.role === "DF" && isAttack(r.skill)).length, attackingKeepers: rows.filter(r => r.role === "GK" && isAttack(r.skill)).length,
        keepers: rows.filter(r => r.role === "GK").length, savers: rows.filter(r => r.role === "GK" && r.pen === "penaltySaver").length,
        outfield: rows.filter(r => r.role !== "GK").length, shooters: rows.filter(r => r.role !== "GK" && r.pen === "penaltyFinisher").length };
    });
    assert.equal(skillMix.rules.defenseDuration, skillMix.rules.duration * 1.5, "Defensive skills last 50% longer than attacking ones");
    assert(skillMix.uses > 0 && skillMix.successes === skillMix.uses, "Every skill used fires: " + JSON.stringify({ uses: skillMix.uses, successes: skillMix.successes }));
    assert(skillMix.attackingDefenders > 0 && skillMix.attackingKeepers > 0, "Defenders and keepers sometimes carry attacking skills");
    const saverShare = skillMix.savers / skillMix.keepers, shooterShare = skillMix.shooters / skillMix.outfield;
    assert(saverShare > .3 && saverShare < .7 && shooterShare > .15 && shooterShare < .45, "Penalty specialists are a minority: " + JSON.stringify({ saverShare, shooterShare }));
    console.log("PASS skills always work, defensive skills last longer, mixed skills by position, rare penalty specialists");

    // Corners only come from a real touch: a defender blocking the shot or the keeper pushing it out.
    const cornerCauses = await page.evaluate(() => {
      const rows = [];
      for (let seed = 1; seed <= 12; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none" });
        for (let i = 0; i < 1500 && !api.status().ended; i++) api.__step(.25);
        const st = api.__stats(); rows.push({ corners: st.corners, touched: (st.deflections ?? 0) + (st.parriedOut ?? 0) });
        api.destroy(); host.remove();
      }
      return rows;
    });
    assert(cornerCauses.every(r => r.corners <= r.touched), "Every corner follows a defender's block or a keeper's parry: " + JSON.stringify(cornerCauses));
    console.log("PASS corners only after a real touch by a defender or the keeper");

    // Holding the press key follows: the man on the ball, the man a pass goes to, or a loose ball; it stops on release.
    const pressFollow = await page.evaluate(() => {
      let steps = 0, moving = 0, closing = 0, released = null;
      for (let seed = 1; seed <= 4; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "cpu", seed, still: 0, fonts: "none", duration: 4 });
        let prev = null;
        for (let i = 0; i < 1200 && !api.status().ended; i++) {
          __takeRestart(api);
          const s = api.status(), me = s.players[0], defending = s.possession && s.possession !== me.team && s.phase === "play" && !s.stoppage;
          api.setInput("A", { pressing: defending });
          api.__step(.1);
          const now = api.__selected("A");
          if (defending && me.pressing && prev && prev.name === now.name) {
            steps++;
            if (Math.hypot((now.pos[0] - prev.pos[0]) * 45, (now.pos[1] - prev.pos[1]) * 30) > .05) moving++;
          }
          if (defending && api.status().players[0].pressing && api.status().players[0].ready && !released && i > 200) {
            api.setInput("A", {}); const a = api.__selected("A"); api.__step(.2); const b = api.__selected("A");
            if (a.name === b.name && api.status().players[0].ready) released = Math.hypot((b.pos[0] - a.pos[0]) * 45, (b.pos[1] - a.pos[1]) * 30);
          }
          prev = now;
        }
        api.destroy(); host.remove();
      }
      return { steps, moving, released };
    });
    assert(pressFollow.steps > 50 && pressFollow.moving / pressFollow.steps > .85, "Holding the press key keeps following: " + JSON.stringify(pressFollow));
    assert(pressFollow.released != null && pressFollow.released < .2, "Releasing the press key stops him: " + JSON.stringify(pressFollow));
    console.log("PASS press key held follows the man or the ball, release stops");

    // Difficulty: only the computer's side changes, its whole squad shifted in rating.
    const levels = await page.evaluate(() => {
      const meanOvr = (difficulty, seed) => {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "cpu", teamA: "R", difficulty, seed, still: 0, fonts: "none" });
        const roster = api.roster(), status = api.status(); api.destroy(); host.remove();
        const avg = list => list.reduce((s, p) => s + p.ovr, 0) / list.length;
        return { human: avg(roster.R), cpu: avg(roster.B), name: status.difficulty?.name };
      };
      return ["easy", "normal", "hard", "legend"].map(level => ({ level, ...meanOvr(level, 21) }));
    });
    assert.deepEqual(levels.map(l => l.name), ["Dễ", "Thường", "Khó", "Huyền thoại"]);
    assert(levels.every(l => Math.abs(l.human - levels[1].human) < .01), "The player's side is never changed by the level");
    assert(levels[0].cpu < levels[1].cpu && levels[1].cpu < levels[2].cpu && levels[2].cpu < levels[3].cpu, "Harder levels field a stronger computer side: " + JSON.stringify(levels));
    const oddLevel = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "cpu", difficulty: "constructor", seed: 3, still: 0, fonts: "none" });
      const result = { name: api.status().difficulty.name, finite: Object.values(api.roster()).flat().every(p => Object.values(p.stats).every(Number.isFinite)) };
      api.destroy(); host.remove(); return result;
    });
    assert.deepEqual(oddLevel, { name: "Thường", finite: true }, "An unknown level falls back to normal");
    console.log("PASS AI difficulty: four levels shift only the computer's squad");

    // On the ball, the switch key sends the team-mate in the arrow's direction on a run at goal.
    const runCall = await page.evaluate(() => {
      for (let seed = 1; seed <= 20; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none" });
        for (let i = 0; i < 300; i++) {
          __stepPlay(api, .05);
          const p = api.status().players.find(x => x.hasBall && x.ready && x.role !== "GK");
          if (!p) continue;
          const before = api.__players().filter(x => x.team === p.team && x.name !== p.name).map(x => ({ name: x.name, d: x.d }));
          api.setInput(p.slot, { x: p.team === api.status().leftTeam ? 1 : -1, y: 0 }); api.setInput(p.slot, {});
          const ok = api.action(p.slot, "switch"), stillOwner = api.status().players.find(x => x.slot === p.slot).name === p.name;
          api.__step(1.2);
          const after = api.__players().filter(x => x.team === p.team);
          const advanced = before.map(b => (after.find(a => a.name === b.name)?.d ?? b.d) - b.d);
          const result = { ok, stillOwner, runs: api.__stats().runsCalled ?? 0, best: Math.max(...advanced) };
          api.destroy(); host.remove();
          return result;
        }
        api.destroy(); host.remove();
      }
      return null;
    });
    assert(runCall && runCall.ok && runCall.stillOwner && runCall.runs === 1, "The switch key on the ball calls a run and keeps control: " + JSON.stringify(runCall));
    assert(runCall.best > 0.08, "The called team-mate runs towards goal: " + JSON.stringify(runCall));
    console.log("PASS switch key on the ball calls a team-mate's run at goal");

    // Cards for every side: the computer's side and both sides when watching.
    await route("#/cpu");
    await startMatch("cpu"); await page.keyboard.press("Space"); await page.waitForTimeout(600);
    const cpuCards = await page.evaluate(() => [...document.querySelectorAll("#panel-cpu .player-card")].map(c => ({ controller: c.dataset.controller, ovr: c.querySelector(".pc-ovr b").textContent, stats: c.querySelectorAll(".pc-stat").length })));
    assert.deepEqual(cpuCards.map(c => c.controller), ["A", "cpu"]);
    assert(cpuCards.every(c => /^\d+$/.test(c.ovr) && c.stats === 10), "Both cards show a rating and ten stats: " + JSON.stringify(cpuCards));
    assert.equal(await page.locator("#panel-cpu .arena-energy .energy-player").count(), 2, "The computer's stamina and skill are on the pitch too");
    await page.keyboard.press("Space");
    await route("#/watch");
    await page.waitForFunction(() => [...document.querySelectorAll("#panel-watch .player-card .pc-id strong")].every(n => n.textContent !== "Chuẩn bị"), null, { timeout: 5000 }).catch(() => {});
    const watchCards = await page.evaluate(() => [...document.querySelectorAll("#panel-watch .player-card")].map(c => ({ team: c.dataset.team, name: c.querySelector(".pc-id strong").textContent, ovr: c.querySelector(".pc-ovr b").textContent })));
    assert.deepEqual(watchCards.map(c => c.team), ["R", "B"]);
    assert(watchCards.every(c => c.name !== "Chuẩn bị" && /^\d+$/.test(c.ovr)), "Watching shows both sides' players: " + JSON.stringify(watchCards));
    assert(await page.evaluate(() => { const plan = document.getElementById("watch-match").__ptscFootball.plan(); return !plan.R.coached && !plan.B.coached && plan.R.players.length === 6; }), "Watching lists both squads, view only");
    await route("#/cpu");
    console.log("PASS info cards for the computer's side and for both sides when watching");

    // In-game navigation: everything reachable from inside the stage, with the cursor where the player expects it.
    const routeIs = hash => page.waitForFunction(h => document.getElementById("game").dataset.route === h, hash);
    const activeAct = () => page.evaluate(() => document.activeElement.dataset.act ?? document.activeElement.className);
    await startMatch("cpu"); await page.keyboard.press("Space"); await page.keyboard.press("Escape");
    await page.locator('#panel-cpu [data-act="setup"]').click(); await routeIs("#/cpu");
    assert.match(await page.locator(".nav-back-label").textContent(), /Về trận đấu/);
    await page.keyboard.press("Escape"); await routeIs("#/cpu/match");
    assert.equal(await activeAct(), "resume", "Back in a paused match, the cursor is on its menu");
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    assert(await page.locator('#panel-cpu .sheet[data-sheet="plan"]').isVisible());
    await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest(".sheet")), "Tab stays inside an open sheet");
    await page.keyboard.press("Escape");
    assert.equal(await activeAct(), "plan");
    await page.locator("#panel-cpu .arena-tools .pause").click();
    assert(await page.locator("#panel-cpu .start-overlay").isHidden(), "The pitch's pause button resumes over the menu");
    assert.equal(await page.evaluate(() => document.activeElement.className), "arena");
    await page.evaluate(() => {
      const api = document.querySelector("#panel-cpu .match-host").__ptscFootball;
      // Jump to the end of each half (half time puts the clock back to 30 if it comes late).
      for (let i = 0; i < 800 && !api.status().ended; i++) { if (i % 20 === 0) api.__fastForward(api.status().minute > 30 ? 61 : 31); __stepPlay(api, .5); }
    });
    await page.waitForFunction(() => document.querySelector('#panel-cpu .start-overlay[data-kind="end"]:not([hidden])'), null, { timeout: 8000 });
    assert.equal(await activeAct(), "restart", "The full-time menu opens on a new match, not on a toggle");
    await route("#/menu");
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
    await page.locator('.prompt[data-prompt="enter"]').click(); await routeIs("#/watch");
    await route("#/menu");
    assert.equal(await page.evaluate(() => document.querySelector("#panel-watch .arena").tabIndex), -1, "The pitch behind the menu takes no focus");
    await page.locator(".bar-fullscreen").click();
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById("game"));
    assert(await page.evaluate(() => document.activeElement.matches(".main-menu .menu-item")), "Full screen keeps the menu cursor");
    await page.locator(".bar-fullscreen").click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await route("#/info/keys");
    await page.locator("#screen-info .keymap-name").click(); await page.keyboard.type("x");
    await page.locator('.info-nav [data-pane="stats"]').hover(); await page.keyboard.type("s");
    assert.equal(await page.evaluate(() => document.getElementById("game").dataset.route), "#/info/keys", "Pointing at a tab while typing does not steal the keys");
    assert.match(await page.locator("#screen-info .keymap-name").inputValue(), /xs/, "Typed letters stay in the name field");
    await page.locator("#screen-info .keymap-pick .opt-next").click();
    assert(await page.locator(".game-dialog").isVisible(), "Unsaved changes are confirmed in the game");
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest(".game-dialog")), "Tab stays in the dialog");
    await page.keyboard.press("Escape");
    assert(await page.locator(".game-dialog").isHidden());
    await page.locator('#screen-info .keymap-key[data-action="pass"]').click();
    await page.goBack(); await routeIs("#/menu");
    assert.equal(await page.locator(".keymap-key.is-listening").count(), 0, "Leaving the editor stops listening for a key");
    await route("#/cpu");
    console.log("PASS in-game navigation: back to a paused match, sheets keep Tab, pause button resumes, full-time cursor, prompts, full screen, typing, dialog, key capture");

    const engine = await page.evaluate(() => {
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "cpu", teamA: "R", seed: 6, still: 0, fonts: "none", duration: 6 });
      const out = { start: api.plan() };
      out.cpuRefused = api.queueSub("B", "B1", out.start.B.bench[0]?.id).ok === false && api.setShape("B", "3-1-1").ok === false;
      out.keeperRefused = api.queueSub("R", "R0", out.start.R.bench[0]?.id);
      const off = out.start.R.players.find(p => p.canOff), on = out.start.R.bench.find(b => b.canOn);
      out.pre = api.queueSub("R", off.id, on.id); out.preOn = api.plan().R.players.find(p => p.id === off.id).name === on.name;
      api.setShape("R", "1-1-3");
      api.__step(3); for (let i = 0; i < 60 && api.status().phase !== "play"; i++) __stepPlay(api, .5);
      const initial = api.plan().R.players.map(p => p.name).join();
      api.setAuto("R", { subs: false });
      for (let i = 0; i < 440; i++) __stepPlay(api, .5);
      const mid = api.plan(); out.midMinute = api.status().minute;
      out.held = mid.R.shape; out.injuries = api.__stats().injuries;
      out.lineupKept = mid.R.players.map(p => p.name).join() === initial;
      out.cpuRotated = mid.B.players.map(p => p.name).join() !== out.start.B.players.map(p => p.name).join();
      // A change asked for during play happens at the next dead ball.
      const off2 = mid.R.players.find(p => p.canOff), on2 = mid.R.bench.find(b => b.canOn);
      out.queued = on2 ? api.queueSub("R", off2.id, on2.id) : { ok: false, reason: "no bench" };
      out.queueLen = api.plan().R.queue.length;
      for (let i = 0; i < 400 && api.plan().R.queue.length; i++) __stepPlay(api, .25);
      out.subDone = api.plan().R.players.some(p => p.name === on2?.name) || !!api.plan().R.players.find(p => p.id === off2.id && p.subbing);
      // With the automatic coach back on, a tied side does not stay in all-out attack.
      api.setAuto("R", { tactics: true });
      for (let i = 0; i < 120; i++) __stepPlay(api, .5);
      out.autoShape = api.plan().R.shape; out.minute = api.status().minute; out.score = api.status().score;
      out.figure = api.figure("R3").includes("<path");
      api.destroy(); host.remove();
      return out;
    });
    assert(engine.start.R.coached && !engine.start.B.coached && engine.start.R.auto.tactics === false && engine.start.R.auto.subs === true, "A person's side starts with its own plan and automatic substitutions");
    assert(engine.cpuRefused, "The computer's side cannot be changed");
    assert(!engine.keeperRefused.ok && /thủ môn/.test(engine.keeperRefused.reason), "There is no keeper on the bench");
    assert(engine.pre.ok && engine.pre.now && engine.preOn, "Before kick-off a change alters the line-up at once");
    assert.equal(engine.held, "1-1-3", "With the automatic coach off, the chosen shape holds: " + JSON.stringify(engine));
    assert(engine.injuries > 0 || engine.lineupKept, "With automatic substitutions off, nobody is rotated");
    assert(engine.cpuRotated, "The computer still rotates its side: " + JSON.stringify({ minute: engine.midMinute, injuries: engine.injuries }));
    assert(engine.queued.ok && !engine.queued.now && engine.queueLen === 1 && engine.subDone, "A change during play waits for the next dead ball: " + JSON.stringify(engine.queued));
    assert(engine.figure, "Players can be drawn for their portraits");
    console.log("PASS game plan engine: own shape held, automatic coach optional, substitutions now before kick-off and at the next dead ball otherwise");

    const planEdges = await page.evaluate(() => {
      const mountCpu = seed => { const host = document.createElement("div"); document.body.append(host); return [host, PTSCFootball.mount(host, { mode: "cpu", teamA: "R", seed, still: 0, fonts: "none", duration: 6, autoSubs: false })]; };
      const toPlay = api => { api.__step(3); for (let i = 0; i < 60 && api.status().phase !== "play"; i++) __stepPlay(api, .5); for (let i = 0; i < 10; i++) __stepPlay(api, .2); };
      const out = {};
      // A change queued for a man who then gets injured is dropped: his replacement is not taken off again.
      let [host, api] = mountCpu(3); toPlay(api);
      let plan = api.plan();
      const victim = plan.R.players.find(p => p.role !== "GK" && p.canOff);
      if (plan.R.bench.length >= 2) {
        api.queueSub("R", victim.id, plan.R.bench[1].id);
        const subsBefore = api.__stats().subs, injured = api.__injure();
        for (let i = 0; i < 300 && api.plan().R.queue.length; i++) __stepPlay(api, .25);
        for (let i = 0; i < 40; i++) __stepPlay(api, .25);
        const after = api.plan();
        out.injury = { injured, queue: after.R.queue.length, extraSubs: api.__stats().subs - subsBefore, slotName: after.R.players.find(p => p.id === victim.id)?.name, firstSub: plan.R.bench[0].name };
      }
      api.destroy(); host.remove();
      // A change asked for at half time is made before the second-half kick-off.
      [host, api] = mountCpu(5); toPlay(api);
      api.__fastForward(31);
      for (let i = 0; i < 400 && api.status().phase !== "halftime"; i++) __stepPlay(api, .25);
      for (let i = 0; i < 40 && api.status().phase === "halftime"; i++) api.__step(.25);
      plan = api.plan();
      const off = plan.R.players.find(p => p.canOff), on = plan.R.bench.find(b => b.canOn);
      out.halfQueued = api.queueSub("R", off.id, on.id);
      for (let i = 0; i < 400 && !(api.status().phase === "play" && !api.status().stoppage); i++) __stepPlay(api, .1);
      out.halfDone = api.plan().R.players.some(p => p.name === on.name) && api.status().minute <= 32;
      // Switching the automatic coach off keeps the shape the side is in at that moment.
      api.setAuto("R", { tactics: true }); api.setShape("R", "1-1-3");
      for (let i = 0; i < 200; i++) __stepPlay(api, .5);
      const coachShape = api.plan().R.shape;
      api.setAuto("R", { tactics: false });
      for (let i = 0; i < 200; i++) __stepPlay(api, .5);
      out.kept = [coachShape, api.plan().R.shape];
      // Nothing more to change once the match is over.
      for (let i = 0; i < 800 && !api.status().ended; i++) { if (i % 20 === 0) api.__fastForward(api.status().minute > 30 ? 61 : 31); __stepPlay(api, .5); }
      plan = api.plan();
      out.ended = api.status().ended;
      out.afterEnd = api.queueSub("R", plan.R.players.find(p => p.role !== "GK").id, plan.R.bench[0]?.id ?? "Rs0");
      out.shapeAfterEnd = api.setShape("R", "2-1-2").ok;
      out.keeperLine = api.plan().R.players.find(p => p.role === "GK").line;
      api.destroy(); host.remove();
      return out;
    });
    if (planEdges.injury) assert(planEdges.injury.queue === 0 && planEdges.injury.extraSubs <= 1 && planEdges.injury.slotName === planEdges.injury.firstSub, "A queued change for an injured man is dropped, not turned on his replacement: " + JSON.stringify(planEdges.injury));
    assert(planEdges.halfQueued.ok && planEdges.halfDone, "A change asked for at half time is made before the kick-off: " + JSON.stringify(planEdges));
    assert.equal(planEdges.kept[1], planEdges.kept[0], "Turning the automatic coach off keeps the current shape");
    assert(planEdges.ended && !planEdges.afterEnd.ok && /kết thúc/.test(planEdges.afterEnd.reason) && !planEdges.shapeAfterEnd, "No changes after full time");
    assert.equal(planEdges.keeperLine, "GK");
    console.log("PASS game plan edge cases: injured man's change dropped, half-time change before kick-off, coach switch keeps shape, nothing after full time");

    await choose("cpu", "autoTactics", "true");
    await startMatch("cpu");
    assert.equal(await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.plan().R.auto.tactics), true, "The setting starts the match with the automatic coach");
    await route("#/cpu"); await choose("cpu", "autoTactics", "false");
    await startMatch("cpu");
    await page.keyboard.press("Escape"); await page.locator('#panel-cpu [data-act="plan"]').click();
    const planSheet = page.locator('#panel-cpu .sheet[data-sheet="plan"]');
    assert(await planSheet.isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.dataset.key), "R:R0", "The plan opens on your keeper");
    assert.equal(await planSheet.locator('.plan-team[data-col="0"] .plan-row').count(), await page.evaluate(() => { const p = document.querySelector("#panel-cpu .match-host").__ptscFootball.plan().R; return p.players.length + p.bench.length; }));
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    assert(await planSheet.locator(".plan-detail").isVisible(), "Enter opens the player's info");
    const firstName = await planSheet.locator(".pcard-facts dd").first().textContent();
    assert.equal(await planSheet.locator(".pcard .hex .hex-val").count(), 6, "The player page opens on his card with the ratings hexagon");
    assert.equal(await planSheet.locator(".pcard .posmap [data-zone=\"own\"]").count(), 1, "The card marks his own position on the map");
    await page.keyboard.press("ArrowRight");
    assert.equal(await planSheet.locator(".pd-stats li").count(), 10, "The second page lists all ten ratings");
    await page.keyboard.press("ArrowDown");
    assert.notEqual(await planSheet.locator(".pd-id strong").textContent(), firstName, "Up/down switches to the next player");
    await page.keyboard.press("Escape");
    assert(await planSheet.locator(".plan-detail").isHidden());
    await page.keyboard.press("KeyX");
    assert.equal(await planSheet.getAttribute("data-mode"), "pick", "X starts a substitution");
    const incoming = await page.evaluate(() => document.activeElement.querySelector(".plan-name b").textContent);
    await page.keyboard.press("Enter");
    assert.match(await planSheet.locator(".plan-status").textContent(), /Đã đổi đội hình/);
    assert(await page.evaluate(name => document.querySelector("#panel-cpu .match-host").__ptscFootball.plan().R.players.some(p => p.name === name), incoming), "The substitute is now on the pitch");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement.closest(".plan-team").dataset.col), "1", "Left/right switch between the two sides");
    await page.keyboard.press("Enter"); await page.keyboard.press("KeyX");
    assert.match(await planSheet.locator(".plan-status").textContent(), /đội bạn điều khiển/, "The computer's players can be looked at, not changed");
    await page.keyboard.press("Escape");
    await page.keyboard.press("KeyE");
    assert.equal(await planSheet.locator(".plan-tab.is-current").getAttribute("data-tab"), "tactics");
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.plan().R.shape), "3-1-1", "A shape is picked from the list");
    await page.keyboard.press("KeyE");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.plan().R.auto.tactics), true, "The automatic coach is switched on in the plan");
    await page.keyboard.press("Escape");
    assert.equal(await activeAct(), "plan");
    await page.locator('#panel-cpu [data-act="menu"]').click(); await routeIs("#/menu");
    await route("#/cpu");
    console.log("PASS game plan screen: player info pages, switch player, substitution, view-only opponents, tactics and automatic coach");

    await startMatch("cpu");
    await page.keyboard.press("Escape"); await page.locator('#panel-cpu [data-act="plan"]').click();
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    assert(await page.evaluate(() => { const d = document.querySelector("#panel-cpu .plan-detail"); const r = d.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!el?.closest(".plan-detail"); }), "A player's page covers the mini pitch instead of showing its tokens through");
    assert.match(await page.locator("#panel-cpu .plan-detail .pd-summary").textContent(), /Ăn mừng/, "The page tells the man's style of play and his celebration");
    assert(await page.evaluate(() => document.querySelector("#panel-cpu .plan-head .plan-logo")?.getAttribute("src").includes("assets/teams/")), "The plan shows the club badge");
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    console.log("PASS plan sheet: player page on top of the pitch, club badge, summary and celebration");

    await route("#/local"); await startMatch("local"); await page.keyboard.press("Space"); await page.waitForTimeout(300);
    const timeouts = async () => page.evaluate(() => { const s = document.getElementById("panel-local").__session; return { ...s.timeouts, paused: s.paused, slot: s.timeout?.slot ?? null, kicker: document.querySelector("#panel-local .pause-kicker").textContent }; });
    await page.keyboard.press("KeyP"); await page.waitForTimeout(100);
    let t = await timeouts();
    assert(t.paused && t.slot === "B" && t.B === 2 && /Người B · lượt 1\/3/.test(t.kicker), "P is player B's timeout: " + JSON.stringify(t));
    assert(await page.locator('#panel-local [data-act="plan"]').isVisible(), "The plan is open to the pausing side");
    await page.evaluate(() => { document.getElementById("panel-local").__session.timeout.until = performance.now() + 150; });
    await page.waitForTimeout(700);
    t = await timeouts(); assert(!t.paused, "A timeout that runs out lets play go on: " + JSON.stringify(t));
    await page.keyboard.press("Space"); await page.waitForTimeout(100);
    t = await timeouts(); assert(t.paused && t.slot === "A" && t.A === 2, "Space is player A's timeout: " + JSON.stringify(t));
    await page.keyboard.press("Space"); await page.waitForTimeout(100);
    for (let i = 0; i < 2; i++) { await page.keyboard.press("KeyP"); await page.waitForTimeout(80); await page.keyboard.press("Space"); await page.waitForTimeout(80); }
    await page.keyboard.press("KeyP"); await page.waitForTimeout(100);
    t = await timeouts(); assert(t.paused && t.slot === null && t.B === 0, "A fourth timeout is refused but the menu still opens: " + JSON.stringify(t));
    assert.match(await page.locator("#panel-local .arena-flash").textContent(), /hết 3 lượt/);
    assert(await page.locator('#panel-local [data-act="plan"]').isHidden(), "A plain pause in a two-player match offers no coaching");
    await page.keyboard.press("Space"); await page.waitForTimeout(100);
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    t = await timeouts(); assert(t.paused && t.slot === null && t.A === 2, "Esc opens the menu without spending a timeout: " + JSON.stringify(t));
    await page.keyboard.press("Space"); await page.waitForTimeout(100);
    await page.keyboard.press("KeyQ"); await page.waitForTimeout(100);
    t = await timeouts(); assert(t.paused && t.slot === "A" && t.A === 1, "Q is player A's timeout: " + JSON.stringify(t));
    await page.locator('#panel-local [data-act="menu"]').click(); await routeIs("#/menu");
    await route("#/local/match");
    t = await timeouts(); assert(t.paused && t.slot === null && await page.locator("#panel-local .start-overlay").isVisible(), "Leaving the match turns the timeout into a plain pause that waits: " + JSON.stringify(t));
    await page.evaluate(() => { const s = document.getElementById("panel-local").__session; s.api.pause(); });
    console.log("PASS two-player timeouts: three per side, a minute each, own key per player, refused when spent");

    await route("#/info/teams");
    assert.equal(await page.locator("#screen-info .teams-browser .club-row").count(), 10, "Ten clubs are listed");
    await page.locator("#screen-info .teams-browser .club-row").nth(1).focus();
    assert.equal(await page.locator("#screen-info .teams-browser .club-player").count(), 30, "A club's card lists its thirty players");
    await page.keyboard.press("KeyE"); await page.waitForTimeout(150);
    assert.equal(await page.locator("#screen-info .teams-browser .player-row").count(), 30, "Each club has a tab of its thirty players");
    await page.locator("#screen-info .teams-browser .player-row").nth(5).focus(); await page.waitForTimeout(100);
    const cardInfo = await page.evaluate(() => { const c = document.querySelector("#screen-info .teams-browser .br-detail .pcard"); return c && { hex: c.querySelectorAll(".hex .hex-val").length, own: c.querySelectorAll('.posmap [data-zone="own"]').length, ovr: c.querySelector(".pcard-ovr")?.textContent, kit: !!c.querySelector(".pcard-art img"), facts: c.querySelectorAll(".pcard-facts div").length }; });
    assert(cardInfo && cardInfo.hex === 6 && cardInfo.own === 1 && Number(cardInfo.ovr) > 0 && cardInfo.kit && cardInfo.facts >= 6, "A player's card: hexagon of six, his own zone on the map, OVR, shirt and facts: " + JSON.stringify(cardInfo));
    await page.locator("#screen-info .teams-browser").screenshot({ path: path.join(artifacts, "player-card.png") });
    await page.keyboard.press("KeyQ"); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => PTSC_TEAMS.teams.reduce((n, t) => n + t.players.length, 0)), 300);
    assert(await page.evaluate(() => PTSC_TEAMS.teams.every(t => t.players.every(p => p.face && p.face.hair && p.celebration && p.num && p.short && p.attack && p.defense && Object.keys(p.stats).length === 10))), "Every one of the 300 has a face, a celebration, a number, a short name, two styles and ten ratings");
    await route("#/cpu");
    console.log("PASS clubs pane and the 300-player data set");

    // Club data in the engine: ratings keep their 1–99 scale, the overall is the data's, and the key men start.
    const dataScale = await page.evaluate(() => {
      let seed = 5; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const squad = PTSCTeams.pickSquad("barcelona", rng), club = PTSCTeams.get("barcelona");
      const host = document.createElement("div"); document.body.append(host);
      const api = PTSCFootball.mount(host, { mode: "cpu", teamA: "R", seed: 1, still: 0, fonts: "none", squads: { R: squad }, teams: PTSCTeams.teamOption("barcelona", "arsenal") });
      const plan = api.plan().R, all = [...plan.players, ...plan.bench];
      const rows = all.map(p => { const d = club.players.find(x => x.name === p.name); return { name: p.name, ovr: p.ovr, dataOvr: d.ovr, max: Math.max(...Object.values(p.stats)), dataMax: Math.max(...Object.values(d.stats)), min: Math.min(...Object.values(p.stats)), dataMin: Math.min(...Object.values(d.stats)) }; });
      api.destroy(); host.remove();
      let pillars = 0, squads = 0;
      for (let k = 0; k < 150; k++) { const sq = PTSCTeams.pickSquad(PTSCTeams.list()[k % 10].id, rng); squads++; if (sq.players.filter(p => p.pillar).length === 2 && sq.bench.every(p => !p.pillar)) pillars++; }
      return { rows, pillars, squads };
    });
    assert(dataScale.rows.every(r => r.ovr === r.dataOvr && r.max === r.dataMax && r.min === r.dataMin), "Club ratings and overalls are shown as the data gives them: " + JSON.stringify(dataScale.rows.slice(0, 3)));
    assert(dataScale.rows.some(r => r.max > 95 || r.min < 35), "The 1–99 scale is kept (a 96+ or sub-35 rating survives)");
    assert.equal(dataScale.pillars, dataScale.squads, "Both key men are always among the starters");
    assert(await page.evaluate(() => PTSC_TEAMS.teams.every(t => t.players.filter(p => p.role === "DF").every(p => p.stats.defending >= 78))), "Every defender defends like one");

    // A rematch keeps a randomly drawn opponent; the window losing focus never lets a timeout resume the match.
    await route("#/cpu"); await choose("cpu", "clubB", "random"); await startMatch("cpu");
    const firstB = await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.teams().B.id);
    await page.keyboard.press("Space"); await page.keyboard.press("Escape"); await page.locator('#panel-cpu [data-act="restart"]').click(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.querySelector("#panel-cpu .match-host").__ptscFootball.teams().B.id), firstB, "Trận mới keeps the clubs that played");
    assert.notEqual(firstB, "psg");
    await route("#/local"); await startMatch("local"); await page.keyboard.press("Space"); await page.waitForTimeout(200);
    await page.keyboard.press("KeyP"); await page.waitForTimeout(100);
    await page.evaluate(() => { window.dispatchEvent(new Event("blur")); });
    await page.evaluate(() => { const s = document.getElementById("panel-local").__session; s.timeout = s.timeout ?? null; });
    t = await timeouts(); assert(t.paused && t.slot === null, "A blur turns a timeout into a plain pause: " + JSON.stringify(t));
    await page.evaluate(() => { document.getElementById("panel-local").__session.api.pause(); });
    console.log("PASS club ratings on the data scale, key men start, rematch keeps clubs, blur ends a timeout");

    // Layouts saved before the pause key existed never give both players the same pause key.
    await page.evaluate(() => { localStorage.setItem("ptsc-football.key-layouts.v1", JSON.stringify({ version: 1, layouts: [{ id: "default-a", name: "Mặc định A · WASD", keys: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", switch: "KeyR", sprint: "KeyT", pass: "KeyF", shoot: "KeyG", press: "KeyV", challenge: "KeyB", special: "KeyQ" } }], assign: { cpu: { A: "default-a" }, local: { A: "default-a", B: "default-b" } } })); PTSCKeymap.reload(); });
    const migrated = await page.evaluate(() => { const b = PTSCKeymap.bindings("local"); return { a: b.A.pause, b: b.B.pause, special: b.A.special, clash: PTSCKeymap.conflicts(b.A, b.B) }; });
    assert(migrated.special === "KeyQ" && migrated.a && migrated.b && migrated.a !== migrated.b && migrated.clash.length === 0, "The migrated layout gets a free pause key: " + JSON.stringify(migrated));
    await page.evaluate(() => { localStorage.clear(); PTSCKeymap.reload(); });
    console.log("PASS pause-key migration avoids the other player's keys");

    // A shooting skill always fires when pressed, and goes in about 70% of the time, not always.
    const skillShots = await page.evaluate(() => {
      const results = [];
      for (let seed = 1; seed <= 160 && results.length < 40; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none" });
        for (let i = 0; i < 300; i++) {
          __stepPlay(api, .05);
          const p = api.status().players.find(x => x.hasBall && x.ready && x.special.ready && x.special.kind === "finisher");
          if (!p) continue;
          const before = api.status().score, fired = api.action(p.slot, "special");
          let goal = false, said = [];
          for (let k = 0; k < 40 && !goal; k++) { api.__step(.1); const st = api.__state(); if (st.callout) said.push(st.callout); goal = api.status().score.R + api.status().score.B > before.R + before.B; }
          results.push({ fired, goal, failed: said.some(t => /không thành công|chưa thành công/i.test(t)) });
          break;
        }
        api.destroy(); host.remove();
      }
      return { n: results.length, fired: results.filter(r => r.fired).length, goals: results.filter(r => r.goal).length, failed: results.filter(r => r.failed).length };
    });
    assert(skillShots.n >= 10, "Enough skill shots sampled: " + JSON.stringify(skillShots));
    assert.equal(skillShots.fired, skillShots.n, "Pressing a ready skill always fires it");
    assert.equal(skillShots.failed, 0, "No 'skill failed' message");
    const goalRate = skillShots.goals / skillShots.n;
    assert(goalRate > .4 && goalRate < .95, "Skill shots score about 70% of the time, not always: " + JSON.stringify(skillShots));
    console.log(`PASS skill shots always fire and score ${Math.round(goalRate * 100)}% (${skillShots.goals}/${skillShots.n})`);

    // Penalties: wrong guess always scores; a right guess is saved 100/80% by a skilled keeper, 80/20% otherwise.
    const penaltyOdds = await page.evaluate(() => {
      const kicks = [];
      for (let seed = 1; seed <= 40; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none" });
        api.__step(1); api.__penalties();
        for (let i = 0; i < 400 && !api.status().ended; i++) {
          const s = api.status(), p = s.penalty;
          if (p?.phase === "choose") {
            const shooter = p.players.find(x => x.role === "attack");
            if (i % 2) api.action(shooter.slot, "special");
            const dir = ["left", "center", "right"][i % 3];
            api.choosePenalty("A", dir); api.choosePenalty("B", i % 5 === 0 ? (dir === "left" ? "right" : "left") : dir);
          }
          api.__step(.5);
        }
        kicks.push(...(api.__stats().penaltyKicks ?? []));
        api.destroy(); host.remove();
      }
      const rate = filter => { const list = kicks.filter(filter); return { n: list.length, saved: list.filter(k => !k.goal).length / (list.length || 1) }; };
      return { wrong: rate(k => !k.guessed), saverPlain: rate(k => k.guessed && k.saver && !k.attackSkill), saverSkill: rate(k => k.guessed && k.saver && k.attackSkill),
        plain: rate(k => k.guessed && !k.saver && !k.attackSkill), plainSkill: rate(k => k.guessed && !k.saver && k.attackSkill) };
    });
    assert(penaltyOdds.wrong.n > 0 && penaltyOdds.wrong.saved === 0, "A wrong guess always concedes");
    if (penaltyOdds.saverPlain.n) assert(penaltyOdds.saverPlain.saved >= .85, "A penalty-saving keeper who guesses right nearly always saves an ordinary penalty: " + JSON.stringify(penaltyOdds.saverPlain));
    const near = (r, p, tol) => r.n < 8 || Math.abs(r.saved - p) <= tol;
    assert(near(penaltyOdds.saverSkill, .8, .25) && near(penaltyOdds.plain, .8, .2) && near(penaltyOdds.plainSkill, .2, .2), "Penalty odds follow the rules: " + JSON.stringify(penaltyOdds));
    console.log("PASS penalty odds: wrong guess scores; right guess about 100/80% with the keeper skill, 80/20% without");
    // The keeper's handling moves the fixed odds a little: a great keeper concedes fewer skill shots and saves more penalties.
    await page.evaluate(() => {
      window.__clubMatchAt = (a, b, seed = 4, opts = {}) => { let s = seed; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", teamA: "R", seed, still: 0, fonts: "none", duration: 4, teams: PTSCTeams.teamOption(a, b), squads: { R: PTSCTeams.pickSquad(a, r), B: PTSCTeams.pickSquad(b, r) }, ...opts });
        return { api, destroy: () => { api.destroy(); host.remove(); } }; };
    });
    const odds = await page.evaluate(() => {
      const rows = [];
      for (const [a, b] of [["real-madrid", "barcelona"], ["chelsea", "psg"], ["arsenal", "liverpool"]]) {
        let seed = 4; const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "cpu", teamA: "R", seed: 4, still: 0, fonts: "none", duration: 4, teams: PTSCTeams.teamOption(a, b), squads: { R: PTSCTeams.pickSquad(a, r), B: PTSCTeams.pickSquad(b, r) } });
        rows.push(...Object.values(api.__odds())); api.destroy(); host.remove();
      }
      return rows;
    });
    const byGk = [...odds].sort((x, y) => x.gk - y.gk);
    assert(odds.every(r => r.skillShotAgainst >= .5 && r.skillShotAgainst <= .85 && r.penaltySave >= .6 && r.penaltySave <= 1), "Odds stay within their bands: " + JSON.stringify(odds));
    assert(byGk[0].gk === byGk.at(-1).gk || (byGk[0].skillShotAgainst > byGk.at(-1).skillShotAgainst && byGk[0].penaltySave < byGk.at(-1).penaltySave), "A better keeper concedes fewer skill shots and saves more penalties: " + JSON.stringify(byGk.map(r => [r.keeper, r.gk, r.skillShotAgainst, r.penaltySave])));
    const costs = odds.flatMap(r => r.costs);
    assert(costs.every(([, st, c]) => Math.abs(c - .25 * Math.min(1.2, Math.max(.5, 1.5 - st / 100))) < .002), "A skill costs 25% times the stamina factor: " + JSON.stringify(costs.slice(0, 4)));
    const playedOdds = await page.evaluate(() => {
      const kicks = [];
      for (const [a, b] of [["real-madrid", "barcelona"], ["chelsea", "psg"], ["arsenal", "liverpool"], ["juventus", "bayern"]]) {
        const f = __clubMatchAt(a, b, 6); f.api.__step(1); f.api.__penalties();
        for (let i = 0; i < 300 && !f.api.status().ended; i++) { const p = f.api.status().penalty; if (p?.phase === "choose") { f.api.choosePenalty("A", "left"); f.api.choosePenalty("B", "left"); } f.api.__step(.5); }
        kicks.push(...(f.api.__stats().penaltyKicks ?? []).filter(k => k.guessed)); f.destroy();
      }
      return kicks;
    });
    // A saver at his 100% base stays at 100%; every other base (80% or 20%) moves with the keeper's and the taker's ratings.
    const moved = playedOdds.filter(k => !(k.saver && !k.attackSkill));
    assert(playedOdds.length >= 8 && moved.length >= 1 && moved.every(k => ![.8, .2].includes(k.saveChance)) && playedOdds.every(k => k.saveChance >= 0 && k.saveChance <= 1), "Penalties in play use odds moved by the ratings: " + JSON.stringify(playedOdds.slice(0, 6)));
    console.log("PASS keeper and striker ratings move the fixed skill and penalty odds; stamina scales the cost of a skill");

    // A skill in use shows its badge over the player's head and it goes when the skill ends.
    const badge = await page.evaluate(() => {
      for (let seed = 1; seed <= 30; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { mode: "local", seed, still: 0, fonts: "none" });
        let result = null;
        for (let i = 0; i < 400 && !result; i++) {
          __stepPlay(api, .05);
          const p = api.status().players.find(x => x.hasBall && x.ready && x.special.ready && ["burst", "phantom", "maestro"].includes(x.special.kind));
          if (p && api.action(p.slot, "special")) {
            api.__step(.05);
            const icon = () => [...host.shadowRoot.querySelectorAll('[data-id^="skill-icon-"]')].filter(n => n.getAttribute("opacity") === "1").map(n => n.getAttribute("data-skill"));
            const during = icon(); api.__step(4); result = { kind: p.special.kind, during, after: icon() };
          }
        }
        api.destroy(); host.remove();
        if (result) return result;
      }
      return null;
    });
    assert(badge && badge.during.includes(badge.kind) && !badge.after.includes(badge.kind), "A skill badge shows over the head while the skill lasts: " + JSON.stringify(badge));
    console.log("PASS skill badge over the head while active, gone afterwards");

    // Build: height and weight by position, drawn taller or shorter; keepers come off their line.
    const builds = await page.evaluate(() => {
      const rows = []; let rushes = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const host = document.createElement("div"); document.body.append(host);
        const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none" });
        for (const list of Object.values(api.roster())) rows.push(...list.map(p => ({ role: p.role, ...p.body })));
        if (seed <= 6) { for (let i = 0; i < 1200 && !api.status().ended; i++) api.__step(.25); const st = api.__stats(); rushes += st.keeperRushes ?? 0; }
        api.destroy(); host.remove();
      }
      const mean = role => { const list = rows.filter(r => r.role === role); return list.reduce((s, r) => s + r.height, 0) / list.length; };
      return { rows, gk: mean("GK"), mf: mean("MF"), rushes };
    });
    assert(builds.rows.every(r => r.height >= 150 && r.height <= 205 && r.weight >= 45 && r.weight <= 110 && r.reach > 1.8 && r.sweep > .8), "Builds stay realistic");
    assert(builds.gk > builds.mf + 5, "Keepers are taller than midfielders on average");
    assert(builds.rushes >= 6, "Keepers come off their line regularly: " + builds.rushes);
    console.log("PASS player builds by position and keepers sweeping off their line");

    await page.evaluate(() => {
      const rngOf = seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      window.__clubMatch = (opts, seed = 3) => { const host = document.createElement("div"); document.body.append(host); const r = rngOf(seed); const api = PTSCFootball.mount(host, { seed, still: 0, fonts: "none", teams: PTSCTeams.teamOption("barcelona", "bayern"), squads: { R: PTSCTeams.pickSquad("barcelona", r), B: PTSCTeams.pickSquad("bayern", r) }, ...opts }); return { api, destroy: () => { api.destroy(); host.remove(); } }; };
    });
    // Dead balls keep their shape: a waiting kick-off keeps everyone in his half; a waiting corner keeps the men placed for it where they are.
    const deadBalls = await page.evaluate(() => {
      const k = __clubMatch({ mode: "local", teamA: "R", duration: 4 });
      let maxD = 0, kickoffSeen = false;
      for (let s = 0; s < 12; s++) { k.api.__step(1); if (k.api.status().kickoff?.slot) kickoffSeen = true; maxD = Math.max(maxD, ...k.api.__players().map(p => p.d)); }
      const kickoff = { maxD: +maxD.toFixed(3), kickoffSeen, phase: k.api.status().phase };
      k.destroy();
      const c = __clubMatch({ mode: "cpu", teamA: "R", duration: 4 });
      c.api.__step(1); __takeRestart(c.api); c.api.__step(2);
      c.api.__corner("R", 0);
      c.api.__step(3);   // the men placed for it walk over first
      let minBox = 9, samples = 0;
      for (let s = 0; s < 15; s++) { c.api.__step(1); if (!c.api.status().corner) break; samples++; minBox = Math.min(minBox, c.api.__players().filter(p => p.team === "R" && p.role !== "GK" && p.d > .7).length); }
      const corner = { minBox, samples, waiting: !!c.api.status().corner, hold: c.api.__hold().corner?.length ?? 0 };
      c.destroy();
      return { kickoff, corner };
    });
    assert(deadBalls.kickoff.kickoffSeen && deadBalls.kickoff.maxD <= .505, "Nobody crosses the halfway line while a kick-off waits: " + JSON.stringify(deadBalls.kickoff));
    assert(deadBalls.corner.waiting && deadBalls.corner.samples >= 12 && deadBalls.corner.hold >= 6 && deadBalls.corner.minBox >= 3, "The men placed for a corner hold their spots while the taker waits: " + JSON.stringify(deadBalls.corner));
    console.log("PASS a waiting kick-off and a waiting corner keep their shape");

    // A goal kick: the keeper walks back to his goal, waits for his player's pass and restarts with it; the computer's keeper passes by himself.
    const goalKicks = await page.evaluate(() => {
      const f = __clubMatch({ mode: "cpu", teamA: "R", duration: 4 });
      f.api.__step(1); __takeRestart(f.api); f.api.__step(2);
      f.api.__goalKick("R");
      let ready = null, carriedEarly = false;
      for (let s = 0; s < 8 && !ready; s++) { f.api.__step(.5); if (f.api.__state().carrier) carriedEarly = true; const st = f.api.status(); if (st.goalKick?.ready) ready = { t: (s + 1) / 2, slot: st.goalKick.slot, gk: f.api.__players().find(p => p.team === "R" && p.role === "GK") }; }
      f.api.__step(3);
      const stillWaiting = f.api.status().stoppage && !!f.api.status().goalKick;
      const shootRefused = !f.api.action("A", "shoot");
      const accepted = f.api.action("A", "pass"), kick = f.api.__state().kick;
      f.api.__step(.5);
      const human = { ready: ready && { t: ready.t, slot: ready.slot, d: +ready.gk.d.toFixed(3), w: +ready.gk.w.toFixed(2) }, carriedEarly, stillWaiting, shootRefused, accepted, kick: kick && { action: kick.action, origin: kick.origin.map(v => +v.toFixed(2)) }, resumed: !f.api.status().stoppage };
      f.api.__step(3); f.api.__goalKick("B");
      let cpuTaken = null;
      for (let s = 0; s < 16 && !cpuTaken; s++) { f.api.__step(.5); if (!f.api.status().stoppage) cpuTaken = { t: (s + 1) / 2 }; }
      const cpu = { cpuTaken, goalKicks: f.api.__stats().goalKicks };
      f.destroy();
      return { human, cpu };
    });
    assert(goalKicks.human.ready && goalKicks.human.ready.slot === "A" && Math.abs(goalKicks.human.ready.d - .06) < .02 && Math.abs(goalKicks.human.ready.w - .5) < .05, "The keeper stands in front of his goal for the goal kick: " + JSON.stringify(goalKicks.human));
    assert(!goalKicks.human.carriedEarly && goalKicks.human.stillWaiting && goalKicks.human.shootRefused, "The goal kick waits for the pass key and allows nothing else: " + JSON.stringify(goalKicks.human));
    assert(goalKicks.human.accepted && goalKicks.human.kick?.action === "pass" && goalKicks.human.resumed, "Pass takes the goal kick and play goes on: " + JSON.stringify(goalKicks.human));
    assert(goalKicks.cpu.cpuTaken && goalKicks.cpu.cpuTaken.t <= 4 && goalKicks.cpu.goalKicks === 2, "The computer's keeper takes his goal kick by himself: " + JSON.stringify(goalKicks.cpu));
    console.log("PASS goal kicks go back to the keeper in front of his goal and restart with a pass");
    // The same goal kick through the keyboard: hold and release the pass key. The switch key always moves the cursor.
    await route("#/cpu"); await startMatch("cpu"); await page.keyboard.press("Space"); await page.waitForTimeout(150);
    const gkReady = await page.evaluate(() => { const api = document.querySelector("#panel-cpu .match-host").__ptscFootball; api.pause();
      for (let i = 0; i < 30 || (i < 600 && (api.status().stoppage || api.status().phase !== "play")); i++) { __takeRestart(api); api.__step(.1); } api.__goalKick("R"); for (let i = 0; i < 40 && !api.status().goalKick?.ready; i++) api.__step(.1); api.play(); return { ...api.status().goalKick, passes: api.__stats().passes ?? 0 }; });
    await page.keyboard.down("KeyF"); await page.waitForTimeout(350); await page.keyboard.up("KeyF"); await page.waitForTimeout(350);
    const gkKeys = await page.evaluate(() => { const api = document.querySelector("#panel-cpu .match-host").__ptscFootball; const k = api.__state().kick; return { stoppage: api.status().stoppage, kick: k?.action, origin: k?.origin, passes: api.__stats().passes ?? 0 }; });
    assert(gkReady?.ready && gkReady.slot === "A" && !gkKeys.stoppage && gkKeys.kick === "pass" && gkKeys.passes === gkReady.passes + 1 && (gkKeys.origin[0] < .1 || gkKeys.origin[0] > .9), "The pass key takes the goal kick from in front of the goal: " + JSON.stringify({ gkReady, gkKeys }));
    const switched = await page.evaluate(() => { const api = document.querySelector("#panel-cpu .match-host").__ptscFootball; api.pause();
      const out = [];
      for (let n = 0; n < 6; n++) { let ok = false; for (let i = 0; i < 600 && !ok; i++) { __takeRestart(api); api.__step(.1); const s = api.status(); ok = !s.stoppage && s.possession === "B" && s.phase === "play" && !s.players[0].hasBall; } if (!ok) continue; const before = api.__selected("A").name; api.action("A", "switch"); out.push(before !== api.__selected("A").name); api.__step(1.5); }
      api.play(); return out;
    });
    assert(switched.length >= 3 && switched.every(Boolean), "Every press of the switch key changes the man: " + JSON.stringify(switched));
    const apart = await page.evaluate(async () => { const api = document.querySelector("#panel-cpu .match-host").__ptscFootball; api.pause(); const out = [];
      for (let n = 0; n < 3; n++) { await new Promise(r => setTimeout(r, 1100)); const before = api.__selected("A").name; api.action("A", "switch"); out.push(before !== api.__selected("A").name); }
      api.play(); return out; });
    assert(apart.every(Boolean), "Separate presses never reselect the same man: " + JSON.stringify(apart));
    await page.keyboard.press("Escape");
    console.log("PASS the pass key takes a goal kick; the switch key always changes the man");

    // Ratings per line, a swap of two men on the pitch, the best line-up on a shape change, and the team rating.
    const tactics = await page.evaluate(() => {
      const f = __clubMatch({ mode: "cpu", teamA: "R", duration: 4 });
      const plan = f.api.plan().R;
      const fw = plan.players.find(p => p.line === "FW"), df = plan.players.find(p => p.line === "DF"), gk = plan.players.find(p => p.role === "GK");
      const natural = [...plan.players, ...plan.bench].every(p => p.ovrs[p.natural] === p.ovr);
      const gkSwap = f.api.swapSlots("R", gk.id, fw.id), cpuSwap = f.api.swapSlots("B", "B4", "B1");
      const swap = f.api.swapSlots("R", fw.id, df.id);
      const after = f.api.plan().R, fwNow = after.players.find(p => p.id === fw.id), dfNow = after.players.find(p => p.id === df.id);
      const arranged = f.api.arrange("R"), back = f.api.plan().R;
      const shape = f.api.setShape("R", "3-1-1"), three = f.api.plan().R;
      f.destroy();
      return { rating: plan.rating, natural, gkSwap, cpuSwap, swap, fw: { ovr: fw.ovr, ovrs: fw.ovrs }, fwNow: { line: fwNow.line, ovr: fwNow.ovr }, dfNow: { line: dfNow.line, ovr: dfNow.ovr }, ratingAfter: after.rating, arranged, ratingBack: back.rating, shape,
        three: { shape: three.shape, rating: three.rating, lines: three.players.map(p => p.line).sort().join("") }, shapes: plan.shapes.map(s => [s.id, s.ovr]) };
    });
    assert(tactics.natural && tactics.rating.players === 6 && tactics.rating.ovr >= 80 && Math.abs(tactics.rating.sum / 6 - tactics.rating.ovr) < 1, "Every man's overall is his own in his natural line: " + JSON.stringify(tactics.rating));
    assert(!tactics.gkSwap.ok && !tactics.cpuSwap.ok && tactics.swap.ok, "Only two outfield men of a coached side change places: " + JSON.stringify([tactics.gkSwap, tactics.cpuSwap, tactics.swap]));
    assert(tactics.fwNow.line === "DF" && tactics.dfNow.line === "FW" && tactics.fwNow.ovr === tactics.fw.ovrs.DF && tactics.fwNow.ovr < tactics.fw.ovr, "A forward at centre-back plays at his centre-back rating: " + JSON.stringify(tactics));
    assert(tactics.ratingAfter.sum < tactics.rating.sum && tactics.arranged.ok && tactics.arranged.moved >= 1 && tactics.ratingBack.sum === tactics.rating.sum, "Arranging restores the best line-up: " + JSON.stringify([tactics.ratingAfter, tactics.arranged, tactics.ratingBack]));
    assert(tactics.shape.ok && tactics.three.shape === "3-1-1" && tactics.three.lines === "DFDFDFFWGKMF" && tactics.three.rating.ovr === tactics.shapes.find(s => s[0] === "3-1-1")[1], "A shape change rates the side in its new lines, as the tactics tab promised: " + JSON.stringify(tactics.three) + " " + JSON.stringify(tactics.shapes));
    console.log("PASS ratings per line, swaps on the pitch, the best line-up after a shape change, team ratings");

    // The rapid pass, automatic switching and penalty skills that need no key.
    const feel = await page.evaluate(() => {
      const f = __clubMatch({ mode: "cpu", teamA: "R", duration: 4 });
      let rapid = null;
      for (let i = 0; i < 600 && !rapid; i++) {
        __takeRestart(f.api); f.api.__step(.1);
        const st = f.api.status(), me = st.players[0];
        if (me.hasBall && me.ready && !st.stoppage) { const before = me.energy, ok = f.api.action("A", "pass", { rapid: true }), kick = f.api.__state().kick; f.api.__step(.2); rapid = { ok, rapid: kick.rapid, height: kick.height, receiver: kick.receiver, drop: +(before - f.api.status().players[0].energy).toFixed(3) }; }
      }
      f.destroy();
      const run = on => { const g = __clubMatch({ mode: "cpu", teamA: "R", duration: 4, autoSwitch: on }); for (let i = 0; i < 400; i++) { __takeRestart(g.api); g.api.__step(.1); } const r = { switches: g.api.__stats().autoSwitches ?? 0, flag: g.api.status().autoSwitch }; g.api.setAutoSwitch(!on); r.toggled = g.api.status().autoSwitch; g.destroy(); return r; };
      const switching = { on: run(true), off: run(false) };
      const pen = [];
      for (let seed = 1; seed <= 12; seed++) { const h = __clubMatch({ mode: "local", teamA: "R", duration: 4 }, seed); h.api.__step(1); h.api.__penalties(); pen.push(...h.api.status().players.map(p => ({ kind: p.special.kind, label: p.special.label, ready: p.special.ready }))); h.destroy(); }
      const legs = __clubMatch({ mode: "cpu", teamA: "R", duration: 4, autoSubs: false });
      for (let i = 0; i < 360 && legs.api.status().minute < 40; i++) { __takeRestart(legs.api); legs.api.__step(1); }
      const field = Object.entries(legs.api.__energy()).filter(([k]) => k.startsWith("R:") && !k.endsWith("*")).map(([, v]) => v);
      const energy = { minute: legs.api.status().minute, min: Math.min(...field), max: Math.max(...field) };
      legs.destroy();
      return { rapid, switching, pen, energy };
    });
    assert(feel.rapid?.ok && feel.rapid.rapid && feel.rapid.height === 0 && feel.rapid.receiver && feel.rapid.drop >= .02, "Two taps of pass send a hard ground ball to a far team-mate at a price: " + JSON.stringify(feel.rapid));
    assert(feel.switching.on.flag && feel.switching.on.switches > 0 && !feel.switching.on.toggled && !feel.switching.off.flag && feel.switching.off.switches === 0 && feel.switching.off.toggled, "Automatic switching moves the cursor only when it is on: " + JSON.stringify(feel.switching));
    const penSkilled = feel.pen.filter(r => r.kind);
    assert(penSkilled.length > 0 && penSkilled.every(r => !r.ready && /Tự/.test(r.label)), "Penalty skills are on by themselves: " + JSON.stringify(penSkilled.slice(0, 4)));
    assert(feel.energy.minute >= 40 && feel.energy.min < .7, "Legs tire over a match even without skills: " + JSON.stringify(feel.energy));
    console.log("PASS rapid pass, automatic switching, penalty skills on by themselves, tiring legs");

    // A pass reaches its man even while a direction is held and the cursor has jumped to him.
    const reception = await page.evaluate(() => {
      let reached = 0, tried = 0, steered = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const f = __clubMatch({ mode: "cpu", teamA: "R", duration: 4, autoSwitch: true }, seed);
        for (let i = 0; i < 500; i++) {
          __takeRestart(f.api); f.api.__step(.1);
          const st = f.api.status(), me = st.players[0];
          if (!(me.hasBall && me.ready && !st.stoppage && st.phase === "play")) continue;
          f.api.setInput("A", { x: 1, y: 0 });
          f.api.beginCharge("A", "pass"); f.api.__step(.15); f.api.releaseCharge("A");
          const receiver = f.api.__state().kick?.receiver;
          if (!receiver) break;
          tried++;
          for (let k = 0; k < 40; k++) { f.api.__step(.1); if (f.api.__selected("A")?.name === receiver) steered++; const c = f.api.__state().carrier; if (c && c !== me.name) { if (c === receiver) reached++; break; } if (f.api.status().stoppage) break; }
          break;
        }
        f.destroy();
      }
      return { reached, tried, steered };
    });
    assert(reception.tried >= 8 && reception.steered > 0 && reception.reached >= reception.tried - 2, "Passes reach their man with a direction held: " + JSON.stringify(reception));
    console.log("PASS passes reach the receiver while a direction is held");

    // A long note under the scoreboard must not stretch the bug past its clock (measured on the visible watch match).
    await route("#/watch");
    const board = await page.evaluate(() => {
      const root = document.getElementById("watch-match").shadowRoot, note = root.querySelector('[data-id="note"]'), bug = root.querySelector(".sb-bug"), clock = root.querySelector('[data-id="clock"]');
      const was = { hidden: note.hidden, text: note.textContent };
      note.hidden = false; note.textContent = "Thay người · Bayern Munich: Hummels #5 vào, J. Martínez #8 ra · ghi chú thật dài để thử bảng";
      const r = { bug: bug.getBoundingClientRect().width, note: note.getBoundingClientRect().width, gap: Math.abs(bug.getBoundingClientRect().right - clock.getBoundingClientRect().right) };
      note.hidden = was.hidden; note.textContent = was.text;
      return r;
    });
    assert(board.note > board.bug && board.gap < 3, "The scoreboard ends at its clock whatever the note says: " + JSON.stringify(board));
    console.log("PASS the scoreboard keeps its width under a long note");
    await route("#/local/match");   // back to the paused match, with the watcher frozen again

    const watcherTime = await page.evaluate(() => document.getElementById("watch-match").__ptscFootball.__state().T);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.getElementById("watch-match").__ptscFootball.__state().T), watcherTime);
    await route("#/watch");
    await page.keyboard.press("Space");
    assert(await page.locator("#panel-watch .start-overlay").isVisible(), "Space opens the watching menu");
    await page.locator('#panel-watch [data-act="new-watch"]').click();
    assert(await page.locator("#panel-watch .start-overlay").isHidden());
    assert.equal(await page.evaluate(() => document.getElementById("watch-match").__ptscFootball.__state().score.R), 0);
    await page.screenshot({ path: path.join(artifacts, "watch.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await route("#/local");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile layout must not overflow");
    await page.screenshot({ path: path.join(artifacts, "mobile.png"), fullPage: true });
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log("PASS mode lifecycle, new match, mobile layout, no runtime errors");
    fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ passed: true, narrativeSides, watchResults, cpu: cpu.stats, mechanics }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
