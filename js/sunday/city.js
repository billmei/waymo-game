/* Waymo Care · Sunday Drive · City Diorama & Inter-Neighborhood Traffic
   Bird's-Eye camera, 3D arterial roads, autonomous fleet with spinning lidars,
   inter-neighborhood fares, regional care needs, auto-resolve timer,
   Ride Along chasing camera, and Inspector card dialogs. */
(function () {
  "use strict";
  const WG = window.WG || (window.WG = {});
  const T = THREE;
  const K = (WG.world && WG.world.SCALE) || 1.6;

  const CAR_SCALE = 8.5; // Toy scale for aerial city diorama
  const ROAD_W = 10;     // Road ribbon width in island units
  const PITCH = 0.98;

  const BOUNDS = {
    x0: -2100 * K,
    x1: 1800 * K,
    z0: -1800 * K,
    z1: 2200 * K,
  };

  const PASSENGERS = [
    { rider: "GRANDMA", name: "Grandma Evelyn", icon: "👵" },
    { rider: "ARTIST", name: "Clara (Artist)", icon: "🎨" },
    { rider: "LOCAL", name: "Marcus (Local)", icon: "🏃" },
    { rider: "TOURIST", name: "The Millers", icon: "🎒" },
    { rider: "BARISTA", name: "Leo (Barista)", icon: "☕" },
    { rider: "SURFER", name: "Kai (Surfer)", icon: "🏄" },
    { rider: "TECHIE", name: "Aria (Engineer)", icon: "💻" },
    { rider: "CHEF", name: "Chef Mateo", icon: "🧑‍🍳" },
    { rider: "HIKER", name: "Jordan (Hiker)", icon: "🥾" },
  ];

  const REGIONAL_NEEDS = {
    lombard: ["charge", "doors"],
    downtown: ["dirty", "vacuum"],
    presidio: ["birds"],
    ladies: ["cone", "vacuum"],
    windmills: ["reboot", "dirty"],
    twinpeaks: ["charge", "reboot"],
  };

  const STATUS_TEXT = {
    dirty: "Chassis is dusty from city streets",
    charge: "Battery low from climbing steep hills",
    birds: "Pigeons roosting on the lidar dome",
    cone: "Blocked by misplaced traffic cones",
    reboot: "Sensor fogged up from coastal mist",
    vacuum: "Cabin snacks left behind by riders",
    doors: "Passenger door left ajar",
  };

  const City = {
    scene: null,
    group: null,
    roadsGroup: null,
    cars: [],
    cam: {
      x: 420 * K,
      z: -620 * K,
      h: 680 * K,
      yaw: 0.6,
      follow: null,
      ride: null,
    },
    drag: null,
    inspectedCar: null,
    inspectedDistrict: null,
    activePlazas: {},
  };

  /* ---------- Camera Controller ---------- */
  function camera(dt, pos, look) {
    const c = City.cam;

    if (c.ride) {
      const p = carPosition(c.ride);
      if (p) {
        const fx = -Math.sin(p.yaw);
        const fz = -Math.cos(p.yaw);
        look.set(p.x + fx * 95, p.y + 12, p.z + fz * 95);
        pos.set(p.x - fx * 115, p.y + 65, p.z - fz * 115);
        return 3.5;
      }
      c.ride = null;
    }

    if (c.follow) {
      const p = carPosition(c.follow);
      if (p) {
        const f = Math.min(1, dt * 3.5);
        c.x += (p.x - c.x) * f;
        c.z += (p.z - c.z) * f;
      }
    }

    c.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, c.x));
    c.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, c.z));
    c.h = Math.max(120 * K, Math.min(1400 * K, c.h));

    const W = WG.world;
    const gy = W ? Math.max(0, W.height(c.x, c.z)) : 0;
    const dist = c.h / Math.sin(PITCH);

    look.set(c.x, gy, c.z);
    pos.set(
      c.x + Math.sin(c.yaw) * Math.cos(PITCH) * dist,
      gy + c.h,
      c.z + Math.cos(c.yaw) * Math.cos(PITCH) * dist
    );
    return 4.2;
  }

  function pan(dx, dy, cam3d) {
    const c = City.cam;
    const fov = cam3d ? cam3d.fov : 40;
    const dist = c.h / Math.sin(PITCH);
    const mpp = (2 * dist * Math.tan((fov * Math.PI) / 360)) / innerHeight;

    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);

    c.x += (-dx * rx + dy * fx * 1.25) * mpp;
    c.z += (-dx * rz + dy * fz * 1.25) * mpp;
    c.follow = null;
    c.ride = null;
  }

  function zoom(factor) {
    City.cam.h = Math.max(120 * K, Math.min(1400 * K, City.cam.h * factor));
    City.cam.ride = null;
  }

  function rotate(ang) {
    City.cam.yaw += ang;
  }

  function focus(x, z, h) {
    City.cam.x = x;
    City.cam.z = z;
    if (h) City.cam.h = h;
    City.cam.follow = null;
    City.cam.ride = null;
  }

  /* ---------- Roads & Geometry ---------- */
  function init(scene) {
    City.scene = scene;
    if (City.group) scene.remove(City.group);

    City.group = new T.Group();
    City.group.renderOrder = 4;
    scene.add(City.group);

    City.roadsGroup = new T.Group();
    City.group.add(City.roadsGroup);

    buildRoadNetwork();
    spawnInitialFleet();
  }

  function setVisible(on) {
    if (City.group) City.group.visible = on;
  }

  // Arterial road network connecting districts
  const ROAD_EDGES = [
    { from: "lombard", to: "downtown", bend: -0.15 },
    { from: "lombard", to: "presidio", bend: 0.12 },
    { from: "lombard", to: "ladies", bend: -0.08 },
    { from: "downtown", to: "ladies", bend: 0.14 },
    { from: "downtown", to: "twinpeaks", bend: -0.16 },
    { from: "presidio", to: "ladies", bend: -0.12 },
    { from: "presidio", to: "windmills", bend: 0.18 },
    { from: "ladies", to: "windmills", bend: -0.09 },
    { from: "ladies", to: "twinpeaks", bend: 0.11 },
    { from: "twinpeaks", to: "windmills", bend: -0.14 },
  ];

  function getSplinePoint(edge, t, out) {
    const D = WG.sundayClouds ? WG.sundayClouds.DISTRICTS : {};
    const A = D[edge.from];
    const B = D[edge.to];
    if (!A || !B) return { x: 0, z: 0, dx: 0, dz: 1 };

    out = out || {};
    const u = 1 - t;
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const L = Math.hypot(dx, dz) || 1;

    // Bézier control point curving gracefully
    const cx = (A.x + B.x) / 2 - (dz / L) * L * edge.bend;
    const cz = (A.z + B.z) / 2 + (dx / L) * L * edge.bend;

    out.x = u * u * A.x + 2 * u * t * cx + t * t * B.x;
    out.z = u * u * A.z + 2 * u * t * cz + t * t * B.z;

    const ddx = 2 * u * (cx - A.x) + 2 * t * (B.x - cx);
    const ddz = 2 * u * (cz - A.z) + 2 * t * (B.z - cz);
    const len = Math.hypot(ddx, ddz) || 1;
    out.dx = ddx / len;
    out.dz = ddz / len;
    return out;
  }

  function buildRoadNetwork() {
    City.roadsGroup.clear();
    const W = WG.world;
    const D = WG.sundayClouds ? WG.sundayClouds.DISTRICTS : {};

    // 1. Build road ribbons for each edge
    const pos = [], col = [], idx = [];
    const cRoad = new T.Color("#565f6d");
    const cEdge = new T.Color("#e8edf2");
    const cStripe = new T.Color("#fbc02d");

    function addStrip(pts, halfW, lift, colorHex, dashed) {
      const c = new T.Color(colorHex);
      for (let i = 0; i < pts.length - 1; i++) {
        if (dashed && i % 2) continue;
        const a = pts[i], b = pts[i + 1];
        const base = pos.length / 3;

        for (const p of [a, b]) {
          pos.push(p.x - p.nz * halfW, p.y + lift, p.z + p.nx * halfW);
          pos.push(p.x + p.nz * halfW, p.y + lift, p.z - p.nx * halfW);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }

    const pt = {};
    for (const e of ROAD_EDGES) {
      const n = 36;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        getSplinePoint(e, i / n, pt);
        const y = (W ? W.groundY(pt.x, pt.z) : 10) + 1.2;
        pts.push({ x: pt.x, y, z: pt.z, nx: pt.dx, nz: pt.dz });
      }
      addStrip(pts, ROAD_W * 0.65, 0.2, "#e8edf2");
      addStrip(pts, ROAD_W * 0.52, 0.5, "#49515e");
      addStrip(pts, ROAD_W * 0.08, 0.8, "#fbc02d", true);
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx);

    const mat = new T.MeshBasicMaterial({
      vertexColors: true,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const mesh = new T.Mesh(g, mat);
    mesh.renderOrder = 3;
    City.roadsGroup.add(mesh);

    // 2. Plazas at each district center
    const disc = new T.CircleGeometry(ROAD_W * 2.8, 32);
    for (const key in D) {
      const d = D[key];
      const y = (W ? W.groundY(d.x, d.z) : 15) + 1.4;
      const plaza = new T.Mesh(
        disc,
        new T.MeshBasicMaterial({
          color: 0xffffff,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        })
      );
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.set(d.x, y, d.z);
      plaza.renderOrder = 3;
      City.roadsGroup.add(plaza);
      City.activePlazas[key] = plaza;
    }
  }

  /* ---------- Autonomous Fleet ---------- */
  function spawnInitialFleet() {
    City.cars.forEach((c) => {
      if (c.parts && c.parts.root && City.group) City.group.remove(c.parts.root);
    });
    City.cars = [];

    const st = WG.sunday ? WG.sunday.state : null;
    const unlocked = st && st.unlockedDistricts ? st.unlockedDistricts : ["lombard"];

    const carCount = Math.max(4, unlocked.length * 2);
    for (let i = 0; i < carCount; i++) {
      spawnCar(i + 1, unlocked);
    }
  }

  function spawnCar(num, unlocked) {
    const parts = WG.makeCar();
    parts.root.scale.setScalar(CAR_SCALE);
    parts.sprite.renderOrder = 14;
    parts.sprite.scale.set(4.5, 4.5, 1);
    if (City.group) City.group.add(parts.root);

    const car = {
      id: "car_" + num,
      name: `Waymo #${num}`,
      plate: `SF-${400 + num}-ROBO`,
      parts,
      edge: null,
      t: Math.random(),
      reverse: Math.random() < 0.5,
      speed: 0.045 + Math.random() * 0.025,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      passenger: null,
      need: null,
      needTime: 0,     // seconds the car has had this need
      lastNeedSpawn: 0,
      hop: 0,
    };

    pickTrip(car, unlocked);
    City.cars.push(car);
    return car;
  }

  function pickTrip(car, unlocked) {
    const uList = unlocked || (WG.sunday && WG.sunday.state && WG.sunday.state.unlockedDistricts) || ["lombard"];
    const D = WG.sundayClouds ? WG.sundayClouds.DISTRICTS : {};

    // Available edges that connect unlocked districts
    const validEdges = ROAD_EDGES.filter((e) => uList.includes(e.from) && uList.includes(e.to));
    let chosenEdge = validEdges.length ? validEdges[Math.floor(Math.random() * validEdges.length)] : ROAD_EDGES[0];

    car.edge = chosenEdge;
    car.t = 0;
    car.reverse = Math.random() < 0.5;

    const fromId = car.reverse ? chosenEdge.to : chosenEdge.from;
    const toId = car.reverse ? chosenEdge.from : chosenEdge.to;

    const pass = PASSENGERS[Math.floor(Math.random() * PASSENGERS.length)];
    car.passenger = {
      rider: pass.rider,
      name: pass.name,
      icon: pass.icon,
      from: D[fromId] ? D[fromId].name : fromId,
      to: D[toId] ? D[toId].name : toId,
      toId,
    };
  }

  function carPosition(car) {
    if (!car) return null;
    return { x: car.x, y: car.y, z: car.z, yaw: car.yaw };
  }

  /* ---------- Traffic Update Loop ---------- */
  function update(dt) {
    const W = WG.world;
    const pt = {};

    for (const car of City.cars) {
      if (!car.edge) continue;

      car.t += car.speed * dt;
      if (car.t >= 1) {
        // Passenger arrived!
        deliverFare(car);
        pickTrip(car);
      }

      const tFrac = car.reverse ? 1 - car.t : car.t;
      getSplinePoint(car.edge, tFrac, pt);

      const dx = car.reverse ? -pt.dx : pt.dx;
      const dz = car.reverse ? -pt.dz : pt.dz;

      const groundY = W ? W.groundY(pt.x, pt.z) : 10;
      car.x = pt.x;
      car.y = groundY + 1.2;
      car.z = pt.z;
      car.yaw = Math.atan2(dx, dz);

      // Spin lidar puck continuously
      if (car.parts.spin) {
        car.parts.spin.rotation.y += dt * 7.5;
      }

      // Smooth hopping / delivery bounce
      if (car.hop > 0) {
        car.hop -= dt * 2.5;
        car.y += Math.sin(car.hop * Math.PI) * 4;
      }

      car.parts.root.position.set(car.x, car.y, car.z);
      car.parts.root.rotation.y = car.yaw;

      // Update need timers & auto-care after 3 minutes (180s)
      if (car.need) {
        car.needTime += dt;
        if (car.needTime >= 180) {
          // Auto-care after 3 mins with ZERO penalty
          autoCare(car, true);
        }
      } else {
        // Occasionally trigger a regional quirk need
        car.lastNeedSpawn += dt;
        if (car.lastNeedSpawn > 45 && Math.random() < 0.008) {
          triggerRegionalNeed(car);
          car.lastNeedSpawn = 0;
        }
      }
    }
  }

  function deliverFare(car) {
    const G = WG.game;
    const pass = car.passenger;
    if (G && G.A) G.A.sfx("chime");

    car.hop = 1;
    const msg = `${pass ? pass.name : "Passenger"} delivered! +Fare`;
    showFloater(msg, car.x, car.y + 18, car.z);

    if (WG.sunday) {
      WG.sunday.recordFare(car);
    }
  }

  function triggerRegionalNeed(car) {
    if (car.need || !car.edge) return;
    const fromId = car.reverse ? car.edge.to : car.edge.from;
    const pool = REGIONAL_NEEDS[fromId] || ["dirty", "charge"];
    const needType = pool[Math.floor(Math.random() * pool.length)];

    car.need = needType;
    car.needTime = 0;

    // Draw need icon in floating status bubble
    const ix = car.parts.cv.getContext("2d");
    ix.clearRect(0, 0, 128, 128);

    // Warm white circular bubble background
    ix.fillStyle = "#ffffff";
    ix.beginPath();
    ix.arc(64, 64, 48, 0, Math.PI * 2);
    ix.fill();
    ix.strokeStyle = "#38bdf8";
    ix.lineWidth = 6;
    ix.stroke();

    if (WG.drawIcon) {
      WG.drawIcon(ix, needType, 64, 64, 1.35);
    }
    car.parts.tex.needsUpdate = true;
    car.parts.sprite.visible = true;
  }

  function autoCare(car, isTimeout) {
    car.need = null;
    car.needTime = 0;
    if (car.parts && car.parts.sprite) {
      car.parts.sprite.visible = false;
    }
    car.hop = 0.8;
    const G = WG.game;
    if (G && G.A) G.A.sfx("carHappy");

    const text = isTimeout ? "Auto-cared at depot ✨" : "Waymo refreshed! ✨";
    showFloater(text, car.x, car.y + 20, car.z);
    closeInspector();
  }

  function showFloater(text, x, y, z) {
    const box = document.getElementById("floaters");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "flt floater-pop";
    el.textContent = text;
    box.appendChild(el);

    // Project world coordinates to screen
    const G = WG.game;
    if (G && G.camera) {
      const v = new T.Vector3(x, y, z).project(G.camera);
      const sx = ((v.x + 1) / 2) * innerWidth;
      const sy = ((-v.y + 1) / 2) * innerHeight;
      el.style.left = sx + "px";
      el.style.top = sy + "px";
    }
    setTimeout(() => el.remove(), 2400);
  }

  /* ---------- Inspector Card Dialog ---------- */
  function openCarInspector(car) {
    City.inspectedCar = car;
    City.inspectedDistrict = null;
    const card = document.getElementById("sunday-inspector");
    if (!card) return;

    card.hidden = false;
    card.dataset.type = "car";

    const title = card.querySelector(".ic-title");
    const sub = card.querySelector(".ic-sub");
    const body = card.querySelector(".ic-body");
    const actions = card.querySelector(".ic-actions");

    title.innerHTML = `<span>${car.name}</span> <small>${car.plate}</small>`;
    sub.textContent = car.passenger ? `${car.passenger.icon} ${car.passenger.name}: ${car.passenger.from} → ${car.passenger.to}` : "Cruising San Francisco";

    if (car.need) {
      const desc = STATUS_TEXT[car.need] || "Needs a pit stop";
      body.innerHTML = `
        <div class="ic-status need">
          <span class="ic-need-icon">⚠️</span>
          <div>
            <b>Attention Needed</b>
            <p>${desc}</p>
          </div>
        </div>
      `;
      actions.innerHTML = `
        <button type="button" class="btn primary" id="ic-take-care">Take Care 🧽</button>
        <button type="button" class="btn" id="ic-auto-care">Auto-Care ⚡</button>
        <button type="button" class="btn" id="ic-ride-along">Ride Along 🎥</button>
        <button type="button" class="btn" id="ic-close">Close</button>
      `;
      card.querySelector("#ic-take-care").onclick = () => {
        closeInspector();
        const fromZone = car.edge ? car.edge.from : "lombard";
        if (WG.sundaySwoop) {
          WG.sundaySwoop.start(car, car.need, fromZone);
        }
      };
      card.querySelector("#ic-auto-care").onclick = () => autoCare(car, false);
    } else {
      body.innerHTML = `
        <div class="ic-status ok">
          <span class="ic-need-icon">✨</span>
          <div>
            <b>In Perfect Shape</b>
            <p>Cruising smoothly across San Francisco with clean lidar and happy riders.</p>
          </div>
        </div>
      `;
      actions.innerHTML = `
        <button type="button" class="btn primary" id="ic-ride-along">Ride Along 🎥</button>
        <button type="button" class="btn" id="ic-close">Close</button>
      `;
    }

    card.querySelector("#ic-ride-along").onclick = () => {
      City.cam.ride = car;
      closeInspector();
      if (WG.game && WG.game.A) WG.game.A.sfx("select");
    };
    card.querySelector("#ic-close").onclick = closeInspector;

    if (WG.game && WG.game.A) WG.game.A.sfx("open");
  }

  function openDistrictInspector(dist) {
    City.inspectedDistrict = dist;
    City.inspectedCar = null;
    const card = document.getElementById("sunday-inspector");
    if (!card) return;

    card.hidden = false;
    card.dataset.type = "district";

    const title = card.querySelector(".ic-title");
    const sub = card.querySelector(".ic-sub");
    const body = card.querySelector(".ic-body");
    const actions = card.querySelector(".ic-actions");

    const st = WG.sunday ? WG.sunday.state : { unlockedDistricts: ["lombard"], mapSeals: 0 };
    const isUnlocked = st.freeDrive || (st.unlockedDistricts && st.unlockedDistricts.includes(dist.id));
    const seals = st.mapSeals || 0;
    const canUnlock = seals >= dist.seals;

    title.innerHTML = `<span>${dist.title}</span>`;
    sub.textContent = `Primary Landmark: ${dist.landmark}`;

    body.innerHTML = `
      <div class="ic-dist-lore">
        <p>${dist.lore}</p>
        <div class="ic-dist-meta">
          <span>Status: <b>${isUnlocked ? "Unlocked & Active ☀️" : "Covered in Coastal Fog ☁️"}</b></span>
          ${!isUnlocked ? `<span>Requires: <b>${dist.seals} Map Seals</b> (You have: <b>${seals}</b>)</span>` : ""}
        </div>
      </div>
    `;

    if (!isUnlocked) {
      actions.innerHTML = `
        <button type="button" class="btn primary" id="ic-unlock-dist" ${canUnlock ? "" : "disabled"}>
          ${canUnlock ? `Unlock District (${dist.seals} Seals) ✨` : `Need ${dist.seals - seals} More Seals`}
        </button>
        <button type="button" class="btn" id="ic-focus-dist">Look Here 🔭</button>
        <button type="button" class="btn" id="ic-close">Close</button>
      `;
      const unlockBtn = card.querySelector("#ic-unlock-dist");
      if (unlockBtn && canUnlock) {
        unlockBtn.onclick = () => {
          closeInspector();
          if (WG.sunday) WG.sunday.unlockDistrict(dist.id);
        };
      }
    } else {
      actions.innerHTML = `
        <button type="button" class="btn primary" id="ic-focus-dist">Look Here 🔭</button>
        <button type="button" class="btn" id="ic-close">Close</button>
      `;
    }

    card.querySelector("#ic-focus-dist").onclick = () => {
      focus(dist.x, dist.z);
      closeInspector();
    };
    card.querySelector("#ic-close").onclick = closeInspector;

    if (WG.game && WG.game.A) WG.game.A.sfx("open");
  }

  function closeInspector() {
    City.inspectedCar = null;
    City.inspectedDistrict = null;
    const card = document.getElementById("sunday-inspector");
    if (card) card.hidden = true;
  }

  /* ---------- Pointer & Click Interaction ---------- */
  function pointer(type, e) {
    if (type === "down") {
      City.drag = {
        x: e.clientX,
        y: e.clientY,
        moved: false,
        btn: e.button,
      };
    } else if (type === "move") {
      if (!City.drag) return;
      const dx = e.clientX - City.drag.x;
      const dy = e.clientY - City.drag.y;
      if (Math.hypot(dx, dy) > 8) City.drag.moved = true;

      if (City.drag.btn === 2 || e.buttons === 2) {
        rotate(dx * 0.005);
      } else {
        pan(dx, dy, WG.game ? WG.game.camera : null);
      }
      City.drag.x = e.clientX;
      City.drag.y = e.clientY;
    } else if (type === "up") {
      if (City.drag && !City.drag.moved) {
        handleClick(e.clientX, e.clientY);
      }
      City.drag = null;
    } else if (type === "wheel") {
      zoom(e.deltaY > 0 ? 1.12 : 0.89);
    }
  }

  function handleClick(cx, cy) {
    const G = WG.game;
    if (!G || !G.camera) return;

    // 1. Raycast for Waymo Cars
    const v = new T.Vector3();
    let bestCar = null;
    let bestDist = 48; // Screen pixel radius for easy clicking

    for (const car of City.cars) {
      v.set(car.x, car.y + 12, car.z).project(G.camera);
      if (v.z > 0 && v.z < 1) {
        const sx = ((v.x + 1) / 2) * innerWidth;
        const sy = ((-v.y + 1) / 2) * innerHeight;
        const dist = Math.hypot(cx - sx, cy - sy);
        if (dist < bestDist) {
          bestDist = dist;
          bestCar = car;
        }
      }
    }

    if (bestCar) {
      openCarInspector(bestCar);
      return;
    }

    // 2. Check for District Plazas / Clouds
    const W = WG.world;
    const ray = G.rayAt(cx, cy);
    if (ray) {
      // Find ground intersection point
      const ground = G.pickGround ? G.pickGround(cx, cy) : null;
      const gx = ground ? ground.x : City.cam.x;
      const gz = ground ? ground.z : City.cam.z;

      const dist = WG.sundayClouds ? WG.sundayClouds.getDistrictAt(gx, gz) : null;
      if (dist) {
        openDistrictInspector(dist);
        return;
      }
    }

    // Clicked empty ground -> close inspector or exit Ride Along
    if (City.cam.ride) {
      City.cam.ride = null;
    } else {
      closeInspector();
    }
  }

  function key(e) {
    if (e.code === "Escape") {
      if (City.cam.ride) {
        City.cam.ride = null;
        return true;
      }
      if (City.inspectedCar || City.inspectedDistrict) {
        closeInspector();
        return true;
      }
    }
    if (e.code === "KeyQ") {
      rotate(-0.1);
      return true;
    }
    if (e.code === "KeyE") {
      rotate(0.1);
      return true;
    }
    return false;
  }

  const Module = {
    init,
    update,
    camera,
    pan,
    zoom,
    rotate,
    focus,
    pointer,
    key,
    setVisible,
    get cars() {
      return City.cars;
    },
    spawnInitialFleet,
    openCarInspector,
    openDistrictInspector,
    closeInspector,
  };

  WG.sundayCity = Module;
})();
