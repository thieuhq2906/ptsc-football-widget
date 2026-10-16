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
        const state = api.status(), restart = [state.kickoff, state.freeKick].find(r => r?.slot && r.ready);
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
    assert.equal(await page.evaluate(() => document.activeElement.dataset.opt), "team", "Setup opens with the cursor on the first row");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator('#panel-cpu .opt[data-opt="team"]').getAttribute("data-value"), "B", "Left/right change a setting");
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
    for (const colour of ["R", "B"]) for (const side of ["left", "right"]) {
      await route("#/local");
      await choose("local", "team", colour);
      await choose("local", "side", side);
      await startMatch("local");
      const state = await page.evaluate(() => {
        const api = document.querySelector("#panel-local .match-host").__ptscFootball;
        api.pause(); api.__step(3);
        for (let i = 0; i < 60 && api.status().phase !== "play"; i++) api.__step(.5);
        api.__step(.7);
        return { status: api.status(), stats: api.__stats() };
      });
      const other = colour === "R" ? "B" : "R";
      assert.equal(state.status.players[0].team, colour);
      assert.equal(state.status.players[1].team, other);
      assert.equal(state.status.leftTeam, side === "left" ? other : colour);
      assert.equal(state.stats.onPitch.R, 6); assert.equal(state.stats.onPitch.B, 6);
      assert.equal(state.stats.storyGoals.length, 0, "Play modes must not script goals");
    }
    console.log("PASS all shirt and starting-side combinations, original 6v6 roster");

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
    assert(mechanics.beforeEnergy - mechanics.specialState.energy >= .179);
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
    await choose("cpu", "team", "B");
    await startMatch("cpu");
    const cpu = await page.evaluate(() => {
      const api = document.querySelector("#panel-cpu .match-host").__ptscFootball;
      api.pause();
      for (let i = 0; i < 800 && !api.status().ended && (api.__stats().shots === 0 || api.__stats().subs === 0); i++) __stepPlay(api, .5);
      return { status: api.status(), stats: api.__stats(), energy: api.__energy() };
    });
    assert.equal(cpu.status.players.length, 1); assert.equal(cpu.status.players[0].team, "B");
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
    assert.equal(await page.locator("#panel-cpu .controls .pad-up").textContent(), "Q", "Guides draw the chosen layout");
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
    assert.equal(await page.locator("#screen-info .skill-legend-item").count(), skillData.length);
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
    assert(await page.locator("#screen-info .style-legend .legend-group").count() === 4, "Styles are grouped by zone");
    assert(await page.locator("#screen-info .skill-legend .legend-group").count() === 5, "Skills are grouped by situation");
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
    assert(mean(forwards.filter(p => p.attack === "Kẻ đón lõng"), "finishing") > mean(forwards.filter(p => p.attack === "Bức tường"), "finishing"), "Edge-of-the-box strikers finish better than target men");
    assert(mean(ratings.all.filter(p => p.role === "GK"), "goalkeeping") > 70 && mean(ratings.all.filter(p => p.role !== "GK"), "goalkeeping") < 40, "Only keepers can keep goal");
    const striker = ratings.roster.R.find(p => p.name === "Sát Thủ");
    assert(striker && striker.stats.finishing === 95 && striker.stats.speed === 90 && striker.attack === "Mũi khoan" && striker.defense === "Lò xo", "Squads given as data keep fixed ratings and styles: " + JSON.stringify(striker));
    assert.equal(ratings.roster.R.find(p => p.name === "Thủ Thành").stats.goalkeeping, 92);
    assert(ratings.roster.B.some(p => p.name === "Vũ"), "A team without custom data keeps the default squad");
    const localPlan = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.plan());
    assert(["R", "B"].every(t => localPlan[t].players.length === 6 && [...localPlan[t].players, ...localPlan[t].bench].every(p => Object.keys(p.stats).length === 10)), "Both squads are listed with ratings");
    console.log("PASS player ratings: ten per player in range, shaped by playing styles, squads as data with fixed ratings, roster tables");

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
    await route("#/watch"); await page.waitForTimeout(800);
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
    await page.locator("#screen-info .keymap-edit").selectOption("default-b");
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
    await route("#/cpu"); await choose("cpu", "autoTactics", "false"); await choose("cpu", "team", "R");
    await startMatch("cpu");
    await page.keyboard.press("Escape"); await page.locator('#panel-cpu [data-act="plan"]').click();
    const planSheet = page.locator('#panel-cpu .sheet[data-sheet="plan"]');
    assert(await planSheet.isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.dataset.key), "R:R0", "The plan opens on your keeper");
    assert.equal(await planSheet.locator('.plan-team[data-col="0"] .plan-row').count(), await page.evaluate(() => { const p = document.querySelector("#panel-cpu .match-host").__ptscFootball.plan().R; return p.players.length + p.bench.length; }));
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    assert(await planSheet.locator(".plan-detail").isVisible(), "Enter opens the player's info");
    const firstName = await planSheet.locator(".pd-id strong").textContent();
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
    if (penaltyOdds.saverPlain.n) assert.equal(penaltyOdds.saverPlain.saved, 1, "A penalty-saving keeper who guesses right always saves an ordinary penalty");
    const near = (r, p, tol) => r.n < 8 || Math.abs(r.saved - p) <= tol;
    assert(near(penaltyOdds.saverSkill, .8, .25) && near(penaltyOdds.plain, .8, .2) && near(penaltyOdds.plainSkill, .2, .2), "Penalty odds follow the rules: " + JSON.stringify(penaltyOdds));
    console.log("PASS penalty odds: wrong guess scores; right guess 100/80% with the keeper skill, 80/20% without");

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
