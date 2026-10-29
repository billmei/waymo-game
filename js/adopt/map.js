/* Waymo Care · Adopt-a-Waymo · the bird's-eye map. The whole of San Francisco from above: the roads between the
   neighbourhoods (drawn over the island as ribbons, riding over the rooftops), a toy-sized robotaxi for each adopted car
   (in its wrap, ring colour, accessories and dashpet, with a bubble for its most urgent need or an emote), a few NPC
   toys driving about, Karl the Fog's clouds over the west side, name tags and neighbourhood labels in the DOM, and the
   map camera (pan, zoom, rotate, follow). It also takes the postcard photos for the stamp album. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    I = WG.isle,
    D = WG.adoptData,
    Sim = WG.adoptSim;
  const K = W.SCALE; // island units → game metres
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s) => document.querySelector(s);
  const MS = 9, // how much bigger than life a car is on the map, so it reads as a toy from up here
    NPC_MS = 7,
    ROAD_W = 9; // road width, island units

  const M = {
    cars: new Map(),
    npcs: [],
    onCarTap: null,
    onHoodTap: null,
    onCarDrop: null,
  };
  let scene = null,
    group = null,
    roadY = new Map(),
    labels = {},
    tagBox = null;

  /* ---------- the map's geography: Sim's graph, with each centre nudged onto dry land ---------- */
  function onLand(x, z) {
    if (I.groundH(x, z) > 3) return [x, z];
    for (let r = 20; r < 400; r += 20)
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2,
          px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r;
        if (I.groundH(px, pz) > 4) return [px, pz];
      }
    return [x, z];
  }
  // how high a road runs at an island point: over the ground, and over the roofs of whatever stands there
  function surfaceAt(x, z) {
    let y = Math.max(I.groundH(x, z), 0.4);
    for (let k = 0; k < 10 && I.hitsBuilding(x, y + 1, z, ROAD_W * 0.4); k++)
      y += 3;
    return y;
  }

  /* ---------- the roads: a ribbon along each curve (a light edge, the dark road, a dashed centre line) ---------- */
  function buildRoads() {
    const pos = [],
      col = [],
      idx = [];
    const c = new T.Color();
    function strip(pts, half, lift, hex, dash) {
      c.set(hex);
      for (let i = 0; i < pts.length - 1; i++) {
        if (dash && i % 2) continue;
        const a = pts[i],
          b = pts[i + 1],
          base = pos.length / 3;
        for (const p of [a, b]) {
          pos.push(
            (p.x - p.nz * half) * K,
            p.y * K + lift,
            (p.z + p.nx * half) * K,
          );
          pos.push(
            (p.x + p.nz * half) * K,
            p.y * K + lift,
            (p.z - p.nx * half) * K,
          );
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    const pt = {};
    for (const e of Sim.G.edges) {
      const n = Math.max(6, Math.ceil(e.len / 14)),
        pts = [];
      for (let i = 0; i <= n; i++) {
        Sim.edgePoint(e, e.a, i / n, pt);
        pts.push({
          x: pt.x,
          z: pt.z,
          nx: pt.dx,
          nz: pt.dz,
          y: surfaceAt(pt.x, pt.z),
        });
      }
      // smooth the heights: a road eases over a roof rather than stepping
      const ys = pts.map((p) => p.y);
      for (let i = 0; i < pts.length; i++) {
        let m = 0;
        for (
          let j = Math.max(0, i - 2);
          j <= Math.min(pts.length - 1, i + 2);
          j++
        )
          m = Math.max(m, ys[j]);
        pts[i].y = (m * 2 + ys[i]) / 3;
      }
      roadY.set(
        e,
        pts.map((p) => p.y * K),
      );
      strip(pts, ROAD_W * 0.62, 0.6, "#eef3f7");
      strip(pts, ROAD_W * 0.5, 1.0, "#5a6270");
      strip(pts, ROAD_W * 0.06, 1.4, "#ffd23a", true);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new T.MeshBasicMaterial({
      vertexColors: true,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new T.Mesh(g, m);
    mesh.renderOrder = 2;
    group.add(mesh);
    // a little round plaza at every neighbourhood centre
    M.plazas = {};
    const disc = new T.CircleGeometry(ROAD_W * 1.6 * K, 28);
    for (const name of Sim.G.names) {
      const h = Sim.G.hoods[name],
        y = Math.max(
          ...Sim.G.adj[name]
            .map(([, e]) => edgeY(e, h.name === e.a ? 0 : 1))
            .concat([surfaceAt(h.x, h.z) * K]),
        );
      h.y = y;
      const p = new T.Mesh(
        disc,
        new T.MeshBasicMaterial({
          color: 0xffffff,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }),
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(h.x * K, y + 1.8, h.z * K);
      p.renderOrder = 3;
      group.add(p);
      M.plazas[name] = p;
    }
  }
  // a road's height (game metres) a fraction t of the way along it from its a end
  function edgeY(e, t) {
    const ys = roadY.get(e);
    if (!ys) return 0;
    const f = clamp(t, 0, 1) * (ys.length - 1),
      i = Math.floor(f),
      j = Math.min(ys.length - 1, i + 1);
    return ys[i] + (ys[j] - ys[i]) * (f - i);
  }

  /* ---------- dressing a car: wrap (a tint on its own copy of the body material, plus decals), ring, gear, dashpet ---------- */
  const lam = (c, o) =>
    new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const SPH = new T.SphereGeometry(1, 12, 10),
    BOX = new T.BoxGeometry(1, 1, 1),
    CYL = new T.CylinderGeometry(1, 1, 1, 14),
    CONE = new T.ConeGeometry(1, 1, 14);
  function part(parent, geo, mat, x, y, z, sx, sy, sz, rx, ry, rz) {
    const m = new T.Mesh(
      geo,
      typeof mat === "string" || typeof mat === "number" ? lam(mat) : mat,
    );
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }
  function decals(g, d) {
    if (!d) return;
    const sides = [-1, 1];
    if (d.kind === "stripe") {
      part(g, BOX, d.col, 0, 1.225, 0, 0.36, 0.02, 4.45);
      part(g, BOX, d.col, 0, 1.895, 0.25, 0.36, 0.02, 2.1);
    } else if (d.kind === "trim")
      for (const s of sides)
        part(g, BOX, d.col, s * 0.972, 0.96, 0, 0.02, 0.1, 4.2);
    else if (d.kind === "bands")
      d.cols.forEach((c, i) =>
        sides.forEach((s) =>
          part(
            g,
            BOX,
            c,
            s * 0.972,
            0.6 + i * (0.5 / d.cols.length),
            0,
            0.02,
            0.5 / d.cols.length,
            4.1,
          ),
        ),
      );
    else if (d.kind === "spots" || d.kind === "stars" || d.kind === "clouds") {
      const mat =
        d.kind === "stars"
          ? new T.MeshBasicMaterial({ color: d.col })
          : lam(d.col);
      for (const s of sides)
        for (let k = 0; k < 6; k++) {
          const z = -1.8 + k * 0.72 + (s > 0 ? 0.3 : 0),
            y = 0.72 + ((k * 37) % 5) * 0.08;
          const r =
            d.kind === "clouds" ? 0.22 : d.kind === "stars" ? 0.07 : 0.15;
          part(
            g,
            SPH,
            mat,
            s * 0.965,
            y,
            z,
            0.025,
            r,
            r * (d.kind === "clouds" ? 1.8 : 1),
          );
        }
    } else if (d.kind === "ghosts") {
      const body = lam(d.col, { emissive: 0x335533 }),
        eye = lam(0x111111);
      for (const s of sides)
        for (const z of [-1.2, 0.4, 1.6]) {
          part(g, SPH, body, s * 0.975, 0.95, z, 0.03, 0.2, 0.16);
          part(g, SPH, eye, s * 0.99, 1.0, z - 0.05, 0.02, 0.03, 0.025);
          part(g, SPH, eye, s * 0.99, 1.0, z + 0.05, 0.02, 0.03, 0.025);
        }
    }
  }
  // the accessories, modelled small (they're all on top, where the map can see them)
  const GEAR = {
    topper_beanie: (g) => {
      part(g, SPH, "#e8433f", 0, 2.42, 0.1, 0.44, 0.3, 0.44);
      part(g, SPH, "#ffffff", 0, 2.75, 0.1, 0.13, 0.13, 0.13);
      part(g, CYL, "#ffffff", 0, 2.32, 0.1, 0.46, 0.08, 0.46);
    },
    topper_party: (g) => {
      part(g, CONE, "#ff7ad9", 0, 2.75, 0.1, 0.32, 0.8, 0.32);
      part(g, SPH, "#ffd23a", 0, 3.18, 0.1, 0.1, 0.1, 0.1);
    },
    topper_lantern: (g) => {
      part(
        g,
        SPH,
        lam("#e8433f", { emissive: 0x551010 }),
        0,
        2.72,
        0.1,
        0.36,
        0.42,
        0.36,
      );
      part(g, CYL, "#ffd23a", 0, 3.12, 0.1, 0.16, 0.06, 0.16);
      part(g, CYL, "#ffd23a", 0, 2.32, 0.1, 0.2, 0.06, 0.2);
    },
    topper_sunhat: (g) => {
      part(g, CYL, "#f2d58a", 0, 2.38, 0.1, 0.9, 0.04, 0.9);
      part(g, SPH, "#f2d58a", 0, 2.42, 0.1, 0.42, 0.3, 0.42);
      part(g, CYL, "#e8508a", 0, 2.45, 0.1, 0.44, 0.08, 0.44);
    },
    topper_crown: (g) => {
      const gold = lam("#ffcc3a", { emissive: 0x332200 });
      part(g, CYL, gold, 0, 2.48, 0.1, 0.4, 0.22, 0.4);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        part(
          g,
          CONE,
          gold,
          Math.cos(a) * 0.34,
          2.72,
          0.1 + Math.sin(a) * 0.34,
          0.09,
          0.26,
          0.09,
        );
      }
      part(g, SPH, "#e8433f", 0, 2.52, -0.3, 0.07, 0.07, 0.07);
    },
    topper_witch: (g) => {
      part(g, CYL, "#2a2340", 0, 2.36, 0.1, 0.8, 0.04, 0.8);
      part(g, CONE, "#2a2340", 0, 2.85, 0.1, 0.4, 1.0, 0.4, 0, 0, 0.12);
      part(g, CYL, "#8a5fd8", 0, 2.45, 0.1, 0.4, 0.08, 0.4);
    },
    topper_marigold: (g) => {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        part(
          g,
          SPH,
          k % 2 ? "#ff9a2e" : "#ffd23a",
          Math.cos(a) * 0.36,
          2.4,
          0.1 + Math.sin(a) * 0.36,
          0.13,
          0.11,
          0.13,
        );
      }
    },
    topper_sailor: (g) => {
      part(g, CYL, "#ffffff", 0, 2.45, 0.1, 0.4, 0.22, 0.4);
      part(g, CYL, "#1c3c8a", 0, 2.37, 0.1, 0.43, 0.06, 0.43);
    },
    roof_box: (g) =>
      part(
        g,
        WG.roundBox(1, 1, 1, 0.2, 2),
        "#3a3f47",
        0,
        2.05,
        0.95,
        1.1,
        0.34,
        0.7,
      ),
    roof_bike: (g) => {
      for (const z of [0.6, 1.25])
        part(
          g,
          new T.TorusGeometry(0.28, 0.04, 6, 16),
          "#2b3038",
          0,
          2.25,
          z,
          1,
          1,
          1,
          0,
          Math.PI / 2,
          0,
        );
      part(g, BOX, "#e8433f", 0, 2.35, 0.92, 0.05, 0.05, 0.62);
    },
    roof_surfboard: (g) => {
      part(g, SPH, "#2cc4e4", 0, 1.98, 0.3, 0.38, 0.05, 1.5);
      part(g, BOX, "#ffffff", 0, 2.0, 0.3, 0.05, 0.04, 2.5);
    },
    roof_flowers: (g) => {
      part(g, BOX, "#7a5636", 0, 1.98, 0.95, 1.0, 0.16, 0.6);
      [
        "#e8433f",
        "#ffd23a",
        "#ff7ad9",
        "#ffffff",
        "#8a5fd8",
        "#ff9a2e",
      ].forEach((c, k) =>
        part(
          g,
          SPH,
          c,
          -0.38 + (k % 3) * 0.38,
          2.14,
          0.8 + Math.floor(k / 3) * 0.3,
          0.13,
          0.11,
          0.13,
        ),
      );
    },
    roof_pumpkin: (g) => {
      part(g, SPH, "#ff8a1f", 0, 2.25, 0.95, 0.5, 0.36, 0.45);
      part(g, CYL, "#3a6a2a", 0, 2.66, 0.95, 0.05, 0.14, 0.05);
    },
    mirror_dice: (g) => {
      for (const s of [-1, 1])
        part(
          g,
          BOX,
          "#ffffff",
          s * 1.1,
          1.05,
          -0.75,
          0.16,
          0.16,
          0.16,
          0.4,
          0.4,
          0,
        );
    },
    mirror_lashes: (g) => {
      for (const s of [-1, 1])
        for (let k = 0; k < 4; k++)
          part(
            g,
            BOX,
            "#1c1c22",
            s * (0.45 + k * 0.1),
            1.07,
            -2.33,
            0.03,
            0.14,
            0.03,
            -0.5,
            0,
            s * (k - 1.5) * 0.25,
          );
    },
    mirror_streamers: (g) => {
      ["#e8433f", "#ffd23a", "#41c45a", "#2a9fe6"].forEach((c, k) => {
        for (const s of [-1, 1])
          part(
            g,
            BOX,
            c,
            s * (1.14 + k * 0.02),
            1.22 - k * 0.04,
            -0.4 + k * 0.08,
            0.02,
            0.04,
            0.7,
          );
      });
    },
    dash_bobble: (g) => {
      part(g, SPH, "#7a5636", -0.4, 1.32, -1.25, 0.14, 0.11, 0.18);
      part(g, SPH, "#4a3426", -0.4, 1.4, -1.42, 0.09, 0.09, 0.09);
    },
    dash_hula: (g) => {
      part(g, SPH, "#41c45a", -0.4, 1.3, -1.25, 0.1, 0.06, 0.1);
      part(g, SPH, "#e9a77a", -0.4, 1.45, -1.25, 0.06, 0.12, 0.06);
    },
    dash_snowglobe: (g) => {
      part(
        g,
        SPH,
        new T.MeshPhongMaterial({
          color: 0xcfe9ff,
          transparent: true,
          opacity: 0.7,
          shininess: 100,
        }),
        -0.4,
        1.38,
        -1.25,
        0.14,
        0.14,
        0.14,
      );
      part(g, CYL, "#c8322e", -0.4, 1.26, -1.25, 0.12, 0.06, 0.12);
    },
    plate_gold: (g) =>
      part(
        g,
        BOX,
        lam("#ffcc3a", { emissive: 0x332200 }),
        0,
        0.74,
        2.33,
        0.62,
        0.22,
        0.04,
      ),
    plate_rainbow: (g) =>
      ["#e8433f", "#ffd23a", "#41c45a", "#2a9fe6"].forEach((c, k) =>
        part(g, BOX, c, 0, 0.66 + k * 0.05, 2.33, 0.62, 0.05, 0.04),
      ),
  };
  // the dashpets, sitting on the roof just in front of the lidar
  const PETS = {
    pigeon_pal: (g) => bird(g, "#8e96a3", "#5d7d86"),
    gull_chick: (g) => bird(g, "#f4f6f8", "#f4f6f8", 0.8),
    parrot: (g) => bird(g, "#41c45a", "#e8433f"),
    sea_lion_pup: (g) => {
      part(g, SPH, "#6b5a4a", 0, 0.16, 0, 0.16, 0.14, 0.26);
      part(g, SPH, "#6b5a4a", 0, 0.32, -0.18, 0.11, 0.11, 0.11);
      part(g, SPH, "#111", 0.05, 0.35, -0.27, 0.02, 0.02, 0.02);
      part(g, SPH, "#111", -0.05, 0.35, -0.27, 0.02, 0.02, 0.02);
    },
    mini_karl: (g) => {
      const w = lam("#ffffff", { emissive: 0x333333 });
      part(g, SPH, w, 0, 0.2, 0, 0.18, 0.14, 0.16);
      part(g, SPH, w, 0.15, 0.18, 0.05, 0.12, 0.1, 0.12);
      part(g, SPH, w, -0.14, 0.17, -0.04, 0.12, 0.1, 0.12);
      part(g, SPH, "#2b3038", 0.05, 0.24, -0.15, 0.02, 0.02, 0.02);
      part(g, SPH, "#2b3038", -0.05, 0.24, -0.15, 0.02, 0.02, 0.02);
    },
    succulent: (g) => {
      part(g, CYL, "#c8643a", 0, 0.08, 0, 0.13, 0.16, 0.13);
      for (let k = 0; k < 5; k++)
        part(
          g,
          SPH,
          "#5aa86a",
          Math.cos(k * 1.26) * 0.07,
          0.2,
          Math.sin(k * 1.26) * 0.07,
          0.07,
          0.11,
          0.07,
        );
    },
    starter: (g) => {
      part(
        g,
        CYL,
        new T.MeshPhongMaterial({
          color: 0xdff2ff,
          transparent: true,
          opacity: 0.6,
        }),
        0,
        0.15,
        0,
        0.12,
        0.3,
        0.12,
      );
      part(g, CYL, "#efe2c0", 0, 0.12, 0, 0.1, 0.2, 0.1);
      part(g, CYL, "#c8a06a", 0, 0.31, 0, 0.13, 0.04, 0.13);
    },
    mini_bison: (g) => {
      part(g, SPH, "#5a4030", 0, 0.18, 0.04, 0.17, 0.16, 0.24);
      part(g, SPH, "#3a2a20", 0, 0.24, -0.18, 0.13, 0.13, 0.12);
      for (const s of [-1, 1])
        part(
          g,
          CONE,
          "#efe2c0",
          s * 0.1,
          0.36,
          -0.2,
          0.025,
          0.08,
          0.025,
          0,
          0,
          -s * 0.6,
        );
    },
    bell: (g) => {
      part(
        g,
        CONE,
        lam("#ffcc3a", { emissive: 0x332200 }),
        0,
        0.2,
        0,
        0.14,
        0.24,
        0.14,
      );
      part(g, SPH, "#c8a020", 0, 0.08, 0, 0.05, 0.05, 0.05);
    },
  };
  function bird(g, body, head, k) {
    k = k || 1;
    part(g, SPH, body, 0, 0.14 * k, 0, 0.16 * k, 0.13 * k, 0.24 * k);
    part(g, SPH, head, 0, 0.27 * k, -0.16 * k, 0.09 * k, 0.09 * k, 0.09 * k);
    part(
      g,
      SPH,
      "#e9a23b",
      0,
      0.26 * k,
      -0.26 * k,
      0.03 * k,
      0.025 * k,
      0.05 * k,
    );
  }
  const MITES = {
    crumb_mite: "#c8a06a",
    dust_bunny: "#d8d8e0",
    fog_droplet: "#bfe4ff",
  };
  // dress a robotaxi (WG.makeCar()'s parts) as an adopted car. Called again whenever its look changes
  M.dress = function (parts, car) {
    const w = D.WRAPS[car.wrap] || D.WRAPS.default;
    if (!parts.ownBody) {
      parts.body.material = parts.body.material.clone();
      parts.ownBody = true;
    }
    const bm = parts.body.material;
    bm.color.set(w.tint);
    bm.shininess = w.shiny ? 140 : 70;
    bm.specular.set(w.shiny ? 0xfff0a0 : 0x555555);
    parts.ring.material.color.set(car.ring);
    parts.ring.material.emissive
      .copy(parts.ring.material.color)
      .multiplyScalar(0.35);
    if (parts.look) parts.g.remove(parts.look);
    const look = (parts.look = new T.Group());
    parts.g.add(look);
    decals(look, w.decal);
    for (const k in car.gear)
      if (car.gear[k] && GEAR[car.gear[k]]) GEAR[car.gear[k]](look);
    parts.pet = null;
    if (car.dashpet && PETS[car.dashpet.id]) {
      const pg = new T.Group();
      pg.position.set(0.42, 1.89, -0.45);
      pg.scale.setScalar(1.5);
      PETS[car.dashpet.id](pg);
      if (car.dashpet.mite)
        part(
          pg,
          SPH,
          MITES[car.dashpet.mite] || "#ccc",
          0.17,
          0.08,
          0.1,
          0.05,
          0.05,
          0.05,
        );
      look.add(pg);
      parts.pet = pg;
    }
    parts.dressed = JSON.stringify([car.wrap, car.ring, car.gear, car.dashpet]);
  };

  /* ---------- bubbles: the car's most urgent need (or what it's up to, or an emote) ---------- */
  const EMO = {
    "♥": "#ff5a8a",
    "♪": "#8a7fd8",
    "◎": "#ffbf1f",
    z: "#6a7a8c",
    "☁": "#8a94a3",
    "!": "#ff8a1f",
    "🎓": "#2a9fe6",
  };
  function bubble(m, S, car, now) {
    const s = car.sim,
      em = s.emote && now - s.emote.at < 25 ? s.emote.k : null;
    let kind = null,
      txt = null,
      frac = 1,
      col = "#41c45a";
    if (s.task === "stuck" && s.incident) kind = s.incident;
    else if (em && em !== "◎") txt = em;
    else if (s.task === "nap" || s.task === "tow") txt = "z";
    else if (car.training) txt = "🎓";
    else {
      const w = Sim.worst(car);
      if (w.v < 40) {
        kind = Sim.NEED_JOB[w.need];
        frac = w.v / 100;
        col = w.v < 1 ? "#ff4b3e" : w.v < 10 ? "#ffbf1f" : "#2a9fe6";
      } else if (car.needs.mood < 10) txt = "☁";
      else if (em) txt = em;
    }
    const key = (kind || "") + "|" + (txt || "") + "|" + Math.round(frac * 20);
    if (key === m.bkey) return;
    m.bkey = key;
    const P = m.parts,
      x = P.cv.getContext("2d");
    x.clearRect(0, 0, 128, 128);
    P.sprite.visible = !!(kind || txt);
    if (!P.sprite.visible) return;
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
    if (kind) {
      x.lineWidth = 9;
      x.strokeStyle = "#e6ebf0";
      x.beginPath();
      x.arc(64, 56, 38, 0, 7);
      x.stroke();
      x.strokeStyle = s.incident ? "#ff8a1f" : col;
      x.beginPath();
      x.arc(
        64,
        56,
        38,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.max(0.04, s.incident ? 1 : frac),
      );
      x.stroke();
      WG.drawIcon(x, kind, 64, 58, 1.1);
    } else {
      x.fillStyle = EMO[txt] || "#2e3a4a";
      x.font =
        "900 " +
        (txt.length > 1 ? 50 : 62) +
        "px 'M PLUS Rounded 1c', system-ui, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(txt === "z" ? "zzz" : txt, 64, 58);
    }
    P.tex.needsUpdate = true;
  }

  /* ---------- the fleet's markers ---------- */
  function marker(car) {
    const parts = WG.makeCar();
    parts.root.scale.setScalar(MS);
    parts.sprite.renderOrder = 12;
    group.add(parts.root);
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "ad-cartag";
    tag.dataset.car = car.id;
    tag.innerHTML = "<i></i><b></b><span></span>";
    tagBox.appendChild(tag);
    // tap to follow (and again for the profile); drag onto a neighbourhood to send it there
    tag.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      M.drag = { id: car.id, x: e.clientX, y: e.clientY, moved: false, tag };
      try {
        tag.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    tag.addEventListener("pointermove", (e) => {
      const d = M.drag;
      if (!d || d.id !== car.id) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) d.moved = true;
      if (d.moved) {
        tag.classList.add("dragging");
        tag.style.setProperty("--dx", e.clientX - d.x + "px");
        tag.style.setProperty("--dy", e.clientY - d.y + "px");
        const over = hoodUnder(e.clientX, e.clientY);
        for (const n in labels)
          labels[n].e.classList.toggle("drop", n === over);
      }
    });
    const end = (e) => {
      const d = M.drag;
      if (!d || d.id !== car.id) return;
      M.drag = null;
      tag.classList.remove("dragging");
      for (const n in labels) labels[n].e.classList.remove("drop");
      if (d.moved) {
        const over = hoodUnder(e.clientX, e.clientY);
        if (over && M.onCarDrop) M.onCarDrop(car.id, over);
      } else if (e.type === "pointerup" && M.onCarTap) M.onCarTap(car.id);
    };
    tag.addEventListener("pointerup", end);
    tag.addEventListener("pointercancel", end);
    tag.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (M.onCarTap) M.onCarTap(car.id, true);
      }
    });
    return {
      parts,
      tag,
      id: car.id,
      x: null,
      z: null,
      y: 0,
      yaw: 0,
      bkey: "",
      hop: 0,
      sad: 0,
    };
  }
  function hoodUnder(x, y) {
    const el = document.elementFromPoint(x, y),
      lb = el && el.closest && el.closest(".ad-hood");
    if (lb) return lb.dataset.hood;
    // or the nearest label on screen
    let best = null,
      bd = 70;
    for (const n in labels) {
      const L = labels[n];
      if (!L.on) continue;
      const d = Math.hypot(L.sx - x, L.sy - y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }
  M.sync = function (S) {
    const ids = new Set(S.cars.map((c) => c.id));
    for (const [id, m] of M.cars)
      if (!ids.has(id)) {
        group.remove(m.parts.root);
        m.tag.remove();
        M.cars.delete(id);
      }
    for (const car of S.cars) {
      let m = M.cars.get(car.id);
      if (!m) M.cars.set(car.id, (m = marker(car)));
      const key = JSON.stringify([car.wrap, car.ring, car.gear, car.dashpet]);
      if (m.parts.dressed !== key) M.dress(m.parts, car);
    }
  };
  M.marker = (id) => M.cars.get(id);

  /* ---------- the NPC toys: a few plain robotaxis wandering the roads ---------- */
  function npcs() {
    for (let k = 0; k < 5; k++) {
      const parts = WG.makeCar();
      parts.root.scale.setScalar(NPC_MS);
      group.add(parts.root);
      const a = Sim.G.names[(k * 7 + 3) % Sim.G.names.length],
        nb = Sim.G.adj[a][0];
      M.npcs.push({
        parts,
        from: a,
        to: nb[0],
        t: Math.random(),
        v: 55 + Math.random() * 25,
      });
    }
  }
  function npcUpdate(dt, mins) {
    const pt = {};
    for (const n of M.npcs) {
      let e = Sim.edgeOf(n.from, n.to);
      n.t += (n.v * mins) / e.len;
      while (n.t >= 1) {
        n.t -= 1;
        const opts = Sim.G.adj[n.to]
          .map(([m]) => m)
          .filter((m) => m !== n.from);
        n.from = n.to;
        n.to = opts.length
          ? opts[(Math.random() * opts.length) | 0]
          : Sim.G.adj[n.to][0][0];
        e = Sim.edgeOf(n.from, n.to);
      }
      Sim.edgePoint(e, n.from, n.t, pt);
      place(
        n.parts,
        pt.x * K,
        edgeY(e, n.from === e.a ? n.t : 1 - n.t),
        pt.z * K,
        Math.atan2(-pt.dx, -pt.dz),
      );
      n.parts.spin.rotation.y += dt * 7;
    }
  }
  function place(parts, x, y, z, yaw) {
    const r = parts.root;
    r.position.set(x, y, z);
    r.rotation.order = "YXZ";
    r.rotation.y = yaw;
  }

  /* ---------- Karl the Fog: big soft clouds rolling over the west side on foggy days ---------- */
  function karl() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const x = cv.getContext("2d"),
      gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.55, "rgba(255,255,255,0.5)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const mat = new T.SpriteMaterial({
      map: new T.CanvasTexture(cv),
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
      fog: false,
    });
    M.karl = new T.Group();
    for (const name of Sim.G.names) {
      if (!D.HOODS[name].tags.includes("fog")) continue;
      const h = Sim.G.hoods[name];
      for (let k = 0; k < 7; k++) {
        const s = new T.Sprite(mat),
          sz = (260 + Math.random() * 260) * K;
        s.scale.set(sz, sz * 0.5, 1);
        s.userData = {
          x: (h.x + (Math.random() - 0.5) * 520) * K,
          z: (h.z + (Math.random() - 0.5) * 520) * K,
          y: (60 + Math.random() * 90) * K,
          v: 4 + Math.random() * 6,
          p: Math.random() * 6,
        };
        M.karl.add(s);
      }
    }
    M.karl.visible = false;
    M.karl.renderOrder = 20;
    group.add(M.karl);
  }

  /* ---------- the neighbourhood labels ---------- */
  function makeLabels() {
    const box = $("#ad-hoods");
    for (const name of Sim.G.names) {
      const h = Sim.G.hoods[name],
        e = document.createElement("button");
      e.type = "button";
      e.className = "ad-hood";
      e.dataset.hood = name;
      e.innerHTML = '<b></b><span class="nm"></span>';
      e.querySelector(".nm").textContent = name;
      e.addEventListener("click", () => M.onHoodTap && M.onHoodTap(name));
      box.appendChild(e);
      labels[name] = {
        e,
        h,
        on: false,
        sx: 0,
        sy: 0,
        p: new T.Vector3(h.x * K, 0, h.z * K),
      };
    }
  }
  // the labels' badges: locked, today's daily waiting, a Care Spot, home
  M.refreshLabels = function (S) {
    for (const name in labels) {
      const L = labels[name],
        H = D.HOODS[name],
        open = Sim.open(S, name),
        daily = H.daily && open && Sim.dailyState(S, H.daily).open;
      L.e.classList.toggle("locked", !open);
      L.e.classList.toggle("land", H.rank !== null);
      L.e.classList.toggle("glow", !!daily);
      L.e.classList.toggle(
        "ev",
        Sim.season().some((s) => s.hub === name),
      );
      L.e.querySelector("b").textContent = !open
        ? "🔒"
        : H.home
          ? "🏠"
          : H.care
            ? "🔧"
            : daily
              ? "★"
              : "";
      L.e.setAttribute(
        "aria-label",
        name +
          (!open ? ", locked until Crew Rank " + H.rank : "") +
          (H.care ? ", a Care Spot" : "") +
          (daily ? ", today's daily is waiting" : ""),
      );
      const pl = M.plazas[name];
      if (pl)
        pl.material.color.set(
          !open
            ? 0xb7c0c8
            : H.home
              ? 0xffd23a
              : H.care
                ? 0x36d3c4
                : H.rank !== null
                  ? 0x7fdcff
                  : 0xffffff,
        );
    }
  };

  /* ---------- set up ---------- */
  M.init = function (sc) {
    if (group) return;
    scene = sc;
    group = new T.Group();
    group.visible = false;
    scene.add(group);
    tagBox = $("#ad-tags");
    Sim.setGeo(I.ISL.DIST, (x, z) => onLand(x, z));
    buildRoads();
    for (const name of Sim.G.names)
      Sim.G.hoods[name].y =
        Sim.G.hoods[name].y ||
        surfaceAt(Sim.G.hoods[name].x, Sim.G.hoods[name].z) * K;
    npcs();
    karl();
    makeLabels();
  };
  M.show = function (on) {
    if (group) group.visible = on;
    $("#ad-hoods").hidden = $("#ad-tags").hidden = !on;
  };

  /* ---------- each frame ---------- */
  const _p = {},
    _v = new T.Vector3();
  M.update = function (dt, S, t) {
    const now = Sim.absMin(S),
      paused = !S.settings.speed || S.clock.night ? 0 : 1,
      mins = dt * Sim.MPS * S.settings.speed * Sim.fast;
    npcUpdate(dt, S.clock.night ? dt * Sim.MPS * 3 : mins);
    // the fleet: drawn between the sim's minute steps
    const byHood = {};
    S.cars.forEach((car) => {
      if (!car.sim.from)
        (byHood[car.sim.at] = byHood[car.sim.at] || []).push(car);
    });
    for (const car of S.cars) {
      const m = M.cars.get(car.id);
      if (!m) continue;
      const s = car.sim;
      let x, y, z, yaw;
      if (s.from && s.task !== "nap") {
        const e = Sim.edgeOf(s.from, s.to);
        const tt = Math.min(
          1,
          s.t +
            (paused *
              Sim.frac() *
              Sim.speedOf(S, car) *
              (S.clock.night ? 4 : 1)) /
              e.len,
        );
        Sim.edgePoint(e, s.from, tt, _p);
        x = _p.x * K;
        z = _p.z * K;
        y = edgeY(e, s.from === e.a ? tt : 1 - tt);
        yaw = Math.atan2(-_p.dx, -_p.dz);
      } else if (s.from) {
        const e = Sim.edgeOf(s.from, s.to);
        Sim.edgePoint(e, s.from, s.t, _p);
        x = _p.x * K;
        z = _p.z * K;
        y = edgeY(e, s.from === e.a ? s.t : 1 - s.t);
        yaw = m.yaw;
      } else {
        // parked round the plaza, nose out
        const h = Sim.G.hoods[s.at],
          list = byHood[s.at],
          i = list.indexOf(car),
          a = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.6;
        x = (h.x + Math.cos(a) * ROAD_W * 1.05) * K;
        z = (h.z + Math.sin(a) * ROAD_W * 1.05) * K;
        y = h.y;
        yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
      }
      if (m.x === null) {
        m.x = x;
        m.z = z;
        m.y = y;
        m.yaw = yaw;
      }
      const f = Math.min(1, dt * 10);
      m.x += (x - m.x) * f;
      m.z += (z - m.z) * f;
      m.y += (y - m.y) * f;
      let dy = yaw - m.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.yaw += dy * Math.min(1, dt * 6);
      const P = m.parts;
      place(P, m.x, m.y, m.z, m.yaw);
      // the toy's moods: a hop for a fare, a shiver when grumpy, the lidar's spin
      if (m.hop > 0) m.hop = Math.max(0, m.hop - dt);
      P.g.position.y =
        Math.abs(Math.sin((1 - m.hop) * Math.PI * 3)) * 0.5 * m.hop;
      const mood = car.needs.mood;
      P.g.rotation.z = mood < 20 ? Math.sin(t * 3) * 0.03 : 0;
      if (m.dance > 0) {
        m.dance -= dt;
        P.g.rotation.y = Math.sin(t * 12) * 0.4;
        P.spin.rotation.y += dt * 40;
      } else P.g.rotation.y = 0;
      P.spin.rotation.y +=
        dt *
        (s.task === "nap" || s.task === "tow"
          ? 0.4
          : car.needs.charge < 20
            ? 1.5
            : 3 + mood / 14);
      if (P.pet)
        P.pet.position.y =
          1.89 + Math.abs(Math.sin(t * 3 + car.id.length)) * 0.06;
      bubble(m, S, car, now);
      P.sprite.position.y = 4.2 + Math.sin(t * 2.5 + m.x) * 0.15;
    }
    // Karl's clouds drift east
    const fog = S.clock.weather === "fog" && !S.clock.night;
    M.karl.visible = fog;
    if (fog)
      for (const s of M.karl.children) {
        const u = s.userData;
        u.x += u.v * dt * K;
        if (u.x > (u.x0 = u.x0 || u.x) + 300 * K) u.x -= 300 * K;
        s.position.set(u.x, u.y + Math.sin(t * 0.2 + u.p) * 8, u.z);
        s.material.opacity = 0.8;
      }
  };
  // the DOM over the map: the cars' name tags and the neighbourhood labels, placed each frame
  M.place = function (S, camera, cam) {
    const w = innerWidth,
      h = innerHeight,
      height = cam.h;
    for (const car of S.cars) {
      const m = M.cars.get(car.id);
      if (!m) continue;
      _v.set(m.x, m.y + 5.6 * MS, m.z).project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      m.tag.style.opacity = vis ? 1 : 0;
      m.tag.style.pointerEvents = vis ? "" : "none";
      if (vis)
        m.tag.style.transform =
          "translate(" +
          ((_v.x * 0.5 + 0.5) * w).toFixed(1) +
          "px," +
          ((-_v.y * 0.5 + 0.5) * h).toFixed(1) +
          "px) translate(-50%,-100%)";
      const nm = car.nick || car.name;
      if (m.tagName !== nm)
        m.tag.querySelector("b").textContent = m.tagName = nm;
      const face = D.MOOD_FACE[Math.min(5, Math.floor(car.needs.mood / 18.5))];
      if (m.face !== face) m.tag.querySelector("i").textContent = m.face = face;
      m.tag.classList.toggle("follow", cam.follow === car.id);
      m.tag.setAttribute(
        "aria-label",
        nm + ": " + Sim.doing(car) + ". Tap to follow, again for its profile.",
      );
    }
    for (const name in labels) {
      const L = labels[name],
        H = D.HOODS[name];
      L.p.y = Sim.G.hoods[name].y;
      _v.copy(L.p).project(camera);
      // the plain neighbourhoods only show up close; the lands always do
      const show =
        (H.rank !== null || height < 900 * K) &&
        _v.z < 1 &&
        Math.abs(_v.x) < 1.05 &&
        Math.abs(_v.y) < 1.05;
      L.on = show;
      L.sx = (_v.x * 0.5 + 0.5) * w;
      L.sy = (-_v.y * 0.5 + 0.5) * h;
      // just below the plaza, so a parked car's name tag (above it) stays clear
      if (show)
        L.e.style.transform =
          "translate(" +
          L.sx.toFixed(1) +
          "px," +
          L.sy.toFixed(1) +
          "px) translate(-50%,40%)";
      if (L.e.hidden === show) L.e.hidden = !show;
    }
  };
  M.hop = (id) => {
    const m = M.cars.get(id);
    if (m) m.hop = 1;
  };
  M.dance = (id) => {
    const m = M.cars.get(id);
    if (m) m.dance = 2.5;
  };
  // a car's place on the map (game metres)
  M.carPos = (id) => {
    const m = M.cars.get(id);
    return m && m.x !== null ? { x: m.x, y: m.y, z: m.z, yaw: m.yaw } : null;
  };
  M.hoodPos = (name) => {
    const h = Sim.G.hoods[name];
    return h ? { x: h.x * K, y: h.y, z: h.z * K } : null;
  };
  // tap on the map itself: a car near the tap, or the nearest neighbourhood
  M.pick = function (cx, cy, camera) {
    let best = null,
      bd = 46;
    for (const [id, m] of M.cars) {
      _v.set(m.x, m.y + 1.2 * MS, m.z).project(camera);
      if (_v.z > 1) continue;
      const d = Math.hypot(
        (_v.x * 0.5 + 0.5) * innerWidth - cx,
        (-_v.y * 0.5 + 0.5) * innerHeight - cy,
      );
      if (d < bd) {
        bd = d;
        best = id;
      }
    }
    if (best) return { car: best };
    const n = hoodUnder(cx, cy);
    return n ? { hood: n } : null;
  };

  /* ---------- postcards: a 320×200 photo of a landmark for the stamp album ---------- */
  let rt = null;
  M.postcard = function (renderer, markName, title, carName) {
    const m = I.MARKS.find((q) => q.name === markName);
    if (!m) return null;
    if (!rt) rt = new T.WebGLRenderTarget(320, 200);
    const cam = new T.PerspectiveCamera(46, 1.6, 4, 60000 * K),
      x = m.x * K,
      y = m.y * K,
      z = m.z * K,
      hh = m.h * K,
      d = clamp((m.h * 2.4 + m.r * 0.35) * K, 160, 2600),
      a = 0.6 + (markName.length % 5) * 0.9;
    cam.position.set(
      x + Math.sin(a) * d,
      y + hh * 0.6 + d * 0.32,
      z + Math.cos(a) * d,
    );
    cam.lookAt(x, y + hh * 0.45, z);
    cam.updateMatrixWorld(true);
    const wasVis = group.visible;
    group.visible = false;
    I.frame(cam, 0, 320, 200);
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const px = new Uint8Array(320 * 200 * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, 320, 200, px);
    renderer.setRenderTarget(null);
    group.visible = wasVis;
    const cv = document.createElement("canvas");
    cv.width = 320;
    cv.height = 200;
    const cx = cv.getContext("2d"),
      img = cx.createImageData(320, 200);
    for (let r = 0; r < 200; r++)
      img.data.set(px.subarray((199 - r) * 1280, (200 - r) * 1280), r * 1280);
    cx.putImageData(img, 0, 0);
    // a postcard's border and greeting
    cx.strokeStyle = "#fff";
    cx.lineWidth = 10;
    cx.strokeRect(5, 5, 310, 190);
    cx.font = "900 17px 'M PLUS Rounded 1c', system-ui, sans-serif";
    cx.lineWidth = 4;
    cx.strokeStyle = "rgba(20,60,110,.85)";
    cx.fillStyle = "#fff";
    const t1 = "Greetings from " + title + "!";
    cx.strokeText(t1, 16, 30);
    cx.fillText(t1, 16, 30);
    cx.font = "800 12px 'M PLUS Rounded 1c', system-ui, sans-serif";
    const t2 = "Love, " + carName;
    cx.strokeText(t2, 16, 184);
    cx.fillText(t2, 16, 184);
    return cv.toDataURL("image/jpeg", 0.72);
  };

  /* ---------- the map camera: target, height, heading; it can follow a car ---------- */
  const PITCH = 0.98;
  M.cam = {
    x: 420 * K,
    z: -620 * K,
    h: 640 * K,
    yaw: 0.6,
    follow: null,
    ride: null,
  };
  const BOUNDS = { x0: -1950 * K, x1: 1650 * K, z0: -1650 * K, z1: 2150 * K };
  M.camera = function (dt, pos, look, camera) {
    const c = M.cam;
    if (c.follow) {
      const p = M.carPos(c.follow);
      if (p) {
        const f = Math.min(1, dt * 3);
        c.x += (p.x - c.x) * f;
        c.z += (p.z - c.z) * f;
      }
    }
    c.x = clamp(c.x, BOUNDS.x0, BOUNDS.x1);
    c.z = clamp(c.z, BOUNDS.z0, BOUNDS.z1);
    c.h = clamp(c.h, 250 * K, 1600 * K);
    // Ride Along: low behind the car, looking down the road ahead
    if (c.ride) {
      const p = M.carPos(c.ride);
      if (p) {
        const fx = -Math.sin(p.yaw),
          fz = -Math.cos(p.yaw);
        look.set(p.x + fx * 90, p.y + 10, p.z + fz * 90);
        pos.set(p.x - fx * 110, p.y + 70, p.z - fz * 110);
        return 3;
      }
      c.ride = null;
    }
    const gy = Math.max(0, W.height(c.x, c.z)),
      dist = c.h / Math.sin(PITCH);
    look.set(c.x, gy, c.z);
    pos.set(
      c.x + Math.sin(c.yaw) * Math.cos(PITCH) * dist,
      gy + c.h,
      c.z + Math.cos(c.yaw) * Math.cos(PITCH) * dist,
    );
    return 4;
  };
  // drag to pan: screen pixels to ground metres, along the camera's heading
  M.pan = function (dx, dy, camera) {
    const c = M.cam,
      dist = c.h / Math.sin(PITCH),
      mpp = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / innerHeight;
    const rx = Math.cos(c.yaw),
      rz = -Math.sin(c.yaw),
      fx = -Math.sin(c.yaw),
      fz = -Math.cos(c.yaw);
    c.x += (-dx * rx + dy * fx * 1.25) * mpp;
    c.z += (-dx * rz + dy * fz * 1.25) * mpp;
    c.follow = null;
    c.ride = null;
  };
  M.zoom = (f) => {
    M.cam.h = clamp(M.cam.h * f, 250 * K, 1600 * K);
  };
  M.rotate = (a) => {
    M.cam.yaw += a;
  };
  M.lookAt = (x, z, h) => {
    M.cam.x = x;
    M.cam.z = z;
    if (h) M.cam.h = h;
  };
  M.K = K;
  M.MS = MS;
  WG.adoptMap = M;
})();
