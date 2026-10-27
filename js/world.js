/* Waymo Care · the world. The city is Slop Skies' own toy San Francisco (js/isle.js, generated from its engine: terrain,
   neighbourhoods, terraces, towers, landmarks, trees, sea, sky and clouds, all with its shaders). The game is played on
   the streets of one of its districts: Western Addition's grid around Alamo Square and the Painted Ladies. This file
   boots the island, reads that district's street grid into a graph for the robotaxis, answers ground and collision
   questions from the island's own colliders, and turns Slop's look into our three shifts (sun, Karl the Fog, dusk). */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const T = THREE,
    I = WG.isle;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- scale: Slop Skies squeezes San Francisco to about a third so a plane can cross it in a minute; at street
     level the game enlarges the whole island by SCALE, so its streets, blocks and hills are street-sized next to the
     (real-sized) robotaxis and crew. Game positions are in metres; the island's own functions take island units. ---------- */
  const SCALE = 1.6;

  /* ---------- the play area: a patch of Western Addition's street grid (island.js DIST row 10) ---------- */
  // three blocks by two between Alamo Square and the Painted Ladies (grid units: u by v island units per block)
  const ZONE = { name: "Western Addition", ang: -8, u: 62, v: 82, i0: 5, i1: 8, j0: -6, j1: -4 };
  const ZA = (ZONE.ang * Math.PI) / 180,
    ZC = Math.cos(ZA),
    ZS = Math.sin(ZA),
    HALF_ST = 4; // the streets are the 8-unit gaps between the block pads
  // grid-local island units <-> game metres
  const toWorld = (lx, lz) => [(lx * ZC - lz * ZS) * SCALE, (lx * ZS + lz * ZC) * SCALE];
  const toLocal = (x, z) => [(x * ZC + z * ZS) / SCALE, (-x * ZS + z * ZC) / SCALE];
  // the island's functions, in game metres
  const terrainY = (x, z) => I.ISL.terrainY(x / SCALE, z / SCALE) * SCALE;
  const hitsAt = (x, y, z, r) => I.hitsBuilding(x / SCALE, y / SCALE, z / SCALE, r / SCALE);
  const zoneAt = (x, z) => I.zoneName(x / SCALE, z / SCALE);
  const AREA = {
    lx0: ZONE.i0 * ZONE.u - 22,
    lx1: ZONE.i1 * ZONE.u + 22,
    lz0: ZONE.j0 * ZONE.v - 22,
    lz1: ZONE.j1 * ZONE.v + 22,
  };
  const inArea = (x, z, m) => {
    const [lx, lz] = toLocal(x, z);
    m = (m || 0) / SCALE;
    return lx > AREA.lx0 - m && lx < AREA.lx1 + m && lz > AREA.lz0 - m && lz < AREA.lz1 + m;
  };

  const height = (x, z) => I.groundH(x / SCALE, z / SCALE) * SCALE;
  // a point on a street (the carriageway), as opposed to a block's raised pad
  function onStreet(x, z) {
    const [lx, lz] = toLocal(x, z),
      dx = Math.abs(lx - Math.round(lx / ZONE.u) * ZONE.u),
      dz = Math.abs(lz - Math.round(lz / ZONE.v) * ZONE.v);
    return dx < HALF_ST || dz < HALF_ST;
  }
  const groundY = (x, z) => height(x, z) + (onStreet(x, z) ? 0 : 0.2 * SCALE);
  // the island's colliders (houses, towers, landmarks, street trees)
  const hits = (x, z, r) => hitsAt(x, height(x, z) + 1.2, z, r || 0);
  function isBlocked(x, z, r) {
    if (!inArea(x, z, -(r || 0))) return true;
    if (height(x, z) < 1.5 * SCALE) return true;
    return hits(x, z, r || 0);
  }

  /* ---------- the street graph ---------- */
  function buildGraph() {
    const { u, v, i0, i1, j0, j1, name } = ZONE,
      key = (i, j) => i + "," + j,
      byKey = {},
      nodes = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const [x, z] = toWorld(i * u, j * v),
          g = terrainY(x, z);
        if (g < 2.5 * SCALE || zoneAt(x, z) !== name || hitsAt(x, g + 1.5, z, 1.5 * SCALE)) continue;
        const n = { id: nodes.length, i, j, x, z, nb: [] };
        nodes.push(n);
        byKey[key(i, j)] = n;
      }
    // a segment is a street if it is clear of the island's colliders and not too steep to drive
    const clear = (a, b) => {
      let prev = null;
      for (let k = 1; k < 16; k++) {
        const t = k / 16,
          x = a.x + (b.x - a.x) * t,
          z = a.z + (b.z - a.z) * t,
          g = terrainY(x, z);
        if (g < 2.5 * SCALE || hitsAt(x, g + 1.5, z, 1.0 * SCALE)) return false;
        if (prev !== null && Math.abs(g - prev) / (Math.hypot(b.x - a.x, b.z - a.z) / 16) > 0.32) return false;
        prev = g;
      }
      return true;
    };
    for (const n of nodes)
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ]) {
        const m = byKey[key(n.i + di, n.j + dj)];
        if (m && clear(n, m)) {
          n.nb.push(m.id);
          m.nb.push(n.id);
        }
      }
    // keep the largest connected piece
    const comp = new Array(nodes.length).fill(-1);
    let best = -1,
      bestN = 0;
    for (const n of nodes) {
      if (comp[n.id] >= 0) continue;
      const stack = [n.id];
      let cnt = 0;
      comp[n.id] = n.id;
      while (stack.length) {
        const k = stack.pop();
        cnt++;
        for (const m of nodes[k].nb)
          if (comp[m] < 0) {
            comp[m] = n.id;
            stack.push(m);
          }
      }
      if (cnt > bestN) {
        bestN = cnt;
        best = n.id;
      }
    }
    const keep = nodes.filter((n) => comp[n.id] === best && n.nb.length),
      remap = {};
    keep.forEach((n, k) => (remap[n.id] = k));
    const out = keep.map((n) => ({ id: remap[n.id], i: n.i, j: n.j, x: n.x, z: n.z, nb: n.nb.filter((m) => m in remap).map((m) => remap[m]) }));
    let edges = 0;
    for (const n of out) edges += n.nb.length;
    return { nodes: out, edges: edges / 2 };
  }

  /* ---------- the street surface: at street level the island's soft grey terrain gets real streets on top: asphalt over
     the carriageway, a double yellow line, zebra crossings at every corner. Drawn with the island's own terrain shader
     (mat 2: the same light, grain and haze), following the terrain ---------- */
  function streets(scene) {
    const P = [],
      N = [],
      C = [],
      idx = [];
    const hex = (h) => {
      const c = new T.Color(h);
      return [c.r, c.g, c.b];
    };
    const ASPHALT = hex("#7b7f86"),
      YELLOW = hex("#f1c94c"),
      WHITE = hex("#f6f5ef");
    const nrm = (x, z) => {
      const e = 1,
        dx = (height(x + e, z) - height(x - e, z)) / (2 * e),
        dz = (height(x, z + e) - height(x, z - e)) / (2 * e),
        l = Math.hypot(dx, 1, dz);
      return [-dx / l, 1 / l, -dz / l];
    };
    // a terrain-hugging strip from a to b, w wide, nw cells across, lifted by off
    function strip(ax, az, bx, bz, w, off, col, nw) {
      const L = Math.hypot(bx - ax, bz - az),
        nl = Math.max(1, Math.ceil(L / 2)),
        ux = (bx - ax) / L,
        uz = (bz - az) / L,
        px = -uz,
        pz = ux,
        base = P.length / 3;
      for (let i = 0; i <= nl; i++)
        for (let k = 0; k <= nw; k++) {
          const t = i / nl,
            q = (k / nw - 0.5) * w,
            x = ax + (bx - ax) * t + px * q,
            z = az + (bz - az) * t + pz * q;
          P.push(x, height(x, z) + off, z);
          N.push(...nrm(x, z));
          C.push(col[0], col[1], col[2], 0);
        }
      for (let i = 0; i < nl; i++)
        for (let k = 0; k < nw; k++) {
          const a = base + i * (nw + 1) + k,
            b = a + nw + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const nodes = W.graph.nodes,
      WIDTH = 2 * HALF_ST * SCALE - 0.3,
      [ex, ez] = [ZC, ZS],
      [nx, nz] = [-ZS, ZC];
    // the intersections: a square of asphalt on the grid's axes
    for (const n of nodes) strip(n.x - ex * (WIDTH / 2), n.z - ez * (WIDTH / 2), n.x + ex * (WIDTH / 2), n.z + ez * (WIDTH / 2), WIDTH, 0.06, ASPHALT, 6);
    for (const n of nodes)
      for (const m of n.nb) {
        if (m < n.id) continue;
        const o = nodes[m],
          L = Math.hypot(o.x - n.x, o.z - n.z),
          ux = (o.x - n.x) / L,
          uz = (o.z - n.z) / L,
          px = -uz,
          pz = ux,
          h = WIDTH / 2;
        strip(n.x + ux * h, n.z + uz * h, o.x - ux * h, o.z - uz * h, WIDTH, 0.06, ASPHALT, 6);
        // the double yellow line
        for (const s2 of [-0.16, 0.16]) strip(n.x + ux * (h + 3.6) + px * s2, n.z + uz * (h + 3.6) + pz * s2, o.x - ux * (h + 3.6) + px * s2, o.z - uz * (h + 3.6) + pz * s2, 0.14, 0.09, YELLOW, 1);
        // zebra crossings at both ends
        for (const [cx, cz, sg] of [
          [n.x, n.z, 1],
          [o.x, o.z, -1],
        ])
          for (let q = -h + 0.9; q <= h - 0.9; q += 1.25) {
            const mx = cx + ux * sg * (h + 1.7) + px * q,
              mz = cz + uz * sg * (h + 1.7) + pz * q;
            strip(mx - ux * 1.3, mz - uz * 1.3, mx + ux * 1.3, mz + uz * 1.3, 0.6, 0.1, WHITE, 1);
          }
      }
    void nx;
    void nz;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(N, 3));
    g.setAttribute("aCol", new T.Float32BufferAttribute(C, 4));
    g.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2));
    g.setIndex(idx);
    const m = I.mat(2);
    m.uniforms.uStripe.value = 0;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    const mesh = new T.Mesh(g, m);
    mesh.name = "streets";
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  /* ---------- merged vertex-coloured geometry (the robotaxi and the job props use it) ---------- */
  const _v = new T.Vector3(),
    _c = new T.Color(),
    _m3 = new T.Matrix3();
  function Merge() {
    this.p = [];
    this.n = [];
    this.c = [];
  }
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
  Merge.prototype.mesh = function (material) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return new T.Mesh(g, material);
  };
  const _q = new T.Quaternion(),
    _e = new T.Euler(),
    _s = new T.Vector3(),
    _p = new T.Vector3();
  function mat(x, y, z, sx, sy, sz, ry, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, "YXZ");
    _q.setFromEuler(_e);
    return new T.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  }

  /* ---------- the looks: Slop's own grade for the morning, and two more in its format ---------- */
  const LOOKS = {
    day: { grade: "promo", sun: [26, 222], fogK: 1, light: ["#fff1d6", 0.78, "#d7ecff", "#8f7f5f", 0.6], puffs: 0, karl: 0 },
    fog: { grade: "karl", sun: [40, 200], fogK: 1, light: ["#eef3f7", 0.42, "#e6eef4", "#8d8f86", 0.78], puffs: 1, karl: 1 },
    dusk: { grade: "golden", sun: [9, 262], fogK: 1, light: ["#ffb27a", 0.72, "#9a8ad0", "#6b5040", 0.52], puffs: 0, karl: 0 },
  };
  function addGrades() {
    const G = I.LOOK_GRADES;
    if (G.karl) return;
    G.karl = {
      sky: [
        [0, "#e6ecef"],
        [0.05, "#dde4e8"],
        [0.12, "#cfd8de"],
        [0.2, "#bcc8d0"],
        [0.3, "#a9b7c2"],
        [0.4, "#99a8b5"],
        [0.55, "#8d9caa"],
      ],
      seaNear: "#5f7f93",
      seaMid: "#6d8a9c",
      seaFar: "#88a1b0",
      seaShal: "#8fb0bd",
      seaShalHi: "#b9cdd3",
      foam: "#f2f6f7",
      haze: "#dfe5e8",
      hazeK: 1 / 85,
      hazeW: "#eef0ec",
      glow: "#c8c8c0",
      cloudTop: "#ffffff",
      cloudUnder: "#c3cbd3",
    };
    G.golden = {
      sky: [
        [0, "#ffc28a"],
        [0.03, "#ffad7e"],
        [0.07, "#f2928a"],
        [0.12, "#c97a9c"],
        [0.18, "#8a6fae"],
        [0.26, "#4d5aa6"],
        [0.4, "#2c3c86"],
      ],
      seaNear: "#2a4f8f",
      seaMid: "#3b5d9a",
      seaFar: "#7a72a8",
      seaShal: "#5a86b8",
      seaShalHi: "#e3a98e",
      foam: "#fff1e2",
      haze: "#f5b48e",
      hazeK: 1 / 9000,
      hazeW: "#ffd6a0",
      glow: "#ffb060",
      cloudTop: "#ffd9b8",
      cloudUnder: "#9a7fb0",
    };
  }

  /* ---------- Karl's ground fog, gulls ---------- */
  function puffTex() {
    const pc = document.createElement("canvas");
    pc.width = pc.height = 128;
    const px = pc.getContext("2d"),
      gr = px.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,0.9)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.45)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    px.fillStyle = gr;
    px.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(pc);
  }

  const W = {
    SCALE,
    ZONE,
    AREA,
    LOOKS,
    Merge,
    mat,
    height,
    groundY,
    onStreet,
    isBlocked,
    hits,
    hitsAt,
    inArea,
    toWorld,
    toLocal,
  };

  W.build = function (scene, renderer) {
    W.scene = scene;
    I.boot(scene, renderer, SCALE);
    addGrades();
    I.setGrade("default");
    W.graph = buildGraph();
    W.streets = streets(scene);
    // the middle of the play area, and where the crew member starts
    const [cx, cz] = toWorld(((ZONE.i0 + ZONE.i1) / 2) * ZONE.u, ((ZONE.j0 + ZONE.j1) / 2) * ZONE.v);
    W.center = new T.Vector3(cx, height(cx, cz), cz);
    let st = W.graph.nodes[0];
    for (const n of W.graph.nodes) if (Math.hypot(n.x - cx, n.z - cz) < Math.hypot(st.x - cx, st.z - cz)) st = n;
    W.start = { x: st.x, z: st.z };

    // light for the game's own toys (robotaxis, the crew), from Slop's sun
    W.hemi = new T.HemisphereLight(0xd7ecff, 0x8f7f5f, 0.6);
    W.sun = new T.DirectionalLight(0xfff1d6, 0.78);
    scene.add(W.hemi, W.sun, W.sun.target);

    W.puffMat = new T.SpriteMaterial({ map: puffTex(), transparent: true, opacity: 0, depthWrite: false, fog: false, color: 0xeef2f4 });
    W.puffs = new T.Group();
    for (let i = 0; i < 46; i++) {
      const s = new T.Sprite(W.puffMat),
        sz = 26 + Math.random() * 24;
      s.scale.set(sz, sz * 0.55, 1);
      s.position.set(cx + (Math.random() - 0.5) * 300, 0, cz + (Math.random() - 0.5) * 300);
      s.userData = { v: 1.5 + Math.random() * 2.5, y: 5 + Math.random() * 12 };
      W.puffs.add(s);
    }
    W.puffs.visible = false;
    scene.add(W.puffs);
    W.setLook("day");
  };

  W.setLook = function (name) {
    const L = LOOKS[name] || LOOKS.day;
    W.look = name;
    W.lookData = L;
    I.setLook(L.grade);
    // the sun: elevation and azimuth as in core.js
    const e = (L.sun[0] * Math.PI) / 180,
      b = (L.sun[1] * Math.PI) / 180,
      d = [Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)];
    I.U.uSun.value.set(d[0], d[1], d[2]);
    W.sunDir = new T.Vector3(d[0], d[1], d[2]);
    // a golden key for the dusk shift: the island relights its baked buildings by the ratio of the two rigs
    const sunC = name === "dusk" ? [1.0, 0.7, 0.46] : name === "fog" ? [0.78, 0.8, 0.84] : I.LIGHT.sun,
      sky = name === "dusk" ? [0.56, 0.54, 0.7] : name === "fog" ? [0.62, 0.66, 0.72] : I.LIGHT.sky;
    I.U.uLSun.value.set(sunC[0], sunC[1], sunC[2]);
    I.U.uLSky.value.set(sky[0], sky[1], sky[2]);
    I.U.uRelight.value = name === "day" ? 0 : 1;
    const [c, k, hs, hg, hk] = L.light;
    W.sun.color.set(c);
    W.sun.intensity = k;
    W.hemi.color.set(hs);
    W.hemi.groundColor.set(hg);
    W.hemi.intensity = hk;
    // the island's haze is 1 - exp(-(d·k)²): three's FogExp2 is the same curve, so the toys sit in the same air
    const G = I.LOOK_GRADES[L.grade];
    I.U.uFogD.value = G.hazeK / SCALE;
    W.scene.fog = new T.FogExp2(G.haze, G.hazeK / SCALE);
    W.puffs.visible = !!L.puffs;
    W.puffMat.opacity = L.puffs ? 0.55 : 0;
    if (WG.CAR_HEAD) WG.CAR_HEAD.emissive.set(name === "dusk" ? 0xfff2b0 : name === "fog" ? 0xbbb38a : 0x333322);
  };

  W.update = function (t, dt, focus, camera, vw, vh) {
    if (W.puffs.visible)
      for (const s of W.puffs.children) {
        s.position.x += s.userData.v * dt;
        if (s.position.x > focus.x + 150) s.position.x -= 300;
        if (s.position.x < focus.x - 150) s.position.x += 300;
        if (s.position.z > focus.z + 150) s.position.z -= 300;
        if (s.position.z < focus.z - 150) s.position.z += 300;
        s.position.y = height(s.position.x, s.position.z) + s.userData.y;
      }
    const d = W.sunDir;
    W.sun.position.set(focus.x + d.x * 100, focus.y + d.y * 100, focus.z + d.z * 100);
    W.sun.target.position.copy(focus);
    I.frame(camera, dt, vw, vh);
  };

  WG.world = W;
})();
