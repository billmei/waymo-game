/* Waymo Care · the world. The city is Slop Skies' own toy San Francisco (js/isle.js, generated from its engine: terrain,
   neighbourhoods, terraces, towers, landmarks, trees, sea, sky and clouds, all with its shaders). The game is played on
   streets round its landmarks: each shift works a small patch of street grid (Russian Hill between Lombard Street and
   Coit Tower, the Presidio's Main Post, the Financial District's towers, Alamo Square, the windmills by Ocean Beach),
   filled in by js/extras.js. This file boots the island, reads the patch's street grid into a graph for the robotaxis,
   answers ground and collision questions from the island's own colliders, lets the camera see through the houses in its
   way, and turns Slop's look into our shifts (morning, sun, Karl the Fog, dusk). */
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

  /* ---------- the play areas: each shift works a small patch of street grid round its landmarks. ang, u and v are the
     grid's angle and block size in island units: a district's own (island.js DIST rows: name, grid angle, u by v), or a
     finer one with an extra street down each block (the windmills' Sunset blocks, halved), or, for a park with no grid of
     its own, the next district's (the Presidio takes the Marina's). i0..i1, j0..j1 are the street lines that bound the
     patch; names are the districts whose streets it keeps; pad widens the walkable ground past the streets (island units
     west, east, north, south of the grid) to take in a landmark; slope is the steepest street the robotaxis will climb;
     avoid keeps streets off a landmark (island x, z, radius); marks are the island's landmarks the shift shows off, in
     the briefing's tour and with name tags in play (the crew starts by the first, facing it). A landmark can stand
     outside the patch, on the skyline. js/extras.js builds the houses and buildings that fill in each patch's blocks ---------- */
  const ZONES = {
    // the blocks between the top of Lombard's crooked bricks on Russian Hill and Telegraph Hill, under Coit Tower
    lombard: {
      name: "Russian Hill",
      label: "Lombard to Coit Tower",
      names: [
        "Russian Hill",
        "North Beach",
        "Telegraph Hill",
        "Fisherman's Wharf",
      ],
      ang: -8,
      u: 56,
      v: 76,
      i0: 12,
      i1: 18,
      j0: -16,
      j1: -14,
      slope: 0.75,
      marks: ["Lombard Street", "Coit Tower"],
    },
    // the Presidio's Main Post on its plateau west of the Palace of Fine Arts, the Golden Gate Bridge over the trees
    presidio: {
      name: "Presidio",
      label: "The Presidio",
      names: ["Presidio", "Crissy Field", "Marina"],
      ang: -8,
      u: 60,
      v: 82,
      i0: -17,
      i1: -12,
      j0: -18,
      j1: -15,
      marks: ["Golden Gate Bridge", "Palace of Fine Arts"],
    },
    // the Financial District's towers, from the Transamerica Pyramid down to Market Street under Salesforce Tower
    downtown: {
      name: "Financial District",
      label: "Downtown",
      names: ["Financial District", "Embarcadero", "SoMa"],
      ang: -8,
      u: 62,
      v: 82,
      i0: 17,
      i1: 21,
      j0: -8,
      j1: -4,
      marks: ["Transamerica Pyramid", "555 California", "Salesforce Tower"],
    },
    // the streets round Alamo Square and the Painted Ladies, Sutro Tower on the ridge to the southwest
    ladies: {
      name: "Western Addition",
      label: "Alamo Square",
      names: ["Western Addition", "Haight-Ashbury", "Castro"],
      ang: -8,
      u: 62,
      v: 82,
      i0: 3,
      i1: 7,
      j0: -6,
      j1: -3,
      slope: 0.5,
      avoid: [[232, -380, 64]],
      marks: ["Alamo Square", "Painted Ladies", "Sutro Tower"],
    },
    // the west end of Golden Gate Park by Ocean Beach, from the Dutch Windmill down the Great Highway to the Murphy
    // Windmill
    windmills: {
      name: "Ocean Beach",
      label: "The windmills",
      names: [
        "Ocean Beach",
        "Sunset",
        "Golden Gate Park",
        "Richmond",
        "Lands End",
      ],
      ang: 0,
      u: 60,
      v: 66,
      i0: -30,
      i1: -27,
      j0: -6,
      j1: -2,
      pad: [0, 0, 25, 0],
      marks: ["Dutch Windmill", "Murphy Windmill"],
    },
  };
  let ZONE = ZONES.lombard,
    ZA = 0,
    ZC = 1,
    ZS = 0;
  const HALF_ST = 4; // the streets are the 8-unit gaps between the block pads
  // grid-local island units <-> game metres
  const toWorld = (lx, lz) => [
    (lx * ZC - lz * ZS) * SCALE,
    (lx * ZS + lz * ZC) * SCALE,
  ];
  const toLocal = (x, z) => [
    (x * ZC + z * ZS) / SCALE,
    (-x * ZS + z * ZC) / SCALE,
  ];
  // the island's functions, in game metres
  const terrainY = (x, z) => I.ISL.terrainY(x / SCALE, z / SCALE) * SCALE;
  const hitsAt = (x, y, z, r) =>
    I.hitsBuilding(x / SCALE, y / SCALE, z / SCALE, r / SCALE);
  const zoneAt = (x, z) => I.zoneName(x / SCALE, z / SCALE);
  const AREA = { lx0: 0, lx1: 0, lz0: 0, lz1: 0 };
  function useZone(z) {
    ZONE = z;
    ZA = (z.ang * Math.PI) / 180;
    ZC = Math.cos(ZA);
    ZS = Math.sin(ZA);
    const pad = z.pad || [0, 0, 0, 0];
    AREA.lx0 = z.i0 * z.u - 22 - pad[0];
    AREA.lx1 = z.i1 * z.u + 22 + pad[1];
    AREA.lz0 = z.j0 * z.v - 22 - pad[2];
    AREA.lz1 = z.j1 * z.v + 22 + pad[3];
  }
  useZone(ZONE);
  const inArea = (x, z, m) => {
    const [lx, lz] = toLocal(x, z);
    m = (m || 0) / SCALE;
    return (
      lx > AREA.lx0 - m &&
      lx < AREA.lx1 + m &&
      lz > AREA.lz0 - m &&
      lz < AREA.lz1 + m
    );
  };

  const height = (x, z) => I.groundH(x / SCALE, z / SCALE) * SCALE;
  // a point on a street (the carriageway), as opposed to a block's raised pad
  function onStreet(x, z) {
    const [lx, lz] = toLocal(x, z),
      dx = Math.abs(lx - Math.round(lx / ZONE.u) * ZONE.u),
      dz = Math.abs(lz - Math.round(lz / ZONE.v) * ZONE.v);
    return dx < HALF_ST || dz < HALF_ST;
  }
  // the island's colliders (houses, towers, landmarks, street trees)
  const hits = (x, z, r) => hitsAt(x, height(x, z) + 1.2, z, r || 0);
  // the blocks of a gridded district stand on raised pads; parks, lawns and the beach don't
  const PADS = new Map();
  function onPad(x, z) {
    if (onStreet(x, z)) return false;
    const [lx, lz] = toLocal(x, z),
      i = Math.floor(lx / ZONE.u),
      j = Math.floor(lz / ZONE.v),
      k = i + "," + j;
    let p = PADS.get(k);
    if (p === undefined) {
      const [cx, cz] = toWorld((i + 0.5) * ZONE.u, (j + 0.5) * ZONE.v),
        row = I.ISL.DIST.find((d) => d[1] === zoneAt(cx, cz));
      p = false;
      // a block the game built up (js/extras.js), or one with a grid and something built on it
      const built = WG.extraPads && WG.extraPads[W.zoneKey];
      if (built && built.has(i + "," + j)) p = true;
      else if (row && row[6])
        for (let a = -2; a <= 2 && !p; a++)
          for (let b = -2; b <= 2 && !p; b++) {
            const [sx, sz] = toWorld(
              (i + 0.5 + a * 0.18) * ZONE.u,
              (j + 0.5 + b * 0.18) * ZONE.v,
            );
            p = hits(sx, sz, 0);
          }
      PADS.set(k, p);
    }
    return p;
  }
  const groundY = (x, z) => height(x, z) + (onPad(x, z) ? 0.2 * SCALE : 0);
  function isBlocked(x, z, r) {
    if (!inArea(x, z, -(r || 0))) return true;
    if (height(x, z) < 1.5 * SCALE) return true;
    return hits(x, z, r || 0);
  }

  /* ---------- the street graph ---------- */
  // ground the zone keeps clear of streets (island units: x, z, radius), so a landmark like Lombard's bricks stays on show
  const avoids = (x, z) =>
    (ZONE.avoid || []).some(
      ([ax, az, r]) => Math.hypot(x / SCALE - ax, z / SCALE - az) < r,
    );
  function buildGraph() {
    const { u, v, i0, i1, j0, j1 } = ZONE,
      names = ZONE.names || [ZONE.name],
      key = (i, j) => i + "," + j,
      byKey = {},
      nodes = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const [x, z] = toWorld(i * u, j * v),
          g = terrainY(x, z);
        if (
          g < 2.5 * SCALE ||
          !names.includes(zoneAt(x, z)) ||
          avoids(x, z) ||
          hitsAt(x, g + 1.5, z, 1.5 * SCALE)
        )
          continue;
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
        if (
          g < 2.5 * SCALE ||
          avoids(x, z) ||
          hitsAt(x, g + 1.5, z, 1.0 * SCALE)
        )
          return false;
        if (
          prev !== null &&
          Math.abs(g - prev) / (Math.hypot(b.x - a.x, b.z - a.z) / 16) >
            (ZONE.slope || 0.32)
        )
          return false;
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
    const out = keep.map((n) => ({
      id: remap[n.id],
      i: n.i,
      j: n.j,
      x: n.x,
      z: n.z,
      nb: n.nb.filter((m) => m in remap).map((m) => remap[m]),
    }));
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
    for (const n of nodes)
      strip(
        n.x - ex * (WIDTH / 2),
        n.z - ez * (WIDTH / 2),
        n.x + ex * (WIDTH / 2),
        n.z + ez * (WIDTH / 2),
        WIDTH,
        0.06,
        ASPHALT,
        6,
      );
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
        strip(
          n.x + ux * h,
          n.z + uz * h,
          o.x - ux * h,
          o.z - uz * h,
          WIDTH,
          0.06,
          ASPHALT,
          6,
        );
        // the double yellow line
        for (const s2 of [-0.16, 0.16])
          strip(
            n.x + ux * (h + 3.6) + px * s2,
            n.z + uz * (h + 3.6) + pz * s2,
            o.x - ux * (h + 3.6) + px * s2,
            o.z - uz * (h + 3.6) + pz * s2,
            0.14,
            0.09,
            YELLOW,
            1,
          );
        // zebra crossings at both ends
        for (const [cx, cz, sg] of [
          [n.x, n.z, 1],
          [o.x, o.z, -1],
        ])
          for (let q = -h + 0.9; q <= h - 0.9; q += 1.25) {
            const mx = cx + ux * sg * (h + 1.7) + px * q,
              mz = cz + uz * sg * (h + 1.7) + pz * q;
            strip(
              mx - ux * 1.3,
              mz - uz * 1.3,
              mx + ux * 1.3,
              mz + uz * 1.3,
              0.6,
              0.1,
              WHITE,
              1,
            );
          }
      }
    void nx;
    void nz;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(N, 3));
    g.setAttribute("aCol", new T.Float32BufferAttribute(C, 4));
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2),
    );
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
      _v.set(nr[3 * j], nr[3 * j + 1], nr[3 * j + 2])
        .applyMatrix3(_m3)
        .normalize();
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

  /* ---------- the looks: Slop's own grade for the day (and a low eastern sun on it for the morning), and two more in its
     format ---------- */
  const LOOKS = {
    morning: {
      grade: "promo",
      sun: [15, 112],
      fogK: 1,
      light: ["#ffe2bd", 0.74, "#d9ebff", "#8f7f5f", 0.62],
      puffs: 0,
      karl: 0,
    },
    day: {
      grade: "promo",
      sun: [26, 222],
      fogK: 1,
      light: ["#fff1d6", 0.78, "#d7ecff", "#8f7f5f", 0.6],
      puffs: 0,
      karl: 0,
    },
    fog: {
      grade: "karl",
      sun: [40, 200],
      fogK: 1,
      light: ["#eef3f7", 0.42, "#e6eef4", "#8d8f86", 0.78],
      puffs: 1,
      karl: 1,
    },
    dusk: {
      grade: "golden",
      sun: [9, 262],
      fogK: 1,
      light: ["#ffb27a", 0.72, "#9a8ad0", "#6b5040", 0.52],
      puffs: 0,
      karl: 0,
    },
    // Adopt-a-Waymo's evenings: moonlight, a deep blue sky and the street lights' warm haze
    night: {
      grade: "night",
      sun: [16, 300],
      fogK: 1,
      light: ["#a9bcff", 0.38, "#4a5a96", "#262a3a", 0.46],
      puffs: 0,
      karl: 0,
    },
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
      hazeK: 1 / 150,
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
    G.night = {
      sky: [
        [0, "#33406e"],
        [0.03, "#2a3765"],
        [0.07, "#222e5a"],
        [0.12, "#1b264e"],
        [0.18, "#151f43"],
        [0.26, "#101838"],
        [0.4, "#0a1028"],
      ],
      seaNear: "#0f2446",
      seaMid: "#132a50",
      seaFar: "#1d3460",
      seaShal: "#21406a",
      seaShalHi: "#3a5a86",
      foam: "#b8c8e0",
      haze: "#2a3560",
      hazeK: 1 / 9000,
      hazeW: "#ffcf8a",
      glow: "#ffd9a0",
      cloudTop: "#6a76a0",
      cloudUnder: "#2a3258",
    };
  }

  /* ---------- seeing through the houses: rather than swing the camera up over the rooftops, the island's buildings,
     landmarks and trees go see-through in a corridor from the camera to whatever it follows (the crew member, or the car
     in a job). The corridor is a vertical slice on the ground (so a house fades up to its roof, not as a hole), takes in
     what rises to within a few metres of the line of sight (so the streets, roads and low walls under it stay solid) and
     stops just short of the follow point. With
     multisampling the faded part is drawn at partial coverage (alpha to coverage), otherwise with a fine ordered dither
     ---------- */
  const SEE = { p: new T.Vector3(), k: new T.Vector4(0, 6.5, 0.35, 0), on: 0 };
  const SEE_GLSL = `
  if(uSeeK.x>0.001){
    vec2 sd=uSeeP.xz-uCam.xz;float sl=max(length(sd),1e-3);vec2 su=sd/sl;
    vec2 q=vW.xz-uCam.xz;float st=dot(q,su),sr=abs(q.x*su.y-q.y*su.x);
    float yl=mix(uCam.y,uSeeP.y+1.2,clamp(st/sl,0.0,1.0));     // the line of sight's height over this point
    float sw=(1.0-smoothstep(uSeeK.y*0.55,uSeeK.y,sr))*(1.0-smoothstep(sl-2.2,sl-0.7,st))*smoothstep(-1.0,0.5,st)
      *smoothstep(uSeeP.y+0.5,uSeeP.y+1.2,vW.y)*smoothstep(yl-4.5,yl-2.5,vW.y)*uSeeK.x;
    a*=1.0-sw*(1.0-uSeeK.z);
#ifdef SEE_DITHER
    vec2 b1=floor(gl_FragCoord.xy*0.5),b2=floor(gl_FragCoord.xy);   // a 4x4 Bayer threshold
    float th=fract(dot(b1,vec2(0.5,b1.y*0.75)))*0.25+fract(dot(b2,vec2(0.5,b2.y*0.75)))+0.03;
    if(a<th)discard;a=1.0;
#endif
  }
  gl_FragColor=vec4(c,a);`;
  function seeThrough(renderer) {
    const gl = renderer.getContext(),
      msaa = (gl.getParameter(gl.SAMPLES) || 0) > 1;
    for (const k of ["objects", "homes", "homesFar"]) {
      const mesh = I.ISLAND.meshes[k],
        m = mesh && mesh.material;
      if (!m || !m.fragmentShader) continue;
      const fs = m.fragmentShader,
        out = "gl_FragColor=vec4(c,a);",
        at = fs.lastIndexOf(out);
      if (at < 0) continue;
      m.fragmentShader =
        "uniform vec3 uSeeP; uniform vec4 uSeeK;\n" +
        fs.slice(0, at) +
        SEE_GLSL +
        fs.slice(at + out.length);
      m.uniforms.uSeeP = { value: SEE.p };
      m.uniforms.uSeeK = { value: SEE.k };
      if (msaa) m.alphaToCoverage = true;
      else m.defines = Object.assign(m.defines || {}, { SEE_DITHER: 1 });
      m.needsUpdate = true;
    }
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
    ZONES,
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
    seeThrough(renderer);
    addGrades();
    I.setGrade("default");
    W.setArea("lombard");

    // light for the game's own toys (robotaxis, the crew), from Slop's sun
    W.hemi = new T.HemisphereLight(0xd7ecff, 0x8f7f5f, 0.6);
    W.sun = new T.DirectionalLight(0xfff1d6, 0.78);
    scene.add(W.hemi, W.sun, W.sun.target);

    W.puffMat = new T.SpriteMaterial({
      map: puffTex(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      color: 0xeef2f4,
    });
    W.puffs = new T.Group();
    for (let i = 0; i < 46; i++) {
      const s = new T.Sprite(W.puffMat),
        sz = 26 + Math.random() * 24;
      s.scale.set(sz, sz * 0.55, 1);
      s.position.set(
        W.center.x + (Math.random() - 0.5) * 300,
        0,
        W.center.z + (Math.random() - 0.5) * 300,
      );
      s.userData = { v: 1.5 + Math.random() * 2.5, y: 5 + Math.random() * 12 };
      W.puffs.add(s);
    }
    W.puffs.visible = false;
    scene.add(W.puffs);
    W.setLook("day");
  };

  // how far a landmark's grounds reach (metres): along 16 bearings, the last collider before a clear gap of 8 m
  function footprint(x, z) {
    let R = 14;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      let last = 0;
      for (let d = 0, gap = 0; d < 160 && gap < 8; d += 2)
        if (hits(x + Math.cos(a) * d, z + Math.sin(a) * d, 0)) {
          last = d;
          gap = 0;
        } else gap += 2;
      R = Math.max(R, last);
    }
    return R;
  }

  // move the play area to another district: its street graph, paving, middle and the crew's start
  W.setArea = function (key) {
    const z = ZONES[key] || ZONES.lombard;
    if (W.zone === z && W.graph) return false;
    useZone(z);
    PADS.clear();
    W.zone = z;
    W.zoneKey = key;
    W.graph = buildGraph();
    if (W.streets) {
      W.scene.remove(W.streets);
      W.streets.geometry.dispose();
    }
    W.streets = streets(W.scene);
    const [cx, cz] = toWorld(
      ((z.i0 + z.i1) / 2) * z.u,
      ((z.j0 + z.j1) / 2) * z.v,
    );
    W.center = new T.Vector3(cx, height(cx, cz), cz);
    // the shift's landmarks, in game metres: where they stand, their foot and their height
    W.marks = (z.marks || [])
      .map((n) => I.MARKS.find((m) => m.name === n))
      .filter(Boolean)
      .map((m) => ({
        name: m.name,
        x: m.x * SCALE,
        z: m.z * SCALE,
        y: m.y * SCALE,
        h: m.h * SCALE,
      }));
    // the crew starts on a street corner just outside the first landmark's grounds, facing it, so its foot is in the frame
    const m0 = W.marks[0] || { x: cx, z: cz, h: 0 },
      D = clamp(footprint(m0.x, m0.z) + 8, 30, 60),
      off = (n) => Math.abs(Math.hypot(n.x - m0.x, n.z - m0.z) - D);
    let st = W.graph.nodes[0];
    for (const n of W.graph.nodes) if (off(n) < off(st)) st = n;
    W.start = { x: st.x, z: st.z, yaw: Math.atan2(st.x - m0.x, st.z - m0.z) };
    // a bigger patch of streets takes a bigger fleet
    W.fleet = clamp(Math.round(W.graph.edges * 0.45), 12, 20);
    if (W.puffs)
      for (const s of W.puffs.children) {
        s.position.x = cx + (Math.random() - 0.5) * 300;
        s.position.z = cz + (Math.random() - 0.5) * 300;
      }
    return true;
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
    const sunC =
        name === "dusk"
          ? [1.0, 0.7, 0.46]
          : name === "fog"
            ? [0.78, 0.8, 0.84]
            : name === "morning"
              ? [1.0, 0.88, 0.72]
              : name === "night"
                ? [0.4, 0.48, 0.82]
                : I.LIGHT.sun,
      sky =
        name === "dusk"
          ? [0.56, 0.54, 0.7]
          : name === "fog"
            ? [0.62, 0.66, 0.72]
            : name === "night"
              ? [0.22, 0.27, 0.46]
              : I.LIGHT.sky;
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
    if (WG.CAR_HEAD)
      WG.CAR_HEAD.emissive.set(
        name === "dusk" || name === "night"
          ? 0xfff2b0
          : name === "fog"
            ? 0xbbb38a
            : 0x333322,
      );
  };

  // what the camera follows, so the houses in the way go see-through (null: nothing, as in the aerial views)
  W.see = function (p) {
    SEE.on = p ? 1 : 0;
    if (p) SEE.p.copy(p);
  };

  W.update = function (t, dt, focus, camera, vw, vh) {
    SEE.k.x += (SEE.on - SEE.k.x) * Math.min(1, dt * 5);
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
    W.sun.position.set(
      focus.x + d.x * 100,
      focus.y + d.y * 100,
      focus.z + d.z * 100,
    );
    W.sun.target.position.copy(focus);
    I.frame(camera, dt, vw, vh);
  };

  WG.world = W;
})();
