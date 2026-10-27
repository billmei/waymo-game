const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const r = await p.evaluate(process.argv[2]);
  console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1));
  await b.close();
})();
