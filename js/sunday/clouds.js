/* Waymo Care · Sunday Drive · the clouds over the locked neighbourhoods. Each district that hasn't been opened yet sits
   under a bank of soft puffs (WG.world.puffTex, the same cloud texture the island uses). They drift slowly, and when a
   Map Seal opens a district they thin, lift and blow away. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    City = WG.sundayCity;
  const K = W.SCALE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);

  const C = {
    groups: {},
    active: false,
  };
  let root = null,
    tex = null;

  function cloudMat(opacity) {
    return new T.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity,
      color: 0xf3f7fb,
      fog: false,
    });
  }

  function buildDistrict(id, d) {
    const g = new T.Group();
    g.visible = false;
    const cx = d.x * K,
      cz = d.z * K,
      r = d.radius * K,
      base = Math.max(0, W.height(cx, cz));
    // a low, wide veil: three big soft discs hugging the district
    for (let k = 0; k < 3; k++) {
      const s = new T.Sprite(cloudMat(0.5 + k * 0.12));
      const w = r * rand(1.75, 2.5);
      s.scale.set(w, w * rand(0.42, 0.58), 1);
      s.position.set(
        cx + rand(-0.3, 0.3) * r,
        base + 35 + k * 38 + rand(-8, 8),
        cz + rand(-0.3, 0.3) * r,
      );
      s.userData = {
        x0: s.position.x,
        z0: s.position.z,
        y0: s.position.y,
        ph: rand(0, 7),
        v: rand(1.4, 3.2),
        drift: rand(0.35, 0.8),
      };
      s.renderOrder = 18 + k;
      g.add(s);
    }
    // taller puffs, so the bank has some body from a low angle
    for (let k = 0; k < 14; k++) {
      const s = new T.Sprite(cloudMat(rand(0.55, 0.9)));
      const w = r * rand(0.55, 1.25);
      s.scale.set(w, w * rand(0.5, 0.75), 1);
      s.position.set(
        cx + rand(-0.82, 0.82) * r,
        base + rand(70, 260),
        cz + rand(-0.82, 0.82) * r,
      );
      s.userData = {
        x0: s.position.x,
        z0: s.position.z,
        y0: s.position.y,
        ph: rand(0, 7),
        v: rand(2, 5),
        drift: rand(0.5, 1.2),
      };
      s.renderOrder = 20;
      g.add(s);
    }
    g.userData = { fade: 1, unlocking: false, id, base };
    root.add(g);
    C.groups[id] = g;
  }

  C.init = function (scene) {
    if (root) return;
    tex = W.puffTex();
    root = new T.Group();
    root.name = "sunday-clouds";
    root.visible = false;
    scene.add(root);
    for (const id of City.order) buildDistrict(id, City.districts[id]);
  };

  C.show = function (on) {
    C.active = !!on;
    if (root) root.visible = !!on;
  };

  C.sync = function (S) {
    const open = new Set(S.unlockedDistricts);
    for (const id in C.groups) {
      const g = C.groups[id];
      if (open.has(id)) {
        g.visible = false;
        g.userData.fade = 0;
      } else {
        g.visible = true;
        g.userData.fade = 1;
        g.userData.unlocking = false;
        for (const s of g.children) {
          s.material.opacity = s.userData.op0 || s.material.opacity;
          s.position.set(s.userData.x0, s.userData.y0, s.userData.z0);
        }
      }
    }
    // remember the starting opacity for a clean re-show
    for (const id in C.groups)
      for (const s of C.groups[id].children)
        if (s.userData.op0 === undefined) s.userData.op0 = s.material.opacity;
  };

  C.part = function (id) {
    const g = C.groups[id];
    if (!g) return;
    g.visible = true;
    g.userData.unlocking = true;
    g.userData.t = 0;
    for (const s of g.children) {
      s.position.set(s.userData.x0, s.userData.y0, s.userData.z0);
      s.material.opacity = s.userData.op0 || s.material.opacity;
    }
  };

  C.update = function (dt, t) {
    if (!root || !root.visible) return;
    for (const id in C.groups) {
      const g = C.groups[id],
        u = g.userData;
      if (!g.visible) continue;
      if (u.unlocking) {
        u.t += dt;
        const k = clamp(u.t / 2.6, 0, 1),
          e = 1 - Math.pow(1 - k, 3);
        u.fade = 1 - e;
        for (const s of g.children) {
          s.material.opacity = (s.userData.op0 || 0.7) * (1 - e);
          s.position.y = s.userData.y0 + e * 260;
          s.position.x = s.userData.x0 + e * 180;
        }
        if (k >= 1) {
          g.visible = false;
          u.unlocking = false;
        }
        continue;
      }
      for (const s of g.children) {
        const v = s.userData;
        s.position.x = v.x0 + Math.sin(t * 0.05 * v.drift + v.ph) * 22;
        s.position.z = v.z0 + Math.cos(t * 0.04 * v.drift + v.ph) * 18;
        s.position.y = v.y0 + Math.sin(t * 0.12 + v.ph) * 5;
      }
    }
  };

  WG.sundayClouds = C;
})();
