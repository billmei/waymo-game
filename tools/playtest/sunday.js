// Sunday Drive smoke test: boots straight into the mode with a fresh save, watches the fleet, gives a car a need and
// swoops down to take care of it (finishing the job by hand), earns seals and opens Downtown with the cloud-parting
// ceremony, photographs Coit Tower in Photo Mode, opens the scrapbook, switches on Free Drive, then checks that the
// arcade's shifts still start as before. Screenshots go to the current directory (sunday_*.png).
//   node sunday.js            (with the repo served on :8123, see README.md)
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(e.message));
  const shot = async (n, wait) => {
    await p.waitForTimeout(wait === undefined ? 2000 : wait);
    await p.screenshot({ path: "sunday_" + n + ".png", timeout: 180000 });
    console.log("shot", n);
  };
  const ev = (f, a) => p.evaluate(f, a);
  const check = (ok, what) => {
    console.log((ok ? "ok   " : "FAIL ") + what);
    if (!ok) process.exitCode = 1;
  };
  p.setDefaultTimeout(600000);
  await p.goto("http://localhost:8123/index.html?mode=sunday&reset=1");
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === "sunday", null, { timeout: 240000 });
  // headless frames are slow (SwiftShader), which stalls CSS animations: switch them off for the screenshots
  await p.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await shot("1_intro", 2500);
  await p.click("#sd-modal .btn.primary");
  await shot("2_city", 4000);
  check((await ev(() => WG.sunday.debug.City.cars.length)) === 3, "three cars on the map");

  // a need, the Inspector card, and a swoop down to take care of it
  const id = await ev(() => WG.sunday.debug.need(1, "dirty"));
  await ev((id) => WG.sunday.debug.select(id), id);
  await shot("3_card", 1500);
  console.log("card:", await ev(() => document.querySelector("#sd-card").innerText.replace(/\s+/g, " ")));
  await p.click('#sd-card [data-a="care"]');
  await p.waitForFunction(() => WG.jobs.active, null, { timeout: 600000 });
  check((await ev(() => WG.G.state)) === "sundayCare", "the job runs in the sundayCare state");
  await shot("4_job", 1500);
  // finish the job as if scrubbed clean
  await ev(() => {
    const j = WG.jobs.active;
    j.done = true;
    j.doneT = 0;
    j.q = 2;
    j.time = 4;
  });
  await p.waitForFunction(() => WG.G.state === "sunday" && !WG.sundaySwoop.active, null, { timeout: 600000 });
  await shot("5_back", 1500);
  const after = await ev(() => ({ cared: WG.sunday.debug.S.totalCared, notes: WG.sunday.debug.S.thankYouNotes.length, need: !!WG.sunday.debug.City.find(1).need, mode: WG.sunday.debug.City.find(1).mode }));
  console.log("after care:", JSON.stringify(after));
  check(after.cared === 1 && after.notes === 1 && !after.need && after.mode === "fare", "care counted, note written, car back to fares");

  // auto-care: an ignored need goes to a depot by itself
  await ev(() => {
    WG.sunday.debug.need(2, "charge");
    WG.sunday.debug.ageNeeds(200);
  });
  await p.waitForFunction(() => { const c = WG.sunday.debug.City.find(2); return c.need && c.need.auto; }, null, { timeout: 60000 });
  check(true, "an ignored need heads to a depot on its own");

  // seals and the cloud-parting ceremony
  await ev(() => WG.sunday.debug.seals(2));
  await ev(() => WG.sunday.debug.district("downtown"));
  await shot("6_unlock", 1200);
  await p.click("#sd-modal .btn.primary");
  await shot("7_ceremony", 3500);
  await p.waitForFunction(() => !document.querySelector("#sunday").classList.contains("cer"), null, { timeout: 600000 });
  await shot("8_opened", 2500);
  const open = await ev(() => ({ u: WG.sunday.debug.S.unlockedDistricts, seals: WG.sunday.debug.S.mapSeals, cars: WG.sunday.debug.City.cars.length, stems: WG.audio.stems }));
  console.log("opened:", JSON.stringify(open));
  check(open.u.includes("downtown") && open.seals === 0 && open.cars === 4 && open.stems.bass, "Downtown open, seals spent, a fourth car, the bass stem on");

  // Photo Mode: aim at Coit Tower and take its postcard
  await ev(() => WG.sunday.debug.photo());
  await ev(() => {
    const m = WG.isle.MARKS.find((q) => q.name === "Coit Tower"),
      K = WG.world.SCALE,
      P = WG.sundayPhoto;
    P.cam.pos.set(m.x * K + 260, m.y * K + 150, m.z * K + 260);
    P.cam.yaw = Math.atan2(260, 260);
    P.cam.pitch = -Math.atan2(100, Math.hypot(260, 260));
    WG.sundayPhoto.border = WG.sundayData.BORDERS[1];
    WG.sundayPhoto.filter = WG.sundayData.FILTERS[1];
  });
  await shot("9_viewfinder", 3000);
  console.log("detector:", await ev(() => document.querySelector("#sd-ph-det").textContent));
  await ev(() => WG.sundayPhoto.snap());
  await p.waitForFunction(() => Object.keys(WG.sunday.debug.S.postcards).length > 0, null, { timeout: 120000 }).catch(() => {});
  const pcs = await ev(() => WG.sunday.debug.S.postcards);
  console.log("postcards:", JSON.stringify(pcs));
  check(Object.keys(pcs).some((k) => /Coit/.test(k)), "Coit Tower postcard collected");
  await p.waitForTimeout(1500);
  await ev(() => WG.sundayPhoto.exit());
  await ev(() => WG.sunday.debug.book("postcards"));
  await shot("10_book", 2500);
  // open the photo big
  await p.click("#sd-book .sd-pc.got");
  await shot("11_photo", 2500);
  await ev(() => WG.sundayAlbum.close());

  // Free Drive: the whole city
  await ev(() => {
    const S = WG.sunday.debug.S;
    S.freeDrive = true;
  });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  await p.click("#sd-s-free"); // switches it back off (it was set on above): click twice to see both
  await p.click("#sd-s-free");
  await p.keyboard.press("Escape");
  await ev(() => {
    const c = WG.sunday.debug.City.cam;
    c.h = 1400 * WG.world.SCALE;
    c.x = -100 * WG.world.SCALE;
    c.z = -300 * WG.world.SCALE;
  });
  await shot("12_freedrive", 4000);
  check((await ev(() => WG.sunday.debug.City.open.size)) === 6, "Free Drive opens every district");

  // back to the title, and the arcade still starts
  await ev(() => WG.sunday.exit());
  await p.waitForFunction(() => WG.G.state === "title");
  await p.click("#t-arcade");
  await p.click("#t-start");
  await p.waitForFunction(() => WG.G.state === "brief");
  await p.click("#br-go");
  await p.waitForFunction(() => WG.G.state === "play", null, { timeout: 60000 });
  await shot("13_arcade", 2500);
  check(true, "the arcade's shift still starts");
  console.log(errs.length ? "errors:\n" + errs.join("\n") : "no errors");
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
