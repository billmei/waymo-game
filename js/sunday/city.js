/* Waymo Care · Sunday Drive · the bird's-eye city. San Francisco from above as a toy diorama: the roads between the
   neighbourhoods (Adopt-a-Waymo's road graph, js/adopt/sim.js, ridden at the same height as its map draws them), lit up
   where the city is open and dim under the clouds; a toy robotaxi for each car in the fleet, picking up riders and
   driving them across town; the cars' needs (a soft bubble, never an alarm) and the depots they take themselves to
   when nobody comes; the district and neighbourhood labels; and the map camera (pan, zoom, turn, follow, ride along).
   No save in here: js/sunday/main.js owns the save and tells the city what's open. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    I = WG.isle,
    D = WG.sundayData,
    AD = WG.adoptData,
    Sim = WG.adoptSim,
    AM = WG.adoptMap;
  const K = W.SCALE; // island units → game metres
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const $ = (s) => document.querySelector(s);
  const MS = AM.MS,
    ROAD_W = AM.ROAD_W;

  const City = {
    cars: [],
    on: null, // (event) → main.js: fare, need, depot, autoCared, board
    onDistrictTap: null,
    open: new Set(), // open district ids
    hoodOpen: new Set(), // open neighbourhood names
    paused: false,
    MS,
    K,
  };
  let scene = null,
    group = null,
    built = false;
  const emit = (ev) => City.on && City.on(ev);

  /* ---------- the districts on the graph: each neighbourhood belongs to one (the last takes every one left over) ---------- */
  const hoodDist = {};
  City.hoodDist = hoodDist;
  function assignHoods() {
    const rest = D.DISTRICTS.find((d) => d.rest);
    for (const d of D.DISTRICTS)
      for (const h of d.hoods) if (Sim.G.hoods[h]) hoodDist[h] = d.id;
    for (const n of Sim.G.names) if (!hoodDist[n]) hoodDist[n] = rest.id;
    for (const d of D.DISTRICTS) {
      d.all = Sim.G.names.filter((n) => hoodDist[n] === d.id);
      d.hub = d.hoods.find((h) => Sim.G.hoods[h]) || d.all[0];
      // the district's middle (game metres), for the label, the clouds and the camera
      let x = 0,
        z = 0;
      for (const n of d.all) {
        x += Sim.G.hoods[n].x;
        z += Sim.G.hoods[n].z;
      }
      d.cx = (x / d.all.length) * K;
      d.cz = (z / d.all.length) * K;
      let r = 0;
      for (const n of d.all)
        r = Math.max(
          r,
          Math.hypot(Sim.G.hoods[n].x * K - d.cx, Sim.G.hoods[n].z * K - d.cz),
        );
      d.r = r + 220 * K;
      const hub = Sim.G.hoods[d.hub];
      d.hx = hub.x * K;
      d.hz = hub.z * K;
    }
  }
  // which district a point (game metres) is in: its nearest neighbourhood's
  City.districtAt = function (x, z) {
    let best = null,
      bd = Infinity;
    for (const n of Sim.G.names) {
      const h = Sim.G.hoods[n],
        d = (h.x * K - x) ** 2 + (h.z * K - z) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best ? hoodDist[best] : D.DISTRICTS[0].id;
  };
  City.hoodAt = function (x, z) {
    let best = null,
      bd = Infinity;
    for (const n of Sim.G.names) {
      const h = Sim.G.hoods[n],
        d = (h.x * K - x) ** 2 + (h.z * K - z) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };
  // the district a landmark (js/isle.js MARKS, island units) belongs to
  City.markDistrict = (m) => City.districtAt(m.x * K, m.z * K);
  City.district = (id) => D.BY_ID[id];

  /* ---------- routes over the open part of the graph only ---------- */
  let routeCache = {};
  function route(a, b) {
    if (a === b) return [a];
    const key = a + ">" + b;
    if (routeCache[key] !== undefined) return routeCache[key];
    const dist = { [a]: 0 },
      prev = {},
      done = new Set(),
      open = [a];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++)
        if (dist[open[i]] < dist[open[bi]]) bi = i;
      const n = open.splice(bi, 1)[0];
      if (n === b) break;
      if (done.has(n)) continue;
      done.add(n);
      for (const [m, e] of Sim.G.adj[n]) {
        if (!City.hoodOpen.has(m)) continue;
        const d = dist[n] + e.len;
        if (dist[m] === undefined || d < dist[m]) {
          dist[m] = d;
          prev[m] = n;
          open.push(m);
        }
      }
    }
    if (dist[b] === undefined) return (routeCache[key] = null);
    const out = [b];
    while (out[0] !== a) out.unshift(prev[out[0]]);
    return (routeCache[key] = out);
  }
  function routeLen(r) {
    if (!r) return Infinity;
    let L = 0;
    for (let i = 1; i < r.length; i++) L += Sim.edgeOf(r[i - 1], r[i]).len;
    return L;
  }
  City.route = route;

  /* ---------- the roads: a ribbon per road, lit where both ends are open ---------- */
  const roads = (City.roads = []); // { e, mesh, lit, k (0 dim → 1 lit), delay }
  function buildRoads() {
    for (const e of Sim.G.edges) {
      const g = AM.roadGeometry(e, ["#f6f1e4", "#5f6878", "#ffd23a"]);
      const mat = new T.MeshBasicMaterial({
        vertexColors: true,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.35,
        color: 0x9aa3ad,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new T.Mesh(g, mat);
      mesh.renderOrder = 2;
      group.add(mesh);
      roads.push({ e, mesh, lit: false, k: 0, delay: 0 });
    }
  }
  // a road's light: k from 0 (dim, under the clouds) to 1 (lit)
  function paint(r, k) {
    r.k = k;
    r.mesh.renderOrder = k > 0.99 ? 3 : 2;
    r.mesh.material.opacity = 0.35 + k * 0.65;
    r.mesh.material.color.setRGB(0.6 + k * 0.4, 0.64 + k * 0.36, 0.68 + k * 0.32);
    r.mesh.material.depthWrite = k > 0.99;
  }
  /* ---------- a plaza at each neighbourhood centre, a depot (a little garage) at each district's hub ---------- */
  const plazas = {};
  function buildPlazas() {
    const disc = new T.CircleGeometry(ROAD_W * 0.6 * K, 28);
    for (const name of Sim.G.names) {
      const h = Sim.G.hoods[name],
        p = new T.Mesh(
          disc,
          new T.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          }),
        );
      p.rotation.x = -Math.PI / 2;
      p.position.set(h.x * K, h.y + 1.9, h.z * K);
      p.renderOrder = 3;
      group.add(p);
      plazas[name] = p;
    }
    // the depots: a striped awning on posts, big enough to read from the sky
    const lam = (c) => new T.MeshLambertMaterial({ color: c });
    for (const d of D.DISTRICTS) {
      const h = Sim.G.hoods[d.hub],
        g = new T.Group();
      const base = new T.Mesh(new T.BoxGeometry(1, 1, 1), lam(0xeef3f7));
      base.scale.set(5.2, 0.25, 3.6);
      base.position.y = 0.12;
      g.add(base);
      for (let k = 0; k < 5; k++) {
        const s = new T.Mesh(new T.BoxGeometry(1, 1, 1), lam(k % 2 ? 0xffffff : 0x36d3c4));
        s.scale.set(1.04, 0.22, 3.8);
        s.position.set(-2.08 + k * 1.04, 2.7, 0);
        s.rotation.x = 0.12;
        g.add(s);
      }
      for (const x of [-2.4, 2.4])
        for (const z of [-1.6, 1.6]) {
          const post = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 2.6, 6), lam(0x2e3a4a));
          post.position.set(x, 1.3, z);
          g.add(post);
        }
      g.scale.setScalar(MS * 0.9);
      g.position.set(h.x * K + ROAD_W * 2.6 * K, h.y + 1, h.z * K - ROAD_W * 1.2 * K);
      g.rotation.y = 0.5;
      g.visible = false;
      group.add(g);
      d.depot = g;
    }
  }

  /* ---------- labels: a big one per district, small ones per neighbourhood when close ---------- */
  const labels = []; // { kind: "d"|"h", id, e, p: Vector3, on }
  function makeLabels() {
    const box = $("#sd-labels");
    for (const d of D.DISTRICTS) {
      const e = document.createElement("button");
      e.type = "button";
      e.className = "sd-dlabel";
      e.dataset.district = d.id;
      e.innerHTML = '<i aria-hidden="true"></i><b></b><small></small>';
      e.querySelector("b").textContent = d.name;
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (City.onDistrictTap) City.onDistrictTap(d.id);
      });
      box.appendChild(e);
      const hub = Sim.G.hoods[d.hub];
      labels.push({
        kind: "d",
        id: d.id,
        e,
        p: new T.Vector3(hub.x * K, hub.y + 30 * K, hub.z * K), // moved by refreshLabels
        on: false,
      });
    }
    for (const n of Sim.G.names) {
      const e = document.createElement("div");
      e.className = "sd-hlabel";
      e.textContent = n;
      box.appendChild(e);
      const h = Sim.G.hoods[n];
      labels.push({ kind: "h", id: n, e, p: new T.Vector3(h.x * K, h.y, h.z * K), on: false });
    }
  }
  // the labels' text and state, after seals or the open set change. info(id) → { cost, can, locked } from main.js
  City.refreshLabels = function (info) {
    for (const L of labels) {
      if (L.kind !== "d") continue;
      const d = D.BY_ID[L.id],
        s = info(L.id);
      L.e.classList.toggle("locked", s.locked);
      L.e.classList.toggle("ready", s.locked && s.can);
      L.e.querySelector("i").textContent = s.locked ? (s.can ? "✨" : "☁️") : d.icon;
      L.e.querySelector("small").textContent = s.locked
        ? s.reachable
          ? s.cost + " Map Seal" + (s.cost === 1 ? "" : "s")
          : "Beyond the clouds"
        : d.sub;
      L.e.setAttribute(
        "aria-label",
        d.name +
          (s.locked
            ? ", under the clouds" + (s.reachable ? ", needs " + s.cost + " Map Seals" : ", open a neighbouring district first")
            : ", open. Tap to fly there"),
      );
      // a locked district's label sits in the middle of its clouds, an open one at its hub
      const hub = Sim.G.hoods[d.hub];
      if (s.locked) L.p.set(d.cx, hub.y + 60 * K, d.cz);
      else L.p.set(hub.x * K, hub.y + 30 * K, hub.z * K);
    }
  };

  /* ---------- what's open ---------- */
  // set the open districts. animate: the newly lit roads light up one after another from the open side
  City.setOpen = function (ids, animate) {
    const before = new Set(City.hoodOpen);
    City.open = new Set(ids);
    City.hoodOpen = new Set(Sim.G.names.filter((n) => City.open.has(hoodDist[n])));
    routeCache = {};
    for (const r of roads) {
      const lit = City.hoodOpen.has(r.e.a) && City.hoodOpen.has(r.e.b);
      if (lit && !r.lit && animate) {
        // the road from an already-open neighbourhood lights first, then on outwards
        const old = before.has(r.e.a) || before.has(r.e.b);
        r.delay = old ? rr(0, 0.4) : rr(0.6, 1.8);
      } else r.delay = 0;
      r.lit = lit;
      if (!animate) paint(r, lit ? 1 : 0);
    }
    for (const n in plazas) {
      const on = City.hoodOpen.has(n);
      plazas[n].material.opacity = on ? 0.95 : 0.25;
    }
    for (const d of D.DISTRICTS) if (d.depot) d.depot.visible = City.open.has(d.id);
    // cars caught on a road that just closed (only a debug or Free Drive switch-off does that) hop back to the start
    for (const car of City.cars)
      if (!City.hoodOpen.has(car.at) || (car.to && !City.hoodOpen.has(car.to))) {
        car.from = car.to = null;
        car.at = D.DISTRICTS[0].hub;
        car.path = [];
        car.rider = null;
        car.mode = "fare";
        car.wait = 0.5;
      }
  };

  /* ---------- the fleet ---------- */
  let nextId = 1;
  function makeToy(ring) {
    const parts = WG.makeCar();
    parts.root.scale.setScalar(MS);
    parts.sprite.renderOrder = 12;
    // its own ring colour (the lidar's glow), so you can tell the cars apart from up here
    parts.ring.material = parts.ring.material.clone();
    parts.ring.material.color.set(ring);
    parts.ring.material.emissive = new T.Color(ring).multiplyScalar(0.4);
    group.add(parts.root);
    return parts;
  }
  // a new car at a neighbourhood (a district's hub by default)
  City.spawn = function (at) {
    const id = nextId++,
      ring = D.RING_COLS[(id - 1) % D.RING_COLS.length];
    const car = {
      id,
      name: "Waymo #" + id,
      plate: "7" + String.fromCharCode(65 + ((id * 7) % 26)) + String.fromCharCode(65 + ((id * 11) % 26)) + String.fromCharCode(65 + ((id * 5) % 26)) + (100 + ((id * 37) % 900)),
      ring,
      parts: makeToy(ring),
      at,
      from: null,
      to: null,
      t: 0,
      path: [],
      v: D.FLEET.speed * rr(0.88, 1.12),
      rider: null,
      need: null,
      mode: "fare",
      wait: rr(0.3, 2.5),
      x: null,
      y: 0,
      z: null,
      yaw: 0,
      hop: 0,
      bkey: "",
      fares: 0,
    };
    City.cars.push(car);
    return car;
  };
  City.find = (id) => City.cars.find((c) => c.id === id);
  City.removeAll = function () {
    for (const c of City.cars) group.remove(c.parts.root);
    City.cars.length = 0;
    nextId = 1;
  };

  function goTo(car, dest) {
    const r = route(car.at, dest);
    if (!r || r.length < 2) {
      car.path = [];
      return r && r.length === 1;
    }
    car.path = r.slice(1);
    car.from = car.at;
    car.to = car.path.shift();
    car.t = 0;
    return true;
  }
  // a new fare: a rider somewhere near, going somewhere else (across town, more often than not)
  function newFare(car) {
    const open = Array.from(City.hoodOpen);
    if (open.length < 2) return false;
    let from = null,
      bl = Infinity;
    for (let k = 0; k < 3; k++) {
      const c = pick(open),
        L = routeLen(route(car.at, c));
      if (L < bl) {
        bl = L;
        from = c;
      }
    }
    if (!from) return false;
    const fd = hoodDist[from],
      across = City.open.size > 1 && Math.random() < 0.7,
      cands = open.filter((n) => n !== from && (!across || hoodDist[n] !== fd));
    const to = pick(cands.length ? cands : open.filter((n) => n !== from));
    if (!to || !route(from, to)) return false;
    const key = pick(AD.RIDER_KEYS);
    car.rider = { key, from, to, phase: "pickup" };
    car.mode = "fare";
    if (car.at === from) arrive(car);
    else goTo(car, from);
    return true;
  }
  // the nearest open depot (a district hub) to a car
  function depotFor(car) {
    const here = car.to || car.at,
      own = D.BY_ID[hoodDist[here]];
    if (own && City.open.has(own.id)) return own;
    let best = null,
      bl = Infinity;
    for (const d of D.DISTRICTS)
      if (City.open.has(d.id)) {
        const L = routeLen(route(here, d.hub));
        if (L < bl) {
          bl = L;
          best = d;
        }
      }
    return best;
  }
  // send a car with a need to a depot to sort itself out (after dropping off whoever's on board)
  City.autoCare = function (car) {
    if (!car || !car.need || car.mode === "care") return false;
    car.need.auto = true;
    if (!car.rider || car.rider.phase === "pickup") {
      car.rider = null;
      headToDepot(car);
    }
    return true;
  };
  function headToDepot(car) {
    const d = depotFor(car);
    if (!d) return;
    car.mode = "depot";
    car.depot = d.id;
    if (car.from) car.path = []; // finish this road first, then route from its end
    else if (car.at === d.hub) arrive(car);
    else goTo(car, d.hub);
  }
  // a car reaches the end of its route
  function arrive(car) {
    if (car.mode === "depot") {
      const d = D.BY_ID[car.depot];
      if (d && car.at !== d.hub) return goTo(car, d.hub) || (car.wait = 1);
      car.mode = "servicing";
      car.wait = 4;
      emit({ type: "depot", car, district: car.depot });
      return;
    }
    const r = car.rider;
    if (r && r.phase === "pickup") {
      if (car.at !== r.from) return goTo(car, r.from) || (car.rider = null);
      r.phase = "ride";
      car.wait = 1.4;
      car.hop = 0.6;
      emit({ type: "board", car, rider: r });
      return;
    }
    if (r && r.phase === "ride") {
      if (car.at !== r.to) return goTo(car, r.to) || (car.rider = null);
      car.rider = null;
      car.fares++;
      car.wait = 1.6;
      car.hop = 1;
      emit({ type: "fare", car, rider: r, hood: car.at, district: hoodDist[car.at] });
      return;
    }
    car.wait = rr(0.4, 1.2);
  }

  /* ---------- needs: one turns up now and then, from the district the car is driving through ---------- */
  let needT = rr(14, 24);
  function needTick(dt, opts) {
    needT -= dt;
    if (needT > 0) return;
    needT = rr(opts.needEvery * 0.7, opts.needEvery * 1.3);
    const have = City.cars.filter((c) => c.need).length,
      cap = Math.max(1, Math.round(City.cars.length / 3));
    if (have >= cap) return;
    const cand = City.cars.filter((c) => !c.need && c.mode === "fare" && c.from);
    if (!cand.length) return;
    const car = pick(cand),
      dist = D.BY_ID[hoodDist[car.to || car.at]],
      [kind, why] = pick(dist.needs);
    car.need = { kind, why, district: dist.id, age: 0, auto: false };
    car.bkey = "";
    emit({ type: "need", car });
  }
  City.clearNeed = function (car) {
    car.need = null;
    car.bkey = "";
    car.blink = 0;
  };
  City.giveNeed = function (car, kind) {
    const dist = D.BY_ID[hoodDist[car.to || car.at]],
      n = dist.needs.find((q) => q[0] === kind) || [kind, D.NEEDS[kind].label];
    car.need = { kind, why: n[1], district: dist.id, age: 0, auto: false };
    car.bkey = "";
  };

  /* ---------- each frame ---------- */
  const _p = {};
  // opts: { autoAfter (seconds), needEvery (seconds) }
  City.update = function (dt, t, opts) {
    if (!built) return;
    // roads lighting up
    for (const r of roads) {
      const want = r.lit ? 1 : 0;
      if (r.k === want) continue;
      if (r.delay > 0) {
        r.delay -= dt;
        continue;
      }
      paint(r, clamp(r.k + (want ? dt * 1.4 : -dt * 3), 0, 1));
    }
    if (!City.paused) {
      needTick(dt, opts);
      for (const car of City.cars) step(car, dt, opts);
    }
    for (const car of City.cars) draw(car, dt, t);
  };
  function step(car, dt, opts) {
    if (car.mode === "care") return; // parked while the crew sees to it down on the street
    if (car.need) {
      car.need.age += dt;
      if (car.need.age > opts.autoAfter && !car.need.auto) City.autoCare(car);
    }
    if (car.wait > 0) {
      car.wait -= dt;
      if (car.wait > 0) return;
      if (car.mode === "servicing") {
        const d = car.depot;
        car.mode = "fare";
        if (car.need) {
          const kind = car.need.kind;
          City.clearNeed(car);
          emit({ type: "autoCared", car, district: d, kind });
        }
        car.wait = 0.8;
        return;
      }
      if (!car.from) {
        if (car.need && car.need.auto && car.mode !== "depot" && (!car.rider || car.rider.phase === "pickup")) {
          car.rider = null;
          return headToDepot(car);
        }
        if (car.mode === "depot") return arrive(car);
        if (car.rider) return arrive(car);
        if (!newFare(car)) car.wait = 1;
        return;
      }
    }
    if (!car.from) {
      if (car.wait <= 0) car.wait = 0.01;
      return;
    }
    const e = Sim.edgeOf(car.from, car.to);
    if (!e) {
      car.from = car.to = null;
      return;
    }
    car.t += (car.v * dt) / e.len;
    if (car.t >= 1) {
      car.at = car.to;
      car.from = car.to = null;
      car.t = 0;
      // a car that's off to a depot after a drop-off re-routes at the end of each road
      if (car.mode === "depot" && car.path.length === 0) return arrive(car);
      if (car.path.length) {
        car.from = car.at;
        car.to = car.path.shift();
      } else arrive(car);
    }
  }
  function draw(car, dt, t) {
    let x, y, z, yaw;
    if (car.from) {
      const e = Sim.edgeOf(car.from, car.to);
      Sim.edgePoint(e, car.from, car.t, _p);
      x = _p.x * K;
      z = _p.z * K;
      y = AM.edgeY(e, car.from === e.a ? car.t : 1 - car.t);
      yaw = Math.atan2(-_p.dx, -_p.dz);
    } else {
      const here = City.cars.filter((c) => !c.from && c.at === car.at);
      AM.parkPoint(car.at, here.indexOf(car), _p);
      x = _p.x * K;
      z = _p.z * K;
      y = _p.y;
      yaw = Math.atan2(-_p.dx, -_p.dz);
      if (car.mode === "servicing") {
        // tucked under the depot's awning
        const d = D.BY_ID[car.depot];
        if (d && d.depot) {
          x = d.depot.position.x;
          z = d.depot.position.z;
          y = d.depot.position.y;
          yaw = d.depot.rotation.y;
        }
      }
    }
    if (car.x === null) {
      car.x = x;
      car.y = y;
      car.z = z;
      car.yaw = yaw;
    }
    // Keep the wheels on the route through turns; only ease the heading.
    car.x = x;
    car.y = y;
    car.z = z;
    let dy = yaw - car.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    car.yaw += dy * Math.min(1, dt * 6);
    const P = car.parts,
      r = P.root;
    r.position.set(car.x, car.y, car.z);
    r.rotation.order = "YXZ";
    r.rotation.y = car.yaw;
    if (car.hop > 0) car.hop = Math.max(0, car.hop - dt);
    P.g.position.y = Math.abs(Math.sin((1 - car.hop) * Math.PI * 3)) * 0.5 * car.hop;
    P.spin.rotation.y += dt * (City.paused ? 0 : car.mode === "servicing" ? 1 : 5);
    // the turn signal: the lidar ring blinks amber on the way to a depot
    const blink = car.need && car.need.auto && car.mode !== "servicing";
    if (blink) {
      const on = Math.sin(t * 9) > 0;
      P.ring.material.color.set(on ? "#ffb020" : car.ring);
      P.ring.material.emissive.set(on ? "#a06000" : "#000000");
      car.blinking = true;
    } else if (car.blinking) {
      car.blinking = false;
      P.ring.material.color.set(car.ring);
      P.ring.material.emissive = new T.Color(car.ring).multiplyScalar(0.4);
    }
    bubble(car);
    P.sprite.position.y = 4.4 + Math.sin(t * 2 + car.id) * 0.12;
    const pulse = car.need && !car.need.auto ? 1 + Math.sin(t * 2.4 + car.id) * 0.05 : 1;
    P.sprite.scale.set(3.4 * pulse, 3.4 * pulse, 1);
    P.sprite.visible = City.bubbles !== false && !!car.need;
  }
  // the bubble: the need's icon in a soft white circle, with a little arrow when it's off to a depot
  function bubble(car) {
    const n = car.need,
      key = n ? n.kind + (n.auto ? "a" : "") + (car.mode === "servicing" ? "s" : "") : "";
    if (key === car.bkey) return;
    car.bkey = key;
    const P = car.parts,
      x = P.cv.getContext("2d");
    x.clearRect(0, 0, 128, 128);
    if (!n) return;
    x.fillStyle = "rgba(20,60,110,.16)";
    x.beginPath();
    x.arc(64, 60, 46, 0, 7);
    x.fill();
    x.fillStyle = "#fffdf6";
    x.beginPath();
    x.arc(64, 56, 46, 0, 7);
    x.moveTo(50, 98);
    x.lineTo(64, 122);
    x.lineTo(78, 98);
    x.fill();
    x.lineWidth = 6;
    x.strokeStyle = n.auto ? "#ffb020" : "#9fe0f5";
    x.beginPath();
    x.arc(64, 56, 40, 0, 7);
    x.stroke();
    WG.drawIcon(x, n.kind, 64, 58, 1.05);
    if (n.auto) {
      x.fillStyle = "#ffb020";
      x.beginPath();
      x.arc(100, 22, 18, 0, 7);
      x.fill();
      x.fillStyle = "#fff";
      x.font = "900 24px 'M PLUS Rounded 1c', system-ui, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(car.mode === "servicing" ? "✓" : "↪", 100, 23);
    }
    P.tex.needsUpdate = true;
  }

  /* ---------- the labels and the cars' screen positions ---------- */
  const _v = new T.Vector3();
  City.place = function (camera) {
    const w = innerWidth,
      h = innerHeight,
      height = City.cam.h;
    for (const L of labels) {
      _v.copy(L.p).project(camera);
      let show = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
      if (L.kind === "h") show = show && City.hoodOpen.has(L.id) && height < 520 * K && City.labels !== false;
      else show = show && City.labels !== false;
      L.sx = (_v.x * 0.5 + 0.5) * w;
      L.sy = (-_v.y * 0.5 + 0.5) * h;
      if (show)
        L.e.style.transform =
          "translate(" + L.sx.toFixed(1) + "px," + L.sy.toFixed(1) + "px) translate(-50%," + (L.kind === "h" ? "60%" : "-50%") + ")";
      if (L.e.hidden === show) L.e.hidden = !show;
      L.on = show;
    }
  };
  City.screenPos = function (car, camera, lift) {
    _v.set(car.x, car.y + (lift === undefined ? 1.2 : lift) * MS, car.z).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight, vis: _v.z < 1 };
  };
  // tap on the map: a car (its body or its bubble) near the tap, or a district label
  City.pick = function (cx, cy, camera) {
    let best = null,
      bd = 44;
    for (const car of City.cars) {
      for (const lift of [1.2, 4.4]) {
        if (lift > 2 && !car.need) continue;
        const s = City.screenPos(car, camera, lift);
        if (!s.vis) continue;
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (d < bd) {
          bd = d;
          best = car;
        }
      }
    }
    if (best) return { car: best };
    for (const L of labels)
      if (L.kind === "d" && L.on && Math.hypot(L.sx - cx, L.sy - cy) < 60) return { district: L.id };
    return null;
  };
  // where a screen point meets the ground (game metres), marching down the view ray
  City.ground = function (cx, cy, camera) {
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
    const o = ray.ray.origin,
      d = ray.ray.direction,
      p = new T.Vector3();
    for (let s = 0; s < 30000; s += 8) {
      p.copy(o).addScaledVector(d, s);
      if (p.y <= Math.max(0, W.height(p.x, p.z))) return p;
    }
    return null;
  };

  /* ---------- the map camera: a target on the ground, a height and a heading, tilting flatter as it comes down ---------- */
  const H0 = 120 * K,
    H1 = 1400 * K;
  const BOUNDS = { x0: -1950 * K, x1: 1650 * K, z0: -1650 * K, z1: 2150 * K };
  City.cam = { x: 0, z: 0, h: 520 * K, yaw: 0.5, follow: null, ride: null, glide: null };
  City.pitch = () => 0.62 + 0.42 * clamp((City.cam.h - H0) / (H1 - H0), 0, 1);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  City.camera = function (dt, pos, look) {
    const c = City.cam;
    if (c.glide) {
      const g = c.glide;
      g.t += dt;
      const e = ease(Math.min(1, g.t / g.dur));
      c.x = g.x0 + (g.x1 - g.x0) * e;
      c.z = g.z0 + (g.z1 - g.z0) * e;
      c.h = g.h0 + (g.h1 - g.h0) * e;
      if (g.yaw1 !== undefined) {
        let dy = g.yaw1 - g.yaw0;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw = g.yaw0 + dy * e;
      }
      if (g.t >= g.dur) c.glide = null;
    } else if (c.follow) {
      const car = City.find(c.follow);
      if (car && car.x !== null) {
        const f = Math.min(1, dt * 3);
        c.x += (car.x - c.x) * f;
        c.z += (car.z - c.z) * f;
      } else c.follow = null;
    }
    c.x = clamp(c.x, BOUNDS.x0, BOUNDS.x1);
    c.z = clamp(c.z, BOUNDS.z0, BOUNDS.z1);
    c.h = clamp(c.h, H0, H1);
    // Ride Along: low behind the car, looking down the road ahead
    if (c.ride) {
      const car = City.find(c.ride);
      if (car && car.x !== null) {
        const fx = -Math.sin(car.yaw),
          fz = -Math.cos(car.yaw);
        look.set(car.x + fx * 80, car.y + 14, car.z + fz * 80);
        pos.set(car.x - fx * 70, car.y + 42, car.z - fz * 70);
        return 3;
      }
      c.ride = null;
    }
    const P = City.pitch(),
      gy = Math.max(0, W.height(c.x, c.z)),
      dist = c.h / Math.sin(P);
    look.set(c.x, gy, c.z);
    pos.set(c.x + Math.sin(c.yaw) * Math.cos(P) * dist, gy + c.h, c.z + Math.cos(c.yaw) * Math.cos(P) * dist);
    return c.glide ? 8 : 4;
  };
  City.pan = function (dx, dy, camera) {
    const c = City.cam,
      dist = c.h / Math.sin(City.pitch()),
      mpp = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / innerHeight;
    const rx = Math.cos(c.yaw),
      rz = -Math.sin(c.yaw),
      fx = -Math.sin(c.yaw),
      fz = -Math.cos(c.yaw);
    c.x += (-dx * rx + dy * fx * 1.25) * mpp;
    c.z += (-dx * rz + dy * fz * 1.25) * mpp;
    c.follow = null;
    c.ride = null;
    c.glide = null;
  };
  City.zoom = (f) => {
    City.cam.h = clamp(City.cam.h * f, H0, H1);
    City.cam.glide = null;
  };
  City.rotate = (a) => {
    City.cam.yaw += a;
    City.cam.glide = null;
  };
  City.glide = function (x, z, h, dur, yaw) {
    const c = City.cam;
    c.follow = null;
    c.ride = null;
    c.glide = { t: 0, dur: dur || 1.6, x0: c.x, z0: c.z, h0: c.h, x1: x, z1: z, h1: h || c.h, yaw0: c.yaw, yaw1: yaw };
  };
  City.H0 = H0;
  City.H1 = H1;

  /* ---------- set up and show ---------- */
  City.init = function (sc) {
    if (built) return;
    scene = sc;
    AM.init(sc); // the road graph and its heights (Adopt-a-Waymo's map builds them; its own toys stay hidden)
    group = new T.Group();
    group.visible = false;
    scene.add(group);
    assignHoods();
    buildRoads();
    buildPlazas();
    makeLabels();
    const d0 = D.DISTRICTS[0];
    City.cam.x = d0.cx;
    City.cam.z = d0.cz;
    built = true;
  };
  City.show = function (on) {
    if (group) group.visible = on;
    const L = $("#sd-labels");
    if (L) L.hidden = !on;
  };
  City.group = () => group;
  WG.sundayCity = City;
})();
