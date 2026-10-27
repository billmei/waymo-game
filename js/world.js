/* Waymo Care · the toy San Francisco: hills, a 5×5 street grid, painted ladies, downtown, the landmarks, the bay,
   and the three looks (morning sun, Karl the Fog, golden dusk). Static scenery is merged into a few vertex-coloured meshes. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const T = THREE;

  const N = 5,
    P = 34,
    H = (N * P) / 2,
    RW = 5,
    SW = 2.6,
    CURB = 0.2,
    LAND = 100,
    COAST = 112;
  const rc = (k) => -H + k * P;
  const bc = (b) => -H + b * P + P / 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => {
    x = clamp((x - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  };

  let seed = 1906;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (a) => a[(rnd() * a.length) | 0];

  /* ---------- terrain ---------- */
  const HILLS = [
    [0, -68, 26, 9], // Telegraph Hill (Coit Tower)
    [44, -30, 34, 6], // Nob Hill
    [-62, 58, 40, 10], // the western hills
    [-40, -40, 22, 4],
  ];
  function coastD(x, z) {
    const ax = Math.abs(x),
      az = Math.abs(z);
    return Math.pow(Math.pow(ax, 6) + Math.pow(az, 6), 1 / 6);
  }
  function height(x, z) {
    let h = 0;
    for (const [cx, cz, r, hh] of HILLS) {
      const dx = x - cx,
        dz = z - cz;
      h += hh * Math.exp(-(dx * dx + dz * dz) / (r * r));
    }
    const d = coastD(x, z);
    if (d > LAND) {
      const k = smooth(LAND, COAST, d);
      h = h * (1 - k) - 3 * k;
    }
    return h;
  }

  /* ---------- the city plan ---------- */
  // block types by [bz][bx] (bz 0 = north, by the bay)
  const PLAN = [
    ["res", "res", "coit", "pyramid", "down"],
    ["res", "res", "res", "down", "down"],
    ["res", "alamo", "ladies", "res", "res"],
    ["park", "res", "res", "res", "depot"],
    ["park", "res", "dolores", "res", "res"],
  ];
  const blocks = [];
  for (let bz = 0; bz < N; bz++)
    for (let bx = 0; bx < N; bx++)
      blocks.push({
        bx,
        bz,
        type: PLAN[bz][bx],
        x0: rc(bx) + RW,
        x1: rc(bx + 1) - RW,
        z0: rc(bz) + RW,
        z1: rc(bz + 1) - RW,
        cx: bc(bx),
        cz: bc(bz),
      });
  const solids = []; // axis-aligned footprints the crew cannot walk through

  function blockAt(x, z) {
    const bx = Math.floor((x + H) / P),
      bz = Math.floor((z + H) / P);
    if (bx < 0 || bz < 0 || bx >= N || bz >= N) return null;
    const b = blocks[bz * N + bx];
    return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 ? b : null;
  }
  function groundY(x, z) {
    return height(x, z) + (blockAt(x, z) ? CURB : 0);
  }
  function isBlocked(x, z, r) {
    r = r || 0;
    if (coastD(x, z) > LAND + 2 - r) return true;
    for (const s of solids) if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return true;
    return false;
  }

  /* ---------- merged geometry ---------- */
  function Merge() {
    this.p = [];
    this.n = [];
    this.c = [];
  }
  const _v = new T.Vector3(),
    _c = new T.Color(),
    _m3 = new T.Matrix3();
  Merge.prototype.geo = function (g, color, m) {
    const p = g.attributes.position.array,
      nr = g.attributes.normal.array,
      idx = g.index ? g.index.array : null,
      cnt = idx ? idx.length : p.length / 3;
    _m3.getNormalMatrix(m);
    _c.set(color);
    for (let i = 0; i < cnt; i++) {
      const j = idx ? idx[i] : i;
      _v.set(p[3 * j], p[3 * j + 1], p[3 * j + 2]).applyMatrix4(m);
      this.p.push(_v.x, _v.y, _v.z);
      _v.set(nr[3 * j], nr[3 * j + 1], nr[3 * j + 2]).applyMatrix3(_m3).normalize();
      this.n.push(_v.x, _v.y, _v.z);
      this.c.push(_c.r, _c.g, _c.b);
    }
  };
  Merge.prototype.tri = function (a, b, c, color) {
    _c.set(color);
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const q of [a, b, c]) {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(nx, ny, nz);
      this.c.push(_c.r, _c.g, _c.b);
    }
  };
  // a quad whose vertices carry their own normals (for terrain-following surfaces)
  Merge.prototype.quadN = function (a, b, c, d, na, nb, nc, nd, color) {
    _c.set(color);
    const push = (q, n) => {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(n[0], n[1], n[2]);
      this.c.push(_c.r, _c.g, _c.b);
    };
    push(a, na);
    push(b, nb);
    push(c, nc);
    push(a, na);
    push(c, nc);
    push(d, nd);
  };
  Merge.prototype.mesh = function (mat) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return new T.Mesh(g, mat);
  };

  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    cyl8: new T.CylinderGeometry(1, 1, 1, 8),
    cyl16: new T.CylinderGeometry(1, 1, 1, 16),
    sph: new T.SphereGeometry(1, 10, 8),
    cone4: new T.ConeGeometry(1, 1, 4),
    cone8: new T.ConeGeometry(1, 1, 8),
  };
  G.prism = (function () {
    // gable roof: ridge along z, base 1×1 at y 0, apex at y 1
    const g = new T.BufferGeometry(),
      a = [-0.5, 0, 0.5],
      b = [0.5, 0, 0.5],
      c = [0, 1, 0.5],
      d = [-0.5, 0, -0.5],
      e = [0.5, 0, -0.5],
      f = [0, 1, -0.5];
    const v = [].concat(a, b, c, e, d, f, a, c, f, a, f, d, b, e, f, b, f, c);
    g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  })();
  const _m = new T.Matrix4(),
    _q = new T.Quaternion(),
    _e = new T.Euler(),
    _s = new T.Vector3(),
    _p = new T.Vector3();
  function mat(x, y, z, sx, sy, sz, ry, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, "YXZ");
    _q.setFromEuler(_e);
    return new T.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  }

  /* ---------- builders ---------- */
  const M = {}; // the merges: city, win (lit at dusk), winDark, glow (lamp heads), marks
  function frame(x, z, ry) {
    const base = new T.Matrix4().makeRotationY(ry);
    base.setPosition(x, 0, z);
    return {
      part(merge, geo, color, lx, ly, lz, sx, sy, sz, lry, lrx) {
        merge.geo(geo, color, new T.Matrix4().multiplyMatrices(base, mat(lx, ly, lz, sx, sy, sz, lry, lrx)));
      },
    };
  }
  function nrm(x, z) {
    const e = 0.5,
      dx = (height(x + e, z) - height(x - e, z)) / (2 * e),
      dz = (height(x, z + e) - height(x, z - e)) / (2 * e),
      l = Math.hypot(dx, 1, dz);
    return [-dx / l, 1 / l, -dz / l];
  }
  // a terrain-hugging rectangle (top plus skirts)
  function slab(m, x0, z0, x1, z1, off, color, skirt, step) {
    step = step || 3;
    const nx = Math.max(1, Math.round((x1 - x0) / step)),
      nz = Math.max(1, Math.round((z1 - z0) / step));
    const pt = (x, z) => [x, height(x, z) + off, z];
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const xa = x0 + ((x1 - x0) * i) / nx,
          xb = x0 + ((x1 - x0) * (i + 1)) / nx,
          za = z0 + ((z1 - z0) * j) / nz,
          zb = z0 + ((z1 - z0) * (j + 1)) / nz;
        m.quadN(pt(xa, za), pt(xa, zb), pt(xb, zb), pt(xb, za), nrm(xa, za), nrm(xa, zb), nrm(xb, zb), nrm(xb, za), color);
      }
    if (!skirt) return;
    const side = (ax, az, bx, bz, n) => {
      const k = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step));
      for (let i = 0; i < k; i++) {
        const xa = ax + ((bx - ax) * i) / k,
          za = az + ((bz - az) * i) / k,
          xb = ax + ((bx - ax) * (i + 1)) / k,
          zb = az + ((bz - az) * (i + 1)) / k;
        const ha = height(xa, za),
          hb = height(xb, zb);
        m.quadN([xa, ha + off, za], [xb, hb + off, zb], [xb, hb - 0.6, zb], [xa, ha - 0.6, za], n, n, n, n, skirt);
      }
    };
    side(x0, z1, x1, z1, [0, 0, 1]);
    side(x1, z1, x1, z0, [1, 0, 0]);
    side(x1, z0, x0, z0, [0, 0, -1]);
    side(x0, z0, x0, z1, [-1, 0, 0]);
  }
  // a thin terrain-hugging strip from a to b
  function ribbon(m, ax, az, bx, bz, w, off, color) {
    const L = Math.hypot(bx - ax, bz - az),
      k = Math.max(1, Math.ceil(L / 2)),
      ux = (bx - ax) / L,
      uz = (bz - az) / L,
      px = -uz * (w / 2),
      pz = ux * (w / 2),
      up = [0, 1, 0];
    for (let i = 0; i < k; i++) {
      const xa = ax + (bx - ax) * (i / k),
        za = az + (bz - az) * (i / k),
        xb = ax + (bx - ax) * ((i + 1) / k),
        zb = az + (bz - az) * ((i + 1) / k);
      const p = (x, z) => [x, height(x, z) + off, z];
      m.quadN(p(xa - px, za - pz), p(xa + px, za + pz), p(xb + px, zb + pz), p(xb - px, zb - pz), up, up, up, up, color);
    }
  }
  function minH(x, z, w, d, ry) {
    const c = Math.cos(ry),
      s = Math.sin(ry);
    let h = Infinity;
    for (const [a, b] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
      [0, 0],
    ])
      h = Math.min(h, height(x + a * c + b * s, z - a * s + b * c));
    return h;
  }

  const PASTEL = [
    "#f6b8c8",
    "#a9d8e8",
    "#f7dc8a",
    "#bfe3b4",
    "#d9c3ef",
    "#f4c49a",
    "#9fc9f0",
    "#f2a7a0",
    "#c9e7d9",
    "#fff1c1",
    "#e7b7e0",
    "#b8e0f0",
  ];
  const TRIM = ["#fffaf0", "#fffaf0", "#fffaf0", "#4f64a6", "#7a4a7a", "#3f7f6e"];
  const ROOF = ["#6d7a99", "#8a6e7d", "#5f7f86", "#9b7d6a", "#7d8aa8"];
  const GLASS = "#33507a",
    WHITE = "#fffaf0";

  function winPane(f, lx, ly, lz, w, h, trim) {
    f.part(M.city, G.box, trim, lx, ly, lz, w + 0.3, h + 0.3, 0.12);
    f.part(rnd() < 0.62 ? M.win : M.winDark, G.box, GLASS, lx, ly, lz + 0.06, w, h, 0.1);
  }

  // a Victorian row house; its front faces local +z
  function house(x, z, ry, w, d, opt) {
    opt = opt || {};
    const g0 = minH(x, z, w, d, ry) - 0.8,
      fy = height(x + Math.sin(ry) * (d / 2), z + Math.cos(ry) * (d / 2)) + CURB,
      floors = opt.floors || (rnd() < 0.55 ? 3 : 2),
      top = fy + floors * 3 + 0.4,
      main = opt.color || pick(PASTEL),
      trim = opt.trim || pick(TRIM),
      roof = pick(ROOF),
      f = frame(x, z, ry),
      hd = d / 2;
    const hgt = top - g0;
    f.part(M.city, G.box, main, 0, g0 + hgt / 2, 0, w, hgt, d);
    // cornice and gable
    f.part(M.city, G.box, trim, 0, top + 0.2, hd - 0.2, w + 0.35, 0.45, 0.8);
    f.part(M.city, G.box, trim, 0, top + 0.1, 0, w + 0.1, 0.25, d + 0.1);
    f.part(M.city, G.prism, opt.fancy ? trim : roof, 0, top + 0.2, 0, w + 0.2, opt.fancy ? 2.6 : 1.8, d + 0.2);
    if (opt.fancy) f.part(M.city, G.prism, main, 0, top + 0.5, hd + 0.05, w - 0.9, 1.8, 0.2);
    // bay window stack
    const bw = w * 0.46,
      bx = -w * 0.24,
      by0 = fy + 3,
      bh = top - 0.5 - by0;
    f.part(M.city, G.box, main, bx, by0 + bh / 2, hd + 0.5, bw, bh, 1.0);
    f.part(M.city, G.box, trim, bx, by0 - 0.15, hd + 0.55, bw + 0.3, 0.3, 1.15);
    f.part(M.city, G.box, trim, bx, by0 + bh + 0.1, hd + 0.55, bw + 0.3, 0.3, 1.15);
    for (let fl = 1; fl < floors; fl++) {
      const wy = fy + fl * 3 + 1.5;
      winPane(f, bx, wy, hd + 1.0, bw - 0.7, 1.6, trim);
      winPane(f, w * 0.25, wy, hd, 1.2, 1.7, trim);
    }
    // ground floor: garage under the bay, steps up to the door
    f.part(M.city, G.box, pick(["#f4f1ea", "#d9d4c8", "#8e6f58"]), bx, fy + 1.1, hd + 0.04, bw - 0.4, 2.2, 0.1);
    f.part(M.city, G.box, pick(["#6b3f3a", "#2f4a6b", "#3e5e3e", "#8e6f58"]), w * 0.25, fy + 1.5, hd + 0.04, 1.0, 2.0, 0.1);
    f.part(M.city, G.box, trim, w * 0.25, fy + 2.7, hd + 0.2, 1.6, 0.25, 0.5);
    for (let s = 0; s < 3; s++) f.part(M.city, G.box, "#d8d2c6", w * 0.25, fy - 0.3 + s * 0.3, hd + 1.0 - s * 0.35, 1.3, 0.3, 0.4);
  }

  function tower(x, z, w, d, hgt, color) {
    const g0 = minH(x, z, w, d, 0) - 0.5,
      top = height(x, z) + hgt,
      f = frame(x, z, 0),
      h = top - g0;
    f.part(rnd() < 0.7 ? M.win : M.winDark, G.box, "#6f9ccc", 0, g0 + h / 2, 0, w - 0.4, h, d - 0.4);
    for (let y = height(x, z) + 3.6; y < top - 1; y += 3.4) f.part(M.city, G.box, color, 0, y, 0, w, 1.4, d);
    f.part(M.city, G.box, color, 0, g0 + (height(x, z) + 3.2 - g0) / 2, 0, w + 0.2, height(x, z) + 3.2 - g0, d + 0.2);
    f.part(M.city, G.box, color, 0, top, 0, w + 0.3, 1.2, d + 0.3);
    f.part(M.city, G.box, "#b9c0c8", 0, top + 1.2, 0, w * 0.5, 1.4, d * 0.5);
    if (rnd() < 0.4) f.part(M.city, G.cyl8, "#c9cfd6", w * 0.2, top + 3, 0, 0.12, 4, 0.12);
  }

  function tree(m, x, z, s, col) {
    const y = groundY(x, z);
    m.geo(G.cyl8, "#8a5a3c", mat(x, y + 1.1 * s, z, 0.22 * s, 2.2 * s, 0.22 * s));
    const c = col || pick(["#5fbf4a", "#4fae48", "#73c957", "#58b860"]);
    m.geo(G.sph, c, mat(x, y + 2.9 * s, z, 1.5 * s, 1.35 * s, 1.5 * s));
    m.geo(G.sph, c, mat(x + 0.6 * s, y + 3.5 * s, z - 0.3 * s, 0.95 * s, 0.9 * s, 0.95 * s));
  }
  function palm(m, x, z, s) {
    const y = groundY(x, z);
    m.geo(G.cyl8, "#a07a55", mat(x, y + 3.5 * s, z, 0.2 * s, 7 * s, 0.2 * s, 0, 0.06));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      m.geo(G.sph, i % 2 ? "#4ea846" : "#5dbb52", mat(x + Math.sin(a) * 1.3 * s, y + 6.9 * s, z + Math.cos(a) * 1.3 * s, 0.45 * s, 0.18 * s, 1.9 * s, a, 0.35));
    }
  }
  const lamps = [];
  function lamp(x, z) {
    const y = groundY(x, z);
    M.city.geo(G.cyl8, "#3e4b4f", mat(x, y + 2.3, z, 0.09, 4.6, 0.09));
    M.city.geo(G.box, "#3e4b4f", mat(x, y + 4.7, z, 0.5, 0.25, 0.5));
    M.glow.geo(G.box, "#fff6d8", mat(x, y + 4.45, z, 0.38, 0.35, 0.38));
    lamps.push([x, y + 4.3, z]);
  }

  // a suspension bridge from a to b (deck at y), towers at the fractions ts
  function bridge(m, a, b, deckY, towerH, ts, color, deckColor) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      ry = Math.atan2(dx, dz),
      at = (t) => [a[0] + dx * t, a[1] + dz * t];
    const mid = at(0.5);
    m.geo(G.box, deckColor, mat(mid[0], deckY, mid[1], 8, 1.4, L, ry));
    m.geo(G.box, color, mat(mid[0], deckY - 1.2, mid[1], 7, 1.2, L, ry));
    const px = Math.cos(ry),
      pz = -Math.sin(ry);
    for (const t of ts) {
      const p = at(t);
      for (const sd of [-1, 1]) m.geo(G.box, color, mat(p[0] + px * 3.6 * sd, (deckY + towerH - 6) / 2, p[1] + pz * 3.6 * sd, 1.6, deckY + towerH + 6, 1.8, ry));
      for (const yy of [deckY + 4, deckY + towerH * 0.55, deckY + towerH - 2]) m.geo(G.box, color, mat(p[0], yy, p[1], 8.6, 1.5, 1.4, ry));
      // the pier
      m.geo(G.box, "#c8c2b6", mat(p[0], -2, p[1], 10, 4, 6, ry));
    }
    // cables: a parabola between each pair of support points
    const sup = [0].concat(ts, [1]);
    for (let i = 0; i < sup.length - 1; i++) {
      const t0 = sup[i],
        t1 = sup[i + 1],
        y0 = i === 0 ? deckY + 1 : deckY + towerH,
        y1 = i === sup.length - 2 ? deckY + 1 : deckY + towerH,
        sag = deckY + 3;
      const K = 14;
      let prev = null;
      for (let k = 0; k <= K; k++) {
        const u = k / K,
          t = t0 + (t1 - t0) * u;
        // quadratic through y0, sag (at the low point), y1
        const yl = (1 - u) * y0 + u * y1,
          y = i === 0 || i === sup.length - 2 ? yl : yl - 4 * (yl - sag) * u * (1 - u);
        const p = at(t);
        if (prev)
          for (const sd of [-1, 1]) {
            const ax = prev[0] + px * 3.6 * sd,
              az = prev[1] + pz * 3.6 * sd,
              bx = p[0] + px * 3.6 * sd,
              bz = p[1] + pz * 3.6 * sd,
              len = Math.hypot(bx - ax, prev[2] - y, bz - az),
              pitch = Math.atan2(y - prev[2], Math.hypot(bx - ax, bz - az));
            m.geo(G.box, color, mat((ax + bx) / 2, (prev[2] + y) / 2, (az + bz) / 2, 0.5, 0.5, len, ry, -pitch));
            if (k % 2 === 0 && y - deckY > 2) m.geo(G.box, color, mat(bx, (y + deckY) / 2, bz, 0.12, y - deckY, 0.12, ry));
          }
        prev = [p[0], p[1], y];
      }
    }
  }

  function buildCity() {
    M.city = new Merge();
    M.win = new Merge();
    M.winDark = new Merge();
    M.glow = new Merge();
    M.marks = new Merge();
    M.trees = new Merge();
    seed = 1906;

    // --- streets: markings and crosswalks
    for (let j = 0; j <= N; j++)
      for (let i = 0; i < N; i++) {
        for (const horiz of [true, false]) {
          const a0 = rc(i) + RW + 3.2,
            a1 = rc(i + 1) - RW - 3.2,
            c = rc(j);
          for (const o of [-0.17, 0.17]) {
            if (horiz) ribbon(M.marks, a0, c + o, a1, c + o, 0.13, 0.04, "#f3c94a");
            else ribbon(M.marks, c + o, a0, c + o, a1, 0.13, 0.04, "#f3c94a");
          }
        }
      }
    for (let i = 0; i <= N; i++)
      for (let j = 0; j <= N; j++) {
        const x = rc(i),
          z = rc(j);
        const arms = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [ux, uz] of arms) {
          const nx = i + ux,
            nz = j + uz;
          if (nx < 0 || nz < 0 || nx > N || nz > N) continue;
          for (let s = -RW + 0.9; s <= RW - 0.9; s += 1.15) {
            const px = -uz,
              pz = ux,
              cx = x + ux * (RW + 1.6) + px * s,
              cz = z + uz * (RW + 1.6) + pz * s;
            ribbon(M.marks, cx - ux * 1.2, cz - uz * 1.2, cx + ux * 1.2, cz + uz * 1.2, 0.55, 0.05, "#fbfbf6");
          }
        }
      }

    // --- blocks
    for (const b of blocks) {
      const { x0, x1, z0, z1, cx, cz } = b;
      const sideC = "#cfc8ba";
      if (b.type === "depot") {
        slab(M.city, x0, z0, x1, z1, CURB, "#e4ded2", sideC);
        slab(M.city, x0 + SW, z0 + SW, x1 - SW, z1 - SW, CURB + 0.02, "#9aa1ab", null);
        for (let k = 0; k < 5; k++) {
          const x = x0 + SW + 1.8 + k * 4.0;
          ribbon(M.marks, x - 2, z0 + SW + 0.6, x - 2, z0 + SW + 6.6, 0.15, CURB + 0.05, "#ffffff");
          ribbon(M.marks, x - 2, z1 - SW - 6.6, x - 2, z1 - SW - 0.6, 0.15, CURB + 0.05, "#ffffff");
        }
        for (const zz of [z0 + SW + 0.5, z1 - SW - 0.5])
          for (let k = 0; k < 5; k++) {
            const x = x0 + SW + 2 + k * 4.0,
              y = height(x, zz) + CURB;
            M.city.geo(G.box, "#f4f6f8", mat(x, y + 0.9, zz, 0.7, 1.8, 0.45));
            M.glow.geo(G.box, "#36d3c4", mat(x, y + 1.6, zz + (zz < cz ? 0.24 : -0.24), 0.5, 0.18, 0.04));
          }
        // the depot shed
        const y = height(cx, cz) + CURB;
        M.city.geo(G.box, "#f4f6f8", mat(x1 - SW - 2.4, y + 1.8, cz, 4.2, 3.6, 7));
        M.city.geo(G.box, "#36d3c4", mat(x1 - SW - 2.4, y + 3.7, cz, 4.4, 0.25, 7.2));
        solids.push({ x0: x1 - SW - 4.6, x1: x1 - SW - 0.2, z0: cz - 3.6, z1: cz + 3.6 });
        continue;
      }
      if (b.type === "park" || b.type === "alamo" || b.type === "coit" || b.type === "dolores") {
        slab(M.city, x0, z0, x1, z1, CURB, "#e4ded2", sideC);
        slab(M.city, x0 + SW, z0 + SW, x1 - SW, z1 - SW, CURB + 0.03, b.type === "dolores" ? "#86d45f" : "#7ccc58", null, 2);
        // paths
        ribbon(M.marks, x0 + SW, cz, x1 - SW, cz, 1.6, CURB + 0.06, "#eadbb8");
        ribbon(M.marks, cx, z0 + SW, cx, z1 - SW, 1.6, CURB + 0.06, "#eadbb8");
        const nT = b.type === "coit" ? 10 : 14;
        for (let k = 0; k < nT; k++) {
          const x = rr(x0 + SW + 1.5, x1 - SW - 1.5),
            z = rr(z0 + SW + 1.5, z1 - SW - 1.5);
          if (Math.abs(x - cx) < 2 || Math.abs(z - cz) < 2) continue;
          if (b.type === "coit" && Math.hypot(x - cx, z - cz) < 6) continue;
          if (b.type === "dolores" && rnd() < 0.5) palm(M.trees, x, z, rr(0.8, 1.1));
          else tree(M.trees, x, z, rr(0.8, 1.25));
        }
        if (b.type === "coit") {
          const y = height(cx, cz) + CURB;
          M.city.geo(G.cyl16, "#ede4d0", mat(cx, y + 0.6, cz, 4.2, 1.2, 4.2));
          M.city.geo(G.cyl16, "#f2ead8", mat(cx, y + 10, cz, 2.4, 19, 2.4));
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            M.city.geo(G.box, "#e2d7bf", mat(cx + Math.sin(a) * 2.35, y + 10, cz + Math.cos(a) * 2.35, 0.3, 18.5, 0.3, a));
          }
          M.city.geo(G.cyl16, "#ede4d0", mat(cx, y + 19.8, cz, 2.9, 1.2, 2.9));
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            M.winDark.geo(G.box, "#4a5a70", mat(cx + Math.sin(a) * 2.75, y + 18.4, cz + Math.cos(a) * 2.75, 0.8, 1.4, 0.2, a));
          }
          M.city.geo(G.cyl16, "#d9cfb8", mat(cx, y + 20.8, cz, 2.2, 0.8, 2.2));
          solids.push({ x0: cx - 4.2, x1: cx + 4.2, z0: cz - 4.2, z1: cz + 4.2 });
        }
        if (b.type === "park") {
          // a little pond
          const y = height(cx + 5, cz + 5) + CURB + 0.06;
          M.city.geo(G.cyl16, "#4fb6dc", mat(cx + 5.5, y, cz + 5.5, 3.6, 0.1, 2.6));
          M.city.geo(G.cyl16, "#d9cfb8", mat(cx + 5.5, y - 0.04, cz + 5.5, 3.9, 0.1, 2.9));
        }
        if (b.type === "alamo") {
          for (let k = 0; k < 5; k++) M.city.geo(G.box, "#a77a52", mat(x1 - SW - 2.2, height(x1 - 5, cz - 6 + k * 3) + CURB + 0.45, cz - 6 + k * 3, 0.5, 0.15, 1.8));
        }
        for (const [lx, lz] of [
          [x0 + 0.6, z0 + 0.6],
          [x1 - 0.6, z1 - 0.6],
          [x0 + 0.6, z1 - 0.6],
          [x1 - 0.6, z0 + 0.6],
        ])
          lamp(lx, lz);
        continue;
      }

      // built-up blocks
      slab(M.city, x0, z0, x1, z1, CURB, "#e8e2d6", sideC);
      const ix0 = x0 + SW,
        ix1 = x1 - SW,
        iz0 = z0 + SW,
        iz1 = z1 - SW;
      solids.push({ x0: ix0, x1: ix1, z0: iz0, z1: iz1 });
      if (b.type === "down" || b.type === "pyramid") {
        slab(M.city, ix0, iz0, ix1, iz1, CURB + 0.02, "#d6d9dd", null);
        if (b.type === "pyramid") {
          const y = height(cx, cz) + CURB;
          const f = frame(cx, cz, Math.PI / 4);
          f.part(M.city, G.cone4, "#f4f2ec", 0, y + 31, 0, 10.5, 62, 10.5);
          f.part(M.city, G.cone4, "#e7e3da", 0, y + 64, 0, 1.4, 8, 1.4);
          for (let k = 0; k < 14; k++) {
            const yy = y + 4 + k * 3.6,
              r = 10.5 * (1 - (yy - y) / 62) * 0.72;
            for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
              f.part(rnd() < 0.7 ? M.win : M.winDark, G.box, GLASS, Math.sin(a) * r * 0.98, yy, Math.cos(a) * r * 0.98, r * 1.1, 1.2, 0.15, a + Math.PI / 4 - Math.PI / 4);
          }
          tower(cx - 7, cz + 7, 6, 6, 14, "#e9e2d2");
        } else {
          const cs = ["#eef0f2", "#e6dccb", "#dfe7ee", "#f1ece2", "#d7dde6"];
          const q = (ix1 - ix0) / 2 - 0.5;
          tower(cx - q / 2 - 0.25, cz - q / 2 - 0.25, q, q, rr(22, 44), pick(cs));
          tower(cx + q / 2 + 0.25, cz - q / 2 - 0.25, q, q, rr(16, 36), pick(cs));
          tower(cx - q / 2 - 0.25, cz + q / 2 + 0.25, q, q, rr(14, 30), pick(cs));
          tower(cx + q / 2 + 0.25, cz + q / 2 + 0.25, q, q, rr(18, 40), pick(cs));
        }
      } else {
        // painted-lady rows
        slab(M.city, ix0 + 1, iz0 + 1, ix1 - 1, iz1 - 1, CURB + 0.02, "#88c766", null);
        const rot = b.type === "ladies" ? "ew" : (b.bx + b.bz) % 2 ? "ns" : "ew";
        const fancy = b.type === "ladies";
        const span = ix1 - ix0,
          n = 4,
          w = span / n,
          d = 8.4;
        if (rot === "ns") {
          for (let k = 0; k < n; k++) {
            const x = ix0 + w * (k + 0.5);
            house(x, iz1 - d / 2, 0, w - 0.05, d);
            house(x, iz0 + d / 2, Math.PI, w - 0.05, d);
          }
        } else {
          const lad = ["#f6b8c8", "#a9d8e8", "#f7dc8a", "#d9c3ef"];
          for (let k = 0; k < n; k++) {
            const z = iz0 + w * (k + 0.5);
            house(ix0 + d / 2, z, -Math.PI / 2, w - 0.05, d, fancy ? { fancy: true, floors: 3, color: lad[k], trim: WHITE } : null);
            house(ix1 - d / 2, z, Math.PI / 2, w - 0.05, d);
          }
        }
        tree(M.trees, cx, cz, 0.9);
      }
      // street trees and lamps on the sidewalk
      for (const [lx, lz] of [
        [x0 + 0.6, z0 + 0.6],
        [x1 - 0.6, z1 - 0.6],
      ])
        lamp(lx, lz);
      if (b.type === "res" || b.type === "ladies")
        for (const [tx, tz] of [
          [cx, z0 + 1.1],
          [cx, z1 - 1.1],
          [x0 + 1.1, cz],
          [x1 - 1.1, cz],
        ])
          if (rnd() < 0.6) tree(M.trees, tx, tz, 0.55);
    }

    // --- the waterfront: Embarcadero palms, the Ferry Building, a promenade
    for (let z = -80; z <= 80; z += 9) palm(M.trees, H + RW + 3.5, z, 0.9);
    {
      const fx = H + RW + 9.5,
        fz = -34,
        y = height(fx, fz);
      M.city.geo(G.box, "#efe9dc", mat(fx, y + 3, fz, 6, 6, 34));
      M.city.geo(G.box, "#d9cfba", mat(fx, y + 6.3, fz, 6.4, 0.7, 34.4));
      M.city.geo(G.box, "#efe9dc", mat(fx, y + 14, fz, 4.2, 22, 4.2));
      M.city.geo(G.cone4, "#c9b48c", mat(fx, y + 27, fz, 3.2, 4, 3.2, Math.PI / 4));
      for (const s of [-1, 1]) M.winDark.geo(G.cyl16, "#fffbe8", mat(fx - 2.15, y + 21, fz + s * 0, 1.2, 0.1, 1.2, 0, 0, Math.PI / 2));
      M.glow.geo(G.cyl16, "#fffbe8", mat(fx - 2.15, y + 21, fz, 1.2, 0.12, 1.2, 0, 0, Math.PI / 2));
      for (let k = -7; k <= 7; k++) M.win.geo(G.box, GLASS, mat(fx - 3.05, y + 3.2, fz + k * 2.1, 0.12, 2.2, 1.1));
      solids.push({ x0: fx - 3.2, x1: fx + 3.2, z0: fz - 17, z1: fz + 17 });
    }
    // west side: a windmill in the park strip and Sutro-ish cliffs
    {
      const wx = -H - RW - 6,
        wz = 62,
        y = height(wx, wz);
      M.city.geo(G.cone8, "#efe6d6", mat(wx, y + 5, wz, 2.6, 10, 2.6));
      M.city.geo(G.box, "#8a6e5a", mat(wx, y + 9, wz + 2.3, 0.6, 0.6, 0.6));
      for (let k = 0; k < 4; k++) M.city.geo(G.box, "#f8f4ec", mat(wx, y + 9, wz + 2.6, 0.7, 11, 0.12, 0, 0, (k * Math.PI) / 4 + 0.3));
      solids.push({ x0: wx - 2.6, x1: wx + 2.6, z0: wz - 2.6, z1: wz + 2.6 });
    }
    for (let k = 0; k < 30; k++) {
      const s = rnd() < 0.5 ? -1 : 1,
        along = rr(-95, 95),
        out = rr(H + RW + 2, LAND - 2);
      let x, z;
      if (rnd() < 0.5) {
        x = -out;
        z = along;
      } else {
        x = along;
        z = out;
      }
      if (s > 0 && x > H) continue;
      if (Math.abs(x - (-H - RW - 6)) < 5 && Math.abs(z - 62) < 5) continue;
      tree(M.trees, x, z, rr(0.9, 1.4), pick(["#4f9e48", "#5fb24f", "#3f8f45"]));
    }

    // --- the bay: the Golden Gate, the Bay Bridge, Alcatraz, Marin and the East Bay
    bridge(M.city, [-96, -104], [-190, -330], 13, 46, [0.22, 0.78], "#d9542b", "#b8452a");
    bridge(M.city, [106, 34], [430, -10], 14, 34, [0.18, 0.4, 0.62], "#c9d3dc", "#9aa6b2");
    // Alcatraz
    M.city.geo(G.sph, "#b39f84", mat(55, -2, -215, 22, 7, 12));
    M.city.geo(G.box, "#efe9dc", mat(55, 5.5, -215, 18, 4, 6));
    M.city.geo(G.cyl8, "#f4f4f0", mat(66, 8, -213, 0.8, 10, 0.8));
    // Marin headlands and the East Bay hills
    const hills = [
      [-200, -360, 90, 40, 50, "#9cb86a"],
      [-90, -380, 80, 34, 45, "#a8bd74"],
      [-300, -330, 70, 48, 60, "#8fae63"],
      [40, -420, 120, 30, 60, "#b5b47a"],
      [520, -100, 130, 42, 90, "#a7b878"],
      [560, 120, 140, 36, 90, "#9fb672"],
      [480, -280, 120, 30, 80, "#b0b67c"],
      [-420, 80, 60, 12, 120, "#8fb065"],
    ];
    for (const [x, z, r, h, d, c] of hills) M.city.geo(G.sph, c, mat(x, -4, z, r, h, d));
    // Treasure Island
    M.city.geo(G.sph, "#b9c58a", mat(250, -2.5, -40, 30, 3.5, 22));
  }

  /* ---------- the environment ---------- */
  const LOOKS = {
    day: {
      top: "#3d8fe0",
      hor: "#cdeaf8",
      bot: "#e8f5fb",
      sun: "#fff4e0",
      sunI: 0.72,
      sunDir: [0.45, 0.85, 0.35],
      hemiS: "#d5ebff",
      hemiG: "#8c7d5c",
      hemiI: 0.42,
      amb: 0.08,
      fog: "#cdeaf8",
      fogN: 260,
      fogF: 1100,
      water: "#2a8fd0",
      lit: 0,
      puffs: 0,
      clouds: 1,
    },
    fog: {
      top: "#9fb0bd",
      hor: "#dfe5e8",
      bot: "#e8ecee",
      sun: "#f1f4f8",
      sunI: 0.4,
      sunDir: [0.2, 0.9, 0.3],
      hemiS: "#e6eef4",
      hemiG: "#8d8f86",
      hemiI: 0.62,
      amb: 0.1,
      fog: "#dce3e6",
      fogN: 8,
      fogF: 120,
      water: "#80a9bb",
      lit: 0.35,
      puffs: 1,
      clouds: 0,
    },
    dusk: {
      top: "#2e3d8a",
      hor: "#ffad78",
      bot: "#ffd2a8",
      sun: "#ffb475",
      sunI: 0.72,
      sunDir: [-0.75, 0.38, 0.25],
      hemiS: "#9a8ad0",
      hemiG: "#6b5040",
      hemiI: 0.45,
      amb: 0.08,
      fog: "#f0a681",
      fogN: 200,
      fogF: 900,
      water: "#5a7fbf",
      lit: 1,
      puffs: 0,
      clouds: 1,
    },
  };

  const W = {
    Merge,
    mat,
    N,
    P,
    H,
    RW,
    SW,
    CURB,
    LAND,
    rc,
    bc,
    height,
    groundY,
    blockAt,
    isBlocked,
    coastD,
    blocks,
    solids,
    lamps,
    LOOKS,
    rnd,
  };

  W.build = function (scene) {
    buildCity();
    const city = M.city.mesh(new T.MeshLambertMaterial({ vertexColors: true }));
    city.castShadow = city.receiveShadow = true;
    scene.add(city);
    const trees = M.trees.mesh(new T.MeshLambertMaterial({ vertexColors: true }));
    trees.castShadow = trees.receiveShadow = true;
    scene.add(trees);
    W.winMat = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
    const win = M.win.mesh(W.winMat);
    win.receiveShadow = true;
    scene.add(win);
    const winD = M.winDark.mesh(new T.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x8899aa }));
    scene.add(winD);
    W.glowMat = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
    scene.add(M.glow.mesh(W.glowMat));
    const marks = M.marks.mesh(
      new T.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    marks.receiveShadow = true;
    scene.add(marks);

    // terrain
    const S = 2 * 130,
      seg = 200,
      tg = new T.PlaneGeometry(S, S, seg, seg);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position,
      cols = new Float32Array(tp.count * 3),
      c = new T.Color(),
      asphalt = new T.Color("#5d6472"),
      grass = new T.Color("#8fd16a"),
      sand = new T.Color("#f2dfa6"),
      wet = new T.Color("#c9b98a");
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i),
        z = tp.getZ(i),
        h = height(x, z);
      tp.setY(i, h);
      const inCity = Math.abs(x) <= H + RW + 0.3 && Math.abs(z) <= H + RW + 0.3;
      if (inCity) c.copy(asphalt);
      else if (h < -0.4) c.copy(wet);
      else if (h < 1.0 && coastD(x, z) > LAND - 4) c.copy(sand);
      else c.copy(grass).offsetHSL(0, 0, (Math.sin(x * 0.3) * Math.cos(z * 0.27)) * 0.025);
      cols[3 * i] = c.r;
      cols[3 * i + 1] = c.g;
      cols[3 * i + 2] = c.b;
    }
    tg.setAttribute("color", new T.BufferAttribute(cols, 3));
    tg.computeVertexNormals();
    const terrain = new T.Mesh(tg, new T.MeshLambertMaterial({ vertexColors: true }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // the bay
    W.waterMat = new T.MeshPhongMaterial({ color: LOOKS.day.water, shininess: 40, specular: 0x335566 });
    const water = new T.Mesh(new T.PlaneGeometry(5000, 5000, 1, 1), W.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.7;
    water.receiveShadow = true;
    scene.add(water);
    // sparkles on the water
    const spk = [];
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2,
        r = rr(120, 420);
      spk.push(Math.cos(a) * r, -0.6, Math.sin(a) * r);
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.Float32BufferAttribute(spk, 3));
    W.sparkMat = new T.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.7 });
    scene.add(new T.Points(sg, W.sparkMat));

    // sky
    W.skyU = {
      top: { value: new T.Color(LOOKS.day.top) },
      hor: { value: new T.Color(LOOKS.day.hor) },
      bot: { value: new T.Color(LOOKS.day.bot) },
      sunDir: { value: new T.Vector3(0.45, 0.85, 0.35).normalize() },
      sunC: { value: new T.Color("#fff4d6") },
    };
    const sky = new T.Mesh(
      new T.SphereGeometry(1800, 32, 16),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: W.skyU,
        vertexShader:
          "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 top, hor, bot, sunC, sunDir; varying vec3 vD;" +
          "void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y*1.6,0.0,1.0), 0.7)) : mix(hor, bot, clamp(-y*4.0,0.0,1.0));" +
          " float s = max(dot(vD, normalize(sunDir)), 0.0); c += sunC * (pow(s, 600.0) * 0.9 + pow(s, 12.0) * 0.18);" +
          " gl_FragColor = vec4(c, 1.0); }",
      }),
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    W.sky = sky;
    scene.add(sky);

    // lights
    W.hemi = new T.HemisphereLight(0xd5ebff, 0x8c7d5c, 0.62);
    scene.add(W.hemi);
    W.amb = new T.AmbientLight(0xffffff, 0.16);
    scene.add(W.amb);
    const sun = new T.DirectionalLight(0xfff4e0, 0.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70;
    sc.right = 70;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 1;
    sc.far = 400;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    scene.add(sun.target);
    W.sun = sun;
    scene.fog = new T.Fog(0xcdeaf8, 260, 1100);

    // clouds
    W.clouds = new T.Group();
    const cm = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8f9aa6 });
    for (let i = 0; i < 16; i++) {
      const g = new T.Group(),
        n = 4 + ((rnd() * 4) | 0);
      for (let k = 0; k < n; k++) {
        const s = rr(9, 18),
          m = new T.Mesh(G.sph, cm);
        m.scale.set(s, s * 0.75, s);
        m.position.set(k * 10 - n * 5 + rr(-3, 3), rr(-2, 4), rr(-5, 5));
        g.add(m);
      }
      const a = rnd() * Math.PI * 2,
        r = rr(150, 520);
      g.position.set(Math.cos(a) * r, rr(70, 120), Math.sin(a) * r);
      g.userData.v = rr(1, 3);
      W.clouds.add(g);
    }
    scene.add(W.clouds);

    // Karl the Fog: soft drifting puffs low over the city
    const pc = document.createElement("canvas");
    pc.width = pc.height = 128;
    const px = pc.getContext("2d"),
      gr = px.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,0.9)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.45)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    px.fillStyle = gr;
    px.fillRect(0, 0, 128, 128);
    const ptex = new T.CanvasTexture(pc);
    W.puffMat = new T.SpriteMaterial({ map: ptex, transparent: true, opacity: 0, depthWrite: false, fog: false, color: 0xeef2f4 });
    W.puffs = new T.Group();
    for (let i = 0; i < 46; i++) {
      const s = new T.Sprite(W.puffMat),
        sz = rr(26, 50);
      s.scale.set(sz, sz * 0.55, 1);
      s.position.set(rr(-140, 140), rr(6, 18), rr(-140, 140));
      s.userData.v = rr(1.5, 4);
      W.puffs.add(s);
    }
    W.puffs.visible = false;
    scene.add(W.puffs);

    // lamp glows (dusk)
    const gc = document.createElement("canvas");
    gc.width = gc.height = 64;
    const gx = gc.getContext("2d"),
      gg = gx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gg.addColorStop(0, "rgba(255,240,190,1)");
    gg.addColorStop(0.35, "rgba(255,210,130,0.5)");
    gg.addColorStop(1, "rgba(255,200,120,0)");
    gx.fillStyle = gg;
    gx.fillRect(0, 0, 64, 64);
    W.glowTex = new T.CanvasTexture(gc);
    W.lampGlowMat = new T.SpriteMaterial({ map: W.glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 });
    W.lampGlows = new T.Group();
    for (const [x, y, z] of lamps) {
      const s = new T.Sprite(W.lampGlowMat);
      s.position.set(x, y, z);
      s.scale.set(5, 5, 1);
      W.lampGlows.add(s);
    }
    scene.add(W.lampGlows);

    // seagulls wheeling over the waterfront
    W.gulls = [];
    const gm = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x555555 }),
      gt = new T.MeshLambertMaterial({ color: 0x9aa5b3 });
    for (let i = 0; i < 9; i++) {
      const g = new T.Group(),
        body = new T.Mesh(G.sph, gm);
      body.scale.set(0.25, 0.22, 0.6);
      g.add(body);
      const wings = [];
      for (const sd of [-1, 1]) {
        const piv = new T.Group(),
          w = new T.Mesh(G.box, sd < 0 ? gm : gm);
        w.scale.set(1.3, 0.06, 0.45);
        w.position.x = sd * 0.7;
        const tip = new T.Mesh(G.box, gt);
        tip.scale.set(0.4, 0.07, 0.35);
        tip.position.x = sd * 1.4;
        piv.add(w, tip);
        g.add(piv);
        wings.push(piv);
      }
      const ring = pick([
        [H + 30, -40],
        [H + 20, 40],
        [-40, -H - 30],
        [30, -H - 25],
        [-H - 25, 0],
      ]);
      g.userData = { cx: ring[0] + rr(-10, 10), cz: ring[1] + rr(-10, 10), r: rr(10, 22), y: rr(14, 26), a: rnd() * 7, v: rr(0.25, 0.45) * (rnd() < 0.5 ? -1 : 1), wings };
      g.scale.setScalar(1.3);
      scene.add(g);
      W.gulls.push(g);
    }

    W.setLook("day");
  };

  W.setLook = function (name) {
    const L = LOOKS[name] || LOOKS.day;
    W.look = name;
    W.lookData = L;
    W.skyU.top.value.set(L.top);
    W.skyU.hor.value.set(L.hor);
    W.skyU.bot.value.set(L.bot);
    W.skyU.sunDir.value.set(L.sunDir[0], L.sunDir[1], L.sunDir[2]).normalize();
    W.skyU.sunC.value.set(name === "fog" ? "#000000" : L.sun);
    W.sun.color.set(L.sun);
    W.sun.intensity = L.sunI;
    W.hemi.color.set(L.hemiS);
    W.hemi.groundColor.set(L.hemiG);
    W.hemi.intensity = L.hemiI;
    W.amb.intensity = L.amb;
    const sc = W.sky.parent;
    sc.fog.color.set(L.fog);
    sc.fog.near = L.fogN;
    sc.fog.far = L.fogF;
    W.waterMat.color.set(L.water);
    W.winMat.emissive.set(L.lit >= 1 ? "#d9a54e" : L.lit > 0 ? "#3a3a2a" : "#000000");
    W.glowMat.emissive.set(L.lit > 0 ? "#fff1c0" : "#000000");
    W.glowMat.emissiveIntensity = L.lit > 0 ? 0.85 : 0;
    W.lampGlowMat.opacity = L.lit >= 1 ? 0.85 : L.lit > 0 ? 0.25 : 0;
    W.puffs.visible = !!L.puffs;
    W.puffMat.opacity = L.puffs ? 0.6 : 0;
    W.clouds.visible = !!L.clouds;
    W.clouds.children.forEach((g) => g.children.forEach((m) => (m.material.emissive.set(name === "dusk" ? "#b07a7a" : "#8f9aa6"))));
    W.sparkMat.opacity = name === "fog" ? 0.15 : 0.7;
  };

  W.update = function (t, dt, focus) {
    for (const g of W.clouds.children) {
      g.position.x += g.userData.v * dt;
      if (g.position.x > 560) g.position.x = -560;
    }
    if (W.puffs.visible)
      for (const s of W.puffs.children) {
        s.position.x += s.userData.v * dt;
        if (s.position.x > focus.x + 150) s.position.x = focus.x - 150;
        if (s.position.x < focus.x - 150) s.position.x = focus.x + 150;
        if (s.position.z > focus.z + 150) s.position.z -= 300;
        if (s.position.z < focus.z - 150) s.position.z += 300;
      }
    W.sparkMat.size = 0.9 + Math.sin(t * 3) * 0.4;
    for (const g of W.gulls) {
      const u = g.userData;
      u.a += u.v * dt;
      g.position.set(u.cx + Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 1.5, u.cz + Math.sin(u.a) * u.r);
      g.rotation.y = -u.a + (u.v > 0 ? Math.PI : 0);
      g.rotation.z = u.v > 0 ? 0.25 : -0.25;
      const f = Math.sin(t * 6 + u.cx) * 0.5;
      u.wings[0].rotation.z = f;
      u.wings[1].rotation.z = -f;
    }
    // keep the shadow camera on the action
    const L = W.lookData,
      d = W.skyU.sunDir.value;
    W.sun.position.set(focus.x + d.x * 150, focus.y + d.y * 150, focus.z + d.z * 150);
    W.sun.target.position.set(focus.x, focus.y, focus.z);
    W.sky.position.set(focus.x, 0, focus.z);
    void L;
  };

  WG.world = W;
})();
