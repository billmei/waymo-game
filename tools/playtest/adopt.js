// Adopt-a-Waymo smoke test: boots straight into the mode with a fresh seeded save, adopts a car, runs the clock,
// opens the main panels, swoops down to a Care Spot for a hands-on job and back up, then checks that the arcade's
// shifts still start as before. Screenshots go to the current directory (adopt_*.png).
//   node adopt.js            (with the repo served on :8123, see README.md)
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(e.message));
  const shot = async (n) => {
    await p.waitForTimeout(2500);
    await p.screenshot({ path: "adopt_" + n + ".png", timeout: 180000 });
    console.log("shot", n);
  };
  const ev = (f, a) => p.evaluate(f, a);
  p.setDefaultTimeout(180000);
  await p.goto("http://localhost:8123/index.html?mode=adopt&reset=1&seed=7");
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === "adopt", null, { timeout: 180000 });
  // headless frames are slow (SwiftShader), which stalls CSS animations: switch them off for the screenshots
  await p.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await p.waitForTimeout(2500);
  await shot("1_welcome");
  // adopt through the UI: the welcome modal → the lot → name it
  await p.click("#ad-modal .btn.primary");
  await p.waitForSelector("#ad-panel:not([hidden]) .ad-lotcar");
  await shot("2_lot");
  await p.click('#ad-panel [data-a="adopt"]');
  await p.fill("#ad-name", "Pickle");
  await p.click('#ad-modal [data-a="adoptOk"]');
  await p.waitForTimeout(1500);
  console.log("cars", await ev(() => WG.adopt.S.cars.map((c) => c.name + " @" + c.sim.at + " " + c.sim.task)));
  // run the clock a few hours and look at the map
  await ev(() => WG.adopt.debug.skipHours(3));
  await p.waitForTimeout(1200);
  await shot("3_map");
  const id = await ev(() => WG.adopt.S.cars[0].id);
  await ev((id) => WG.adopt.focusCar(id, false), id);
  await p.waitForTimeout(1500);
  await ev((id) => WG.adoptUI.panel("profile", id), id);
  await shot("4_profile");
  await ev(() => WG.adoptUI.panel("hood", "Russian Hill"));
  await shot("5_hood");
  // the daily: the prize wheel
  await p.click('#ad-panel [data-a="daily"]');
  await p.click('#ad-modal [data-a="spin"]');
  await p.waitForTimeout(3800);
  await shot("6_wheel");
  console.log("wheel:", await ev(() => document.querySelector("#ad-modal .panel-b").textContent));
  await ev(() => WG.adoptUI.closeModal());
  for (const k of ["inventory", "album", "arcade", "garage", "diary", "inbox", "help"]) {
    await ev((k) => WG.adoptUI.panel(k), k);
    await p.waitForTimeout(150);
  }
  await ev(() => WG.adoptUI.panel("album", "stamps"));
  await shot("7_album");
  await ev(() => WG.adoptUI.close());
  // hands-on care: bring the car home, dirty it, swoop down
  await ev((id) => {
    const S = WG.adopt.S,
      c = WG.adoptSim.find(S, id);
    c.sim = { at: "Russian Hill", from: null, to: null, t: 0, path: [], dest: null, task: "garage", wait: 0 };
    c.needs.shine = 12;
    WG.adopt.care(id, "dirty");
  }, id);
  await p.waitForFunction(() => WG.jobs.active, null, { timeout: 600000 });
  await p.waitForTimeout(1500);
  await shot("8_care");
  console.log("state in job:", await ev(() => WG.G.state));
  await ev(() => WG.jobs.cancel());
  await p.waitForFunction(() => WG.G.state === "adopt" && !WG.adoptCare.active, null, { timeout: 600000 });
  await p.waitForTimeout(800);
  await shot("9_back");
  // a little of everything in the sim
  console.log(
    "sim:",
    await ev(() => {
      const S = WG.adopt.S,
        Sim = WG.adoptSim,
        c = S.cars[0];
      const out = [];
      out.push(Sim.careDone(S, c.id, "dirty", 2) && "careDone ok");
      out.push(Sim.useItem(S, c.id, "snack_volt_bar").msg);
      out.push(Sim.pat(S, c.id).msg);
      WG.adopt.debug.fares(20000);
      WG.adopt.debug.rank(12);
      out.push(Sim.buy(S, "corner", 0).msg);
      out.push(Sim.claimDaily(S, "sourdough").msg);
      out.push(Sim.fish(S).msg);
      out.push(Sim.trade(S, "FOGG", 10).msg);
      out.push(Sim.bid(S, 0).msg);
      out.push(Sim.showEnter(S, c.id).msg);
      WG.adopt.debug.give("chip_lombard", 2);
      out.push(Sim.train(S, c.id, "handling").msg);
      out.push(Sim.rallyStart(S).msg);
      out.push(Sim.derbyStart(S, c.id).ok && Sim.derbyMove(S, "push").ok && "derby ok");
      WG.adopt.debug.newDay();
      out.push("day " + S.clock.day + ", diary " + S.diary.length);
      return out;
    }),
  );
  await ev(() => WG.adopt.changed());
  await ev(() => WG.adoptUI.panel("hood", "Twin Peaks"));
  await shot("10_twinpeaks");
  // back to the title, then make sure the arcade still starts
  await ev(() => WG.adopt.exit());
  await p.waitForTimeout(600);
  console.log("after exit:", await ev(() => WG.G.state), "fleet", await ev(() => WG.Traffic.cars.length + "/" + WG.world.fleet));
  await p.click("#t-start");
  await p.waitForTimeout(800);
  await p.click("#br-go");
  await p.waitForFunction(() => WG.G.state === "play", null, { timeout: 600000 });
  await p.waitForTimeout(2500);
  await shot("11_arcade");
  console.log("arcade state", await ev(() => WG.G.state + " zone " + WG.world.zoneKey + " problems " + WG.Traffic.cars.filter((c) => c.problem).length));
  console.log("errors:", errs.length ? errs.join("\n") : "none");
  await b.close();
})();
