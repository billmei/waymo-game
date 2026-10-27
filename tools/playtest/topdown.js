// usage: node topdown.js '<json zones>'   zones: [{key, label, names, ang,u,v,i0,i1,j0,j1, view:[cx,cz,halfW] (island units)}]
const { chromium } = require('playwright');
const fs = require('fs');
const zones = JSON.parse(process.argv[2]);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  await p.evaluate(() => {
    const r = WG.debug.renderer, o = r.render.bind(r);
    r.render = (s, c) => o(s, window.__cam || c);
    window.requestAnimationFrame = () => 0;
    document.querySelectorAll('.screen,#hud').forEach(e => e.style.display = 'none');
  });
  for (const z of zones) {
    const info = await p.evaluate((z) => { let r0;
      const W = WG.world, S = W.SCALE;
      W.ZONES[z.key] = z;
      W.zone = null;
      W.setArea(z.key);
      const [cx, cz, hw] = z.view;
      const cam = new THREE.OrthographicCamera(-hw * S, hw * S, hw * S, -hw * S, 1, 20000);
      cam.position.set(cx * S, 3000, cz * S + 0.001);
      cam.up.set(0, 0, -1);
      cam.lookAt(cx * S, 0, cz * S);
      cam.updateMatrixWorld();
      window.__cam = cam;
      const proj = (x, z2, y) => { const v = new THREE.Vector3(x, y || 0, z2).project(cam); return [Math.round((v.x * 0.5 + 0.5) * 1000), Math.round((-v.y * 0.5 + 0.5) * 1000)]; };
      const nodes = W.graph.nodes.map(n => [...proj(n.x, n.z), n.nb.filter(m => m > n.id).map(m => proj(W.graph.nodes[m].x, W.graph.nodes[m].z))]);
      const marks = WG.isle.MARKS.map(m => [m.name, ...proj(m.x * S, m.z * S)]);
      const area = [[W.AREA.lx0, W.AREA.lz0], [W.AREA.lx1, W.AREA.lz0], [W.AREA.lx1, W.AREA.lz1], [W.AREA.lx0, W.AREA.lz1]].map(([a, c]) => { const w = W.toWorld(a, c); return proj(w[0], w[1]); });
      WG.isle.frame(cam, 0.016, 1000, 1000);
      r0 = WG.debug.renderer; r0.setSize(1000, 1000, false); r0.render(WG.debug.scene, cam);
      const img = r0.domElement.toDataURL('image/png');
      return { img, nodes, marks, area, n: W.graph.nodes.length, e: W.graph.edges, start: proj(W.start.x, W.start.z) };
    }, z);
    fs.writeFileSync('td_' + z.key + '.png', Buffer.from(info.img.split(',')[1], 'base64'));
    delete info.img;
    fs.writeFileSync('td_' + z.key + '.json', JSON.stringify(info));
    console.log(z.key, 'nodes', info.n, 'edges', info.e);
  }
  await b.close();
})();
