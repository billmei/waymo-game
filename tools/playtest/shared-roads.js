// Regression check for the shared, ground-level road map. Serve the repo on :8123 first.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const errors = [];
  const out = path.join(__dirname, "../../work");
  fs.mkdirSync(out, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://localhost:8123/index.html?mode=adopt&reset=1&seed=7");
    await page.waitForFunction(() => window.WG?.G?.state === "adopt", null, { timeout: 180000 });
    const report = await page.evaluate(() => {
      const S = WG.adoptSim, M = WG.adoptMap, I = WG.isle, K = M.K, failures = [];
      const check = (ok, message) => { if (!ok && failures.length < 30) failures.push(message); };
      let samples = 0, vertices = 0;
      for (const e of S.G.edges) {
        const a = S.G.hoods[e.a], b = S.G.hoods[e.b];
        const first = S.edgePoint(e, e.a, 0), last = S.edgePoint(e, e.a, 1);
        check(Math.hypot(first.x-a.x,first.z-a.z)<1e-6 && Math.hypot(last.x-b.x,last.z-b.z)<1e-6, "Disconnected endpoints: "+e.a+" / "+e.b);
        const n = Math.ceil(e.len);
        for (let i=0;i<=n;i++) {
          const p=S.edgePoint(e,e.a,i/n),r=S.edgePoint(e,e.b,1-i/n),y=I.groundH(p.x,p.z);
          check(y>=2.5,"Road in water: "+e.a+" / "+e.b);
          check(!I.hitsBuilding(p.x,y+1,p.z,M.ROAD_W*0.62),"Building overlap: "+e.a+" / "+e.b+" @ "+p.x+","+p.z);
          check(Math.hypot(p.x-r.x,p.z-r.z)<1e-6 && Math.hypot(p.dx+r.dx,p.dz+r.dz)<1e-6,"Reverse mismatch: "+e.a+" / "+e.b);
          check(Math.abs(M.edgeY(e,i/n)-y*K-1.1)<1e-6,"Road/car height mismatch");
          samples++;
        }
        const geometry=M.roads.find(r=>r.e===e).mesh.geometry, positions=geometry.attributes.position;
        for(let i=0;i<positions.count;i++) {
          const x=positions.getX(i)/K,z=positions.getZ(i)/K,y=I.groundH(x,z),height=positions.getY(i)-y*K;
          check(!I.hitsBuilding(x,y+1,z,0),"Road mesh inside building: "+e.a+" / "+e.b);
          check(height>=0.59 && height<=1.11,"Road mesh above/below ground");vertices++;
        }
      }
      for(const a of S.G.names)for(const b of S.G.names)check(!!S.route(a,b),"Unreachable: "+a+" / "+b);
      return { neighborhoods:S.G.names.length, connections:S.G.edges.length,samples,vertices,failures };
    });
    console.log(JSON.stringify(report,null,2));
    assert.deepEqual(report.failures, []);
    // Exercise adoption and drawing a car along a bent route, including both sides of each corner.
    await page.click("#ad-modal .btn.primary");
    await page.click('#ad-panel [data-a="adopt"]');
    await page.fill("#ad-name", "Street Tester");
    await page.click('#ad-modal [data-a="adoptOk"]');
    await page.evaluate(() => { WG.adoptUI.closeModal(); WG.adoptUI.close(); });
    const motion = await page.evaluate(() => {
      const S=WG.adopt.S,Sim=WG.adoptSim,M=WG.adoptMap,car=S.cars[0];
      S.settings.speed=0;
      const e=Sim.edgeOf("Russian Hill","North Beach"),failures=[];
      for(const from of [e.a,e.b]) for(const corner of e.points) for(const delta of [-0.01,0,0.01]) {
        const t=Math.max(0,Math.min(1,corner.distance/e.len+delta/e.len));
        Object.assign(car.sim,{from,to:from===e.a?e.b:e.a,t,task:"ride",at:from});
        M.update(1/60,S,0);
        const expected=Sim.edgePoint(e,from,t),actual=M.carPos(car.id);
        if(!actual || Math.hypot(actual.x-expected.x*M.K,actual.z-expected.z*M.K)>1e-5)failures.push(t);
      }
      Object.assign(M.cam,{x:650*M.K,z:-1200*M.K,h:400*M.K,yaw:0,follow:null,ride:null});
      return failures;
    });
    assert.deepEqual(motion,[]);
    await page.screenshot({ path: path.join(out,"adopt-streets.png"), timeout:180000 });
    // Switch modes in the same page: geometry and edge objects must remain identical.
    await page.evaluate(() => { WG.adopt.exit(); WG.sunday.enter(); });
    await page.waitForFunction(() => WG.G.state === "sunday");
    const shared = await page.evaluate(() => {
      const City=WG.sundayCity,M=WG.adoptMap,Sim=WG.adoptSim;
      City.setOpen(WG.sundayData.DISTRICTS.map(d=>d.id),false);
      City.paused=true;
      const car=City.cars[0],e=Sim.edgeOf("Russian Hill","North Beach"),failures=[];
      for(const from of [e.a,e.b])for(const corner of e.points) {
        const t=corner.distance/e.len;
        Object.assign(car,{from,to:from===e.a?e.b:e.a,t,at:from});
        City.update(1/60,0,{});
        const p=Sim.edgePoint(e,from,t);
        if(Math.hypot(car.x-p.x*M.K,car.z-p.z*M.K)>1e-5)failures.push("Sunday car leaves street");
      }
      for(let i=0;i<M.roads.length;i++) {
        const a=M.roads[i],b=City.roads[i];
        if(a.e!==b.e)failures.push("Different edge objects");
        const av=a.mesh.geometry.attributes.position.array,bv=b.mesh.geometry.attributes.position.array;
        if(av.length!==bv.length || av.some((v,i)=>v!==bv[i]))failures.push("Different road geometry");
      }
      Object.assign(City.cam,{x:650*M.K,z:-1200*M.K,h:400*M.K,yaw:0,follow:null,ride:null,glide:null});
      return failures;
    });
    assert.deepEqual(shared,[]);
    await page.locator("#sd-modal .btn.primary").click();
    await page.screenshot({path:path.join(out,"sunday-streets.png"),timeout:180000});
    assert.deepEqual(errors,[]);
    console.log("PASS: all routes clear buildings; both modes share identical roads and follow turns without cutting corners.");
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
