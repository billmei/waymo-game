/* Waymo Care · Sunday Drive · the sea of clouds. Every district that isn't open yet sleeps under a low blanket of soft
   coastal cloud (billboard puffs, drawn on a canvas like world.js's puffTex but lumpier); unlocking one blows its clouds
   outward and away. Ocean Beach, once open, keeps a few wisps of Karl the Fog drifting in off the sea. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    I = WG.isle,
    D = WG.sundayData,
    Sim = WG.adoptSim;
  const K = WG.world.SCALE;
  const rr = (a, b) => a + Math.random() * (b - a);
  const Clouds = { groups: {} };
  let root = null,
    karl = null;

  // a fluffy cumulus: a few overlapping soft blobs, a touch of blue-grey underneath
  function cloudTex(seed) {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 160;
    const x = cv.getContext("2d");
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const blobs = [];
    for (let k = 0; k < 9; k++)
      blobs.push([40 + rnd() * 176, 70 + rnd() * 34 - (k < 4 ? 12 : 0), 30 + rnd() * 30]);
    // the shaded underside first, then the bright tops a little higher
    for (const [bx, by, br] of blobs) {
      const g = x.createRadialGradient(bx, by + 10, 2, bx, by + 10, br * 1.15);
      g.addColorStop(0, "rgba(196,210,226,0.55)");
      g.addColorStop(1, "rgba(196,210,226,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 160);
    }
    for (const [bx, by, br] of blobs) {
      const g = x.createRadialGradient(bx - br * 0.2, by - br * 0.25, 2, bx, by, br);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 160);
    }
    const t = new T.CanvasTexture(cv);
    return t;
  }

  Clouds.init = function (scene) {
    if (root) return;
    root = new T.Group();
    scene.add(root);
    const texs = [cloudTex(1), cloudTex(2), cloudTex(3)];
    for (const d of D.DISTRICTS) {
      if (!d.cost) continue; // the start is never clouded
      const g = new T.Group(),
        mats = texs.map(
          (map) =>
            new T.SpriteMaterial({
              map,
              transparent: true,
              depthWrite: false,
              fog: false,
              opacity: 0.97,
            }),
        );
      const add = (x, z, size) => {
        const s = new T.Sprite(pickOf(mats)),
          gy = Math.max(0, I.groundH(x, z)),
          y = gy + rr(55, 120);
        s.scale.set(size * K, size * 0.62 * K, 1);
        s.position.set(x * K, y * K, z * K);
        s.renderOrder = 20;
        s.userData = { x: x * K, y: y * K, z: z * K, p: Math.random() * 6, vx: 0, vy: 0, vz: 0, sz: size * K };
        g.add(s);
      };
      // a heap over every neighbourhood and along the roads inside the district
      for (const n of d.all) {
        const h = Sim.G.hoods[n];
        add(h.x, h.z, rr(340, 460));
        for (let k = 0; k < 7; k++) {
          const a = Math.random() * Math.PI * 2,
            r = rr(60, 210);
          add(h.x + Math.cos(a) * r, h.z + Math.sin(a) * r, rr(240, 400));
        }
      }
      for (const e of Sim.G.edges)
        if (d.all.includes(e.a) || d.all.includes(e.b)) {
          const p = Sim.edgePoint(e, e.a, 0.5);
          add(p.x, p.z, rr(260, 380));
          if (d.all.includes(e.a) && d.all.includes(e.b)) {
            const q = Sim.edgePoint(e, e.a, rr(0.25, 0.75));
            add(q.x, q.z, rr(220, 340));
          }
        }
      g.userData = { mats, part: -1, cx: d.cx, cz: d.cz };
      root.add(g);
      Clouds.groups[d.id] = g;
    }
    // Karl the Fog's wisps, over the west side once Ocean Beach is open
    const wm = D.DISTRICTS.find((d) => d.karl);
    if (wm) {
      karl = new T.Group();
      const mat = new T.SpriteMaterial({ map: texs[1], transparent: true, depthWrite: false, fog: false, opacity: 0.5 });
      for (let k = 0; k < 16; k++) {
        const s = new T.Sprite(mat),
          sz = rr(260, 480) * K;
        s.scale.set(sz, sz * 0.5, 1);
        s.userData = {
          x0: wm.cx - 900 * K,
          x: wm.cx + rr(-900, 500) * K,
          z: wm.cz + rr(-650, 650) * K,
          y: rr(40, 90) * K,
          v: rr(14, 26) * K,
          p: Math.random() * 6,
        };
        s.renderOrder = 19;
        karl.add(s);
      }
      karl.visible = false;
      root.add(karl);
    }
  };
  const pickOf = (a) => a[(Math.random() * a.length) | 0];

  // which districts are open (a Set of ids): their clouds go, everybody else's come back, at once
  Clouds.set = function (open) {
    for (const id in Clouds.groups) {
      const g = Clouds.groups[id],
        on = !open.has(id);
      g.visible = on;
      g.userData.part = -1;
      if (on) reset(g);
    }
    if (karl) karl.visible = open.has(D.DISTRICTS.find((d) => d.karl).id);
  };
  function reset(g) {
    for (const m of g.userData.mats) m.opacity = 0.97;
    for (const s of g.children) {
      const u = s.userData;
      s.position.set(u.x, u.y, u.z);
      s.scale.set(u.sz, u.sz * 0.62, 1);
      u.vx = u.vy = u.vz = 0;
    }
  }
  // part a district's clouds: each puff blows outward from the middle, rises a little and fades
  Clouds.part = function (id) {
    const g = Clouds.groups[id];
    if (!g) return 0;
    const { cx, cz } = g.userData;
    for (const s of g.children) {
      const u = s.userData,
        dx = u.x - cx,
        dz = u.z - cz,
        l = Math.hypot(dx, dz) || 1,
        v = rr(260, 520) * K;
      u.vx = (dx / l) * v;
      u.vz = (dz / l) * v;
      u.vy = rr(20, 60) * K;
    }
    g.userData.part = 0;
    return 2.8;
  };
  Clouds.parting = () => Object.values(Clouds.groups).some((g) => g.userData.part >= 0);

  Clouds.update = function (dt, t) {
    if (!root) return;
    for (const id in Clouds.groups) {
      const g = Clouds.groups[id];
      if (!g.visible) continue;
      const u0 = g.userData;
      if (u0.part >= 0) {
        u0.part += dt;
        const k = Math.min(1, u0.part / 2.8);
        for (const m of u0.mats) m.opacity = 0.97 * (1 - k) * (1 - k);
        for (const s of g.children) {
          const u = s.userData;
          s.position.x += u.vx * dt;
          s.position.y += u.vy * dt;
          s.position.z += u.vz * dt;
          const f = 1 + k * 0.5;
          s.scale.set(u.sz * f, u.sz * 0.62 * f, 1);
        }
        if (k >= 1) {
          g.visible = false;
          u0.part = -1;
          reset(g);
        }
        continue;
      }
      // a slow breath while they sleep
      for (const s of g.children) {
        const u = s.userData;
        s.position.y = u.y + Math.sin(t * 0.25 + u.p) * 5 * K;
        s.position.x = u.x + Math.sin(t * 0.08 + u.p * 2) * 12 * K;
      }
    }
    if (karl && karl.visible)
      for (const s of karl.children) {
        const u = s.userData;
        u.x += u.v * dt;
        if (u.x > u.x0 + 1500 * K) u.x -= 1500 * K;
        s.position.set(u.x, u.y + Math.sin(t * 0.2 + u.p) * 6 * K, u.z);
        // fade in at the sea end, out as it reaches the city
        const k = (u.x - u.x0) / (1500 * K);
        s.material.opacity = 0.5;
        s.visible = k > 0.03 && k < 0.97;
      }
  };
  Clouds.show = (on) => root && (root.visible = on);
  WG.sundayClouds = Clouds;
})();
