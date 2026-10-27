// node roads.js '<json: {zone, slope, view:[cx,cz,hw], routes:[{name, goal, box, grade, starts:"nodes"|[[x,z]], startFilter:{minH,maxH}}]}>'
const { chromium } = require('playwright');
const fs = require('fs');
const job = JSON.parse(process.argv[2]);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  await p.addScriptTag({ path: 'router.js' });
  const res = await p.evaluate((job) => {
    window.requestAnimationFrame = () => 0;
    const W = WG.world, S = W.SCALE, Z = W.ZONES[job.zone];
    Object.assign(Z, job.patch || {});
    W.zone = null; W.setArea(job.zone);
    const nodes = W.graph.nodes.map(n => [n.x / S, n.z / S, WG.isle.groundH(n.x / S, n.z / S)]);
    const routes = [];
    for (const r of job.routes || []) {
      let starts = r.walk ? null : r.starts === 'nodes' ? nodes.filter(n => n[2] >= (r.minH ?? -1) && n[2] <= (r.maxH ?? 1e9)).map(n => [n[0], n[1]]) : r.starts;
      const t0 = performance.now();
      const out = r.walk ? window.__walk(r) : window.__route(Object.assign({}, r, { starts }));
      routes.push({ name: r.name, pts: out.pts, it: out.it || out.why || out.ok, ms: Math.round(performance.now() - t0) });
    }
    const [cx, cz, hw] = job.view;
    const cam = new THREE.OrthographicCamera(-hw * S, hw * S, hw * S, -hw * S, 1, 20000);
    cam.position.set(cx * S, 3000, cz * S + 0.001); cam.up.set(0, 0, -1); cam.lookAt(cx * S, 0, cz * S); cam.updateMatrixWorld();
    const proj = (x, z) => { const v = new THREE.Vector3(x * S, 0, z * S).project(cam); return [Math.round((v.x * 0.5 + 0.5) * 1000), Math.round((-v.y * 0.5 + 0.5) * 1000)]; };
    WG.isle.frame(cam, 0.016, 1000, 1000);
    const r0 = WG.debug.renderer; r0.setSize(1000, 1000, false); r0.render(WG.debug.scene, cam);
    const img = r0.domElement.toDataURL('image/png');
    const gn = W.graph.nodes.map(n => [...proj(n.x / S, n.z / S), n.nb.filter(m => m > n.id).map(m => proj(W.graph.nodes[m].x / S, W.graph.nodes[m].z / S))]);
    const marks = WG.isle.MARKS.map(m => [m.name, ...proj(m.x, m.z)]);
    return { img, nodes: nodes.map(n => n.map(v => Math.round(v))), gn, marks, routes: routes.map(r => Object.assign(r, { px: r.pts ? r.pts.map(q => proj(q[0], q[1])) : null })) };
  }, job);
  fs.writeFileSync('rd_' + job.zone + '.png', Buffer.from(res.img.split(',')[1], 'base64'));
  delete res.img;
  fs.writeFileSync('rd_' + job.zone + '.json', JSON.stringify(res));
  for (const r of res.routes) console.log(r.name, r.ms + 'ms', 'it', r.it, JSON.stringify(r.pts));
  console.log('graph nodes', res.gn.length);
  await b.close();
})();
