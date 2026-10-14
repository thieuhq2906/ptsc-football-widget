// Run with Node and Playwright installed: node tests/game-browser.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "test-results");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
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
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.getElementById("watch-match").__ptscFootball);
    assert.equal(await page.locator('[role="tab"]').count(), 3);
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').textContent(), "Chỉ xem");

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

    await page.locator("#tab-local").click();
    await page.evaluate(() => { document.querySelector("#panel-local .match-host").dataset.seed = "42"; });
    for (const colour of ["R", "B"]) for (const side of ["left", "right"]) {
      await page.locator(`input[name="local-team"][value="${colour}"]`).check();
      await page.locator(`input[name="local-side"][value="${side}"]`).check();
      await page.locator("#panel-local .start").click();
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

    const before = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      for (let i = 0; i < 600 && !api.status().players.every(player => player.ready); i++) api.__step(.1);
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
    assert(possessionSlot, "Kickoff should leave a human carrier");
    const shotsBefore = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().shots);
    await page.keyboard.press(possessionSlot === "A" ? "g" : "m");
    const shotsAfter = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__stats().shots);
    assert.equal(shotsAfter, shotsBefore + 1, "Shoot key must shoot");
    console.log("PASS human shooting key");

    const halftime = await page.evaluate(() => {
      const api = document.querySelector("#panel-local .match-host").__ptscFootball;
      const initial = api.status().leftTeam;
      api.__fastForward(31);
      for (let i = 0; i < 80 && api.status().leftTeam === initial; i++) api.__step(.5);
      return { initial, state: api.status() };
    });
    assert.notEqual(halftime.state.leftTeam, halftime.initial, "Both selected sides must swap at halftime");
    console.log("PASS selected sides swap at halftime");

    await page.locator("#panel-local .pause").click();
    const paused = await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__state().T);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.querySelector("#panel-local .match-host").__ptscFootball.__state().T), paused);
    console.log("PASS pause freezes match");
    await page.locator("#panel-local .pause").click();
    await page.locator("#panel-local").screenshot({ path: path.join(artifacts, "two-player.png") });

    await page.locator("#tab-cpu").click();
    await page.evaluate(() => { document.querySelector("#panel-cpu .match-host").dataset.seed = "42"; });
    await page.locator('input[name="cpu-team"][value="B"]').check();
    await page.locator("#panel-cpu .start").click();
    const cpu = await page.evaluate(() => {
      const api = document.querySelector("#panel-cpu .match-host").__ptscFootball;
      api.pause();
      for (let i = 0; i < 800 && !api.status().ended && (api.__stats().shots === 0 || api.__stats().subs === 0); i++) api.__step(.5);
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
      for (let i = 0; i < 160 && !api.status().ended; i++) api.__step(.5);
      const ended = api.status(); api.__step(20); const later = api.status();
      api.destroy(); host.remove(); return { ended, later };
    });
    assert(drawnMatch.ended.ended && drawnMatch.ended.phase === "draw", "Human play must allow a draw: " + JSON.stringify(drawnMatch));
    assert.equal(drawnMatch.ended.winner, null);
    assert.equal(drawnMatch.later.phase, "draw", "Finished human games must not automatically restart");
    console.log("PASS human draw and finished-game lifecycle");
    await page.locator("#panel-cpu").screenshot({ path: path.join(artifacts, "cpu.png") });

    const watcherTime = await page.evaluate(() => document.getElementById("watch-match").__ptscFootball.__state().T);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.getElementById("watch-match").__ptscFootball.__state().T), watcherTime);
    await page.locator("#tab-watch").click();
    await page.locator("#new-watch").click();
    assert.equal(await page.evaluate(() => document.getElementById("watch-match").__ptscFootball.__state().score.R), 0);
    await page.screenshot({ path: path.join(artifacts, "watch.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#tab-local").click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile layout must not overflow");
    await page.screenshot({ path: path.join(artifacts, "mobile.png"), fullPage: true });
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log("PASS mode lifecycle, new match, mobile layout, no runtime errors");
    fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ passed: true, narrativeSides, watchResults, cpu: cpu.stats }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
