#!/usr/bin/env node
/* Top-down maps of each shift's play area, for checking their size and layout. It serves the game, renders the real
   scene from straight above with an orthographic camera (north up) and draws over it: the play-area boundary (red
   dashes), the ground the crew can walk on (teal), the robotaxis' streets (yellow), where the crew starts (cyan dot)
   and the shift's landmarks (white diamonds), with the area's size and how far its farthest corner is from the start.

     node tools/map_levels.js                 # every shift, into maps/
     node tools/map_levels.js lombard beach   # just these play areas (keys of ZONES in js/world.js)
     node tools/map_levels.js --out /tmp/maps --grid --margin 120

   --grid draws the district's street grid (with its i, j line numbers) past the play area, for picking new bounds.
   Needs Playwright with Chromium (npm i -g playwright && npx playwright install chromium). */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const opt = { out: path.join(ROOT, "maps"), grid: false, margin: 40, zones: [] };
for (let k = 0; k < args.length; k++) {
  const a = args[k];
  if (a === "--out") opt.out = path.resolve(args[++k]);
  else if (a === "--grid") opt.grid = true;
  else if (a === "--margin") opt.margin = +args[++k];
  else opt.zones.push(a);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".png": "image/png" };
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// runs in the page: render one play area and draw the map over it
async function drawMap({ key, margin, grid }) {
  const W = WG.world,
    I = WG.isle,
    T = THREE,
    { renderer, scene } = window.__map;
  // the title screen's traffic drives the play area's streets: move it along with the map
  if (W.setArea(key) && WG.Traffic) {
    WG.Traffic.n = W.fleet;
    WG.Traffic.reset();
  }
  W.see(null);
  const A = W.AREA,
    Z = W.zone;
  const corners = [
    [A.lx0, A.lz0],
    [A.lx1, A.lz0],
    [A.lx1, A.lz1],
    [A.lx0, A.lz1],
  ].map(([a, b]) => W.toWorld(a, b));
  const xs = corners.map((c) => c[0]),
    zs = corners.map((c) => c[1]);
  const X0 = Math.min(...xs) - margin,
    X1 = Math.max(...xs) + margin,
    Z0 = Math.min(...zs) - margin,
    Z1 = Math.max(...zs) + margin;
  const PPM = Math.min(3, 2400 / Math.max(X1 - X0, Z1 - Z0));
  const w = Math.round((X1 - X0) * PPM),
    h = Math.round((Z1 - Z0) * PPM);
  // north (-z) up, east (+x) right
  const cam = new T.OrthographicCamera(X0, X1, -Z0, -Z1, 1, 20000);
  cam.position.set(0, 5000, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  // no haze, clouds or fog puffs between the camera and the ground
  const fog = scene.fog,
    fogD = I.U.uFogD.value,
    hidden = [];
  scene.fog = null;
  I.U.uFogD.value = 0;
  scene.traverse((o) => {
    if ((o.isSprite || o.isPoints || /cloud/i.test(o.name)) && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });
  const pr = renderer.getPixelRatio(),
    size = renderer.getSize(new T.Vector2());
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  I.frame(cam, 0, w, h);
  renderer.render(scene, cam);
  const shot = renderer.domElement.toDataURL("image/png");
  renderer.setPixelRatio(pr);
  renderer.setSize(size.x, size.y, false);
  scene.fog = fog;
  I.U.uFogD.value = fogD;
  hidden.forEach((o) => (o.visible = true));

  const img = new Image();
  img.src = shot;
  await img.decode();
  const HEAD = 70,
    cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h + HEAD;
  const g = cv.getContext("2d");
  g.fillStyle = "#111";
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(img, 0, HEAD);
  const P = (x, z) => [(x - X0) * PPM, (z - Z0) * PPM + HEAD];
  const label = (s, px, pz, size) => {
    g.font = "bold " + (size || 18) + "px sans-serif";
    g.lineWidth = 4;
    g.strokeStyle = "#000";
    g.fillStyle = "#fff";
    g.strokeText(s, px, pz);
    g.fillText(s, px, pz);
  };
  // the district's street grid, numbered, to pick a play area's bounds
  if (grid) {
    const [a0, b0] = W.toLocal(X0, Z0),
      [a1, b1] = W.toLocal(X1, Z1),
      [a2, b2] = W.toLocal(X1, Z0),
      [a3, b3] = W.toLocal(X0, Z1),
      lx0 = Math.min(a0, a1, a2, a3),
      lx1 = Math.max(a0, a1, a2, a3),
      lz0 = Math.min(b0, b1, b2, b3),
      lz1 = Math.max(b0, b1, b2, b3);
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.lineWidth = 1;
    for (let i = Math.floor(lx0 / Z.u); i <= Math.ceil(lx1 / Z.u); i++) {
      const [ax, az] = P(...W.toWorld(i * Z.u, lz0)),
        [bx, bz] = P(...W.toWorld(i * Z.u, lz1));
      g.beginPath();
      g.moveTo(ax, az);
      g.lineTo(bx, bz);
      g.stroke();
    }
    for (let j = Math.floor(lz0 / Z.v); j <= Math.ceil(lz1 / Z.v); j++) {
      const [ax, az] = P(...W.toWorld(lx0, j * Z.v)),
        [bx, bz] = P(...W.toWorld(lx1, j * Z.v));
      g.beginPath();
      g.moveTo(ax, az);
      g.lineTo(bx, bz);
      g.stroke();
    }
    for (let i = Math.floor(lx0 / Z.u); i <= Math.ceil(lx1 / Z.u); i++)
      for (let j = Math.floor(lz0 / Z.v); j <= Math.ceil(lz1 / Z.v); j++) {
        const [px, pz] = P(...W.toWorld(i * Z.u, j * Z.v));
        if (px > 0 && px < w && pz > HEAD && pz < h + HEAD) label(i + "," + j, px + 3, pz - 3, 11);
      }
  }
  // walkable ground, on the game's 1 m walk grid
  let walk = 0,
    street = 0;
  g.fillStyle = "rgba(54, 211, 196, 0.28)";
  for (let z = Math.floor(Z0); z < Z1; z++)
    for (let x = Math.floor(X0); x < X1; x++) {
      if (!W.inArea(x + 0.5, z + 0.5) || W.isBlocked(x + 0.5, z + 0.5, 0.45)) continue;
      walk++;
      const [px, pz] = P(x, z);
      g.fillRect(px, pz, PPM + 0.5, PPM + 0.5);
    }
  // the play-area boundary
  g.strokeStyle = "#ff3d6e";
  g.lineWidth = 3;
  g.setLineDash([12, 8]);
  g.beginPath();
  corners.forEach(([x, z], i) => {
    const [px, pz] = P(x, z);
    i ? g.lineTo(px, pz) : g.moveTo(px, pz);
  });
  g.closePath();
  g.stroke();
  g.setLineDash([]);
  // the robotaxis' streets
  const nodes = W.graph.nodes;
  g.strokeStyle = "#ffd23f";
  g.lineWidth = 3;
  for (const n of nodes)
    for (const m of n.nb) {
      if (m < n.id) continue;
      const o = nodes[m];
      street += Math.hypot(o.x - n.x, o.z - n.z);
      const [ax, az] = P(n.x, n.z),
        [bx, bz] = P(o.x, o.z);
      g.beginPath();
      g.moveTo(ax, az);
      g.lineTo(bx, bz);
      g.stroke();
    }
  g.fillStyle = "#ffd23f";
  for (const n of nodes) {
    const [px, pz] = P(n.x, n.z);
    g.beginPath();
    g.arc(px, pz, 4, 0, 7);
    g.fill();
  }
  // the crew's start
  {
    const [px, pz] = P(W.start.x, W.start.z);
    g.fillStyle = "#36d3c4";
    g.strokeStyle = "#000";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px, pz, 9, 0, 7);
    g.fill();
    g.stroke();
  }
  // the landmarks (an arrow on the edge for one off the map)
  for (const m of W.marks) {
    let [px, pz] = P(m.x, m.z);
    const off = px < 0 || px > w || pz < HEAD || pz > h + HEAD;
    px = Math.min(w - 10, Math.max(10, px));
    pz = Math.min(h + HEAD - 10, Math.max(HEAD + 10, pz));
    g.fillStyle = "#fff";
    g.strokeStyle = "#000";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(px, pz - 10);
    g.lineTo(px + 8, pz);
    g.lineTo(px, pz + 10);
    g.lineTo(px - 8, pz);
    g.closePath();
    g.fill();
    g.stroke();
    const s = m.name + (off ? " (off the map, " + Math.round(Math.hypot(m.x - W.start.x, m.z - W.start.z)) + " m)" : "");
    g.font = "bold 18px sans-serif";
    const tw = g.measureText(s).width;
    label(s, px + 12 + tw > w ? px - 12 - tw : px + 12, pz + 6);
  }
  // a 100 m scale bar
  {
    const bx = 20,
      by = cv.height - 24;
    g.fillStyle = "rgba(0,0,0,0.6)";
    g.fillRect(bx - 8, by - 26, 100 * PPM + 70, 40);
    g.fillStyle = "#fff";
    g.fillRect(bx, by, 100 * PPM, 6);
    g.font = "bold 16px sans-serif";
    g.fillText("100 m", bx + 100 * PPM + 8, by + 8);
  }
  const wM = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]),
    hM = Math.hypot(corners[3][0] - corners[0][0], corners[3][1] - corners[0][1]);
  let far = 0;
  for (const n of nodes) far = Math.max(far, Math.hypot(n.x - W.start.x, n.z - W.start.z));
  g.fillStyle = "#fff";
  g.font = "bold 24px sans-serif";
  g.fillText((Z.label || Z.name) + "  (" + key + ")", 16, 30);
  g.font = "16px sans-serif";
  g.fillText(
    `${wM.toFixed(0)} × ${hM.toFixed(0)} m · walkable ${(walk / 1000).toFixed(1)}k m² · ${nodes.length} corners, ${W.graph.edges} street blocks (${(street / 1000).toFixed(2)} km) · fleet ${W.fleet} · farthest corner from the start ${far.toFixed(0)} m`,
    16,
    56
  );
  return { png: cv.toDataURL("image/png"), key, w: Math.round(wM), h: Math.round(hM), walk, corners: nodes.length, edges: W.graph.edges, street: Math.round(street), fleet: W.fleet, far: Math.round(far) };
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  // the game keeps its renderer to itself: hand it to the map maker
  await page.route("**/js/game.js", async (route) => {
    const r = await route.fetch(),
      body = (await r.text()).replace("W.build(scene, renderer);", "W.build(scene, renderer); window.__map = { renderer, scene };");
    route.fulfill({ response: r, body });
  });
  await page.goto("http://127.0.0.1:" + server.address().port + "/index.html");
  await page.waitForFunction(() => window.__map && WG.world.graph, null, { timeout: 180000 });
  const zones = opt.zones.length ? opt.zones : await page.evaluate(() => Object.keys(WG.world.ZONES));
  fs.mkdirSync(opt.out, { recursive: true });
  for (const key of zones) {
    const r = await page.evaluate(drawMap, { key, margin: opt.margin, grid: opt.grid });
    const file = path.join(opt.out, key + ".png");
    fs.writeFileSync(file, Buffer.from(r.png.split(",")[1], "base64"));
    delete r.png;
    console.log(file, JSON.stringify(r));
  }
  await browser.close();
  server.close();
})();
