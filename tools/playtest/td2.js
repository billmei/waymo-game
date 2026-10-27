// node td2.js key cx cz hw : render the real zone (as world.js builds it) from above, with its graph
const { chromium } = require('playwright');
const fs = require('fs');
const [key, cx, cz, hw] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  p.on('pageerror', e => console.log('err:', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
  await p.goto('http://localhost:8123/index.html');
  await p.waitForFunction(() => window.WG && WG.G && WG.G.state === 'title', null, { timeout: 120000 });
  const res = await p.evaluate(([key, cx, cz, hw]) => {
    window.requestAnimationFrame = () => 0;
    const W = WG.world, S = W.SCALE;
    const t0 = performance.now();
    W.zone = null; W.setArea(key);
    const ms = Math.round(performance.now() - t0);
    const cam = new THREE.OrthographicCamera(-hw * S, hw * S, hw * S, -hw * S, 1, 20000);
    cam.position.set(cx * S, 3000, cz * S + 0.001); cam.up.set(0, 0, -1); cam.lookAt(cx * S, 0, cz * S); cam.updateMatrixWorld();
    const proj = (x, z) => { const v = new THREE.Vector3(x, 0, z).project(cam); return [Math.round((v.x * 0.5 + 0.5) * 1000), Math.round((-v.y * 0.5 + 0.5) * 1000)]; };
    WG.isle.frame(cam, 0.016, 1000, 1000);
    const r0 = WG.debug.renderer; r0.setSize(1000, 1000, false); r0.render(WG.debug.scene, cam);
    const N = W.graph.nodes;
    return { img: r0.domElement.toDataURL('image/png'), ms, n: N.length, e: W.graph.edges, houses: W.houses ? W.houses.geometry.attributes.position.count / 36 : 0,
      gn: N.map(n => [...proj(n.x, n.z), n.road ? 1 : 0, n.out.map(m => proj(N[m].x, N[m].z))]), start: proj(W.start.x, W.start.z), box: W.box,
      marks: W.marks.map(m => [m.name, ...proj(m.x, m.z)]) };
  }, [key, cx, cz, hw]);
  fs.writeFileSync('t2_' + key + '.png', Buffer.from(res.img.split(',')[1], 'base64'));
  delete res.img;
  fs.writeFileSync('t2_' + key + '.json', JSON.stringify(res));
  console.log(key, 'setArea ms', res.ms, 'nodes', res.n, 'edges', res.e, 'houses~', Math.round(res.houses), 'box', JSON.stringify(res.box));
  await b.close();
})();
