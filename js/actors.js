/* Waymo Care · the actors: the robotaxis (model and traffic) and the crew member, a big-headed toy person. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const T = THREE,
    W = WG.world;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function roundBox(w, h, d, r, seg) {
    const g = new T.BoxGeometry(w, h, d, seg || 4, seg || 4, seg || 4),
      p = g.attributes.position,
      nr = g.attributes.normal,
      ix = w / 2 - r,
      iy = h / 2 - r,
      iz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        cx = clamp(x, -ix, ix),
        cy = clamp(y, -iy, iy),
        cz = clamp(z, -iz, iz);
      let nx = x - cx,
        ny = y - cy,
        nz = z - cz;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      p.setXYZ(i, cx + nx * r, cy + ny * r, cz + nz * r);
      nr.setXYZ(i, nx, ny, nz);
    }
    return g;
  }

  /* ---------- soft blob shadows under the toys (the island has no shadow maps either) ---------- */
  const BLOB = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d"),
      g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(20,30,60,0.55)");
    g.addColorStop(0.6, "rgba(20,30,60,0.32)");
    g.addColorStop(1, "rgba(20,30,60,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const m = new T.MeshBasicMaterial({
        map: new T.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
      geo = new T.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    return (sx, sz) => {
      const b = new T.Mesh(geo, m);
      b.scale.set(sx, 1, sz);
      b.position.y = 0.06;
      b.renderOrder = 2;
      return b;
    };
  })();
  WG.blob = BLOB;

  /* ---------- the robotaxi ---------- */
  const MAT = {
    body: new T.MeshPhongMaterial({ color: 0xf8f9fb, shininess: 70, specular: 0x666666 }),
    trim: new T.MeshLambertMaterial({ color: 0x2b3038 }),
    glass: new T.MeshPhongMaterial({ color: 0x1c2734, shininess: 110, specular: 0x9ab }),
    tire: new T.MeshLambertMaterial({ color: 0x23262b }),
    hub: new T.MeshPhongMaterial({ color: 0xc7ccd3, shininess: 50 }),
    tail: new T.MeshLambertMaterial({ color: 0xe8433f, emissive: 0x330000 }),
    teal: new T.MeshLambertMaterial({ color: 0x36d3c4, emissive: 0x0b4a44 }),
    mud: new T.MeshLambertMaterial({ color: 0x7a5636 }),
    dust: new T.MeshLambertMaterial({ color: 0xb59a6a }),
    poop: new T.MeshLambertMaterial({ color: 0xf0efe6 }),
    cone: new T.MeshLambertMaterial({ color: 0xff7a1a }),
    white: new T.MeshLambertMaterial({ color: 0xffffff }),
    bird: new T.MeshLambertMaterial({ color: 0x8e96a3 }),
    birdH: new T.MeshLambertMaterial({ color: 0x5d7d86 }),
    beak: new T.MeshLambertMaterial({ color: 0xe9a23b }),
  };
  const GEO = {
    body: roundBox(1.9, 0.8, 4.6, 0.34, 4),
    skirt: roundBox(1.94, 0.3, 4.5, 0.12, 2),
    cabin: roundBox(1.72, 0.74, 2.7, 0.3, 4),
    roof: roundBox(1.56, 0.12, 2.2, 0.06, 2),
    hood: roundBox(1.7, 0.2, 1.5, 0.1, 2),
    wheel: new T.CylinderGeometry(0.4, 0.4, 0.32, 16),
    hubG: new T.CylinderGeometry(0.22, 0.22, 0.34, 12),
    domeB: new T.CylinderGeometry(0.42, 0.46, 0.28, 20),
    domeT: new T.CylinderGeometry(0.34, 0.38, 0.24, 20),
    ring: new T.CylinderGeometry(0.39, 0.39, 0.06, 20),
    box: new T.BoxGeometry(1, 1, 1),
    sph: new T.SphereGeometry(1, 12, 10),
    cyl: new T.CylinderGeometry(1, 1, 1, 10),
    cone: new T.ConeGeometry(0.26, 0.72, 14),
    coneBase: new T.BoxGeometry(0.62, 0.07, 0.62),
    stripe: new T.CylinderGeometry(0.17, 0.2, 0.1, 14),
  };
  function add(parent, geo, mat, x, y, z, sx, sy, sz) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (sx !== undefined) m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function makeCone() {
    const g = new T.Group();
    add(g, GEO.coneBase, MAT.cone, 0, 0.035, 0);
    add(g, GEO.cone, MAT.cone, 0, 0.42, 0);
    add(g, GEO.stripe, MAT.white, 0, 0.45, 0);
    return g;
  }
  function makeBird() {
    const g = new T.Group();
    add(g, GEO.sph, MAT.bird, 0, 0.14, 0, 0.16, 0.13, 0.24);
    add(g, GEO.sph, MAT.birdH, 0, 0.27, -0.16, 0.09, 0.09, 0.09);
    add(g, GEO.sph, MAT.beak, 0, 0.26, -0.26, 0.03, 0.025, 0.05);
    add(g, GEO.sph, MAT.bird, 0, 0.17, 0.2, 0.09, 0.03, 0.12);
    return g;
  }
  WG.makeCone = makeCone;
  WG.CAR_MAT = MAT;

  // every robotaxi shares three merged, vertex-coloured meshes: the car, the spinning lidar head and the headlights
  let CAR = null;
  const HEAD_MAT = new T.MeshLambertMaterial({ color: 0xfffbe8, emissive: 0x333322 });
  function carGeo() {
    if (CAR) return CAR;
    const M = new W.Merge(),
      S = new W.Merge(),
      Hd = new W.Merge(),
      put = (m, geo, col, x, y, z, sx, sy, sz, rz) => m.geo(geo, col, W.mat(x, y, z, sx || 1, sy || 1, sz || 1, 0, 0, rz || 0));
    const WHITE = "#f8f9fb",
      TRIM = "#2b3038";
    put(M, GEO.skirt, TRIM, 0, 0.5, 0);
    put(M, GEO.body, WHITE, 0, 0.82, 0);
    put(M, GEO.cabin, "#1c2734", 0, 1.45, 0.25);
    put(M, GEO.roof, WHITE, 0, 1.83, 0.25);
    put(M, GEO.domeB, WHITE, 0, 2.0, 0.1);
    // perimeter sensors and mirror pods
    put(M, GEO.box, TRIM, 0, 0.72, -2.3, 0.7, 0.16, 0.08);
    for (const s of [-1, 1]) {
      put(M, GEO.box, WHITE, s * 1.04, 1.28, -0.75, 0.22, 0.22, 0.36);
      put(M, GEO.box, TRIM, s * 1.1, 1.28, -0.84, 0.08, 0.16, 0.2);
      put(M, GEO.cyl, TRIM, s * 0.82, 1.17, -1.95, 0.09, 0.2, 0.09);
      put(M, GEO.box, "#e8433f", s * 0.64, 0.98, 2.3, 0.4, 0.12, 0.06);
      put(Hd, GEO.box, "#fffbe8", s * 0.62, 0.92, -2.3, 0.44, 0.13, 0.06);
    }
    for (const [x, z] of [
      [-0.9, -1.45],
      [0.9, -1.45],
      [-0.9, 1.45],
      [0.9, 1.45],
    ]) {
      put(M, GEO.wheel, "#23262b", x, 0.4, z, 1, 1, 1, Math.PI / 2);
      put(M, GEO.hubG, "#c7ccd3", x, 0.4, z, 1, 1, 1, Math.PI / 2);
    }
    put(S, GEO.domeT, TRIM, 0, 0, 0);
    put(S, GEO.box, "#36d3c4", 0.3, 0.02, 0, 0.12, 0.1, 0.06);
    const bm = M.mesh(new T.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x555555 })),
      sm = S.mesh(new T.MeshLambertMaterial({ vertexColors: true })),
      hm = Hd.mesh(HEAD_MAT);
    CAR = { body: [bm.geometry, bm.material], spin: [sm.geometry, sm.material], head: [hm.geometry, hm.material] };
    return CAR;
  }
  WG.CAR_HEAD = HEAD_MAT;

  function makeCar() {
    const C = carGeo(),
      root = new T.Group(),
      g = new T.Group();
    root.add(g);
    root.add(BLOB(2.9, 5.6));
    const body = new T.Mesh(C.body[0], C.body[1]);
    body.castShadow = true;
    g.add(body);
    g.add(new T.Mesh(C.head[0], C.head[1]));
    // the spinning lidar
    const spin = new T.Group();
    spin.position.set(0, 2.24, 0.1);
    g.add(spin);
    spin.add(new T.Mesh(C.spin[0], C.spin[1]));
    const ring = add(spin, GEO.ring, MAT.teal.clone(), 0, -0.06, 0);
    ring.castShadow = false;
    const wheels = [],
      headMat = HEAD_MAT;
    // the problems you can see from the street (the dirt and the cones are laid out afresh each time)
    const dirt = new T.Group();
    g.add(dirt);
    dirt.visible = false;
    const cone = new T.Group();
    cone.visible = false;
    g.add(cone);
    const birds = new T.Group();
    for (const [x, y, z, r] of [
      [0.3, 1.9, 0.9, 0.4],
      [-0.4, 1.9, 0.0, -0.6],
      [0.1, 1.24, -1.4, 2.6],
    ]) {
      const b = makeBird();
      b.position.set(x, y, z);
      b.rotation.y = r;
      birds.add(b);
    }
    birds.visible = false;
    g.add(birds);

    // status bubble
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const tex = new T.CanvasTexture(cv);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
    sprite.scale.set(3.4, 3.4, 1);
    sprite.position.set(0, 4.2, 0);
    sprite.renderOrder = 10;
    sprite.visible = false;
    root.add(sprite);

    root.traverse((o) => {
      if (o.isMesh) o.receiveShadow = false;
    });
    return { root, g, body, spin, ring, wheels, headMat, dirt, cone, birds, sprite, cv, tex };
  }
  WG.makeCar = makeCar;

  // dirt where it lands this time: rays from all round the car onto its body, spread out, clear of the wheels, the skirt
  // and the lidar
  let _probe = null;
  const _ray = new T.Raycaster(),
    UP = new T.Vector3(0, 1, 0);
  function dirtSpots(n) {
    if (!_probe) {
      const C = carGeo();
      _probe = new T.Mesh(C.body[0], new T.MeshBasicMaterial({ side: T.FrontSide }));
      _probe.updateMatrixWorld(true);
    }
    const out = [],
      o = new T.Vector3(),
      at = new T.Vector3();
    for (let k = 0; out.length < n && k < 600; k++) {
      const a = Math.random() * Math.PI * 2,
        e = Math.random() * 1.2;
      o.set(Math.cos(a) * Math.cos(e) * 6, 0.8 + Math.sin(e) * 6, Math.sin(a) * Math.cos(e) * 7);
      at.set((Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 1.1, (Math.random() - 0.5) * 4);
      _ray.set(o, at.sub(o).normalize());
      const h = _ray.intersectObject(_probe, false)[0];
      if (!h || !h.face) continue;
      const p = h.point,
        nr = h.face.normal.clone();
      if (p.y < 0.55 || p.y > 2.05) continue;
      if (Math.abs(p.x) > 0.9 && p.y < 0.9 && Math.abs(Math.abs(p.z) - 1.45) < 0.55) continue;
      if (out.some((q) => q.p.distanceTo(p) < 0.62)) continue;
      const q = Math.random();
      out.push({ p: p.clone().addScaledVector(nr, 0.01), n: nr, s: 0.15 + Math.random() * 0.12, k: q < 0.22 ? 1 : q < 0.5 ? 2 : 0 });
    }
    return out;
  }
  WG.dirtSpots = dirtSpots;
  // where the cones go when somebody boxes a car in: on the road ahead, behind and on the street side (car units)
  const CONE_RING = [
    [0.1, -3.3],
    [-0.9, -3.0],
    [0.95, -3.1],
    [-1.75, -1.6],
    [-1.85, 0.2],
    [-1.75, 1.8],
    [0.0, 3.25],
    [-0.95, 3.0],
    [0.9, 3.1],
  ];
  function coneSpots(n) {
    // always one ahead and one behind, so the car really is stuck; the rest anywhere round it
    const front = [0, 1, 2].sort(() => Math.random() - 0.5),
      back = [6, 7, 8].sort(() => Math.random() - 0.5),
      rest = front.slice(1).concat(back.slice(1), [3, 4, 5]).sort(() => Math.random() - 0.5),
      pick = [front[0], back[0]].concat(rest).slice(0, n);
    return pick.map((i) => {
      const [x, z] = CONE_RING[i];
      return [x + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3];
    });
  }
  WG.coneSpots = coneSpots;

  /* ---------- status icons (also used by the HUD) ---------- */
  const KIND = {
    dirty: { col: "#3aa6e8", label: "Dirty" },
    charge: { col: "#3cc35a", label: "Low battery" },
    cone: { col: "#ff8a1f", label: "Coned in" },
    birds: { col: "#8a7fd8", label: "Pigeons" },
    reboot: { col: "#e8508a", label: "Needs reboot" },
    vacuum: { col: "#e0a21a", label: "Messy inside" },
    doors: { col: "#1fae9f", label: "Doors open" },
  };
  WG.KIND = KIND;
  function drawIcon(x, kind, cx, cy, s) {
    x.save();
    x.translate(cx, cy);
    x.scale(s, s);
    x.lineJoin = x.lineCap = "round";
    if (kind === "dirty") {
      // a sponge with bubbles
      x.fillStyle = "#ffd44a";
      x.strokeStyle = "#c99a12";
      x.lineWidth = 3;
      x.beginPath();
      x.roundRect ? x.roundRect(-20, -8, 40, 24, 7) : x.rect(-20, -8, 40, 24);
      x.fill();
      x.stroke();
      x.fillStyle = "#e7b520";
      for (const [a, b] of [
        [-10, 2],
        [4, 8],
        [10, -1],
      ]) {
        x.beginPath();
        x.arc(a, b, 3, 0, 7);
        x.fill();
      }
      x.fillStyle = "rgba(160,220,255,.9)";
      x.strokeStyle = "#5ab3e6";
      x.lineWidth = 2;
      for (const [a, b, r] of [
        [-12, -18, 6],
        [4, -22, 8],
        [17, -14, 5],
      ]) {
        x.beginPath();
        x.arc(a, b, r, 0, 7);
        x.fill();
        x.stroke();
      }
    } else if (kind === "charge") {
      x.fillStyle = "#fff";
      x.strokeStyle = "#2f8e45";
      x.lineWidth = 4;
      x.beginPath();
      x.roundRect ? x.roundRect(-22, -12, 40, 24, 5) : x.rect(-22, -12, 40, 24);
      x.fill();
      x.stroke();
      x.fillStyle = "#2f8e45";
      x.fillRect(19, -5, 5, 10);
      x.fillStyle = "#ff5a4a";
      x.fillRect(-18, -8, 8, 16);
      x.fillStyle = "#ffd23a";
      x.strokeStyle = "#b8860b";
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(2, -20);
      x.lineTo(-8, 3);
      x.lineTo(0, 3);
      x.lineTo(-4, 20);
      x.lineTo(10, -4);
      x.lineTo(2, -4);
      x.closePath();
      x.fill();
      x.stroke();
    } else if (kind === "cone") {
      x.fillStyle = "#ff7a1a";
      x.strokeStyle = "#b9500b";
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(-6, -22);
      x.lineTo(6, -22);
      x.lineTo(15, 14);
      x.lineTo(-15, 14);
      x.closePath();
      x.fill();
      x.stroke();
      x.fillStyle = "#fff";
      x.beginPath();
      x.moveTo(-9, -6);
      x.lineTo(9, -6);
      x.lineTo(11, 2);
      x.lineTo(-11, 2);
      x.closePath();
      x.fill();
      x.fillStyle = "#ff7a1a";
      x.fillRect(-21, 13, 42, 7);
      x.strokeRect(-21, 13, 42, 7);
    } else if (kind === "birds") {
      x.fillStyle = "#9aa3b0";
      x.strokeStyle = "#5c6470";
      x.lineWidth = 3;
      x.beginPath();
      x.ellipse(2, 4, 17, 12, -0.2, 0, 7);
      x.fill();
      x.stroke();
      x.fillStyle = "#6b8f99";
      x.beginPath();
      x.arc(-12, -8, 9, 0, 7);
      x.fill();
      x.stroke();
      x.fillStyle = "#e9a23b";
      x.beginPath();
      x.moveTo(-20, -8);
      x.lineTo(-27, -5);
      x.lineTo(-20, -4);
      x.fill();
      x.fillStyle = "#222";
      x.beginPath();
      x.arc(-14, -10, 2, 0, 7);
      x.fill();
      x.strokeStyle = "#e9a23b";
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(-2, 15);
      x.lineTo(-2, 21);
      x.moveTo(6, 15);
      x.lineTo(6, 21);
      x.stroke();
    } else if (kind === "vacuum") {
      // a canister vacuum with its hose, and some crumbs
      x.strokeStyle = "#5c6470";
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(-6, 0);
      x.bezierCurveTo(-4, -26, 22, -24, 16, 2);
      x.stroke();
      x.fillStyle = "#3a3f47";
      x.fillRect(8, 0, 18, 6);
      x.fillStyle = "#ffcf3a";
      x.strokeStyle = "#b8860b";
      x.lineWidth = 3;
      x.beginPath();
      x.ellipse(-12, 6, 15, 11, 0, 0, 7);
      x.fill();
      x.stroke();
      x.fillStyle = "#3a3f47";
      x.beginPath();
      x.arc(-20, 16, 4, 0, 7);
      x.arc(-4, 16, 4, 0, 7);
      x.fill();
      x.fillStyle = "#c9a46a";
      for (const [a, b] of [
        [12, 16],
        [20, 14],
        [16, 20],
        [24, 19],
      ]) {
        x.beginPath();
        x.arc(a, b, 2.2, 0, 7);
        x.fill();
      }
    } else if (kind === "doors") {
      // a little car with its door swung open
      x.fillStyle = "#fff";
      x.strokeStyle = "#5c6470";
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(-24, 10);
      x.lineTo(-22, -2);
      x.lineTo(-12, -4);
      x.lineTo(-4, -14);
      x.lineTo(12, -14);
      x.lineTo(20, -4);
      x.lineTo(24, -2);
      x.lineTo(24, 10);
      x.closePath();
      x.fill();
      x.stroke();
      x.fillStyle = "#1c2734";
      x.fillRect(-6, -11, 9, 7);
      x.fillRect(6, -11, 9, 7);
      x.fillStyle = "#3a3f47";
      x.beginPath();
      x.arc(-13, 11, 5, 0, 7);
      x.arc(14, 11, 5, 0, 7);
      x.fill();
      // the open door
      x.fillStyle = "#1fae9f";
      x.strokeStyle = "#0f6f66";
      x.beginPath();
      x.moveTo(-8, -4);
      x.lineTo(-24, -18);
      x.lineTo(-24, -2);
      x.lineTo(-8, 8);
      x.closePath();
      x.fill();
      x.stroke();
    } else if (kind === "reboot") {
      x.strokeStyle = "#e8508a";
      x.lineWidth = 7;
      x.beginPath();
      x.arc(0, 0, 16, -0.3, Math.PI * 1.55);
      x.stroke();
      x.fillStyle = "#e8508a";
      x.beginPath();
      x.moveTo(13, -16);
      x.lineTo(24, -6);
      x.lineTo(10, -2);
      x.closePath();
      x.fill();
      x.fillStyle = "#333";
      x.font = "900 22px 'M PLUS Rounded 1c', sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("?", 0, 1);
    }
    x.restore();
  }
  WG.drawIcon = drawIcon;
  function drawBubble(car, frac, t) {
    const x = car.parts.cv.getContext("2d"),
      k = KIND[car.problem.type];
    x.clearRect(0, 0, 128, 128);
    // pin shape
    x.fillStyle = "rgba(0,0,0,.18)";
    x.beginPath();
    x.arc(64, 60, 46, 0, 7);
    x.fill();
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(64, 56, 46, 0, 7);
    x.moveTo(50, 98);
    x.lineTo(64, 122);
    x.lineTo(78, 98);
    x.fill();
    // patience ring
    const col = frac > 0.5 ? "#41c45a" : frac > 0.25 ? "#ffbf1f" : "#ff4b3e";
    x.lineWidth = 9;
    x.strokeStyle = "#e6ebf0";
    x.beginPath();
    x.arc(64, 56, 38, 0, 7);
    x.stroke();
    x.strokeStyle = col;
    x.beginPath();
    x.arc(64, 56, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    x.stroke();
    x.fillStyle = k.col;
    x.globalAlpha = 0.14;
    x.beginPath();
    x.arc(64, 56, 32, 0, 7);
    x.fill();
    x.globalAlpha = 1;
    drawIcon(x, car.problem.type, 64, 58, 1.1);
    car.parts.tex.needsUpdate = true;
  }

  /* ---------- traffic: robotaxis on the island's street graph (world.js W.graph) ---------- */
  // Slop Skies' streets are 8 island units between the block pads, 12.8 m at the game's scale (world.js SCALE):
  // a lane each way, room to pull over at the curb, and a 6.4 m half-width at the intersections
  const LANE = 2.1,
    CURBLAT = 5.0,
    END = 7.2,
    CRUISE = 10,
    CAR_SCALE = 1.05;
  WG.CAR_SCALE = CAR_SCALE;
  const locks = {};
  const nodeAt = (k) => W.graph.nodes[k];
  function segOf(a, b) {
    const A = nodeAt(a),
      B = nodeAt(b),
      dx = B.x - A.x,
      dz = B.z - A.z,
      len = Math.hypot(dx, dz);
    return { A, B, dx: dx / len, dz: dz / len, len };
  }

  function Car(scene, a, b, s) {
    this.parts = makeCar();
    this.parts.root.scale.setScalar(CAR_SCALE);
    scene.add(this.parts.root);
    this.a = a;
    this.b = b;
    this.seg = segOf(a, b);
    this.s = s;
    this.lat = LANE;
    this.piece = "line";
    this.speed = CRUISE * 0.6;
    this.state = "drive";
    this.problem = null;
    this.wait = 0;
    this.beepT = 0;
    this.hop = 0;
    this.sad = 0;
    this.pos = new T.Vector3();
    this.fwd = new T.Vector3(0, 0, -1);
    this.spinV = 6;
    this.bubbleT = 0;
    this.id = Car.n = (Car.n || 0) + 1;
    this.chooseNext();
    this.place();
  }
  Car.prototype.to = function () {
    return this.b;
  };
  Car.prototype.chooseNext = function () {
    const B = nodeAt(this.b),
      opts = [];
    for (const n of B.nb) {
      if (n === this.a && B.nb.length > 1) continue;
      const s2 = segOf(this.b, n),
        w = s2.dx * this.seg.dx + s2.dz * this.seg.dz > 0.7 ? 2 : 1;
      for (let k = 0; k < w; k++) opts.push(n);
    }
    this.next = opts.length ? opts[(Math.random() * opts.length) | 0] : this.a;
  };
  Car.prototype.linePos = function (s, lat, out) {
    const g = this.seg;
    out[0] = g.A.x + g.dx * s - g.dz * lat;
    out[1] = g.A.z + g.dz * s + g.dx * lat;
    return out;
  };
  Car.prototype.startTurn = function () {
    const g = this.seg,
      g2 = segOf(this.b, this.next),
      B = g.B,
      dot = g.dx * g2.dx + g.dz * g2.dz;
    const p0 = this.linePos(g.len - END, this.lat, [0, 0]),
      p1 = [B.x + g2.dx * END - g2.dz * LANE, B.z + g2.dz * END + g2.dx * LANE];
    let c;
    if (dot > 0.95) c = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    else if (dot < -0.95) c = [B.x + g.dx * 2, B.z + g.dz * 2];
    else {
      // where the two lanes cross: p0 + t·d1 = p1 - u·d2
      const den = g.dx * g2.dz - g.dz * g2.dx,
        t = ((p1[0] - p0[0]) * g2.dz - (p1[1] - p0[1]) * g2.dx) / den;
      c = [p0[0] + g.dx * t, p0[1] + g.dz * t];
    }
    let len = 0,
      px = p0[0],
      pz = p0[1];
    for (let k = 1; k <= 10; k++) {
      const u = k / 10,
        x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0],
        z = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1];
      len += Math.hypot(x - px, z - pz);
      px = x;
      pz = z;
    }
    this.turn = { p0, c, p1, len, u: 0, straight: dot > 0.95, g2 };
    this.piece = "turn";
  };
  Car.prototype.endTurn = function () {
    this.a = this.b;
    this.b = this.next;
    this.seg = this.turn.g2;
    this.s = END;
    this.lat = LANE;
    this.piece = "line";
    this.chooseNext();
  };
  const _a = [0, 0];
  Car.prototype.xz = function (out) {
    if (this.piece === "line") return this.linePos(this.s, this.lat, out);
    const { p0, c, p1, u } = this.turn;
    out[0] = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0];
    out[1] = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1];
    return out;
  };
  Car.prototype.heading = function (out) {
    if (this.piece === "line") {
      out[0] = this.seg.dx;
      out[1] = this.seg.dz;
      return out;
    }
    const { p0, c, p1, u } = this.turn;
    const x = 2 * (1 - u) * (c[0] - p0[0]) + 2 * u * (p1[0] - c[0]),
      z = 2 * (1 - u) * (c[1] - p0[1]) + 2 * u * (p1[1] - c[1]),
      l = Math.hypot(x, z) || 1;
    out[0] = x / l;
    out[1] = z / l;
    return out;
  };
  Car.prototype.place = function () {
    const p = this.xz(_a),
      x = p[0],
      z = p[1],
      h = [0, 0];
    this.heading(h);
    const hf = W.height(x + h[0] * 1.6, z + h[1] * 1.6),
      hb = W.height(x - h[0] * 1.6, z - h[1] * 1.6),
      y = (hf + hb) / 2;
    this.pos.set(x, y, z);
    this.fwd.set(h[0], 0, h[1]);
    const r = this.parts.root;
    r.position.set(x, y, z);
    r.rotation.order = "YXZ";
    r.rotation.y = Math.atan2(-h[0], -h[1]);
    r.rotation.x = Math.atan2(hf - hb, 3.2);
  };
  Car.prototype.setProblem = function (p) {
    this.problem = p;
    const P = this.parts;
    // fresh dirt (and cones) in fresh places every time
    if (p && p.type === "dirty") {
      if (!p.spots) p.spots = dirtSpots(12);
      this.showDirt(p.spots);
    }
    if (p && p.type === "cone") {
      if (!p.spots) p.spots = coneSpots(p.n || 3);
      this.showCones(p.spots);
    }
    P.dirt.visible = !!(p && p.type === "dirty");
    P.cone.visible = !!(p && p.type === "cone");
    P.birds.visible = !!(p && p.type === "birds");
    P.sprite.visible = !!p;
    // doors passengers left open
    const want = p && p.type === "doors" ? p.doors || [] : [];
    if (want.length || this.doorParts) {
      const D = this.ensureDoors();
      D.forEach((d, i) => {
        const open = want.includes(i);
        d.pivot.visible = d.patch.visible = open;
        d.pivot.rotation.y = open ? d.side * 1.1 : 0;
      });
    }
    P.ring.material.color.set(p && p.type === "charge" ? 0xff4b3e : 0x36d3c4);
    P.ring.material.emissive.set(p && p.type === "charge" ? 0x551010 : 0x0b4a44);
    this.bubbleT = 0;
  };
  Car.prototype.showDirt = function (spots) {
    const D = this.parts.dirt;
    while (D.children.length) D.remove(D.children[0]);
    for (const s of spots) {
      const g = new T.Group();
      g.position.copy(s.p);
      g.quaternion.setFromUnitVectors(UP, s.n);
      add(g, GEO.sph, s.k === 1 ? MAT.poop : s.k === 2 ? MAT.dust : MAT.mud, 0, 0, 0, s.s, 0.03, s.s * 0.8);
      D.add(g);
    }
  };
  // the cones stand on the road round the car (the car's group sits at road level)
  Car.prototype.showCones = function (spots) {
    const D = this.parts.cone;
    while (D.children.length) D.remove(D.children[0]);
    for (const [x, z, r] of spots) {
      const c = makeCone();
      c.position.set(x, 0, z);
      c.rotation.y = r;
      D.add(c);
    }
  };
  const DOOR_PANEL = roundBox(0.07, 0.62, 0.98, 0.03, 2),
    DOOR_GLASS = roundBox(0.05, 0.34, 0.78, 0.03, 2),
    DOOR_HOLE = new T.MeshLambertMaterial({ color: 0x1c2330 });
  Car.prototype.ensureDoors = function () {
    if (this.doorParts) return this.doorParts;
    // front-left, front-right, rear-left, rear-right; each hinged at its front edge
    this.doorParts = [
      [-1, -1.08],
      [1, -1.08],
      [-1, 0.02],
      [1, 0.02],
    ].map(([side, z0]) => {
      const pivot = new T.Group();
      pivot.position.set(side * 0.97, 0, z0);
      const panel = new T.Mesh(DOOR_PANEL, MAT.body);
      panel.position.set(0, 0.82, 0.49);
      panel.castShadow = true;
      const glass = new T.Mesh(DOOR_GLASS, MAT.glass);
      glass.position.set(0, 1.3, 0.45);
      pivot.add(panel, glass);
      const patch = new T.Mesh(GEO.box, DOOR_HOLE);
      patch.scale.set(0.02, 0.85, 0.92);
      patch.position.set(side * 0.958, 1.02, z0 + 0.48);
      this.parts.g.add(pivot, patch);
      pivot.visible = patch.visible = false;
      return { side, z0, pivot, patch };
    });
    return this.doorParts;
  };
  Car.prototype.canPull = function () {
    if (this.state !== "drive" || this.piece !== "line" || this.s < END + 1 || this.s > this.seg.len - END - 15) return false;
    // keep clear of the street trees along the curb where it would stop
    const p = [0, 0];
    for (const ds of [4.8, 7, 9.2]) {
      this.linePos(this.s + ds, CURBLAT + 0.6, p);
      if (W.hits(p[0], p[1], 0.5)) return false;
    }
    return true;
  };
  Car.prototype.pullOver = function () {
    this.state = "pulling";
    this.stopS = this.s + 7;
  };

  const Traffic = {
    cars: [],
    // a fresh fleet on the current street graph (the shifts work different districts)
    reset() {
      for (const c of this.cars) this.scene.remove(c.parts.root);
      this.cars = [];
      for (const k in locks) delete locks[k];
      this.init(this.scene, this.n);
    },
    init(scene, n) {
      this.scene = scene;
      this.n = n;
      const used = new Set(),
        N = W.graph.nodes;
      for (let k = 0; k < n; k++) {
        let a, b, tries = 0;
        do {
          a = (Math.random() * N.length) | 0;
          b = N[a].nb[(Math.random() * N[a].nb.length) | 0];
          tries++;
        } while (used.has(a + ">" + b) && tries < 200);
        used.add(a + ">" + b);
        const len = segOf(a, b).len;
        this.cars.push(new Car(scene, a, b, END + 2 + Math.random() * Math.max(1, len - 2 * END - 10)));
      }
    },
    update(dt, t, player, look) {
      const cars = this.cars;
      for (const c of cars) {
        let want = CRUISE;
        if (c.piece === "turn") want = c.turn.straight ? 8 : 5;
        if (c.state === "pulling") {
          want = Math.min(want, Math.max(0, c.stopS - c.s) * 1.1 + 0.2);
          c.lat = Math.min(CURBLAT, c.lat + dt * 1.4);
          if (c.s >= c.stopS - 0.25 || (c.speed < 0.3 && c.stopS - c.s < 1)) {
            c.state = "problem";
            c.speed = 0;
          }
        }
        if (c.state === "problem") want = 0;
        if (c.state === "leaving") {
          c.lat = Math.max(LANE, c.lat - dt * 1.2);
          if (c.lat <= LANE) c.state = "drive";
        }
        if (c.state !== "problem") {
          // keep a gap to whoever is ahead in this lane
          for (const o of cars) {
            if (o === c) continue;
            const rx = o.pos.x - c.pos.x,
              rz = o.pos.z - c.pos.z,
              along = rx * c.fwd.x + rz * c.fwd.z;
            if (along <= 0 || along > 14) continue;
            const lat = -rx * c.fwd.z + rz * c.fwd.x;
            if (Math.abs(lat) > 1.6) continue;
            const ofw = o.fwd.x * c.fwd.x + o.fwd.z * c.fwd.z;
            if (ofw < -0.3) continue; // oncoming
            want = Math.min(want, Math.max(0, along - 6) * 1.4);
          }
          // and stop for the crew
          if (player) {
            const rx = player.x - c.pos.x,
              rz = player.z - c.pos.z,
              along = rx * c.fwd.x + rz * c.fwd.z,
              lat = -rx * c.fwd.z + rz * c.fwd.x;
            if (along > 0 && along < 10 && Math.abs(lat) < 1.9) {
              want = Math.min(want, Math.max(0, along - 3.8) * 1.2);
              if (c.speed < 0.5) {
                c.wait += dt;
                if (c.wait > 1.4 && t - c.beepT > 4) {
                  c.beepT = t;
                  c.beeped = t;
                }
              }
            } else c.wait = 0;
          }
          // one car at a time through each intersection
          if (c.piece === "line" && c.seg.len - END - c.s < 7) {
            const key = c.b,
              L = locks[key];
            if (!L || L.car === c || t - L.t > 5) locks[key] = { car: c, t: L && L.car === c ? L.t : t };
            else want = Math.min(want, Math.max(0, c.seg.len - END - c.s - 0.6) * 1.5);
          }
        }
        const acc = want > c.speed ? 5 : 14;
        c.speed += clamp(want - c.speed, -acc * dt, acc * dt);
        let dist = c.speed * dt;
        while (dist > 1e-6) {
          if (c.piece === "line") {
            const end = c.seg.len - END;
            if (c.s + dist < end) {
              c.s += dist;
              dist = 0;
            } else {
              dist -= end - c.s;
              c.s = end;
              c.startTurn();
            }
          } else {
            const du = dist / c.turn.len;
            if (c.turn.u + du < 1) {
              c.turn.u += du;
              dist = 0;
            } else {
              dist -= (1 - c.turn.u) * c.turn.len;
              if (locks[c.b] && locks[c.b].car === c) delete locks[c.b];
              c.endTurn();
            }
          }
        }
        c.place();
        // animation
        const P = c.parts;
        // a car that needs nothing looks like it
        if (!c.problem && (P.dirt.visible || P.cone.visible || P.birds.visible || P.sprite.visible)) c.setProblem(null);
        let spin = 7;
        if (c.problem && c.problem.type === "reboot") {
          const calm = c.problem.calm || 0;
          spin = Math.sin(t * 3 + c.id) * 14 * (1 - calm) + 7 * calm;
        }
        if (c.problem && c.problem.type === "charge") spin = 1.2;
        P.spin.rotation.y += spin * dt;
        let by = 0;
        if (c.hop > 0) {
          c.hop = Math.max(0, c.hop - dt);
          by = Math.abs(Math.sin((1 - c.hop) * Math.PI * 3)) * 0.5 * c.hop;
        }
        P.g.position.y = by;
        P.g.rotation.z = c.sad > 0 ? Math.sin(t * 20) * 0.03 * c.sad : 0;
        if (c.sad > 0) c.sad = Math.max(0, c.sad - dt);
        if (c.problem) {
          c.bubbleT -= dt;
          if (c.bubbleT <= 0) {
            c.bubbleT = 0.15;
            drawBubble(c, clamp(c.problem.left / c.problem.max, 0, 1), t);
          }
          const pulse = 1 + Math.sin(t * 6) * 0.06 * (c.problem.left / c.problem.max < 0.3 ? 2 : 1);
          P.sprite.scale.set(3.4 * pulse, 3.4 * pulse, 1);
          P.sprite.position.y = 4.2 + Math.sin(t * 2.5 + c.id) * 0.15;
          if (c.problem.type === "birds")
            P.birds.children.forEach((b, i) => {
              b.rotation.x = Math.max(0, Math.sin(t * 5 + i * 2)) * 0.4;
            });
        }
      }
    },
    nearest(x, z, filter) {
      let best = null,
        bd = Infinity;
      for (const c of this.cars) {
        if (filter && !filter(c)) continue;
        const d = Math.hypot(c.pos.x - x, c.pos.z - z);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      return best ? { car: best, d: bd } : null;
    },
  };
  WG.Traffic = Traffic;

  /* ---------- the crew member ---------- */
  function makeMii(o) {
    o = o || {};
    const skin = new T.MeshLambertMaterial({ color: o.skin || 0xffd2ad }),
      shirt = new T.MeshLambertMaterial({ color: o.shirt || 0x22b8a8 }),
      pants = new T.MeshLambertMaterial({ color: o.pants || 0x34446e }),
      dark = new T.MeshLambertMaterial({ color: 0x2b2b33 }),
      white = new T.MeshLambertMaterial({ color: 0xffffff }),
      hair = new T.MeshLambertMaterial({ color: o.hair || 0x4a3426 }),
      cap = new T.MeshLambertMaterial({ color: o.cap || 0x1f8f86 }),
      mouth = new T.MeshLambertMaterial({ color: 0xc8504f });
    const root = new T.Group(),
      body = new T.Group();
    root.add(body);
    root.add(BLOB(1.1, 1.1));
    const S = (geo, m, x, y, z, sx, sy, sz, p) => add(p || body, geo, m, x, y, z, sx, sy, sz);
    // legs (pivot at the hips)
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new T.Group();
      hip.position.set(s * 0.13, 0.62, 0);
      body.add(hip);
      S(GEO.cyl, pants, 0, -0.27, 0, 0.1, 0.5, 0.1, hip);
      S(GEO.sph, dark, 0, -0.55, -0.06, 0.12, 0.08, 0.17, hip);
      legs.push(hip);
    }
    // torso
    const torso = new T.Mesh(new T.CylinderGeometry(0.25, 0.32, 0.62, 16), shirt);
    torso.position.y = 0.95;
    torso.castShadow = true;
    body.add(torso);
    S(GEO.sph, shirt, 0, 1.25, 0, 0.25, 0.08, 0.25);
    S(GEO.cyl, pants, 0, 0.66, 0, 0.32, 0.12, 0.32);
    // a crew badge
    S(GEO.box, white, 0.12, 1.06, -0.27, 0.12, 0.1, 0.02);
    // arms (pivot at the shoulders)
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new T.Group();
      sh.position.set(s * 0.3, 1.2, 0);
      sh.rotation.z = s * 0.18;
      body.add(sh);
      S(GEO.cyl, shirt, 0, -0.2, 0, 0.075, 0.42, 0.075, sh);
      S(GEO.sph, skin, 0, -0.45, 0, 0.1, 0.1, 0.1, sh);
      arms.push(sh);
    }
    // head
    const head = new T.Group();
    head.position.y = 1.62;
    body.add(head);
    S(GEO.sph, skin, 0, 0, 0, 0.4, 0.42, 0.4, head);
    for (const s of [-1, 1]) {
      S(GEO.sph, skin, s * 0.39, -0.02, 0.02, 0.07, 0.1, 0.06, head);
      S(GEO.sph, dark, s * 0.14, 0.04, -0.36, 0.055, 0.08, 0.03, head);
      S(GEO.sph, white, s * 0.14 + 0.015, 0.07, -0.385, 0.018, 0.022, 0.01, head);
      const br = S(GEO.box, hair, s * 0.15, 0.17, -0.355, 0.12, 0.03, 0.03, head);
      br.rotation.z = -s * 0.15;
    }
    S(GEO.sph, skin, 0, -0.06, -0.4, 0.05, 0.045, 0.04, head);
    const mo = S(GEO.sph, mouth, 0, -0.19, -0.35, 0.09, 0.03, 0.03, head);
    // hair and the crew cap
    S(GEO.sph, hair, 0, 0.02, 0.06, 0.41, 0.36, 0.38, head);
    for (const s of [-1, 1]) S(GEO.sph, hair, s * 0.33, 0.08, 0.02, 0.1, 0.18, 0.2, head);
    const capTop = new T.Mesh(new T.SphereGeometry(0.43, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap);
    capTop.position.set(0, 0.1, 0.01);
    capTop.scale.set(1, 0.85, 1);
    capTop.castShadow = true;
    head.add(capTop);
    S(GEO.cyl, cap, 0, 0.12, -0.38, 0.3, 0.03, 0.2, head);
    S(GEO.sph, white, 0, 0.36, -0.12, 0.08, 0.05, 0.06, head);
    root.scale.setScalar(o.scale || 1.4);
    return { root, body, head, legs, arms, mouth: mo };
  }
  WG.makeMii = makeMii;
  WG.roundBox = roundBox;
})();
