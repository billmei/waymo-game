// Rescue-button regression: serve the repo on :8123, then node tools/playtest/adopt-care.js.
// Optionally set CHROMIUM_EXECUTABLE to use a system Chromium installation.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://localhost:8123/index.html?mode=adopt&reset=1&seed=7");
    await p.waitForFunction(() => window.WG && WG.G && WG.G.state === "adopt", null, { timeout: 180000 });
    // These checks exercise DOM input and the care controller, without expensive software-rendered frames.
    await p.evaluate(() => {
      WG.game.renderer.render = () => {};
      WG.adopt.debug.adopt("Pickle");
      WG.adoptUI.closeModal();
      WG.adopt.S.settings.speed = 0;
    });
    await p.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    for (const kind of ["cone", "doors"]) {
      await p.evaluate((kind) => {
        const c = WG.adopt.S.cars[0];
        c.sim = { at: "North Beach", from: null, to: null, t: 0, path: [], dest: null, task: "stuck", wait: 0, incident: kind, stuckT: 45, resume: null };
        WG.adoptUI.panel("profile", c.id);
      }, kind);
      const button = p.getByRole("button", { name: "Rush over and fix it" });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      assert.equal(await p.evaluate(() => {
        const before = document.querySelector('#ad-prof-actions [data-a="care"]');
        // A press can span several live updates. The same button must survive them all.
        for (let i = 0; i < 4; i++) WG.adoptUI.update();
        return before === document.querySelector('#ad-prof-actions [data-a="care"]') && before.isConnected;
      }), true, kind + " button survives live updates during a press");
      await p.mouse.up();
      assert.deepEqual(await p.evaluate(() => ({ state: WG.G.state, kind: WG.adoptCare.active.kind })), { state: "adoptCare", kind });
      assert.equal(await p.evaluate(() => WG.adopt.care(WG.adopt.S.cars[0].id, "cone")), false, "overlapping care is rejected");
      await p.evaluate(() => { WG.adoptCare.abort(); WG.adoptCare.update(2.5); });
      console.log("ok", kind, "held click and cancellation");
    }
    await p.evaluate(() => {
      const c = WG.adopt.S.cars[0];
      WG.adoptUI.panel("profile", c.id);
      // The incident resolves after rendering but before clicking.
      WG.adoptSim.clearIncident(WG.adopt.S, c);
    });
    await p.getByRole("button", { name: "Rush over and fix it" }).dispatchEvent("click");
    assert.equal(await p.evaluate(() => WG.adoptCare.active), null);
    assert.equal(await p.locator("#ad-panel").isVisible(), true, "rejected starts keep the profile open");
    console.log("ok stale incident keeps the profile open");
    await p.evaluate(() => {
      const c = WG.adopt.S.cars[0];
      c.sim.task = "stuck";
      c.sim.incident = "doors";
      WG.adoptUI.refresh(true);
    });
    await p.getByRole("button", { name: "Rush over and fix it" }).click();
    // Advance the actual traffic and care logic independently of the software renderer's frame rate.
    assert.equal(await p.evaluate(() => {
      for (let i = 0; i < 240 && !WG.jobs.active; i++) {
        WG.Traffic.update(0.1, WG.G.t + i * 0.1, null, WG.world.look);
        WG.adoptCare.update(0.1);
      }
      return !!WG.jobs.active;
    }), true, "rescue reaches the hands-on job");
    await p.evaluate(() => { WG.jobs.cancel(); WG.adoptCare.update(2.5); });
    assert.equal(await p.evaluate(() => WG.adoptCare.active), null);
    console.log("ok rescue reaches the job and returns");
    await p.evaluate(() => {
      const c = WG.adopt.S.cars[0];
      c.sim = { at: "Russian Hill", from: null, to: null, t: 0, path: [], dest: null, task: "garage", wait: 0 };
      WG.adoptUI.panel("profile", c.id);
    });
    await p.getByRole("button", { name: "Care hands-on" }).click();
    await p.locator('#ad-modal [data-a="care"][data-k="charge"]').click();
    assert.equal(await p.evaluate(() => WG.adopt.S.cars[0].sim.task), "care");
    await p.evaluate(() => {
      WG.adoptCare.active.waiting = 24;
      WG.adoptCare.update(0.1);
      WG.adoptCare.update(2.5);
    });
    assert.equal(await p.evaluate(() => WG.adoptCare.active), null);
    assert.equal(await p.evaluate(() => WG.adopt.S.cars[0].sim.task), "garage");
    assert.ok((await p.locator("#ad-toasts").textContent()).includes("Couldn't find a clear place to stop"));
    assert.deepEqual(errors, []);
    console.log("ok normal care menu and timeout recovery without page errors");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
