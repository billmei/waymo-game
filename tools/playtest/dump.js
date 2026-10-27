const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('console', m => console.log('console:', m.text()));
  p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const I = WG.isle;
    return { marks: I.MARKS.map(m => [m.id, m.name, Math.round(m.x), Math.round(m.z), Math.round(m.y), Math.round(m.h), m.r]),
      meshes: Object.keys(I.ISLAND.meshes) };
  });
  console.log(JSON.stringify(r, null, 0));
  await b.close();
})();
