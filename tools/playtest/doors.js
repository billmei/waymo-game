const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  p.on('pageerror', e => console.log('err:', e.message));
  const waitGame = (s) => p.evaluate((s) => new Promise(r => { const t0 = WG.G.t; const f = () => WG.G.t - t0 >= s ? r() : setTimeout(f, 100); f(); }), s);
  await p.goto('http://localhost:8123/index.html?low');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  await p.click('#t-start');
  console.log(await p.evaluate(() => JSON.stringify({ start: WG.world.start, kinds: [...document.querySelectorAll('#br-jobs span')].map(e => e.textContent), d: Math.hypot(WG.world.start.x - WG.world.marks[0].x, WG.world.start.z - WG.world.marks[0].z) })));
  await p.click('#br-go');
  await p.waitForFunction(() => WG.G.state === 'play', null, { timeout: 60000 });
  await waitGame(2);
  await p.screenshot({ path: 'm_play.png', timeout: 120000 });
  // a doors job on the nearest car
  const ok = await p.evaluate(() => {
    const P = WG.P, cars = WG.Traffic.cars.filter(c => !c.problem);
    let c = cars[0];
    for (const o of cars) if (Math.hypot(o.pos.x - P.pos.x, o.pos.z - P.pos.z) < Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z)) c = o;
    c.setProblem({ type: 'doors', max: 40, left: 40, doors: [0, 1, 2, 3] });
    c.state = 'problem'; c.speed = 0;
    P.pos.set(c.pos.x + c.fwd.z * 3, P.pos.y, c.pos.z - c.fwd.x * 3);
    WG.debug.startJob(c);
    window.__car = c;
    return !!WG.jobs.active;
  });
  console.log('job started', ok);
  await waitGame(1.5);
  await p.screenshot({ path: 'm_doors0.png', timeout: 120000 });
  // steer at each open door in turn
  for (let i = 0; i < 4; i++) {
    await p.evaluate((i) => { const j = WG.jobs.active; if (!j) return; const d = j.open.find(d => !d.shut); if (!d) return; const b = d.pivot.localToWorld(new THREE.Vector3(0, 0.8, 0.5)); j.steer = { x: b.x, z: b.z }; }, i);
    await waitGame(1.2);
  }
  await p.screenshot({ path: 'm_doors1.png', timeout: 120000 });
  console.log(await p.evaluate(() => JSON.stringify({ active: !!WG.jobs.active, shut: WG.jobs.active ? WG.jobs.active.open.map(d => d.shut) : 'done', score: WG.G.score, ollie: !!document.getElementById('job-ollie') })));
  await b.close();
})();
