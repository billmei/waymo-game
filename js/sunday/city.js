/* Waymo Care · Sunday Drive · the bird's-eye city. The whole of San Francisco from above: the roads between the
   neighbourhoods, a toy-sized robotaxi fleet cruising and carrying fares, the district labels, the map camera, and the
   little needs that appear over a car's roof. The clouds that hide the locked districts live in js/sunday/clouds.js;
   this file only owns the roads, the cars, the camera and the pick-ups. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    I = WG.isle;
  const K = W.SCALE; // island units → game metres
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (s) => document.querySelector(s);
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const MS = 9; // how much bigger than life a toy car reads from up here
  const ROAD_W = 13;
  const PITCH = 0.94;

  /* ---------- the neighbourhoods, in the order the clouds part ---------- */
  const DISTRICTS = {
    lombard: {
      id: "lombard",
      name: "Russian Hill",
      short: "Russian Hill",
      zone: "lombard",
      look: "morning",
      cost: 0,
      order: 1,
      x: 420,
      z: -1230,
      radius: 360,
      marks: ["Lombard Street", "Coit Tower"],
      quirk: "Morning sun · steep grade climbs · doors left open on slopes",
      quirkShort: "Morning sun & steep hills",
      needs: ["charge", "doors"],
      stem: "Nylon guitar & electric piano",
      colour: "#f3b24a",
      riderLine: "a lazy Sunday morning",
    },
    downtown: {
      id: "downtown",
      name: "Downtown / FiDi",
      short: "Downtown",
      zone: "downtown",
      look: "day",
      cost: 2,
      order: 2,
      x: 1150,
      z: -760,
      radius: 430,
      marks: ["Transamerica Pyramid", "555 California", "Salesforce Tower"],
      quirk: "Skyscraper shadows · lunch-rush dust & coffee splashes",
      quirkShort: "Lunch-rush towers",
      needs: ["dirty", "vacuum"],
      stem: "Upright bass",
      colour: "#5aa7d8",
      riderLine: "the lunch rush",
    },
    presidio: {
      id: "presidio",
      name: "The Presidio",
      short: "The Presidio",
      zone: "presidio",
      look: "day",
      cost: 4,
      order: 3,
      x: -1100,
      z: -1220,
      radius: 520,
      marks: ["Golden Gate Bridge", "Palace of Fine Arts"],
      quirk: "Coastal pine breezes · pigeons & gulls roosting on lidar",
      quirkShort: "Pines & gulls",
      needs: ["birds"],
      stem: "Vibraphone melody",
      colour: "#6fb36b",
      riderLine: "the bridge breeze",
    },
    ladies: {
      id: "ladies",
      name: "Alamo Square",
      short: "Alamo Square",
      zone: "ladies",
      look: "dusk",
      cost: 6,
      order: 4,
      x: 330,
      z: -560,
      radius: 400,
      marks: ["Painted Ladies", "Alamo Square", "Sutro Tower"],
      quirk: "Perpetual golden hour · picnics · cones blocking the lane",
      quirkShort: "Golden hour & picnics",
      needs: ["cone"],
      stem: "Brush drums & shaker",
      colour: "#e8945a",
      riderLine: "golden hour",
    },
    windmills: {
      id: "windmills",
      name: "Ocean Beach & Windmills",
      short: "Ocean Beach",
      zone: "windmills",
      look: "fog",
      cost: 8,
      order: 5,
      x: -1650,
      z: 320,
      radius: 540,
      marks: ["Dutch Windmill", "Murphy Windmill", "Ocean Beach"],
      quirk: "Karl the Fog rolling across the dunes · salt spray · misty reboots",
      quirkShort: "Karl the Fog & salt spray",
      needs: ["reboot", "birds"],
      stem: "Mellow horn",
      colour: "#9aa7b4",
      riderLine: "the fog line",
    },
    twin: {
      id: "twin",
      name: "Twin Peaks & Waterfront",
      short: "Twin Peaks",
      zone: "ladies",
      look: "day",
      cost: 10,
      order: 6,
      x: 0,
      z: 0,
      radius: 520,
      marks: ["Twin Peaks", "Ferry Building", "Bay Bridge (west span)"],
      quirk: "Panoramic heights · ferry horns · long scenic routes across the city",
      quirkShort: "Panoramas & ferry horns",
      needs: ["dirty", "vacuum", "doors", "charge", "birds", "cone", "reboot"],
      stem: "Full ensemble harmony",
      colour: "#8a7fd8",
      riderLine: "the long way round",
    },
  };
  const ORDER = Object.keys(DISTRICTS).sort(
    (a, b) => DISTRICTS[a].order - DISTRICTS[b].order,
  );

  // the roads: neighbourhoods joined by a gentle spline through a few scenic waypoints (island units)
  const EDGES = [
    ["lombard", "downtown", [[420, -1230], [610, -1080], [900, -900], [1150, -760]]],
    ["lombard", "presidio", [[420, -1230], [-40, -1370], [-600, -1320], [-1100, -1220]]],
    ["lombard", "ladies", [[420, -1230], [390, -980], [350, -760], [330, -560]]],
    ["lombard", "twin", [[420, -1230], [300, -900], [120, -400], [0, 0]]],
    ["downtown", "ladies", [[1150, -760], [820, -650], [560, -590], [330, -560]]],
    ["downtown", "twin", [[1150, -760], [750, -400], [350, -150], [0, 0]]],
    ["ladies", "windmills", [[330, -560], [-200, -450], [-800, -100], [-1300, 180], [-1650, 320]]],
    ["ladies", "twin", [[330, -560], [180, -350], [60, -120], [0, 0]]],
    ["presidio", "twin", [[-1100, -1220], [-650, -900], [-300, -400], [-80, -90], [0, 0]]],
    ["presidio", "windmills", [[-1100, -1220], [-1450, -850], [-1650, -400], [-1750, 0], [-1650, 320]]],
    ["windmills", "twin", [[-1650, 320], [-1200, 250], [-700, 180], [-250, 90], [0, 0]]],
  ];

  const RIDERS = [
    { name: "Grandma", icon: "👵", line: "Such a polite car, dear." },
    { name: "Tourist", icon: "🧢", line: "Is that the Golden Gate? Amazing!" },
    { name: "Influencer", icon: "💅", line: "This light is everything." },
    { name: "Founder", icon: "💻", line: "Standup in four minutes!" },
    { name: "Local", icon: "🕶️", line: "No notes. Just vibes." },
    { name: "Artist", icon: "🎨", line: "The fog looks like a painting." },
    { name: "Student", icon: "🎒", line: "Sorry, I'm running late!" },
  ];
  const NEED_LABEL = {
    dirty: "Dusty chassis",
    vacuum: "Popcorn crumbs in the cabin",
    charge: "Low battery from the hills",
    birds: "Pigeons roosting on the lidar",
    cone: "Cones blocking the pick-up",
    reboot: "Salt-spray sensor glitch",
    doors: "A door left ajar",
  };
  const NEED_ICON = {
    dirty: "dirty",
    vacuum: "vacuum",
    charge: "charge",
    birds: "birds",
    cone: "cone",
    reboot: "reboot",
    doors: "doors",
  };
  const NOTE = {
    dirty: "Best pit crew in SF. Keep it easy.",
    vacuum: "Such a polite crew, thank you dear!",
    charge: "I made my standup. You're a legend.",
    birds: "The pigeons have left the building.",
    cone: "Cone-free and feeling fine.",
    reboot: "I can see again! The fog is beautiful.",
    doors: "All shut. Five stars, no notes.",
  };

  const city = {
    cars: [],
    districts: DISTRICTS,
    order: ORDER,
    cam: {
      x: 420 * K,
      z: -620 * K,
      h: 720 * K,
      yaw: 0.6,
      follow: null,
      ride: null,
      ceremony: null,
    },
    onCarTap: null,
    onDistrictTap: null,
    onNeed: null,
    onFare: null,
    onAuto: null,
  };
  let scene = null,
    group = null,
    tagBox = null,
    floatBox = null,
    hoodBox = null,
    labels = {},
    edges = [],
    loops = {},
    seq = 0;
  const _v = new T.Vector3(),
    _p = {},
    _q = {};

  /* ---------- geography helpers ---------- */
  function onLand(x, z) {
    if (I.groundH(x, z) > 3) return [x, z];
    for (let r = 16; r < 380; r += 16)
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2,
          px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r;
        if (I.groundH(px, pz) > 4) return [px, pz];
      }
    return [x, z];
  }
  // road height over the ground and over the roofs of whatever stands there
  function surfaceAt(x, z) {
    let y = Math.max(W.height(x, z), 1);
    for (let k = 0; k < 14 && W.hitsAt(x, y + 2, z, ROAD_W * 0.42); k++)
      y += 5;
    return y + 1.1;
  }
  function smoothY(pts) {
    const ys = pts.map((p) => p.y);
    for (let i = 0; i < pts.length; i++) {
      let m = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(pts.length - 1, i + 2); j++)
        m = Math.max(m, ys[j]);
      pts[i].y = (m * 2 + ys[i]) / 3;
    }
    return pts;
  }
  function cumulative(pts, closed) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(
        cum[i - 1] +
          Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
      );
    if (closed) {
      const last = pts[pts.length - 1],
        first = pts[0];
      cum.push(
        cum[cum.length - 1] + Math.hypot(last.x - first.x, last.z - first.z),
      );
    }
    return cum;
  }
  function samplePath(path, d, out, closed) {
    const pts = path.pts,
      cum = path.cum;
    d = clamp(d, 0, path.len);
    let lo = 0,
      hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = pts[lo % pts.length],
      b = pts[(lo + 1) % pts.length],
      seg = Math.max(1e-5, cum[lo + 1] - cum[lo]),
      t = clamp((d - cum[lo]) / seg, 0, 1);
    out.x = lerp(a.x, b.x, t);
    out.y = lerp(a.y, b.y, t);
    out.z = lerp(a.z, b.z, t);
    const dx = b.x - a.x,
      dz = b.z - a.z,
      l = Math.hypot(dx, dz) || 1;
    out.dx = dx / l;
    out.dz = dz / l;
    return out;
  }

  /* ---------- road ribbons ---------- */
  function ribbon(pts, half, lift, colour, opacity, dash) {
    const pos = [],
      idx = [];
    const c = new T.Color(colour);
    for (let i = 0; i < pts.length - 1; i++) {
      if (dash && i % 2) continue;
      const a = pts[i],
        b = pts[i + 1],
        base = pos.length / 3;
      let dx = b.x - a.x,
        dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const nx = -dz,
        nz = dx;
      for (const p of [a, b]) {
        pos.push(
          p.x - nx * half,
          p.y + lift,
          p.z - nz * half,
          p.x + nx * half,
          p.y + lift,
          p.z + nz * half,
        );
      }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new T.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity,
      side: T.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: true,
    });
    const mesh = new T.Mesh(g, m);
    mesh.renderOrder = 2;
    return mesh;
  }
  function makeEdge(a, b, raw) {
    const pts = raw.map(([x, z]) => onLand(x, z));
    const curve = new T.CatmullRomCurve3(
      pts.map((p) => new T.Vector3(p[0] * K, 0, p[1] * K)),
      false,
      "centripetal",
    );
    const n = Math.max(22, Math.ceil(curve.getLength() / 32));
    const out = curve.getPoints(n).map((p) => ({
      x: p.x,
      z: p.z,
      y: surfaceAt(p.x, p.z),
    }));
    smoothY(out);
    const path = {
      a,
      b,
      pts: out,
      cum: cumulative(out, false),
    };
    path.len = path.cum[path.cum.length - 1];
    const meshes = [
      ribbon(out, ROAD_W * 0.66, 0.7, "#eef3f7", 1),
      ribbon(out, ROAD_W * 0.5, 1.05, "#5a6270", 1),
      ribbon(out, ROAD_W * 0.055, 1.35, "#ffd23a", 1, true),
    ];
    for (const m of meshes) {
      m.visible = false;
      group.add(m);
    }
    return { a, b, path, meshes, reveal: 0, lit: false };
  }
  function makeLoop(d) {
    const cx = d.x,
      cz = d.z,
      r = d.radius * 0.72,
      pts = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2,
        [x, z] = onLand(cx + Math.cos(a) * r, cz + Math.sin(a) * r * 0.78);
      pts.push({ x: x * K, z: z * K, y: surfaceAt(x * K, z * K) });
    }
    smoothY(pts);
    const loop = { pts, cum: cumulative(pts, true) };
    loop.len = loop.cum[loop.cum.length - 1];
    const meshes = [
      ribbon(pts, ROAD_W * 0.34, 0.8, "#dbe7ef", 0.85),
      ribbon(pts, ROAD_W * 0.24, 1.12, "#6a7280", 0.9),
    ];
    for (const m of meshes) {
      m.visible = false;
      group.add(m);
    }
    loop.meshes = meshes;
    return loop;
  }

  /* ---------- the fleet ---------- */
  const NAMES = [
    "Waymo #3",
    "Waymo #7",
    "Waymo #12",
    "Waymo #18",
    "Waymo #21",
    "Waymo #24",
    "Waymo #31",
    "Waymo #42",
    "Waymo #55",
    "Waymo #68",
    "Waymo #77",
    "Waymo #88",
  ];
  function plate() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    return (
      "SF " +
      (1 + ((Math.random() * 9) | 0)) +
      letters[(Math.random() * letters.length) | 0] +
      letters[(Math.random() * letters.length) | 0] +
      letters[(Math.random() * letters.length) | 0]
    );
  }
  function makeTag(car) {
    const e = document.createElement("button");
    e.type = "button";
    e.className = "su-tag hidden";
    e.innerHTML = '<span class="dot"></span><b></b>';
    e.querySelector("b").textContent = car.name;
    e.addEventListener("click", (ev) => {
      ev.stopPropagation();
      e.blur();
      if (city.onCarTap) city.onCarTap(car.id);
    });
    tagBox.appendChild(e);
    car.tag = e;
    const f = document.createElement("div");
    f.className = "su-float";
    f.hidden = true;
    floatBox.appendChild(f);
    car.float = f;
  }
  function makeCar(districtId) {
    const d = DISTRICTS[districtId],
      parts = WG.makeCar(),
      car = {
        id: "su_" + ++seq,
        name: NAMES[seq % NAMES.length],
        plate: plate(),
        district: districtId,
        parts,
        at: districtId,
        mode: "loop",
        loopD: Math.random() * (loops[districtId] ? loops[districtId].len : 100),
        route: null,
        leg: 0,
        legD: 0,
        wait: 1 + Math.random() * 4,
        tripT: 6 + Math.random() * 10,
        speed: 72 + Math.random() * 26,
        passenger: null,
        need: null,
        needT: 12 + Math.random() * 34,
        hop: 0,
        msg: "",
        msgT: 0,
        x: null,
        z: null,
        y: 0,
        yaw: 0,
        bkey: "",
      };
    parts.root.scale.setScalar(MS);
    parts.sprite.renderOrder = 12;
    parts.ring.material.color.set(d.colour);
    parts.ring.material.emissive.copy(parts.ring.material.color).multiplyScalar(0.3);
    group.add(parts.root);
    makeTag(car);
    city.cars.push(car);
    return car;
  }
  function removeCar(car) {
    group.remove(car.parts.root);
    if (car.tag) car.tag.remove();
    if (car.float) car.float.remove();
    const i = city.cars.indexOf(car);
    if (i >= 0) city.cars.splice(i, 1);
  }
  function ensureCars(unlocked) {
    const want = Math.min(14, 2 + unlocked.size * 2);
    for (const id of unlocked) {
      const n = city.cars.filter((c) => c.district === id).length;
      for (let k = n; k < 2 && city.cars.length < want; k++) makeCar(id);
    }
    // a couple more as the map grows, spread over the open neighbourhoods
    while (city.cars.length < want) {
      const id = Array.from(unlocked)[city.cars.length % unlocked.size];
      makeCar(id);
    }
  }

  /* ---------- the graph ---------- */
  function neighbours(id) {
    const out = [];
    for (const e of edges) {
      if (e.a === id) out.push({ edge: e, other: e.b, reverse: false });
      else if (e.b === id) out.push({ edge: e, other: e.a, reverse: true });
    }
    return out;
  }
  function routeBetween(from, to, unlocked) {
    if (from === to) return null;
    const prev = {},
      q = [from];
    prev[from] = null;
    while (q.length) {
      const n = q.shift();
      for (const o of neighbours(n)) {
        if (!unlocked.has(o.other) || prev[o.other] !== undefined) continue;
        prev[o.other] = { from: n, edge: o.edge, reverse: o.reverse };
        if (o.other === to) {
          const route = [];
          let at = to;
          while (prev[at]) {
            const p = prev[at];
            route.push({ edge: p.edge, reverse: p.reverse });
            at = p.from;
          }
          return route.reverse();
        }
        q.push(o.other);
      }
    }
    return null;
  }
  function startTrip(car, unlocked) {
    const opts = Array.from(unlocked).filter((id) => id !== car.at);
    if (!opts.length) return false;
    const dest = opts[(Math.random() * opts.length) | 0],
      route = routeBetween(car.at, dest, unlocked);
    if (!route || !route.length) return false;
    car.mode = "route";
    car.route = route;
    car.leg = 0;
    car.legD = 0;
    car.dest = dest;
    car.wait = 0;
    if (Math.random() < 0.82) {
      const r = RIDERS[(Math.random() * RIDERS.length) | 0];
      car.passenger = {
        rider: r,
        from: car.at,
        to: dest,
        text:
          r.icon +
          " " +
          r.name +
          ": " +
          DISTRICTS[car.at].short +
          " → " +
          DISTRICTS[dest].short,
      };
    } else car.passenger = null;
    return true;
  }
  function arrive(car, unlocked) {
    car.at = car.dest || car.at;
    car.district = car.at;
    car.mode = "loop";
    car.route = null;
    car.loopD = 0;
    car.wait = 2 + Math.random() * 5;
    if (car.passenger) {
      const p = car.passenger;
      car.passenger = null;
      car.hop = 1;
      city.float(car, p.rider.icon + " " + p.rider.name + " delivered! +Fare");
      if (city.onFare) city.onFare(car, p);
      drawBubble(car);
    }
  }

  /* ---------- needs ---------- */
  function giveNeed(car, kind, quiet) {
    if (car.need) return false;
    const d = DISTRICTS[car.district];
    kind = kind || d.needs[(Math.random() * d.needs.length) | 0];
    car.need = {
      kind,
      label: NEED_LABEL[kind] || "Needs a little care",
      left: 180,
      since: performance.now(),
    };
    drawBubble(car);
    if (!quiet && city.onNeed) city.onNeed(car);
    return true;
  }
  function clearNeed(car, byPlayer) {
    if (!car.need) return false;
    const kind = car.need.kind;
    car.need = null;
    car.needT = Math.max(car.needT, 8);
    drawBubble(car);
    if (byPlayer) city.float(car, "All set! ✨");
    return kind;
  }

  /* ---------- the bubble over a car's roof ---------- */
  function drawBubble(car) {
    const key = car.need
      ? "need:" + car.need.kind + ":" + Math.floor(car.need.left / 3)
      : car.passenger
        ? "fare:" + car.passenger.rider.name
        : "";
    if (key === car.bkey) return;
    car.bkey = key;
    const P = car.parts,
      x = P.cv.getContext("2d");
    x.clearRect(0, 0, 128, 128);
    P.sprite.visible = !!key;
    if (!key) return;
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
    if (car.need) {
      x.lineWidth = 9;
      x.strokeStyle = "#e6ebf0";
      x.beginPath();
      x.arc(64, 56, 38, 0, 7);
      x.stroke();
      x.strokeStyle = "#ffbf1f";
      x.beginPath();
      x.arc(
        64,
        56,
        38,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * clamp(car.need.left / 180, 0.03, 1),
      );
      x.stroke();
      WG.drawIcon(x, NEED_ICON[car.need.kind] || "dirty", 64, 58, 1.1);
    } else {
      x.fillStyle = "#2a9fe6";
      x.font = "900 48px 'M PLUS Rounded 1c', system-ui, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("◎", 64, 58);
    }
    P.tex.needsUpdate = true;
  }

  /* ---------- labels ---------- */
  function makeLabels() {
    hoodBox = $("#su-hoods");
    tagBox = $("#su-tags");
    floatBox = $("#su-floats");
    for (const id of ORDER) {
      const d = DISTRICTS[id],
        e = document.createElement("button");
      e.type = "button";
      e.className = "su-hood hidden";
      e.dataset.hood = id;
      e.innerHTML = "<b></b><small></small>";
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        e.blur();
        if (city.onDistrictTap) city.onDistrictTap(id);
      });
      hoodBox.appendChild(e);
      labels[id] = {
        e,
        d,
        on: false,
        sx: 0,
        sy: 0,
        p: new T.Vector3(d.x * K, 0, d.z * K),
      };
    }
  }
  city.refreshLabels = function (S) {
    const unlocked = new Set(S.unlockedDistricts);
    let hereId = null,
      hereD = Infinity;
    for (const id of ORDER) {
      const d = DISTRICTS[id],
        dd = Math.hypot(d.x * K - city.cam.x, d.z * K - city.cam.z);
      if (dd < hereD) {
        hereD = dd;
        hereId = id;
      }
    }
    for (const id of ORDER) {
      const L = labels[id],
        d = DISTRICTS[id],
        open = unlocked.has(id),
        i = ORDER.indexOf(id),
        prevOpen = i <= 0 || unlocked.has(ORDER[i - 1]),
        can = S.mapSeals >= d.cost && !open && prevOpen;
      L.e.classList.toggle("locked", !open);
      L.e.classList.toggle("unlockable", can);
      L.e.classList.toggle("here", open && id === hereId && city.cam.follow === null);
      L.e.querySelector("b").textContent = open ? d.name : "🔒 " + d.name;
      L.e.querySelector("small").textContent = open
        ? d.quirkShort
        : d.cost + " Map Seals";
      L.e.setAttribute(
        "aria-label",
        open
          ? d.name + ". " + d.quirk
          : d.name + ", locked. Requires " + d.cost + " Map Seals.",
      );
    }
  };
  city.refreshRoads = function (S) {
    const unlocked = new Set(S.unlockedDistricts);
    for (const e of edges) {
      const lit = unlocked.has(e.a) && unlocked.has(e.b);
      if (lit && !e.lit) e.reveal = 0.02;
      e.lit = lit;
      for (const m of e.meshes) m.visible = e.reveal > 0.01;
    }
    for (const id of ORDER) {
      const l = loops[id],
        open = unlocked.has(id);
      if (l) for (const m of l.meshes) m.visible = open;
    }
    // the plazas
    for (const id of ORDER) {
      const p = city.plazas[id];
      if (p)
        p.material.color.set(
          unlocked.has(id) ? new T.Color(DISTRICTS[id].colour).getHex() : 0xb7c0c8,
        );
    }
  };

  /* ---------- set up ---------- */
  city.init = function (sc) {
    if (group) return;
    scene = sc;
    group = new T.Group();
    group.visible = false;
    scene.add(group);
    makeLabels();
    for (const id of ORDER) loops[id] = makeLoop(DISTRICTS[id]);
    for (const [a, b, raw] of EDGES) edges.push(makeEdge(a, b, raw));
    // a little round plaza at every neighbourhood centre
    city.plazas = {};
    const disc = new T.CircleGeometry(ROAD_W * 1.7 * K, 26);
    for (const id of ORDER) {
      const d = DISTRICTS[id],
        p = new T.Mesh(
          disc,
          new T.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          }),
        );
      p.rotation.x = -Math.PI / 2;
      p.position.set(d.x * K, surfaceAt(d.x * K, d.z * K) + 1.8, d.z * K);
      p.renderOrder = 3;
      group.add(p);
      city.plazas[id] = p;
    }
    // the primary landmarks, in game metres
    for (const id of ORDER) {
      const d = DISTRICTS[id];
      d.markObjs = d.marks
        .map((name) => I.MARKS.find((m) => m.name === name))
        .filter(Boolean)
        .map((m) => ({
          name: m.name,
          id: m.id,
          x: m.x * K,
          y: m.y * K,
          z: m.z * K,
          h: m.h * K,
          r: m.r * K,
        }));
      d.primary = d.markObjs[0] || { x: d.x * K, y: W.height(d.x * K, d.z * K), z: d.z * K, h: 0 };
    }
  };
  city.show = function (on) {
    if (group) group.visible = on;
    if (hoodBox) hoodBox.hidden = tagBox.hidden = !on;
    if (floatBox) floatBox.hidden = !on;
  };
  city.sync = function (S) {
    ensureCars(new Set(S.unlockedDistricts));
    city.refreshRoads(S);
    city.refreshLabels(S);
  };
  city.reset = function (S) {
    for (const c of city.cars.slice()) removeCar(c);
    seq = 0;
    city.sync(S);
  };

  /* ---------- the camera ---------- */
  const BOUNDS = { x0: -2200 * K, x1: 1800 * K, z0: -1800 * K, z1: 2400 * K };
  city.camera = function (dt, pos, look) {
    const c = city.cam;
    if (c.ceremony) {
      const ce = c.ceremony,
        d = DISTRICTS[ce.id],
        m = d.primary;
      ce.t += dt;
      const glide = ease(Math.min(1, ce.t / 1.8));
      const cx = lerp(ce.fromX, m.x, glide),
        cz = lerp(ce.fromZ, m.z, glide),
        h = lerp(ce.fromH, clamp(m.h * 1.1 + 320 * K, 260 * K, 780 * K), glide);
      const a = ce.fromYaw + ce.t * 0.32;
      const gy = Math.max(0, W.height(cx, cz)),
        dist = h / Math.sin(PITCH);
      look.set(m.x, m.y + m.h * 0.4, m.z);
      pos.set(
        cx + Math.sin(a) * Math.cos(PITCH) * dist,
        gy + h,
        cz + Math.cos(a) * Math.cos(PITCH) * dist,
      );
      if (ce.t > 6.2) {
        c.x = m.x;
        c.z = m.z;
        c.h = clamp(m.h * 1.1 + 320 * K, 260 * K, 780 * K);
        c.yaw = a;
        c.ceremony = null;
      }
      return 3.2;
    }
    if (c.follow) {
      const car = city.cars.find((q) => q.id === c.follow);
      if (car && car.x !== null) {
        const f = Math.min(1, dt * 2.4);
        c.x += (car.x - c.x) * f;
        c.z += (car.z - c.z) * f;
      } else c.follow = null;
    }
    if (c.ride) {
      const car = city.cars.find((q) => q.id === c.ride);
      if (car && car.x !== null) {
        const fx = -Math.sin(car.yaw),
          fz = -Math.cos(car.yaw);
        look.set(car.x + fx * 90, car.y + 12, car.z + fz * 90);
        pos.set(car.x - fx * 105, car.y + 62, car.z - fz * 105);
        return 3;
      }
      c.ride = null;
    }
    c.x = clamp(c.x, BOUNDS.x0, BOUNDS.x1);
    c.z = clamp(c.z, BOUNDS.z0, BOUNDS.z1);
    // the zoom range the mode promises: 120 m (low over the rooftops) to 1400 m (the whole city)
    c.h = clamp(c.h, 120, 1400);
    const gy = Math.max(0, W.height(c.x, c.z)),
      dist = c.h / Math.sin(PITCH);
    look.set(c.x, gy + 60 * K, c.z);
    pos.set(
      c.x + Math.sin(c.yaw) * Math.cos(PITCH) * dist,
      gy + c.h,
      c.z + Math.cos(c.yaw) * Math.cos(PITCH) * dist,
    );
    return 4;
  };
  city.pan = function (dx, dy, camera) {
    const c = city.cam,
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
  city.zoom = (f) => {
    city.cam.h = clamp(city.cam.h * f, 120, 1400);
  };
  city.rotate = (a) => {
    city.cam.yaw += a;
  };
  city.focusDistrict = function (id, h) {
    const d = DISTRICTS[id];
    city.cam.x = d.x * K;
    city.cam.z = d.z * K;
    city.cam.h = h || clamp(d.radius * 2.4 * K, 300 * K, 1400);
    city.cam.follow = null;
    city.cam.ride = null;
    if (d.look) W.setLook(d.look);
  };
  // a double-click on the open ground simply centres the map there
  city.focusAt = function (x, z) {
    city.cam.x = clamp(x, BOUNDS.x0, BOUNDS.x1);
    city.cam.z = clamp(z, BOUNDS.z0, BOUNDS.z1);
    city.cam.follow = null;
    city.cam.ride = null;
  };
  city.focusCar = function (id) {
    const car = city.cars.find((c) => c.id === id);
    if (!car) return;
    city.cam.follow = id;
    city.cam.ride = null;
    if (city.cam.h > 700 * K) city.cam.h = 420 * K;
  };
  city.ride = function (id) {
    city.cam.ride = id;
    city.cam.follow = id;
  };
  city.clearFocus = function () {
    city.cam.follow = null;
    city.cam.ride = null;
  };
  city.startCeremony = function (id) {
    const c = city.cam,
      d = DISTRICTS[id];
    c.ceremony = {
      id,
      t: 0,
      fromX: c.x,
      fromZ: c.z,
      fromH: c.h,
      fromYaw: c.yaw,
    };
    c.follow = null;
    c.ride = null;
    if (d.look) W.setLook(d.look);
  };
  city.unlock = function (S) {
    city.sync(S);
  };

  /* ---------- picking ---------- */
  city.pick = function (cx, cy, camera) {
    let best = null,
      bd = 44;
    for (const car of city.cars) {
      if (car.x === null) continue;
      _v.set(car.x, car.y + 1.2 * MS, car.z).project(camera);
      if (_v.z > 1) continue;
      const d = Math.hypot(
        (_v.x * 0.5 + 0.5) * innerWidth - cx,
        (-_v.y * 0.5 + 0.5) * innerHeight - cy,
      );
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    if (best) return { car: best.id };
    let hood = null,
      hd = 80;
    for (const id of ORDER) {
      const d = DISTRICTS[id];
      _v.set(d.x * K, W.height(d.x * K, d.z * K) + 30 * K, d.z * K).project(camera);
      if (_v.z > 1) continue;
      const dist = Math.hypot(
        (_v.x * 0.5 + 0.5) * innerWidth - cx,
        (-_v.y * 0.5 + 0.5) * innerHeight - cy,
      );
      if (dist < hd) {
        hd = dist;
        hood = id;
      }
    }
    return hood ? { hood } : null;
  };
  city.carPos = (id) => {
    const c = city.cars.find((q) => q.id === id);
    return c && c.x !== null ? { x: c.x, y: c.y, z: c.z, yaw: c.yaw } : null;
  };
  city.hoodPos = (id) => {
    const d = DISTRICTS[id];
    return { x: d.x * K, y: W.height(d.x * K, d.z * K), z: d.z * K };
  };
  city.markPos = (id) => {
    const d = DISTRICTS[id],
      m = d && d.primary;
    return m ? { x: m.x, y: m.y, z: m.z, h: m.h } : city.hoodPos(id);
  };

  /* ---------- floats ---------- */
  city.float = function (car, text) {
    car.msg = text;
    car.msgT = 2.9;
    if (car.float) {
      car.float.style.animation = "none";
      void car.float.offsetWidth;
      car.float.style.animation = "";
    }
  };

  /* ---------- each frame ---------- */
  city.update = function (dt, S) {
    const unlocked = new Set(S.unlockedDistricts);
    for (const car of city.cars) {
      const d = DISTRICTS[car.district];
      // the need timer: gentle, optional, never a penalty. Free Drive has no needs at all.
      if (city.freeDrive) {
        if (car.need) {
          clearNeed(car, false);
          city.float(car, "All set at the depot! ✨");
        }
        car.needT = Math.max(car.needT, 8);
      } else if (!car.need) {
        car.needT -= dt;
        if (car.needT <= 0) {
          car.needT = 26 + Math.random() * 46;
          if (Math.random() < 0.5) giveNeed(car);
        }
      } else {
        car.need.left -= dt;
        if (car.need.left <= 0) {
          const kind = clearNeed(car, false);
          city.float(car, "All set at the depot! ✨");
          if (city.onAuto) city.onAuto(car, kind);
        }
      }
      if (car.hop > 0) car.hop = Math.max(0, car.hop - dt);
      if (car.msgT > 0) car.msgT -= dt;
      // move
      if (car.mode === "route" && car.route) {
        const leg = car.route[car.leg];
        if (!leg) {
          arrive(car, unlocked);
        } else {
          const path = leg.edge.path;
          car.legD += car.speed * dt;
          if (car.legD >= path.len) {
            car.legD -= path.len;
            car.leg++;
            if (car.leg >= car.route.length) arrive(car, unlocked);
          }
          if (car.mode === "route" && car.route) {
            const cur = car.route[Math.min(car.leg, car.route.length - 1)];
            if (cur) {
              const p = samplePath(
                cur.edge.path,
                cur.reverse ? cur.edge.path.len - car.legD : car.legD,
                _p,
                false,
              );
              car.x = p.x;
              car.y = p.y;
              car.z = p.z;
              const dx = cur.reverse ? -p.dx : p.dx,
                dz = cur.reverse ? -p.dz : p.dz;
              car.yaw = Math.atan2(-dx, -dz);
            }
          }
        }
      } else {
        // a lazy loop round the neighbourhood while waiting for a fare
        if (car.wait > 0) car.wait -= dt;
        else {
          const loop = loops[car.district];
          if (loop) {
            car.loopD = (car.loopD + car.speed * 0.72 * dt) % loop.len;
            const p = samplePath(loop, car.loopD, _p, true);
            car.x = p.x;
            car.y = p.y;
            car.z = p.z;
            car.yaw = Math.atan2(-p.dx, -p.dz);
          }
          car.tripT -= dt;
          if (car.tripT <= 0) {
            car.tripT = 9 + Math.random() * 14;
            if (unlocked.size > 1 && Math.random() < 0.62) startTrip(car, unlocked);
          }
        }
      }
      if (car.x === null) {
        const loop = loops[car.district];
        const p = samplePath(loop, car.loopD, _p, true);
        car.x = p.x;
        car.y = p.y;
        car.z = p.z;
        car.yaw = Math.atan2(-p.dx, -p.dz);
      }
      // the toy's mood: a hop for a fare, a smooth lean into the hills
      const P = car.parts,
        r = P.root;
      r.position.set(car.x, car.y, car.z);
      r.rotation.order = "YXZ";
      r.rotation.y = car.yaw;
      P.g.position.y = Math.abs(Math.sin((1 - car.hop) * Math.PI * 3)) * 0.5 * car.hop;
      P.spin.rotation.y += dt * (car.need && car.need.kind === "charge" ? 1.4 : 6.5);
      if (car.need) P.sprite.position.y = 4.2 + Math.sin(performance.now() * 0.0025 + car.x) * 0.15;
      drawBubble(car);
    }
    // roads lighting up
    for (const e of edges) {
      if (!e.lit) {
        if (e.reveal > 0.01) {
          e.reveal = Math.max(0, e.reveal - dt * 1.5);
          for (const m of e.meshes) {
            m.material.opacity = e.reveal;
            m.visible = e.reveal > 0.01;
          }
        }
      } else if (e.reveal < 1) {
        e.reveal = Math.min(1, e.reveal + dt * 1.8);
        for (const m of e.meshes) {
          m.material.opacity = e.reveal;
          m.visible = true;
        }
      }
    }
  };

  /* ---------- DOM over the map ---------- */
  city.place = function (camera) {
    const w = innerWidth,
      h = innerHeight;
    for (const car of city.cars) {
      if (car.x === null) continue;
      _v.set(car.x, car.y + 5.8 * MS, car.z).project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      const show =
        vis &&
        (!!car.need || city.cam.follow === car.id || city.cam.h < 760 * K);
      car.tag.classList.toggle("hidden", !show);
      car.tag.classList.toggle("need", !!car.need);
      car.tag.style.pointerEvents = show ? "" : "none";
      if (show) {
        car.tag.style.left = ((_v.x * 0.5 + 0.5) * w).toFixed(1) + "px";
        car.tag.style.top = ((-_v.y * 0.5 + 0.5) * h).toFixed(1) + "px";
      }
      if (car.float) {
        const on = car.msgT > 0 && vis;
        car.float.hidden = !on;
        if (on) {
          if (car.float.textContent !== car.msg) car.float.textContent = car.msg;
          car.float.style.left = ((_v.x * 0.5 + 0.5) * w).toFixed(1) + "px";
          car.float.style.top = ((-_v.y * 0.5 + 0.5) * h - 44).toFixed(1) + "px";
        }
      }
    }
    for (const id of ORDER) {
      const L = labels[id],
        d = DISTRICTS[id],
        unlocked = city._unlocked ? city._unlocked.has(id) : true;
      L.p.set(
        d.x * K,
        W.height(d.x * K, d.z * K) + (unlocked ? 26 * K : 150 * K),
        d.z * K,
      );
      _v.copy(L.p).project(camera);
      const show = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
      L.on = show;
      L.sx = (_v.x * 0.5 + 0.5) * w;
      L.sy = (-_v.y * 0.5 + 0.5) * h;
      L.e.classList.toggle("hidden", !show);
      if (show) {
        L.e.style.left = L.sx.toFixed(1) + "px";
        L.e.style.top = L.sy.toFixed(1) + "px";
      }
    }
  };
  city.setUnlocked = function (set) {
    city._unlocked = set;
  };
  city.labels = () => labels;

  /* ---------- content for the inspector and the postcards ---------- */
  city.districtOf = (car) => DISTRICTS[car.district];
  city.needLabel = (kind) => NEED_LABEL[kind] || "Needs a little care";
  city.clearNeed = clearNeed;
  city.noteFor = (kind) => NOTE[kind] || "Thank you!";
  city.riderFor = (car) => (car.passenger ? car.passenger.rider : RIDERS[0]);
  city.districtName = (id) => (DISTRICTS[id] || DISTRICTS.lombard).name;

  WG.sundayCity = city;
})();
