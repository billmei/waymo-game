const { chromium } = require('playwright');
const shifts = (process.argv[2] || '0').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  p.on('pageerror', e => console.log('err:', e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
  await p.goto('http://localhost:8123/index.html?low');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 10) requestAnimationFrame(f); else r(10000 / (performance.now() - t0)); }; requestAnimationFrame(f); }));
  console.log('fps', fps.toFixed(2));
  const waitGame = (s) => p.evaluate((s) => new Promise(r => { const t0 = WG.G.t; const f = () => WG.G.t - t0 >= s ? r() : setTimeout(f, 100); f(); }), s);
  for (const k of shifts) {
    const t0 = Date.now();
    await p.evaluate((k) => { WG.G.round = k; document.getElementById('pz-restart').click(); }, k);
    console.log('shift', k, 'brief opened in', Date.now() - t0, 'ms');
    const info = await p.evaluate(() => ({ zone: WG.world.zoneKey, nodes: WG.world.graph.nodes.length, fleet: WG.world.fleet, cars: WG.debug && WG.G.state, marks: WG.world.marks.map(m => m.name + ' h' + m.h.toFixed(0)) }));
    console.log(JSON.stringify(info));
    await waitGame(+(process.argv[3] || 4));
    await p.screenshot({ path: `s${k}_brief.png`, timeout: 120000 });
    await p.click('#br-go');
    await p.waitForFunction(() => WG.G.state === 'play', null, { timeout: 60000 });
    await waitGame(2.5);
    await p.screenshot({ path: `s${k}_play.png`, timeout: 120000 });
    await p.evaluate(() => document.getElementById('h-pause').click());
  }
  await b.close();
})();
