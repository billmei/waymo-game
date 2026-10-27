const { chromium } = require('playwright');
const specs = JSON.parse(process.argv[2]);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  const out = await p.evaluate((specs) => {
    const I = WG.isle, res = [];
    for (const sp of specs) {
      const a = sp.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const rows = [];
      for (let j = sp.j0; j <= sp.j1; j++) {
        let row = 'j' + String(j).padStart(4) + ' ';
        for (let i = sp.i0; i <= sp.i1; i++) {
          const lx = i * sp.u, lz = j * sp.v, x = lx * c - lz * s, z = lx * s + lz * c;
          const g = I.ISL.terrainY(x, z), n = I.zoneName(x, z), hit = I.hitsBuilding(x, g + 1.5 / 1.6, z, 1.5);
          const ch = g < 2.5 ? '~' : hit ? '#' : (n[0] + (n.split(' ')[1] || ' ')[0]);
          row += ch.padEnd(3);
        }
        rows.push(row);
      }
      res.push(sp.label + ' i' + sp.i0 + '..' + sp.i1 + '\n' + rows.join('\n'));
    }
    return res;
  }, specs);
  console.log(out.join('\n\n'));
  await b.close();
})();
