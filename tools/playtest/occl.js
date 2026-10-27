const { chromium } = require('playwright');
const k = +(process.argv[2] || 2), pick = +(process.argv[3] || 0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  p.on('pageerror', e => console.log('err:', e.message));
  const waitGame = (s) => p.evaluate((s) => new Promise(r => { const t0 = WG.G.t; const f = () => WG.G.t - t0 >= s ? r() : setTimeout(f, 100); f(); }), s);
  await p.goto('http://localhost:8123/index.html?low');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  await p.evaluate((k) => { WG.G.round = k; document.getElementById('pz-restart').click(); }, k);
  await p.click('#br-go');
  await p.waitForFunction(() => WG.G.state === 'play', null, { timeout: 60000 });
  const r = await p.evaluate((pick) => {
    const W = WG.world, P = WG.P, CAM = WG.debug.CAM;
    const zoom = 28, pitch = 46 * Math.PI / 180, found = [];
    for (const n of W.graph.nodes) for (let a = 0; a < 6.28; a += 0.2) {
      const sy = Math.sin(a), cy = Math.cos(a), lx = n.x, lz = n.z, ly = W.height(lx, lz) + 1.6;
      const cxp = lx + sy * Math.cos(pitch) * zoom, cyp = ly + Math.sin(pitch) * zoom, czp = lz + cy * Math.cos(pitch) * zoom;
      let hit = 0;
      for (let t = 0.1; t < 0.9; t += 0.05) if (W.hitsAt(lx + (cxp - lx) * t, ly + (cyp - ly) * t, lz + (czp - lz) * t, 0.5)) hit++;
      if (hit) found.push([n.x, n.z, a, hit]);
    }
    const f = found[pick % found.length];
    P.pos.set(f[0], W.groundY(f[0], f[1]), f[1]); P.path = []; CAM.yaw = f[2];
    return [found.length, f];
  }, pick);
  console.log('spot', JSON.stringify(r));
  await waitGame(2.5);
  await p.screenshot({ path: `occl${k}.png`, timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => { const c = WG.debug.camera; return { scr: WG.P.pos.clone().project(c).toArray().map(v => +v.toFixed(2)), t: WG.G.t.toFixed(1) }; })));
  await p.evaluate(() => { const o = WG.world.see; WG.world.see = () => o(null); });
  await waitGame(2);
  await p.screenshot({ path: `occl${k}_off.png`, timeout: 120000 });
  await b.close();
})();
