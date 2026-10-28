/* Waymo Care · Adopt-a-Waymo · the simulation. Everything that happens to the fleet, with no three.js and no DOM, so it
   runs the same in Node (tools/adopt_sim.js, and the time-away catch-up): the in-game clock, needs dropping, demand and
   rides on the neighbourhood graph (Dijkstra), traits, mood, napping and towing, nights at home, random events, rider
   friendships and requests, stamps, cards, Karl's quests, training, growing up, shops and haggling, dailies, the
   arcade's pay, the Car Show, the Hill Climb Derby, the Startup Index and the Auction House. The game reads its state
   (S, the save) and calls its actions; it tells the game what happened through Sim.on(event). */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  const WG = (root.WG = root.WG || {});
  const D = WG.adoptData,
    St = WG.adoptState;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const R = (S) => St.rand(S);
  const has = (car, t) => car.traits.includes(t);
  // a trait that the car's 10 hearts upgraded no longer has its downside
  const plus = (car) => car.bond >= 10;
  const Sim = { on: null, now: () => Date.now(), fast: 1 };

  /* ======================================================================================================
     the map: neighbourhoods, the roads between them (gentle curves) and routes
     ====================================================================================================== */
  const G = { hoods: {}, names: [], edges: [], adj: {}, cache: {} };
  Sim.G = G;
  // rows are js/isle.js ISL.DIST rows [id, name, x, z, …] in island units; fix(x, z) may move a centre (onto land)
  Sim.setGeo = function (rows, fix) {
    G.hoods = {};
    G.names = [];
    G.edges = [];
    G.adj = {};
    G.cache = {};
    for (const r of rows) {
      const name = r[1];
      if (!D.HOODS[name] || D.EXCLUDE.includes(name)) continue;
      const [x, z] = fix ? fix(r[2], r[3], name) : [r[2], r[3]];
      G.hoods[name] = Object.assign({ name, x, z }, D.HOODS[name]);
      G.names.push(name);
      G.adj[name] = [];
    }
    const seen = new Set();
    for (const line of D.EDGES.trim().split("\n")) {
      const [a, rest] = line.split(":");
      for (const b0 of rest.split(",")) {
        const b = b0.trim(),
          A = G.hoods[a.trim()],
          B = G.hoods[b];
        if (!A || !B) continue;
        const k = [A.name, B.name].sort().join("|");
        if (seen.has(k)) continue;
        seen.add(k);
        const dx = B.x - A.x,
          dz = B.z - A.z,
          L = Math.hypot(dx, dz);
        // the curve bends to one side or the other (decided by the names, so it's always the same)
        let h = 0;
        for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0;
        const s = (h & 1 ? 1 : -1) * (0.07 + ((h >>> 3) % 7) * 0.012);
        const e = { a: A.name, b: B.name, len: L * 1.25, cx: (A.x + B.x) / 2 - (dz / L) * L * s, cz: (A.z + B.z) / 2 + (dx / L) * L * s };
        G.edges.push(e);
        G.adj[A.name].push([B.name, e]);
        G.adj[B.name].push([A.name, e]);
      }
    }
  };
  const edgeOf = (a, b) => {
    for (const [n, e] of G.adj[a] || []) if (n === b) return e;
    return null;
  };
  Sim.edgeOf = edgeOf;
  // a point on a road, travelling from `from` (t from 0 to 1): a quadratic Bézier between the two centres
  Sim.edgePoint = function (e, from, t, out) {
    out = out || {};
    if (from !== e.a) t = 1 - t;
    const A = G.hoods[e.a],
      B = G.hoods[e.b],
      u = 1 - t;
    out.x = u * u * A.x + 2 * u * t * e.cx + t * t * B.x;
    out.z = u * u * A.z + 2 * u * t * e.cz + t * t * B.z;
    let dx = 2 * u * (e.cx - A.x) + 2 * t * (B.x - e.cx),
      dz = 2 * u * (e.cz - A.z) + 2 * t * (B.z - e.cz);
    if (from !== e.a) {
      dx = -dx;
      dz = -dz;
    }
    const l = Math.hypot(dx, dz) || 1;
    out.dx = dx / l;
    out.dz = dz / l;
    return out;
  };
  // the shortest route (Dijkstra), as a list of neighbourhood names from a to b; cached
  Sim.route = function (a, b) {
    if (a === b) return [a];
    const key = a + ">" + b;
    if (G.cache[key]) return G.cache[key];
    const dist = { [a]: 0 },
      prev = {},
      done = new Set(),
      open = [a];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
      const n = open.splice(bi, 1)[0];
      if (n === b) break;
      if (done.has(n)) continue;
      done.add(n);
      for (const [m, e] of G.adj[n]) {
        const d = dist[n] + e.len;
        if (dist[m] === undefined || d < dist[m]) {
          dist[m] = d;
          prev[m] = n;
          open.push(m);
        }
      }
    }
    if (dist[b] === undefined) return null;
    const out = [b];
    while (out[0] !== a) out.unshift(prev[out[0]]);
    G.cache[key] = out;
    return out;
  };
  Sim.routeLen = function (a, b) {
    const r = Sim.route(a, b);
    if (!r) return Infinity;
    let L = 0;
    for (let i = 1; i < r.length; i++) L += edgeOf(r[i - 1], r[i]).len;
    return L;
  };
  Sim.km = (units) => units * D.KM_PER_UNIT;
  Sim.CARE = {};
  for (const [n, h] of Object.entries(D.HOODS)) if (h.care) Sim.CARE[n] = h.care;
  Sim.HOME = Object.keys(D.HOODS).find((n) => D.HOODS[n].home);

  /* ======================================================================================================
     time
     ====================================================================================================== */
  Sim.MPS = 60 / 45; // in-game minutes per real second (an in-game hour is 45 s)
  const absMin = (S) => S.clock.day * 1440 + S.clock.minute;
  const hourIdx = (S) => S.clock.day * 24 + Math.floor(S.clock.minute / 60);
  Sim.absMin = absMin;
  Sim.hourIdx = hourIdx;
  Sim.hour = (S) => Math.floor(S.clock.minute / 60) % 24;
  Sim.fmtClock = (min) => {
    const m = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  };
  Sim.fmtWhen = (abs) => "Day " + Math.floor(abs / 1440) + ", " + Sim.fmtClock(abs % 1440);
  // which light the city is in: morning, day, dusk or night
  Sim.look = (S) => {
    const m = S.clock.minute;
    return S.clock.night || m >= 1200 ? "night" : m < 600 ? "morning" : m < 1020 ? "day" : "dusk";
  };
  Sim.weekend = (S) => S.clock.day % 7 === 6 || S.clock.day % 7 === 0;
  let acc = 0;
  // advance by real seconds (at the player's speed: 1×, 2×, 4×, or 0 for paused)
  Sim.advance = function (S, realSec) {
    const sp = S.settings.speed;
    if (!sp) return;
    acc += realSec * Sim.MPS * sp * Sim.fast;
    let n = Math.floor(acc);
    acc -= n;
    if (n > 240) n = 240;
    for (let k = 0; k < n; k++) step(S, false);
  };
  // run a number of in-game minutes at once (the time-away catch-up, the balance tool, the debug skip)
  Sim.run = function (S, minutes, opt) {
    const away = !!(opt && opt.away);
    for (let k = 0; k < minutes; k++) step(S, away);
  };

  /* ======================================================================================================
     helpers: events, inventory, xp
     ====================================================================================================== */
  Sim.emit = function (S, ev) {
    ev.at = absMin(S);
    if (ev.inbox) {
      S.inbox.unshift({ at: ev.at, icon: ev.icon || "🔔", text: ev.text, read: false });
      if (S.inbox.length > 40) S.inbox.length = 40;
    }
    if (ev.diary && S.today) {
      S.today.lines.push(ev.text);
      if (S.today.lines.length > 12) S.today.lines.shift();
    }
    if (Sim.on) Sim.on(ev, S);
  };
  const toast = (S, icon, text, o) => Sim.emit(S, Object.assign({ type: "toast", icon, text }, o || {}));
  const nameOf = (car) => car.nick || car.name;
  Sim.nameOf = nameOf;
  const fill = (s, car, extra) =>
    s
      .replace(/\{car\}/g, car ? nameOf(car) : "")
      .replace(/\{hood\}/g, car ? hoodOf(car) : "")
      .replace(/\{(\w+)\}/g, (m, k) => (extra && extra[k] !== undefined ? extra[k] : m));
  Sim.invCount = (S) => Object.values(S.inventory).reduce((a, b) => a + b, 0);
  Sim.invCap = (S) => D.FRIDGE[S.garage.fridge] || 40;
  Sim.has = (S, id, n) => (S.inventory[id] || 0) >= (n || 1);
  // into the inventory; when the fridge is full it goes straight to the Pawn Shop
  Sim.give = function (S, id, n) {
    n = n || 1;
    const it = D.ITEMS[id];
    if (!it) return false;
    const room = Sim.invCap(S) - Sim.invCount(S);
    const keep = Math.min(n, room);
    if (keep > 0) S.inventory[id] = (S.inventory[id] || 0) + keep;
    if (keep < n) {
      const f = Math.floor(it.price * 0.5) * (n - keep);
      S.player.fares += f;
      toast(S, "🧊", "The snack fridge is full, so the " + it.name + " went to the Pawn Shop for ◎" + f + ".");
    }
    return keep > 0;
  };
  Sim.take = function (S, id, n) {
    n = n || 1;
    if (!Sim.has(S, id, n)) return false;
    S.inventory[id] -= n;
    if (!S.inventory[id]) delete S.inventory[id];
    return true;
  };
  Sim.xpNeed = (r) => Math.round(120 + 44 * Math.pow(r, 1.5));
  Sim.xp = function (S, n) {
    const p = S.player;
    p.xp += n;
    while (p.rank < 50 && p.xp >= Sim.xpNeed(p.rank)) {
      p.xp -= Sim.xpNeed(p.rank);
      p.rank++;
      syncUnlocks(S);
      const lands = Object.keys(D.HOODS).filter((h) => D.HOODS[h].rank === p.rank),
        extra = D.RANK_UNLOCKS[p.rank],
        what = lands.map((h) => h + " unlocked").concat(extra ? [extra] : []);
      Sim.emit(S, { type: "rank", rank: p.rank, icon: "⭐", text: "Crew Rank " + p.rank + "!" + (what.length ? " " + what.join(" · ") + "." : ""), inbox: true, diary: true });
    }
  };
  function syncUnlocks(S) {
    S.unlocked.hoods = Object.keys(D.HOODS).filter((h) => D.HOODS[h].rank !== null && D.HOODS[h].rank <= S.player.rank);
    let slots = 1;
    for (const [r, n] of D.CAR_SLOTS) if (S.player.rank >= r) slots = n;
    S.unlocked.carSlots = slots;
  }
  Sim.syncUnlocks = syncUnlocks;
  // a land is open at its rank; plain neighbourhoods always are
  Sim.open = (S, hood) => {
    const h = D.HOODS[hood];
    return !!h && (h.rank === null || h.rank <= S.player.rank);
  };
  Sim.trophy = function (S, id) {
    if (S.player.trophies.includes(id)) return;
    S.player.trophies.push(id);
    const t = D.TROPHIES[id];
    if (t) Sim.emit(S, { type: "trophy", id, icon: t.icon, text: "Trophy: " + t.name + "!", inbox: true, diary: true });
  };
  const fares = (S, n, why) => {
    S.player.fares = Math.max(0, S.player.fares + n);
    if (S.today) S.today.fares += Math.max(0, n);
    if (S.player.fares >= 100000) Sim.trophy(S, "millionaire");
  };
  Sim.fares = fares;
  // apply a prize: { item, n } / { fares } / { text }
  function prize(S, p, car) {
    if (!p) return "";
    if (p.item) {
      Sim.give(S, p.item, p.n || 1);
      const it = D.ITEMS[p.item];
      return (p.n > 1 ? p.n + "× " : "") + it.icon + " " + it.name;
    }
    if (p.fares) {
      fares(S, p.fares);
      return "◎" + p.fares;
    }
    if (p.text === "fortune") return "“" + St.pick(S, D.FORTUNES) + "”";
    return p.text || "";
  }
  Sim.prize = prize;

  /* ======================================================================================================
     cars: effective stats, labels, where they are
     ====================================================================================================== */
  Sim.find = (S, id) => S.cars.find((c) => c.id === id) || S.stored.find((c) => c.id === id) || null;
  Sim.level = (car) => Math.floor(D.STAT_KEYS.reduce((a, k) => a + car.stats[k], 0) / 5);
  Sim.eff = function (S, car) {
    const s = Object.assign({}, car.stats);
    for (const k in car.gear) {
      const it = car.gear[k] && D.ITEMS[car.gear[k]];
      if (it && it.charm) s.charm += it.charm;
    }
    const w = D.ITEMS["wrap_" + car.wrap];
    if (w) s.charm += w.rarity >= 70 ? 2 : w.rarity >= 45 ? 1 : 0;
    if (car.needs.shine >= 80) s.charm += 1;
    const pet = car.dashpet && car.dashpet.id;
    if (pet === "parrot") s.charm += 2;
    if (pet === "mini_bison") s.range += 2;
    for (const f of S.garage.furniture) {
      const it = D.ITEMS[f];
      if (it && it.bonus && it.bonus.comfort) s.comfort += it.bonus.comfort;
    }
    return s;
  };
  Sim.label = function (need, v) {
    const L = D.NEEDS[need].labels;
    let out = L[0][1];
    for (const [at, name] of L) if (v >= at) out = name;
    if (need === "charge" && v > 100) out = L[L.length - 1][1];
    return out;
  };
  Sim.worst = function (car) {
    let k = null,
      v = 999;
    for (const n of D.NEED_KEYS)
      if (car.needs[n] < v) {
        v = car.needs[n];
        k = n;
      }
    return { need: k, v };
  };
  Sim.hearts = (car) => Math.floor(car.bond);
  function hoodOf(car) {
    const s = car.sim;
    return s.from ? (s.t < 0.5 ? s.from : s.to) : s.at;
  }
  Sim.hoodOf = hoodOf;
  // a car's place on the map, in island units, with its heading
  Sim.pos = function (car, out) {
    out = out || {};
    const s = car.sim;
    if (s.from) {
      const e = edgeOf(s.from, s.to);
      if (e) return Sim.edgePoint(e, s.from, s.t, out);
    }
    const h = G.hoods[s.at] || G.hoods[Sim.HOME];
    out.x = h ? h.x : 0;
    out.z = h ? h.z : 0;
    out.dx = 0;
    out.dz = 1;
    return out;
  };
  Sim.moving = (car) => !!car.sim.from;
  Sim.atHome = (car) => !car.sim.from && car.sim.at === Sim.HOME;
  Sim.careSpot = (car) => (!car.sim.from && Sim.CARE[car.sim.at]) || null;
  // what a car is doing, in words
  const TASK = {
    idle: "Waiting for a rider",
    garage: "Resting in the garage",
    toPickup: "Off to pick someone up",
    ride: "Giving a ride",
    toCare: "Heading to a Care Spot",
    care: "Waiting for you at the Care Spot",
    toHang: "Off to hang out",
    hang: "Hanging out",
    home: "Driving home",
    toSchool: "Off to the Driving Academy",
    school: "At the Driving Academy",
    nap: "Napping at the kerb (out of charge)",
    tow: "Being towed home",
    stuck: "Stuck",
  };
  Sim.doing = function (car) {
    const s = car.sim;
    let t = TASK[s.task] || s.task;
    if (s.task === "ride" && s.ride) t = "Giving " + (s.ride.rider ? D.RIDERS[s.ride.rider].name.replace(/^The /, "the ") : "a rider") + " a ride to " + s.ride.to;
    if (s.task === "stuck" && s.incident) t = D.INCIDENTS[s.incident].name;
    if ((s.task === "hang" || s.task === "idle" || s.task === "care") && s.at) t += " · " + s.at;
    if (s.from && s.dest) t += " → " + s.dest;
    return t;
  };

  /* ======================================================================================================
     moving about
     ====================================================================================================== */
  const BUSY = ["toPickup", "ride", "nap", "tow", "stuck"];
  Sim.busy = (car) => BUSY.includes(car.sim.task) || !!car.training;
  // head for a neighbourhood; arrival is handled by the task (arrive())
  function goTo(S, car, dest, task) {
    const s = car.sim,
      start = s.from ? s.to : s.at,
      r = Sim.route(start, dest);
    if (!r) return false;
    s.task = task;
    s.dest = dest;
    s.wait = 0;
    if (s.from) s.path = r.slice(1);
    else if (r.length === 1) {
      s.path = [];
      arrive(S, car);
    } else {
      s.from = r[0];
      s.to = r[1];
      s.t = 0;
      s.path = r.slice(2);
      s.at = null;
    }
    return true;
  }
  Sim.goTo = goTo;
  function speedOf(S, car) {
    const e = Sim.eff(S, car),
      h = Sim.hour(S);
    let v = 80 * (1 + e.handling * 0.03 + e.smarts * 0.01);
    if (has(car, "speed_demon")) v *= 1.15;
    if (has(car, "night_owl")) {
      if (h >= 20 || S.clock.night) v *= 1.15;
      else if (h < 10 && !plus(car)) v *= 0.8;
    }
    if (car.needs.mood < 20) v *= 0.85;
    if (car.sim.task === "tow") v = 70;
    return v;
  }
  Sim.speedOf = speedOf;
  // how far into the next in-game minute the clock is (0–1), so the map can draw the cars between steps
  Sim.frac = () => acc;
  function move(S, car, mul) {
    const s = car.sim;
    if (!s.from) return;
    let dist = speedOf(S, car) * mul;
    car.km += Sim.km(dist);
    if (S.today) S.today.km[car.id] = (S.today.km[car.id] || 0) + Sim.km(dist);
    while (dist > 0 && s.from) {
      const e = edgeOf(s.from, s.to);
      if (!e) {
        s.at = s.to;
        s.from = null;
        break;
      }
      const left = (1 - s.t) * e.len;
      if (dist < left) {
        s.t += dist / e.len;
        dist = 0;
      } else {
        dist -= left;
        const node = s.to;
        visit(S, car, node);
        if (s.path.length) {
          s.from = node;
          s.to = s.path.shift();
          s.t = 0;
        } else {
          s.at = node;
          s.from = s.to = null;
          s.t = 0;
          arrive(S, car);
        }
      }
    }
  }
  // passing through or arriving at a neighbourhood: stamps, the Rider Rally, storyline visits
  function visit(S, car, hood) {
    const look = Sim.look(S),
      w = S.clock.weather;
    for (const st of D.STAMPS) {
      if (st.hood !== hood || S.album.stamps[st.name]) continue;
      const ok = st.when === "any" || st.when === look || (st.when === "fog" && w === "fog") || (st.when === "clear" && w === "clear");
      if (!ok) continue;
      let p = 0.08 + Sim.eff(S, car).charm * 0.015;
      if (has(car, "tour_guide")) p *= plus(car) ? 3 : 2;
      if (D.HOODS[hood].tags.includes("tourist")) p *= 1.3;
      if (R(S) > p) continue;
      S.album.stamps[st.name] = { car: car.id, carName: nameOf(car), day: S.clock.day, mark: st.mark, img: null };
      Sim.xp(S, 30);
      Sim.emit(S, { type: "stamp", stamp: st.name, mark: st.mark, carId: car.id, icon: "📮", text: "New stamp: " + st.name + "! " + nameOf(car) + " was there.", inbox: true, diary: true });
      if (Object.keys(S.album.stamps).length >= 10) Sim.trophy(S, "collector");
    }
    const ra = S.quests.rally;
    if (ra && ra.day === S.clock.day && !ra.won && ra.hoods.includes(hood) && !ra.done.includes(hood)) {
      ra.done.push(hood);
      toast(S, "🏁", "Rider Rally: " + nameOf(car) + " reached " + hood + " (" + ra.done.length + "/" + ra.hoods.length + ").");
      if (ra.done.length === ra.hoods.length) {
        ra.won = true;
        fares(S, 400);
        Sim.give(S, "chip_sutro");
        Sim.xp(S, 60);
        Sim.emit(S, { type: "toast", icon: "🏆", text: "Rider Rally complete! ◎400 and a Chip-Sutro.", inbox: true, diary: true });
      }
    }
    storyHook(S, { visit: hood });
  }
  function arrive(S, car) {
    const s = car.sim,
      task = s.task;
    s.dest = null;
    s.wait = 0;
    if (task === "toPickup") {
      const r = s.ride;
      // somebody boxed it in with cones while it waited
      let pc = 0.03 * (D.HOODS[s.at].tags.includes("downtown") ? 2 : 1);
      s.task = "ride";
      Sim.emit(S, { type: "pickup", carId: car.id, rider: r.rider, from: r.from, to: r.to });
      if (!S.clock.night && R(S) < pc) return incident(S, car, "cone", "ride");
      if (!goTo(S, car, r.to, "ride")) finishRide(S, car);
      return;
    }
    if (task === "ride") return finishRide(S, car);
    if (task === "toCare") {
      s.task = "care";
      s.careT = 0;
      if (!S.clock.night) toast(S, "🔧", nameOf(car) + " is at the " + s.at + " Care Spot, ready for you.", { carId: car.id, care: true });
      return;
    }
    if (task === "toHang") {
      s.task = "hang";
      s.hangT = 25;
      return;
    }
    if (task === "toSchool") {
      s.task = "school";
      return;
    }
    if (task === "home" || task === "tow") {
      s.task = s.at === Sim.HOME ? "garage" : "idle";
      return;
    }
    s.task = s.at === Sim.HOME ? "garage" : "idle";
  }
  function incident(S, car, kind, resume) {
    const s = car.sim;
    s.task = "stuck";
    s.incident = kind;
    s.stuckT = 45;
    s.resume = resume;
    Sim.emit(S, { type: "incident", carId: car.id, icon: D.INCIDENTS[kind].icon, text: fill(D.INCIDENTS[kind].text, car), inbox: true });
  }
  // the incident's over (fixed by hand, by roadside help, or by a kind passer-by)
  Sim.clearIncident = function (S, car) {
    const s = car.sim;
    if (s.task !== "stuck") return;
    s.incident = null;
    const r = s.resume;
    s.resume = null;
    if (r === "ride" && s.ride) {
      if (!goTo(S, car, s.ride.to, "ride")) finishRide(S, car);
    } else s.task = s.at === Sim.HOME ? "garage" : "idle";
  };
  function finishRide(S, car) {
    const s = car.sim,
      r = s.ride;
    s.ride = null;
    s.task = s.at === Sim.HOME && car.needs.charge < 40 ? "garage" : "idle";
    if (!r) return;
    const e = Sim.eff(S, car),
      rd = r.rider ? D.RIDERS[r.rider] : null,
      hood = s.at,
      tags = D.HOODS[hood].tags;
    let tip = rd ? rd.tip : 1;
    if (has(car, "foodie")) tip += plus(car) ? 0.4 : 0.2;
    if (car.dashpet && car.dashpet.id === "gull_chick" && (hood === "Fisherman's Wharf" || hood === "Embarcadero" || r.from === "Fisherman's Wharf")) tip += 0.15;
    const moodF = 0.8 + car.needs.mood / 250,
      fare = Math.round((10 + 2 * r.km) * (1 + e.comfort * 0.02) * tip * moodF * (r.half ? 0.5 : 1));
    fares(S, fare);
    car.rides++;
    if (S.today) S.today.rides[car.id] = (S.today.rides[car.id] || 0) + 1;
    Sim.xp(S, 10);
    // the cabin after the rider
    let mess = 2.8 * (rd ? rd.mess : 1) * (has(car, "foodie") ? 1.5 : 1) * (1 - Math.min(0.5, e.comfort * 0.02));
    if (car.dashpet && car.dashpet.id === "succulent") mess *= 0.6;
    car.needs.cozy = clamp(car.needs.cozy - mess, AWAY ? Math.min(car.needs.cozy, 25) : 0, 100);
    s.emote = { k: "◎", at: absMin(S) };
    Sim.emit(S, { type: "ride", carId: car.id, fare, rider: r.rider, from: r.from, to: r.to });
    // friendship, rider cards and lucky finds
    if (r.rider) {
      const f = (S.riders[r.rider] = S.riders[r.rider] || { friend: 0, rides: 0, request: null });
      f.rides++;
      const lv = Math.min(10, Math.floor(f.rides / 4));
      if (lv > f.friend) {
        f.friend = lv;
        Sim.emit(S, { type: "toast", icon: rd.icon, text: rd.name + " is now a friend (level " + lv + ")!" + (lv === 2 ? " They might ask you for things now." : ""), inbox: lv === 2 });
        if (r.rider === "GRANDMA" && lv >= 5) Sim.trophy(S, "grandmas_favorite");
      }
      if (R(S) < 0.06 * (tags.includes("tourist") ? 1.5 : 1)) {
        const tier = R(S) < 1 / 40 ? "s" : R(S) < 1 / 8 ? "h" : "c",
          id = r.rider.toLowerCase() + "_" + tier,
          card = D.CARDS[id];
        S.album.cards[id] = (S.album.cards[id] || 0) + 1;
        Sim.emit(S, { type: "toast", icon: "🃏", text: rd.name + " left a rider card: " + card.name + (tier === "h" ? " (holo!)" : tier === "s" ? " (SECRET!)" : "") + ".", inbox: tier !== "c" });
      }
    }
    if (R(S) < 0.05) {
      const p = St.wpick(S, D.LOOT.ride);
      toast(S, "🎁", nameOf(car) + " found something after the ride: " + prize(S, p, car) + ".");
    }
    // the riders walked off and left the doors open
    if (!S.clock.night && R(S) < 0.035 * (tags.includes("tourist") ? 2 : 1)) incident(S, car, "doors", null);
    checkStage(S, car);
  }

  /* ======================================================================================================
     rides: demand, requests and choosing one
     ====================================================================================================== */
  const COMMUTE = ["Financial District", "SoMa", "Embarcadero"];
  Sim.demand = function (S, hood, h) {
    const H = D.HOODS[hood],
      t = H.tags;
    let d = 0.25;
    if (H.rank !== null) d += 0.15;
    if (COMMUTE.includes(hood) && h >= 7 && h < 10) d += 0.5;
    if (t.includes("downtown") && h >= 11 && h < 14) d += 0.35;
    if (t.includes("tourist") && h >= 10 && h < 18) d += 0.32;
    if ((t.includes("park") || t.includes("beach")) && Sim.weekend(S) && h >= 9 && h < 18) d += 0.3;
    if (t.includes("nightlife") && h >= 20) d += 0.45;
    if (h < 7 || h >= 22) d *= 0.7;
    if (!Sim.open(S, hood)) d *= 0.65;
    return d;
  };
  function spawnRequests(S) {
    const h = Sim.hour(S),
      now = absMin(S);
    S.req = S.req.filter((r) => !r.taken && now - r.at < 120);
    for (const hood of G.names) {
      // riders mostly go somewhere nearby
      const H = G.hoods[hood],
        weights = G.names.map((n) => [(Sim.demand(S, n, h) + 0.25) / (1 + Math.hypot(G.hoods[n].x - H.x, G.hoods[n].z - H.z) / 900), n]);
      const d = Sim.demand(S, hood, h);
      let n = Math.floor(d) + (R(S) < d % 1 ? 1 : 0);
      n = Math.min(n, 4 - S.req.filter((r) => r.from === hood).length);
      for (let k = 0; k < n; k++) {
        let to = hood;
        for (let tries = 0; to === hood && tries < 6; tries++) to = St.wpick(S, weights);
        if (to === hood) continue;
        let rider = null;
        const smarts = S.cars.reduce((a, c) => Math.max(a, c.stats.smarts), 0);
        if (R(S) < 0.35 + smarts * 0.01) {
          const w = D.RIDER_KEYS.map((k2) => [D.RIDERS[k2].fav.includes(hood) || D.RIDERS[k2].fav.includes(to) ? 3 : 1, k2]);
          rider = St.wpick(S, w);
        }
        const units = Sim.routeLen(hood, to);
        if (!isFinite(units)) continue;
        S.req.push({ id: ((now * 97 + k) % 1e7) + "_" + hood.length + k, from: hood, to, rider, at: now, km: +Sim.km(units).toFixed(2), units });
      }
    }
  }
  // the charge a trip of so many units costs this car (roughly: it doesn't know the hills ahead)
  function tripCost(S, car, units) {
    const e = Sim.eff(S, car);
    let rate = 7.5 * (1 - Math.min(0.6, e.range * 0.02));
    if (has(car, "speed_demon") && !plus(car)) rate *= 1.2;
    return ((units / speedOf(S, car)) / 60) * rate;
  }
  function findRide(S, car) {
    const here = car.sim.at,
      sulky = car.needs.mood < 20;
    let best = null,
      bs = 0;
    for (const r of S.req) {
      if (r.taken) continue;
      const pick = Sim.routeLen(here, r.from);
      if (pick > 2400) continue;
      if (sulky && r.km > 3) continue;
      const units = pick + r.units;
      if (car.needs.charge - tripCost(S, car, units) < 15) continue;
      const sc = (10 + 2 * r.km) / ((pick * 1.8 + r.units) / 80 + 6);
      if (sc > bs) {
        bs = sc;
        best = r;
      }
    }
    if (!best) return false;
    best.taken = true;
    car.sim.ride = { from: best.from, to: best.to, rider: best.rider, km: best.km };
    if (best.from === here) {
      car.sim.task = "toPickup";
      arrive(S, car);
    } else goTo(S, car, best.from, "toPickup");
    return true;
  }

  /* ======================================================================================================
     needs: per in-game minute (the tables give them per hour)
     ====================================================================================================== */
  function moodTarget(S, car, hood, atHome) {
    const n = car.needs,
      sw = has(car, "neat_freak") ? 2 : 1;
    const base = (Math.min(100, n.charge) * 1.2 + n.shine * sw + n.cozy + n.senses + n.clarity) / (4.2 + sw);
    let t = base * 0.8 + 10 + car.bond * 2;
    for (const k of D.NEED_KEYS) if (n[k] < 20) t -= 6;
    const tags = D.HOODS[hood].tags;
    if (has(car, "hill_hater") && !tags.includes("hills")) t += 4;
    if (has(car, "fog_lover") && (hood === "Ocean Beach" || hood === "Lands End")) t += 10;
    if (has(car, "shy")) {
      if (tags.includes("downtown") && !plus(car)) t -= 10;
      if (D.HOODS[hood].rank === null && !tags.includes("downtown") && !tags.includes("tourist") && !tags.includes("nightlife")) t += 5;
    }
    if (car.likes && car.likes.hood === hood) t += 10;
    if (car.dashpet) t += 5;
    if (car.dashpet && car.dashpet.id === "sea_lion_pup" && hood === "Fisherman's Wharf") t += 10;
    if (atHome)
      for (const f of S.garage.furniture) {
        const it = D.ITEMS[f];
        if (it && it.bonus && it.bonus.mood) t += it.bonus.mood;
      }
    if (car.sim.task === "hang") t += 5;
    if (car.sim.task === "nap") t -= 10;
    return clamp(t, 5, 100);
  }
  function decay(S, car, charging, away) {
    const n = car.needs,
      s = car.sim,
      hood = hoodOf(car),
      tags = D.HOODS[hood].tags,
      moving = !!s.from && s.task !== "tow",
      atHome = !s.from && s.at === Sim.HOME,
      e = Sim.eff(S, car),
      fogHere = S.clock.weather === "fog" && tags.includes("fog"),
      fogSafe = has(car, "fog_lover") || (car.dashpet && car.dashpet.id === "mini_karl");
    let ch = 0,
      sh = 0,
      cz = 0,
      se = 0,
      cl = 0;
    if (moving) {
      let c = tags.includes("hills") ? 9.5 : 6.5;
      if (tags.includes("hills") && has(car, "hill_hater") && !plus(car)) c *= 1.6;
      if (has(car, "speed_demon") && !plus(car)) c *= 1.2;
      c *= 1 - Math.min(0.6, e.range * 0.02);
      ch -= c;
      sh -= tags.includes("beach") ? 5 : 2.5;
      if (S.clock.weather === "drizzle") sh -= 4;
      if (tags.includes("downtown")) cz -= 4.5 * (has(car, "foodie") ? 1.5 : 1) * (car.dashpet && car.dashpet.id === "succulent" ? 0.6 : 1);
      se -= tags.includes("park") ? 4 * (has(car, "bird_magnet") && !plus(car) ? 2 : 1) : 1.6;
      cl -= fogHere && !fogSafe ? 6.5 : 1.6;
      if (fogHere && has(car, "fog_lover") && plus(car)) cl += 4;
    } else if (atHome) {
      ch += charging ? 28 : -1;
      cl += 5;
    } else if (s.task !== "tow") ch -= 0.5;
    if (has(car, "neat_freak") && plus(car)) sh *= 0.5;
    if (n.mood < 20 && cl < 0) cl *= 1.5;
    const k = 1 / 60,
      floor = away ? 25 : 0,
      dec = (key, d) => {
        if (!d) return;
        const v = n[key] + d * k;
        if (d < 0) n[key] = Math.max(v, Math.min(n[key], floor), 0);
        else n[key] = Math.min(v, key === "charge" ? Math.max(100, n[key]) : 100);
      };
    dec("charge", ch);
    dec("shine", sh);
    dec("cozy", cz);
    dec("senses", se);
    dec("clarity", cl);
    // an overcharged car settles back down
    if (n.charge > 100 && !moving) n.charge = Math.max(100, n.charge - 2 * k);
    // mood drifts toward its target at 10 an hour, never below 5
    const tgt = moodTarget(S, car, hood, atHome),
      d = tgt - n.mood;
    n.mood = clamp(n.mood + clamp(d, -10 * k, 10 * k), Math.max(5, away ? Math.min(n.mood, 25) : 5), 100);
    // a need left below 20 for more than two hours costs a little bond (it never goes below 0)
    const low = D.NEED_KEYS.some((q) => n[q] < 20);
    car.low.total += k;
    if (low) {
      car.low.run += 1;
      car.low.hours += k;
      if (car.low.run > 120 && !away) car.bond = Math.max(0, car.bond - 0.05 * k);
    } else car.low.run = 0;
    car.hoodTime[hood] = (car.hoodTime[hood] || 0) + 1;
  }

  /* ======================================================================================================
     the step: one in-game minute
     ====================================================================================================== */
  function newToday(S) {
    S.today = { day: S.clock.day, fares: 0, rides: {}, km: {}, lines: [] };
  }
  let AWAY = false; // the time-away catch-up is running (needs stay at 25 or more)
  function step(S, away) {
    const c = S.clock;
    AWAY = away;
    if (!S.today || S.today.day !== c.day) newToday(S);
    if (c.night) {
      for (const car of S.cars) nightCar(S, car);
      if (!c.sleepReady && S.cars.every((car) => ["garage", "school"].includes(car.sim.task))) {
        c.sleepReady = true;
        if (!away) Sim.emit(S, { type: "sleepReady" });
      }
      if (away && c.sleepReady) Sim.sleep(S, true);
      if (away && !c.sleepReady && ++c.nightT > 300) Sim.sleep(S, true);
      return;
    }
    const prevH = Math.floor(c.minute / 60);
    c.minute++;
    if (Math.floor(c.minute / 60) !== prevH && c.minute < 1440) hourly(S, away);
    else if (c.minute % 20 === 0 && c.minute < 1440) spawnRequests(S);
    // the charger bays go to the cars at home that need them most
    const home = S.cars.filter((car) => !car.sim.from && car.sim.at === Sim.HOME).sort((a, b) => a.needs.charge - b.needs.charge);
    const charging = new Set(home.filter((car) => car.needs.charge < 100).slice(0, S.garage.bays));
    for (const car of S.cars) {
      decay(S, car, charging.has(car), away);
      carMinute(S, car, away);
    }
    if (c.minute >= 1440) startNight(S, away);
  }
  function carMinute(S, car, away) {
    const s = car.sim,
      n = car.needs;
    if (s.from) {
      if (n.charge <= 0 && s.task !== "tow") {
        // out of charge: a nap at the kerb, then the free (slow) tow van
        n.charge = 0;
        if (s.ride && s.task === "ride") {
          s.ride.half = true;
          const r = s.ride;
          finishRideHalf(S, car, r);
        }
        s.task = "nap";
        s.napT = 60;
        s.emote = { k: "z", at: absMin(S) };
        Sim.emit(S, { type: "nap", carId: car.id, icon: "💤", text: nameOf(car) + " ran out of charge and is napping at the kerb. A tow van is on its way.", inbox: true, diary: true });
        return;
      }
      if (s.task === "nap") return;
      move(S, car, 1);
      return;
    }
    s.wait = (s.wait || 0) + 1;
    switch (s.task) {
      case "nap":
        if (n.charge > 10) {
          s.task = "idle";
          toast(S, "⚡", nameOf(car) + " woke up from its nap.");
        } else if (--s.napT <= 0) {
          s.task = "tow";
          if (!goTo(S, car, Sim.HOME, "tow")) s.task = "garage";
        }
        return;
      case "stuck":
        if (--s.stuckT <= 0) {
          toast(S, "🙂", "A kind passer-by helped " + nameOf(car) + " get going again.");
          Sim.clearIncident(S, car);
        }
        return;
      case "school":
      case "care":
        if (s.task === "care" && ++s.careT > 240) s.task = "idle";
        return;
      case "hang":
        if (s.wait >= 10 && s.wait % 2 === 0 && findRide(S, car)) return;
        if (--s.hangT <= 0) s.task = "idle";
        return;
      case "garage":
        if (car.training) return;
        if (s.wait % 2 === 0) {
          const freeBay = S.garage.bays > S.cars.filter((c2) => c2 !== car && Sim.atHome(c2) && c2.needs.charge < 100).length;
          if (n.charge >= (freeBay ? 70 : 50) && findRide(S, car)) return;
        }
        return;
      case "idle":
      default:
        if (car.training) return;
        if (n.charge < 22) {
          goTo(S, car, Sim.HOME, "home");
          return;
        }
        if ((s.wait === 1 || s.wait % 2 === 0) && findRide(S, car)) return;
        if (s.wait > 80 && n.charge < 55) goTo(S, car, Sim.HOME, "home");
    }
  }
  function finishRideHalf(S, car, r) {
    // the rider finishes on foot; half the fare
    car.sim.ride = null;
    const f = Math.round((10 + 2 * r.km) * 0.5);
    fares(S, f);
    car.rides++;
  }
  function nightCar(S, car) {
    const s = car.sim;
    if (car.training && !s.from) return;
    if (s.task === "stuck") Sim.clearIncident(S, car);
    if (s.task === "nap") {
      s.task = "tow";
      if (!goTo(S, car, Sim.HOME, "tow")) s.task = "garage";
    }
    if (s.from) {
      move(S, car, 4);
      return;
    }
    if (s.task === "ride" && s.ride) return finishRide(S, car);
    if (s.task !== "garage" && s.task !== "school") {
      if (!goTo(S, car, Sim.HOME, "home")) s.task = "garage";
    }
  }
  function startNight(S, away) {
    const c = S.clock;
    c.minute = 1440;
    c.night = true;
    c.sleepReady = false;
    c.nightT = 0;
    for (const car of S.cars) {
      const s = car.sim;
      if (s.task === "toPickup" && s.ride) {
        s.ride = null;
        s.task = "idle";
      }
      if (["idle", "hang", "care", "toHang", "toCare"].includes(s.task) && !car.training) goTo(S, car, Sim.HOME, "home");
    }
    S.req = [];
    if (!away) Sim.emit(S, { type: "night", icon: "🌙", text: "Midnight! The fleet is driving home." });
  }
  // go to sleep: write the diary, then the next morning
  // lines: the diary already shown to the player (Sim.diary), so it's the same one that gets kept
  Sim.sleep = function (S, away, lines) {
    const c = S.clock;
    if (!c.night) return false;
    const entry = { day: c.day, lines: lines || diaryLines(S) };
    S.diary.unshift(entry);
    if (S.diary.length > 30) S.diary.length = 30;
    // overnight in the garage: the bays, the auto-wash, the auto-vac and the nap pods
    const home = S.cars.filter((car) => Sim.atHome(car)).sort((a, b) => a.needs.charge - b.needs.charge);
    home.forEach((car, i) => {
      const n = car.needs;
      n.charge = Math.min(Math.max(100, n.charge), n.charge + (i < S.garage.bays ? 90 : 25));
      n.shine = Math.min(100, n.shine + 20 * S.garage.wash);
      n.cozy = Math.min(100, n.cozy + 20 * S.garage.vac);
      n.clarity = Math.min(100, n.clarity + 20 * S.garage.pods + 10);
      n.mood = Math.min(100, n.mood + 8);
      car.sim.task = car.training ? car.sim.task : "garage";
    });
    if (c.weather === "fog") {
      S.counts.fogDays++;
      if (S.counts.fogDays >= 5) Sim.trophy(S, "survived_karl");
    }
    c.day++;
    c.minute = 360;
    c.night = false;
    c.sleepReady = false;
    c.weather = rollWeather(S);
    S.req = [];
    newToday(S);
    spawnRequests(S);
    if (S.quests.karl && S.quests.karl.by < absMin(S)) S.quests.karl = null;
    if (!away) Sim.emit(S, { type: "morning", icon: c.weather === "fog" ? "🌫️" : "☀️", text: "Day " + c.day + ". " + (c.weather === "fog" ? "Karl the Fog is out on the west side." : c.weather === "drizzle" ? "A grey drizzle. The cars will need a wash." : "Clear skies over the city.") });
    return entry;
  };
  Sim.diary = (S) => diaryLines(S);
  function rollWeather(S) {
    const m = new Date(Sim.now()).getMonth(),
      fogP = m >= 5 && m <= 8 ? 0.5 : 0.3,
      rainP = m >= 10 || m <= 2 ? 0.15 : 0.03,
      x = R(S);
    return x < fogP ? "fog" : x < fogP + rainP ? "drizzle" : "clear";
  }
  function diaryLines(S) {
    const T = S.today || { fares: 0, rides: {}, km: {}, lines: [] },
      out = [fill(St.pick(S, D.DIARY.open), null, { day: S.clock.day })];
    let best = null,
      bf = -1;
    for (const car of S.cars) {
      const rides = T.rides[car.id] || 0,
        km = (T.km[car.id] || 0).toFixed(1);
      out.push(fill(D.DIARY.km, car, { km, rides }));
      if (rides > bf) {
        bf = rides;
        best = car;
      }
    }
    if (best && S.cars.length > 1 && bf > 0) out.push(fill(D.DIARY.best, best));
    let worst = null;
    for (const car of S.cars) {
      const w = Sim.worst(car);
      if (w.v < 35 && (!worst || w.v < worst.v)) worst = { car, need: w.need, v: w.v };
    }
    if (worst) out.push(fill(D.DIARY.low, worst.car, { need: D.NEEDS[worst.need].name, label: Sim.label(worst.need, worst.v) }));
    else if (S.cars.length) out.push(St.pick(S, D.DIARY.good));
    out.push(fill(D.DIARY.fares, null, { fares: T.fares }));
    for (const l of T.lines.slice(-6)) out.push(l);
    out.push(St.pick(S, D.DIARY.close));
    return out;
  }

  /* ======================================================================================================
     every in-game hour: requests, random events, quests, the market
     ====================================================================================================== */
  function hourly(S, away) {
    spawnRequests(S);
    for (const car of S.cars) if (!car.training && R(S) < 0.08) randomEvent(S, car, away);
    riderRequests(S);
    karlQuest(S);
    stocksTick(S);
    auctionTick(S);
    const ra = S.quests.rally;
    if (ra && ra.day !== S.clock.day) S.quests.rally = null;
  }
  function randomEvent(S, car, away) {
    const hood = hoodOf(car),
      tags = D.HOODS[hood].tags,
      fog = S.clock.weather === "fog" && tags.includes("fog");
    const tone = away ? (R(S) < 0.8 ? "good" : "funny") : St.wpick(S, [
      [70, "good"],
      [20, "funny"],
      [10, "bad"],
    ]);
    const ok = (e) => !e.when || (e.when === "fog" ? fog : tags.includes(e.when));
    const pool = D.EVENTS.filter((e) => e.tone === tone && ok(e)).map((e) => [(e.rare || 1) * (e.id === "pigeon_home" && tags.includes("park") ? 3 : 1), e]);
    if (!pool.length) return;
    applyEvent(S, car, St.wpick(S, pool), away);
  }
  // what a random event does to a car (also the debug hook's way in)
  Sim.forceEvent = (S, car, id) => applyEvent(S, car, D.EVENTS.find((e) => e.id === id), false);
  function applyEvent(S, car, ev, away) {
    if (!ev) return;
    const fx = ev.fx,
      n = car.needs;
    if (ev.id === "pigeon_home" && car.dashpet && car.dashpet.id === "pigeon_pal" && R(S) < 0.5) return;
    let num = 0;
    for (const k of D.NEED_KEYS.concat(["mood"]))
      if (fx[k]) {
        const v = fx[k] < 0 && has(car, "bird_magnet") && k === "mood" ? 0 : fx[k];
        n[k] = clamp(n[k] + v, k === "mood" ? 5 : away ? Math.min(n[k], 25) : 0, k === "charge" ? Math.max(100, n[k]) : 100);
      }
    if (fx.fares) {
      num = St.ri(S, fx.fares[0], fx.fares[1]);
      if (num < 0) num = -Math.min(-num, S.player.fares);
      fares(S, num);
      num = Math.abs(num);
    }
    if (fx.item) Sim.give(S, fx.item);
    if (fx.stat) car.stats[fx.stat]++;
    if (fx.bond) car.bond = Math.min(10, car.bond + fx.bond);
    let extra = "";
    if (fx.petChance && !car.dashpet && R(S) < 0.2) {
      Sim.give(S, "pet_" + fx.petChance);
      extra = " It left behind some adoption papers. Pigeon Pal wants to be friends!";
    }
    car.sim.emote = { k: ev.tone === "bad" ? "☁" : ev.tone === "funny" ? "!" : "♥", at: absMin(S) };
    Sim.emit(S, { type: "event", tone: ev.tone, icon: ev.icon, carId: car.id, text: fill(ev.text, car, { n: num }) + extra, diary: true, inbox: ev.tone !== "funny" });
  }
  function riderRequests(S) {
    const now = absMin(S);
    for (const r of D.RIDER_KEYS) {
      const f = S.riders[r];
      if (!f) continue;
      if (f.request && f.request.by < now) {
        Sim.emit(S, { type: "toast", icon: D.RIDERS[r].icon, text: D.RIDERS[r].name + " found a " + D.ITEMS[f.request.item].name + " somewhere else. No hard feelings!" });
        f.request = null;
      }
      if (f.friend >= 2 && !f.request && R(S) < 0.04) {
        const item = St.pick(S, D.RIDER_ASKS[r]),
          by = now + 18 * 60;
        f.request = { item, by };
        Sim.emit(S, { type: "request", icon: D.RIDERS[r].icon, rider: r, text: D.RIDERS[r].name + ": “" + D.ASK_LINES[r].replace("{item}", D.ITEMS[item].name).replace("{when}", Sim.fmtWhen(by)) + "”", inbox: true });
      }
    }
  }
  // deliver what a rider asked for; the car that brings it might learn something
  Sim.deliver = function (S, rider, carId) {
    const f = S.riders[rider],
      car = Sim.find(S, carId);
    if (!f || !f.request || !car) return { ok: false, msg: "Nothing to deliver." };
    const it = D.ITEMS[f.request.item];
    if (!Sim.take(S, it.id)) return { ok: false, msg: "You don't have a " + it.name + " yet." };
    const pay = Math.round(it.price * 1.5 + 60);
    fares(S, pay);
    f.request = null;
    f.rides += 4;
    f.friend = Math.min(10, Math.floor(f.rides / 4));
    car.bond = Math.min(10, car.bond + 0.2);
    let msg = D.RIDERS[rider].name + " is delighted! ◎" + pay + ".";
    if (R(S) < 0.35) {
      const st = St.pick(S, D.STAT_KEYS);
      car.stats[st]++;
      msg += " " + nameOf(car) + " gained +1 " + D.STATS[st].name + "!";
    }
    Sim.xp(S, 50);
    Sim.emit(S, { type: "toast", icon: D.RIDERS[rider].icon, text: msg, diary: true });
    return { ok: true, msg };
  };
  function karlQuest(S) {
    if (S.clock.weather !== "fog" || S.quests.karl || !Sim.open(S, "Ocean Beach") || R(S) > 0.06) return;
    const item = St.pick(S, D.KARL_ASKS),
      by = absMin(S) + 6 * 60;
    S.quests.karl = { item, by, reward: St.pick(S, D.KARL_REWARDS) };
    Sim.emit(S, { type: "karl", icon: "🌫️", text: "Karl the Fog drifts in, cold and curious: “Bring me a " + D.ITEMS[item].name + " before " + Sim.fmtClock(by % 1440) + "… and I'll make it worth your while.”", inbox: true });
  }
  Sim.karlDeliver = function (S, carId) {
    const q = S.quests.karl,
      car = Sim.find(S, carId);
    if (!q || !car) return { ok: false, msg: "Karl isn't asking for anything." };
    if (q.by < absMin(S)) {
      S.quests.karl = null;
      return { ok: false, msg: "Karl has drifted away." };
    }
    if (!Sim.take(S, q.item)) return { ok: false, msg: "You need a " + D.ITEMS[q.item].name + "." };
    S.quests.karl = null;
    const r = q.reward;
    let msg = "Karl swirls happily. ";
    if (r.stat) {
      const st = St.pick(S, D.STAT_KEYS);
      car.stats[st] += r.stat;
      msg += nameOf(car) + " gained +" + r.stat + " " + D.STATS[st].name + "!";
    } else if (r.dashpet) {
      Sim.give(S, "pet_" + r.dashpet);
      msg += "He leaves a tiny cloud behind: Mini Karl adoption papers!";
    } else msg += "He leaves behind " + prize(S, { item: r.wrap || r.item }) + ".";
    Sim.xp(S, 80);
    Sim.emit(S, { type: "toast", icon: "🌫️", text: msg, inbox: true, diary: true });
    return { ok: true, msg };
  };

  /* ======================================================================================================
     the real calendar: dailies reset, training, the lot, the show, ages, stages
     ====================================================================================================== */
  Sim.today = () => St.today(Sim.now());
  Sim.realTick = function (S) {
    const now = Sim.now(),
      date = St.today(now);
    if (S.dailies.date !== date) {
      const first = !S.dailies.date;
      S.dailies = { date, done: {}, gamePlays: {}, fish: 0, run: false, derby: 0 };
      // a dashpet sometimes picks up a tiny hanger-on of its own (purely for show)
      if (!first)
        for (const car of S.cars)
          if (car.dashpet && !car.dashpet.mite && R(S) < 0.12) {
            car.dashpet.mite = St.pick(S, Object.keys(D.MITES));
            Sim.emit(S, { type: "toast", carId: car.id, icon: D.MITES[car.dashpet.mite].icon, text: "A " + D.MITES[car.dashpet.mite].name + " has moved in with " + car.dashpet.name + ". They seem happy together." });
          }
      S.lot = null;
      S.quests.riddle = null;
      if (S.auction.date !== date) S.auction = { date, lots: [] };
    }
    for (const car of S.cars.concat(S.stored)) {
      if (car.training && now >= car.training.endsAt) finishTraining(S, car);
      // the Sourdough Starter grows into a loaf over 30 days
      if (car.dashpet && car.dashpet.id === "starter" && St.daysBetween(car.dashpet.since, date) >= 30) {
        car.dashpet.since = date;
        Sim.give(S, "rare_starter_loaf");
        Sim.emit(S, { type: "toast", icon: "🍞", text: nameOf(car) + "'s Sourdough Starter grew into a whole Mother Loaf!", inbox: true });
      }
      checkStage(S, car);
    }
    showWeek(S, now);
    syncUnlocks(S);
  };
  Sim.age = (car) => (car.born ? St.daysBetween(car.born, Sim.today()) : 0);
  function checkStage(S, car) {
    const i = D.STAGES.findIndex((s) => s.id === car.stage),
      next = D.STAGES[i + 1];
    if (!next) return;
    const q = next.need;
    if (!((Sim.age(car) >= q.age || car.km >= q.km) && car.bond >= q.bond && Sim.level(car) >= q.level)) return;
    car.stage = next.id;
    car.title = titleFor(car);
    Sim.emit(S, { type: "stage", carId: car.id, icon: next.badge, text: nameOf(car) + " grew up into a " + next.name + "! Title: " + car.title + ".", inbox: true, diary: true });
    if (next.id === "legend") Sim.trophy(S, "legend");
  }
  Sim.checkStage = checkStage;
  // the title depends on where it spent the most time and how well it was looked after
  function titleFor(car) {
    let top = Sim.HOME,
      tv = -1;
    for (const [h, v] of Object.entries(car.hoodTime))
      if (v > tv && D.HOODS[h]) {
        tv = v;
        top = h;
      }
    const t = D.HOODS[top].title,
      care = car.low.total ? car.low.hours / car.low.total : 0;
    return (care > 0.12 ? "Scrappy " : care < 0.02 ? "Pampered " : "") + t;
  }

  /* ======================================================================================================
     caring: hands-on, items, pats
     ====================================================================================================== */
  const JOB_NEED = { charge: "charge", dirty: "shine", vacuum: "cozy", birds: "senses", reboot: "clarity" };
  Sim.JOB_NEED = JOB_NEED;
  Sim.NEED_JOB = { charge: "charge", shine: "dirty", cozy: "vacuum", senses: "birds", clarity: "reboot" };
  Sim.careDone = function (S, carId, kind, q) {
    const car = Sim.find(S, carId);
    if (!car) return null;
    const need = JOB_NEED[kind];
    if (need) car.needs[need] = need === "charge" ? Math.max(100, car.needs.charge) : 100;
    else Sim.clearIncident(S, car);
    const b = 0.3 + (q === 2 ? 0.2 : 0);
    car.bond = Math.min(10, car.bond + b);
    car.needs.mood = Math.min(100, car.needs.mood + 6);
    if (car.sim.task === "nap" && car.needs.charge > 10) car.sim.task = "idle";
    if (car.sim.task === "care") car.sim.task = car.sim.at === Sim.HOME ? "garage" : "idle";
    car.sim.emote = { k: "♥", at: absMin(S) };
    Sim.xp(S, 25 + (q === 2 ? 10 : 0));
    if (kind === "birds" && ++S.counts.birds >= 10) Sim.trophy(S, "pigeon_whisperer");
    storyHook(S, { job: kind });
    if (S.today) S.today.lines.push("You gave " + nameOf(car) + " a hands-on " + { charge: "recharge", dirty: "wash", vacuum: "vacuum", birds: "bird-shooing", reboot: "reboot", doors: "door patrol", cone: "cone toss" }[kind] + ".");
    checkStage(S, car);
    return { bond: b, need };
  };
  Sim.useItem = function (S, carId, itemId) {
    const it = D.ITEMS[itemId],
      car = Sim.find(S, carId);
    if (!it || !Sim.has(S, itemId)) return { ok: false, msg: "You don't have that." };
    if (it.cat === "wrap") return Sim.applyWrap(S, carId, itemId);
    if (it.cat === "gear") return Sim.equip(S, carId, itemId);
    if (it.cat === "dashpet") return Sim.adoptDashpet(S, carId, itemId);
    if (it.cat === "song") return Sim.playSong(S, carId, itemId);
    if (it.cat === "furniture") return Sim.placeFurniture(S, itemId);
    if (!car) return { ok: false, msg: "Pick a car." };
    if (it.cat === "read") {
      if (car.read.includes(itemId)) return { ok: false, msg: nameOf(car) + " has already read that one." };
      Sim.take(S, itemId);
      car.read.push(itemId);
      car.stats.smarts += it.smarts;
      car.needs.mood = Math.min(100, car.needs.mood + 3);
      Sim.xp(S, 8);
      if (car.read.length >= 10) Sim.trophy(S, "bookworm");
      return { ok: true, msg: nameOf(car) + " read " + it.name + ". +" + it.smarts + " Smarts!" };
    }
    if (!it.effect) return { ok: false, msg: it.cat === "chip" ? "Firmware chips are for the Driving Academy on Twin Peaks." : "That's a treasure: keep it, or sell it at the Pawn Shop." };
    Sim.take(S, itemId);
    const n = car.needs;
    for (const [k, v] of Object.entries(it.effect)) {
      if (k === "charge") n.charge = clamp(n.charge + v, 0, it.over ? 120 : Math.max(100, n.charge));
      else n[k] = clamp(n[k] + v, k === "mood" ? 5 : 0, 100);
    }
    let b = 0.05,
      msg = nameOf(car) + " enjoyed the " + it.name + ".";
    if (car.likes && car.likes.item === itemId) {
      b += 0.5;
      msg = nameOf(car) + " LOVES the " + it.name + "! It's its favourite!";
    }
    if (it.pet && car.dashpet) {
      b += 0.1;
      msg = car.dashpet.name + " gobbled the " + it.name + ".";
    }
    if (n.charge > 100) msg += " It's overcharged and a little bloated.";
    car.bond = Math.min(10, car.bond + b);
    car.sim.emote = { k: "♥", at: absMin(S) };
    if (car.sim.task === "nap" && n.charge > 10) {
      car.sim.task = "idle";
      msg += " It woke up from its nap!";
    }
    Sim.xp(S, 4);
    return { ok: true, msg };
  };
  Sim.pat = function (S, carId) {
    const car = Sim.find(S, carId),
      h = hourIdx(S);
    if (!car) return { ok: false };
    if (car.patAt === h) return { ok: false, msg: nameOf(car) + " is still happy from the last pat." };
    car.patAt = h;
    car.bond = Math.min(10, car.bond + (has(car, "chatty") ? 0.15 : 0.1));
    car.needs.mood = Math.min(100, car.needs.mood + 4);
    car.sim.emote = { k: "♥", at: absMin(S) };
    Sim.xp(S, 1);
    return { ok: true, msg: nameOf(car) + (has(car, "chatty") ? " beeps a whole happy song." : " beeps happily.") };
  };
  Sim.playSong = function (S, carId, itemId) {
    const car = Sim.find(S, carId),
      it = D.ITEMS[itemId];
    if (!car || !Sim.has(S, itemId)) return { ok: false, msg: "Pick a car." };
    if (!car.heard.includes(itemId)) car.heard.push(itemId);
    (S.album.playlist[itemId] = S.album.playlist[itemId] || []).includes(car.id) || S.album.playlist[itemId].push(car.id);
    const h = hourIdx(S);
    let mood = car.songAt === h ? 0 : 5;
    if (car.likes && car.likes.song === itemId) mood += 10;
    car.songAt = h;
    car.needs.mood = Math.min(100, car.needs.mood + mood);
    car.sim.emote = { k: "♪", at: absMin(S) };
    return { ok: true, msg: nameOf(car) + " is listening to " + it.name + (car.likes && car.likes.song === itemId ? ". Its favourite song!" : ".") };
  };
  // where to send a car for hands-on care: the nearest Care Spot by road
  Sim.nearestCare = function (car) {
    const s = car.sim,
      start = s.from ? s.to : s.at;
    let best = null,
      bd = Infinity;
    for (const h of Object.keys(Sim.CARE)) {
      const d = Sim.routeLen(start, h);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  };
  // the player's orders: a Care Spot, a neighbourhood to hang out in, home
  function order(S, carId, dest, task) {
    const car = Sim.find(S, carId);
    if (!car || !S.cars.includes(car)) return { ok: false, msg: "That car isn't on the map." };
    if (car.training) return { ok: false, msg: nameOf(car) + " is at the Driving Academy until its course ends." };
    if (S.clock.night) return { ok: false, msg: "It's night. Everybody's going home." };
    const s = car.sim;
    if (["toPickup", "ride", "stuck", "nap", "tow"].includes(s.task)) return { ok: false, msg: nameOf(car) + " is busy: " + Sim.doing(car).toLowerCase() + "." };
    if (!dest) return { ok: false, msg: "Nowhere to go." };
    goTo(S, car, dest, task);
    return { ok: true, msg: nameOf(car) + " is on its way to " + dest + "." };
  }
  Sim.callToCare = (S, carId) => {
    const car = Sim.find(S, carId);
    if (car && Sim.careSpot(car)) {
      car.sim.task = "care";
      car.sim.careT = 0;
      return { ok: true, msg: nameOf(car) + " is already at a Care Spot." };
    }
    return order(S, carId, car && Sim.nearestCare(car), "toCare");
  };
  // send a car to a particular Care Spot
  Sim.callTo = (S, carId, hood) => {
    const car = Sim.find(S, carId);
    if (car && !car.sim.from && car.sim.at === hood) {
      car.sim.task = "care";
      car.sim.careT = 0;
      return { ok: true, msg: nameOf(car) + " is already here." };
    }
    return order(S, carId, hood, "toCare");
  };
  Sim.sendTo = (S, carId, hood) => order(S, carId, hood, hood === Sim.HOME ? "home" : "toHang");
  Sim.goHome = (S, carId) => order(S, carId, Sim.HOME, "home");
  // roadside help: an incident fixed for a few Fares (less bond than doing it yourself)
  Sim.roadside = function (S, carId) {
    const car = Sim.find(S, carId);
    if (!car || car.sim.task !== "stuck") return { ok: false };
    if (S.player.fares < 25) return { ok: false, msg: "Roadside help costs ◎25." };
    fares(S, -25);
    Sim.clearIncident(S, car);
    return { ok: true, msg: "Roadside help sorted " + nameOf(car) + " out. ◎25." };
  };

  /* ======================================================================================================
     looks: wraps, gear, dashpets, nicknames
     ====================================================================================================== */
  Sim.applyWrap = function (S, carId, itemId) {
    const car = Sim.find(S, carId),
      it = D.ITEMS[itemId];
    if (!car) return { ok: false, msg: "Pick a car to paint." };
    if (!Sim.take(S, itemId)) return { ok: false, msg: "You don't have that wrap." };
    car.wrap = it.wrap;
    if (!S.album.wraps.includes(it.wrap)) S.album.wraps.push(it.wrap);
    car.needs.mood = Math.min(100, car.needs.mood + 10);
    Sim.xp(S, 20);
    return { ok: true, msg: nameOf(car) + " is now painted " + D.WRAPS[it.wrap].name + "!", look: true };
  };
  Sim.slots = (car) => D.STAGES.find((s) => s.id === car.stage).slots;
  Sim.equip = function (S, carId, itemId) {
    const car = Sim.find(S, carId),
      it = D.ITEMS[itemId];
    if (!car) return { ok: false, msg: "Pick a car." };
    if (!Sim.slots(car).includes(it.slot)) return { ok: false, msg: nameOf(car) + " unlocks the " + D.SLOTS[it.slot] + " slot when it grows up." };
    if (it.slot === "horn" && car.bond < 4) return { ok: false, msg: "Custom horns unlock at 4 hearts." };
    if (!Sim.take(S, itemId)) return { ok: false, msg: "You don't have that." };
    if (car.gear[it.slot]) Sim.give(S, car.gear[it.slot]);
    car.gear[it.slot] = itemId;
    car.needs.mood = Math.min(100, car.needs.mood + 4);
    return { ok: true, msg: nameOf(car) + " is wearing the " + it.name + ".", look: true };
  };
  Sim.unequip = function (S, carId, slot) {
    const car = Sim.find(S, carId);
    if (!car || !car.gear[slot]) return { ok: false };
    Sim.give(S, car.gear[slot]);
    car.gear[slot] = null;
    return { ok: true, msg: "Took it off.", look: true };
  };
  Sim.adoptDashpet = function (S, carId, itemId) {
    const car = Sim.find(S, carId),
      it = D.ITEMS[itemId];
    if (!car) return { ok: false, msg: "Pick a car." };
    if (!Sim.take(S, itemId)) return { ok: false, msg: "You don't have those papers." };
    const p = D.DASHPETS[it.dashpet],
      old = car.dashpet;
    car.dashpet = { id: it.dashpet, name: p.name, since: Sim.today(), mite: null };
    if (!S.album.dashpets.includes(it.dashpet)) S.album.dashpets.push(it.dashpet);
    car.needs.mood = Math.min(100, car.needs.mood + 15);
    Sim.xp(S, 30);
    return { ok: true, msg: p.name + " hopped onto " + nameOf(car) + "'s roof!" + (old ? " (" + old.name + " went to live at the Paddock with the bison.)" : ""), look: true };
  };
  Sim.nickname = function (S, carId, nick) {
    const car = Sim.find(S, carId);
    if (!car || car.bond < 2) return { ok: false, msg: "Nicknames unlock at 2 hearts." };
    nick = String(nick || "")
      .trim()
      .slice(0, 16);
    car.nick = nick || null;
    return { ok: true, msg: nick ? "From now on, " + car.name + " answers to " + nick + "." : "Nickname cleared." };
  };

  /* ======================================================================================================
     the garage
     ====================================================================================================== */
  Sim.upgradeCost = (S, key) => {
    const g = D.GARAGE[key],
      lv = S.garage[key];
    // the bays start at one, so their table is indexed by the bay being bought
    if (key === "bays") return lv >= g.max ? null : g.cost[lv];
    return lv >= g.max ? null : g.cost[lv + 1];
  };
  Sim.upgrade = function (S, key) {
    const g = D.GARAGE[key],
      cost = Sim.upgradeCost(S, key);
    if (!g || cost === null || cost === undefined) return { ok: false, msg: "That's fully upgraded." };
    if (S.player.fares < cost) return { ok: false, msg: "You need ◎" + cost.toLocaleString("en-US") + "." };
    fares(S, -cost);
    S.garage[key]++;
    Sim.xp(S, 25);
    return { ok: true, msg: g.name + " upgraded!" };
  };
  Sim.roomSlots = (S) => D.ROOMS[S.garage.rooms] || 2;
  Sim.placeFurniture = function (S, itemId) {
    if (S.garage.furniture.length >= Sim.roomSlots(S)) return { ok: false, msg: "No room left. Upgrade the garage's rooms, or put something away." };
    if (!Sim.take(S, itemId)) return { ok: false, msg: "You don't have that." };
    S.garage.furniture.push(itemId);
    return { ok: true, msg: D.ITEMS[itemId].name + " is in the garage now." };
  };
  Sim.removeFurniture = function (S, i) {
    const id = S.garage.furniture[i];
    if (!id) return { ok: false };
    S.garage.furniture.splice(i, 1);
    Sim.give(S, id);
    return { ok: true, msg: "Put it away." };
  };

  /* ======================================================================================================
     shops and haggling
     ====================================================================================================== */
  Sim.season = function (now) {
    const d = new Date(now || Sim.now()),
      md = String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return D.SEASONS.filter((s) => md >= s.from && md <= s.to);
  };
  const seasonOn = (id) => Sim.season().some((s) => s.id === id);
  Sim.seasonOn = seasonOn;
  Sim.shop = function (S, id) {
    const sh = D.SHOPS[id],
      h = hourIdx(S);
    let st = S.shops[id];
    if (st && st.h === h) return st;
    st = S.shops[id] = { h, stock: [] };
    let pool = sh.pool.filter((i) => D.ITEMS[i] && (!D.ITEMS[i].season || seasonOn(D.ITEMS[i].season)));
    // the thrift shop also turns up retired seasonal things
    if (sh.random) pool = pool.concat(Object.keys(D.ITEMS).filter((i) => D.ITEMS[i].season && !seasonOn(D.ITEMS[i].season) && (D.ITEMS[i].cat === "gear" || D.ITEMS[i].cat === "wrap") && R(S) < 0.15));
    for (const id2 of St.shuffle(S, pool)) {
      if (st.stock.length >= sh.size) break;
      const it = D.ITEMS[id2];
      if (it.rarity >= 100) continue;
      const p = it.rarity >= 90 ? 0.08 : 1 - it.rarity / 130;
      if (R(S) > p) continue;
      st.stock.push({ item: id2, qty: it.rarity > 60 ? 1 : St.ri(S, 1, 4), price: Math.max(5, Math.round(it.price * (0.85 + R(S) * 0.35))), tries: 0, mad: false });
    }
    return st;
  };
  // offer a price: accepted, countered, or an insulted shopkeeper
  Sim.buy = function (S, shopId, idx, offer) {
    const st = Sim.shop(S, shopId),
      e = st.stock[idx],
      keeper = D.SHOPS[shopId].keeper;
    if (!e || e.qty <= 0) return { ok: false, msg: "Sold out!" };
    offer = Math.round(offer === undefined ? e.price : offer);
    if (e.mad && offer < e.price) return { ok: false, msg: keeper + " glares. “Full price. ◎" + e.price + ". Take it or leave it.”" };
    let pay = 0;
    if (offer >= e.price) pay = e.price;
    else if (offer < e.price * 0.55) {
      e.mad = true;
      return { ok: false, mad: true, msg: keeper + ": “I'm insulted! Get out of my shop!” (They'll only take full price now.)" };
    } else if (R(S) < (offer / e.price - 0.75) / 0.2) pay = offer;
    else if (e.tries >= 3) {
      e.mad = true;
      return { ok: false, msg: keeper + ": “That's my final price. ◎" + e.price + ".”" };
    } else {
      e.tries++;
      e.price = Math.round((offer + e.price) / 2);
      return { ok: false, counter: e.price, msg: keeper + ": “How about ◎" + e.price + "?”" };
    }
    if (S.player.fares < pay) return { ok: false, msg: "You need ◎" + pay + "." };
    if (Sim.invCount(S) >= Sim.invCap(S)) return { ok: false, msg: "Your snack fridge is full! Sell or use something first." };
    fares(S, -pay);
    e.qty--;
    Sim.give(S, e.item);
    Sim.xp(S, 2);
    const it = D.ITEMS[e.item];
    return { ok: true, paid: pay, msg: (pay < e.price ? keeper + ": “Fine, fine. Deal.” " : "") + "You bought " + it.icon + " " + it.name + " for ◎" + pay + "." };
  };
  // the season's stall: limited items at a fixed price, only while the event lasts
  Sim.buySeason = function (S, itemId) {
    const it = D.ITEMS[itemId];
    if (!it || !it.season || !seasonOn(it.season)) return { ok: false, msg: "That's not on sale any more." };
    if (S.player.fares < it.price) return { ok: false, msg: "You need ◎" + it.price + "." };
    if (Sim.invCount(S) >= Sim.invCap(S)) return { ok: false, msg: "Your snack fridge is full!" };
    fares(S, -it.price);
    Sim.give(S, itemId);
    return { ok: true, msg: "You bought " + it.icon + " " + it.name + "." };
  };
  Sim.sell = function (S, itemId, n) {
    n = n || 1;
    const it = D.ITEMS[itemId];
    if (!it || !Sim.take(S, itemId, n)) return { ok: false };
    const f = Math.floor(it.price * 0.5) * n;
    fares(S, f);
    return { ok: true, msg: "The Pawn Shop gave you ◎" + f + " for " + (n > 1 ? n + "× " : "") + it.name + "." };
  };

  /* ======================================================================================================
     the dailies
     ====================================================================================================== */
  Sim.dailyState = function (S, id) {
    const d = D.DAILIES[id],
      hood = Object.keys(D.HOODS).find((h) => D.HOODS[h].daily === id);
    if (!Sim.open(S, hood)) return { open: false, why: "Unlocks at Crew Rank " + D.HOODS[hood].rank };
    if (d.rank && S.player.rank < d.rank) return { open: false, why: "Unlocks at Crew Rank " + d.rank };
    if (S.dailies.done[id]) return { open: false, done: true, why: "Come back tomorrow" };
    return { open: true };
  };
  const WHEEL_W = [18, 14, 12, 10, 8, 10, 6, 3];
  const WHEEL_P = [{ fares: 50 }, { item: "snack_capacitor" }, { fares: 150 }, { item: "toy_squeaky_cone" }, { item: "chip_lombard" }, { text: "The wheel stopped on a pothole. Nothing! But a lovely spin." }, { item: "wax_surf" }, { fares: 600 }];
  Sim.claimDaily = function (S, id, opt) {
    opt = opt || {};
    const st = Sim.dailyState(S, id);
    if (!st.open) return { ok: false, msg: st.why };
    const d = D.DAILIES[id],
      car = opt.car ? Sim.find(S, opt.car) : null;
    let msg = "",
      out = { ok: true };
    switch (d.kind) {
      case "wheel": {
        const slice = St.wpick(
          S,
          WHEEL_W.map((w, i) => [w, i]),
        );
        out.slice = slice;
        msg = R(S) < 0.005 ? "JACKPOT! " + prize(S, { item: "rare_golden_ticket" }) : prize(S, WHEEL_P[slice]);
        break;
      }
      case "fortune":
        msg = prize(S, { text: "fortune" });
        if (R(S) < 0.55) msg += " Inside the cookie: " + prize(S, St.wpick(S, D.LOOT.fortune.filter((r) => r[1].text !== "fortune")));
        break;
      case "interest": {
        const f = Math.max(1, Math.floor(S.player.fares * D.INTEREST[S.garage.vault]));
        msg = "Interest paid: " + prize(S, { fares: f }) + ".";
        break;
      }
      case "timing": {
        const q = clamp(opt.q | 0, 0, 2);
        msg = ["Clank. Close enough! ", "Nice toss! ", "Ring on! A perfect toss! "][q] + prize(S, { fares: [40, 120, 300][q] });
        if (q === 2 && R(S) < 0.3) msg += " and " + prize(S, { item: "chip_lombard" });
        break;
      }
      case "fountain": {
        const x = R(S);
        if (x < 0.1) {
          const w = St.pick(S, Object.keys(D.ITEMS).filter((i) => D.ITEMS[i].cat === "wrap" && D.ITEMS[i].rarity <= 60 && !D.ITEMS[i].season));
          msg = "The fountain glows… a free wrap! " + prize(S, { item: w });
        } else if (x < 0.5) msg = "The fountain sparkles and spits out " + prize(S, { fares: St.ri(S, 20, 80) }) + ".";
        else msg = "Your coin sinks. The fountain gurgles thoughtfully.";
        break;
      }
      case "summit": {
        const x = R(S);
        if (x < 0.3 && car) {
          const s = St.pick(S, D.STAT_KEYS);
          car.stats[s]++;
          msg = "The wind whispers… " + nameOf(car) + " gained +1 " + D.STATS[s].name + "!";
        } else if (x < 0.55) msg = "A coin rolls down the hill to you: " + prize(S, { fares: 100 }) + ".";
        else msg = St.pick(S, ["You wish very hard. Sutro Tower hums. Nothing happens, but you feel taller.", "A raven lands, considers you, leaves.", "The fog parts for exactly one second. Beautiful. That's it."]);
        break;
      }
      case "bonfire":
        if (!car) return { ok: false, msg: "Pick a car to warm by the fire." };
        for (const k of D.NEED_KEYS) car.needs[k] = k === "charge" ? Math.max(100, car.needs.charge) : 100;
        car.needs.mood = Math.min(100, car.needs.mood + 15);
        msg = nameOf(car) + " warmed up by the bonfire. Every need restored!";
        break;
      case "punch":
        S.punch++;
        if (S.punch >= 7) {
          S.punch = 0;
          msg = "Seventh punch! The taquero hands you " + prize(S, St.wpick(S, D.LOOT.taqueria)) + ".";
        } else msg = "Punch " + S.punch + " of 7. " + (7 - S.punch) + " to go!";
        break;
      case "scratch":
        out.win = R(S) < 0.45;
        msg = out.win ? "Three stars! " + prize(S, St.wpick(S, D.LOOT.raffle)) : "No match this time. The marquee flickers sympathetically.";
        break;
      case "lab":
        if (!car) return { ok: false, msg: "Pick a car to zap." };
        msg = labZap(S, car);
        out.look = true;
        break;
      case "sneak":
        if (!opt.sneak) msg = "You tiptoe away. Wise.";
        else if (R(S) < 0.55) msg = "You sneak in… and out, holding " + prize(S, St.wpick(S, D.LOOT.sutro)) + "!";
        else {
          for (const c of S.cars) c.needs.shine = Math.max(0, c.needs.shine - 15);
          msg = "It woke up! A great foggy sneeze blows you out of the baths and all over your fleet (Shine −15). Nobody's hurt. Everyone's damp.";
        }
        break;
      default: {
        const t = D.LOOT[d.table || id];
        msg = prize(S, St.wpick(S, t));
      }
    }
    S.dailies.done[id] = true;
    Sim.xp(S, 20);
    out.msg = msg;
    return out;
  };
  function labZap(S, car) {
    const x = R(S);
    if (x < 0.2) {
      const w = St.pick(S, Object.keys(D.WRAPS).filter((k) => k !== "gold" && D.ITEMS["wrap_" + k] && !D.ITEMS["wrap_" + k].season));
      car.wrap = w;
      if (!S.album.wraps.includes(w)) S.album.wraps.push(w);
      return "ZAP! " + nameOf(car) + " is now " + D.WRAPS[w].name + "!";
    }
    if (x < 0.45) {
      const s = St.pick(S, D.STAT_KEYS);
      car.stats[s]++;
      return "ZAP! " + nameOf(car) + " gained +1 " + D.STATS[s].name + "!";
    }
    if (x < 0.6) {
      car.ring = St.pick(S, D.RINGS);
      return "ZAP! " + nameOf(car) + "'s lidar ring is a new colour!";
    }
    if (x < 0.7) {
      const g = St.pick(S, Object.keys(D.ITEMS).filter((i) => D.ITEMS[i].cat === "gear" && !D.ITEMS[i].season && D.ITEMS[i].rarity < 60));
      return "ZAP! An accessory fell out of the ray: " + prize(S, { item: g }) + ".";
    }
    if (x < 0.72) {
      car.wrap = "gold";
      if (!S.album.wraps.includes("gold")) S.album.wraps.push("gold");
      return "ZAP!!! " + nameOf(car) + " is… GOLD. Everyone in the lab is speechless.";
    }
    return "ZAP! " + nameOf(car) + " is now… " + St.pick(S, ["slightly beige. Actually no, it's fine.", "briefly a cable car. It's back now.", "convinced it can speak French. It cannot.", "exactly the same, but more confident."]);
  }
  // Pier 39 fishing: three casts a day; the more you fish, the better you get
  Sim.fish = function (S) {
    if (!Sim.open(S, "Fisherman's Wharf")) return { ok: false };
    if (S.dailies.fish >= 3) return { ok: false, msg: "The fish are tired. Come back tomorrow." };
    S.dailies.fish++;
    S.fish.skill = Math.min(100, S.fish.skill + 1);
    const luck = 1 + S.fish.skill / 40,
      table = D.LOOT.fishing.map(([w, p], i) => [i ? w * Math.pow(luck, i / 4) : w / luck, p]);
    return { ok: true, msg: "You cast a line… " + prize(S, St.wpick(S, table)) + ". (Fishing skill " + S.fish.skill + ")" };
  };

  /* ======================================================================================================
     adoption
     ====================================================================================================== */
  function plate(S) {
    return St.ri(S, 1, 9) + St.pick(S, D.PLATE_WORDS) + String(St.ri(S, 0, 999)).padStart(3, "0");
  }
  Sim.genCar = function (S) {
    const traits = St.shuffle(S, Object.keys(D.TRAITS)).slice(0, 2),
      x = R(S);
    let wrap = "default";
    if (x < 0.08) wrap = St.pick(S, Object.keys(D.WRAPS).filter((k) => D.ITEMS["wrap_" + k] && D.ITEMS["wrap_" + k].rarity >= 55 && D.ITEMS["wrap_" + k].rarity < 100 && !D.ITEMS["wrap_" + k].season));
    else if (x < 0.3) wrap = St.pick(S, ["golden_gate", "karl_grey", "sourdough", "cable_red", "sea_lion"]);
    const used = new Set(S.cars.concat(S.stored).map((c) => c.name.toLowerCase()));
    const name = St.shuffle(S, D.CAR_NAMES).find((n) => !used.has(n.toLowerCase())) || "Car " + St.ri(S, 10, 99);
    const stats = {};
    for (const k of D.STAT_KEYS) stats[k] = St.ri(S, 1, 3);
    const needs = {};
    for (const k of D.NEED_KEYS) needs[k] = St.ri(S, 60, 92);
    needs.mood = 60;
    const toys = Object.keys(D.ITEMS).filter((i) => ["toy", "snack"].includes(D.ITEMS[i].cat) && D.ITEMS[i].rarity < 70);
    return St.fillCar({
      id: "c_" + Math.floor(R(S) * 0xffffff).toString(16).padStart(6, "0"),
      name,
      model: "cruiser",
      wrap,
      ring: St.pick(S, D.RINGS),
      plate: plate(S),
      born: null,
      traits,
      likes: {
        hood: St.pick(S, Object.keys(D.HOODS)),
        rider: St.pick(S, D.RIDER_KEYS),
        item: St.pick(S, toys),
        song: St.pick(S, Object.keys(D.ITEMS).filter((i) => D.ITEMS[i].cat === "song" && !D.ITEMS[i].season)),
      },
      needs,
      stats,
      story: St.pick(S, D.BACKSTORIES),
    });
  };
  Sim.lot = function (S) {
    if (!S.lot || S.lot.date !== Sim.today()) S.lot = { date: Sim.today(), cars: [0, 1, 2].map(() => Sim.genCar(S)) };
    return S.lot;
  };
  Sim.adoptFee = (S) => D.ADOPT_FEE[Math.min(S.adopted, D.ADOPT_FEE.length - 1)];
  Sim.validName = function (S, name, exceptId) {
    name = String(name || "").trim();
    if (!name || name.length > 14) return "Names are 1 to 14 characters.";
    if (!/^[\p{L}\p{N} '.\-]+$/u.test(name)) return "Letters, numbers, spaces and . ' - only.";
    if (S.cars.concat(S.stored).some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase())) return "You already have a car called " + name + ".";
    return null;
  };
  Sim.adopt = function (S, idx, name) {
    const lot = Sim.lot(S),
      car = lot.cars[idx];
    if (!car) return { ok: false, msg: "That car has already found a home." };
    const bad = Sim.validName(S, name);
    if (bad) return { ok: false, msg: bad };
    const fee = Sim.adoptFee(S);
    if (S.player.fares < fee) return { ok: false, msg: "Adopting costs ◎" + fee + "." };
    fares(S, -fee);
    lot.cars.splice(idx, 1);
    car.name = String(name).trim();
    car.born = Sim.today();
    car.needs.charge = Math.max(85, car.needs.charge);
    car.sim = { at: Sim.HOME, from: null, to: null, t: 0, path: [], dest: null, task: "garage", wait: 0 };
    if (!S.req.length && !S.clock.night) spawnRequests(S);
    if (!S.album.wraps.includes(car.wrap)) S.album.wraps.push(car.wrap);
    S.adopted++;
    syncUnlocks(S);
    const active = S.cars.length < S.unlocked.carSlots;
    (active ? S.cars : S.stored).push(car);
    Sim.xp(S, 50);
    Sim.trophy(S, "first_adopt");
    if (S.cars.length >= 4) Sim.trophy(S, "full_fleet");
    Sim.emit(S, { type: "adopt", carId: car.id, icon: "🐾", text: "Welcome home, " + car.name + "!" + (active ? "" : " (Your car slots are full, so it's waiting in the lot. Swap it in from the Garage.)"), inbox: true, diary: true });
    return { ok: true, car, active };
  };
  Sim.storeCar = function (S, carId) {
    const i = S.cars.findIndex((c) => c.id === carId);
    if (i < 0) return { ok: false };
    if (S.cars.length === 1) return { ok: false, msg: "Keep at least one car on the road." };
    const car = S.cars.splice(i, 1)[0];
    if (car.sim.ride) car.sim.ride = null;
    car.sim = { at: Sim.HOME, from: null, to: null, t: 0, path: [], dest: null, task: "garage", wait: 0 };
    S.stored.push(car);
    return { ok: true, msg: nameOf(car) + " is resting in the lot." };
  };
  Sim.activate = function (S, carId) {
    const i = S.stored.findIndex((c) => c.id === carId);
    if (i < 0) return { ok: false };
    if (S.cars.length >= S.unlocked.carSlots) return { ok: false, msg: "All your car slots are full. Store a car first." };
    const car = S.stored.splice(i, 1)[0];
    car.sim = { at: Sim.HOME, from: null, to: null, t: 0, path: [], dest: null, task: "garage", wait: 0 };
    S.cars.push(car);
    if (S.cars.length >= 4) Sim.trophy(S, "full_fleet");
    return { ok: true, msg: nameOf(car) + " is back on the road!" };
  };
  Sim.rehome = function (S, carId) {
    const car = Sim.find(S, carId);
    if (!car) return { ok: false };
    if (S.cars.length === 1 && S.cars[0] === car) return { ok: false, msg: "You can't rehome your only car." };
    S.cars = S.cars.filter((c) => c !== car);
    S.stored = S.stored.filter((c) => c !== car);
    for (const k in car.gear) if (car.gear[k]) Sim.give(S, car.gear[k]);
    return { ok: true, msg: car.name + " went to a lovely new home in Marin. It'll send postcards." };
  };

  /* ======================================================================================================
     the Driving Academy (real time)
     ====================================================================================================== */
  const CHIP_FOR = (lv) => (lv <= 3 ? "chip_lombard" : lv <= 6 ? "chip_sutro" : lv <= 9 ? "chip_coit" : "chip_bridge");
  Sim.course = (car, stat) => {
    const lv = clamp(Math.floor(car.stats[stat] / 3) + 1, 1, 12);
    return { level: lv, hours: lv, fares: 40 * lv, chip: CHIP_FOR(lv) };
  };
  Sim.train = function (S, carId, stat) {
    const car = Sim.find(S, carId);
    if (!car || !S.cars.includes(car)) return { ok: false, msg: "Pick a car on the road." };
    if (!Sim.open(S, "Twin Peaks")) return { ok: false, msg: "The Driving Academy opens at Crew Rank 7." };
    if (car.training) return { ok: false, msg: nameOf(car) + " is already at school." };
    if (["toPickup", "ride", "nap", "tow", "stuck"].includes(car.sim.task)) return { ok: false, msg: nameOf(car) + " is busy right now. Try again after this ride." };
    const c = Sim.course(car, stat);
    if (S.player.fares < c.fares) return { ok: false, msg: "The course costs ◎" + c.fares + "." };
    if (!Sim.has(S, c.chip)) return { ok: false, msg: "The course needs a " + D.ITEMS[c.chip].name + "." };
    fares(S, -c.fares);
    Sim.take(S, c.chip);
    car.training = { stat, endsAt: Sim.now() + (c.hours * 3600e3) / Sim.fast };
    if (!S.clock.night) goTo(S, car, "Twin Peaks", "toSchool");
    return { ok: true, msg: nameOf(car) + " enrolled in Level " + c.level + " " + D.STATS[stat].name + ". Back in " + c.hours + " real hour" + (c.hours > 1 ? "s" : "") + "." };
  };
  function finishTraining(S, car) {
    const st = car.training.stat,
      n = R(S) < 0.2 ? 2 : 1;
    car.stats[st] += n;
    car.training = null;
    if (car.sim.task === "school" || car.sim.task === "toSchool") car.sim.task = car.sim.from ? "idle" : car.sim.at === Sim.HOME ? "garage" : "idle";
    Sim.xp(S, 20);
    Sim.emit(S, { type: "toast", carId: car.id, icon: "🎓", text: nameOf(car) + " graduated! +" + n + " " + D.STATS[st].name + ".", inbox: true, diary: true });
    checkStage(S, car);
  }

  /* ======================================================================================================
     quests: the Sutro Tower riddle, the Rider Rally, the seasonal storylines
     ====================================================================================================== */
  Sim.riddle = function (S) {
    if (S.quests.riddle && S.quests.riddle.date === Sim.today()) return S.quests.riddle;
    let q, opts, ans;
    const cars = S.cars;
    if (cars.length && R(S) < 0.5) {
      const car = St.pick(S, cars),
        kind = St.ri(S, 0, 2);
      if (kind === 0) {
        const km = Math.round(car.km);
        q = "How many kilometres has " + nameOf(car) + " driven, give or take?";
        const set = [km, Math.round(km * 1.6 + 7), Math.max(0, Math.round(km * 0.5 - 3))];
        opts = St.shuffle(S, set.map((v) => v + " km"));
        ans = opts.indexOf(km + " km");
      } else if (kind === 1) {
        q = "What is " + nameOf(car) + "'s favourite neighbourhood?";
        const others = St.shuffle(S, Object.keys(D.HOODS).filter((h) => h !== car.likes.hood)).slice(0, 2);
        opts = St.shuffle(S, [car.likes.hood].concat(others));
        ans = opts.indexOf(car.likes.hood);
      } else {
        q = "Which of these is one of " + nameOf(car) + "'s traits?";
        const t = St.pick(S, car.traits),
          others = St.shuffle(S, Object.keys(D.TRAITS).filter((k) => !car.traits.includes(k))).slice(0, 2);
        opts = St.shuffle(S, [t].concat(others)).map((k) => D.TRAITS[k].name);
        ans = opts.indexOf(D.TRAITS[t].name);
      }
    } else {
      const t = St.pick(S, D.TRIVIA);
      q = t[0];
      opts = t[1].slice();
      ans = t[2];
    }
    S.quests.riddle = { date: Sim.today(), q, opts, ans, done: false };
    return S.quests.riddle;
  };
  Sim.answerRiddle = function (S, i) {
    const r = Sim.riddle(S);
    if (r.done) return { ok: false, msg: "Sutro Tower has nothing more to ask today." };
    r.done = true;
    if (i !== r.ans) return { ok: false, msg: "Sutro Tower hums disapprovingly. The answer was “" + r.opts[r.ans] + "”. Try again tomorrow." };
    Sim.xp(S, 40);
    const p = St.pick(S, [{ item: "chip_sutro" }, { item: "map_fog_patterns" }, { item: "rare_old_token" }, { fares: 400 }, { item: "clar_defrag" }]);
    return { ok: true, msg: "Correct! Sutro Tower blinks its red lights at you and drops " + prize(S, p) + "." };
  };
  Sim.rallyStart = function (S) {
    if (S.quests.rally && S.quests.rally.day === S.clock.day) return { ok: false, msg: "Today's rally is already on." };
    if (S.clock.night) return { ok: false, msg: "The rally starts in the morning." };
    const hoods = St.shuffle(S, G.names.filter((h) => D.STAMPS.some((s) => s.hood === h) || D.HOODS[h].rank !== null)).slice(0, 5);
    S.quests.rally = { day: S.clock.day, hoods, done: [], won: false };
    return { ok: true, msg: "Rider Rally! Get any of your cars to " + hoods.join(", ") + " before midnight." };
  };
  // seasonal storylines: a chapter unlocks each real day of the event
  Sim.story = function (S, sid) {
    const se = D.SEASONS.find((s) => s.id === sid),
      year = new Date(Sim.now()).getFullYear();
    let st = S.story[sid];
    if (!st || st.year !== year) st = S.story[sid] = { year, start: Sim.today(), done: 0, finished: false };
    const avail = Math.min(se.story.length, St.daysBetween(st.start, Sim.today()) + 1);
    return { se, st, avail, next: st.done < avail && !st.finished ? se.story[st.done] : null };
  };
  function storyHook(S, what) {
    for (const se of Sim.season()) {
      const s = Sim.story(S, se.id);
      if (!s.next) continue;
      const a = s.next.ask;
      if ((a.job && a.job === what.job) || (a.visit && a.visit === what.visit)) advanceStory(S, s);
    }
  }
  Sim.storyGive = function (S, sid) {
    const s = Sim.story(S, sid);
    if (!s.next || !s.next.ask.item) return { ok: false };
    if (!Sim.take(S, s.next.ask.item)) return { ok: false, msg: "You need a " + D.ITEMS[s.next.ask.item].name + " (sold at the event stall)." };
    advanceStory(S, s);
    return { ok: true, msg: "Chapter complete!" };
  };
  function advanceStory(S, s) {
    const ch = s.next;
    s.st.done++;
    Sim.xp(S, 50);
    Sim.emit(S, { type: "story", icon: s.se.icon, text: s.se.name + ": “" + ch.title + "” complete!", inbox: true, diary: true });
    if (s.st.done >= s.se.story.length) {
      s.st.finished = true;
      const r = s.se.reward;
      if (r.avatar && !S.player.avatars.includes(r.avatar)) S.player.avatars.push(r.avatar);
      if (r.item) Sim.give(S, r.item);
      if (r.fares) fares(S, r.fares);
      if (s.se.id === "halloween") Sim.trophy(S, "halloween");
      Sim.emit(S, { type: "story", icon: "🏆", text: s.se.name + " storyline finished! A new avatar, ◎" + r.fares + " and " + D.ITEMS[r.item].name + ".", inbox: true, diary: true });
    }
  }

  /* ======================================================================================================
     the arcade: each job on its own pays a little, three times a day
     ====================================================================================================== */
  Sim.arcadeScore = (res) => Math.round(250 + res.q * 250 + Math.max(0, 750 - res.time * 15));
  Sim.arcadeResult = function (S, kind, res) {
    const score = Sim.arcadeScore(res),
      A = S.arcade,
      plays = S.dailies.gamePlays[kind] || 0,
      tier = D.ARCADE.tiers.filter((t) => score >= t).length;
    const newBest = score > (A.best[kind] || 0);
    if (newBest) A.best[kind] = score;
    if (tier > (A.trophies[kind] || 0)) A.trophies[kind] = tier;
    let paid = 0;
    if (plays < D.ARCADE.plays) {
      paid = Math.round(score / D.ARCADE.divisor);
      fares(S, paid);
      S.dailies.gamePlays[kind] = plays + 1;
      Sim.xp(S, 10);
    }
    return { score, paid, tier, newBest, left: Math.max(0, D.ARCADE.plays - (S.dailies.gamePlays[kind] || 0)) };
  };
  // a whole arcade run (the five shifts) pays into the Adopt save once a day
  Sim.arcadeRun = function (S, score) {
    if (S.dailies.run) return 0;
    S.dailies.run = true;
    const f = Math.min(D.ARCADE.runCap, Math.round(score / D.ARCADE.runDivisor));
    fares(S, f);
    Sim.xp(S, 30);
    S.inbox.unshift({ at: absMin(S), icon: "🕹️", text: "Your arcade shift paid ◎" + f + " into the garage's account.", read: false });
    return f;
  };

  /* ======================================================================================================
     the weekly Car Show
     ====================================================================================================== */
  function showWeek(S, now) {
    const wk = St.weekOf(now);
    if (S.show.week === wk) return;
    if (S.show.entry) judgeShow(S);
    S.show.week = wk;
    const seasonal = D.SHOW_THEMES.filter((t) => t.season && seasonOn(t.season)),
      list = seasonal.length ? seasonal : D.SHOW_THEMES.filter((t) => !t.season);
    S.show.theme = list[Math.abs(Math.round(St.daysBetween("2026-01-05", wk) / 7)) % list.length].id;
    S.show.entry = null;
  }
  Sim.showTheme = (S) => D.SHOW_THEMES.find((t) => t.id === S.show.theme) || D.SHOW_THEMES[0];
  Sim.showScore = function (S, car, theme) {
    const e = Sim.eff(S, car);
    let match = 0;
    const w = D.WRAPS[car.wrap];
    if (w && w.theme && w.theme.includes(theme)) match += 2;
    for (const k in car.gear) {
      const it = car.gear[k] && D.ITEMS[car.gear[k]];
      if (it && it.theme && it.theme.includes(theme)) match += 1;
    }
    if (theme === "fog" && (has(car, "fog_lover") || (car.dashpet && car.dashpet.id === "mini_karl"))) match += 1;
    if (theme === "night" && has(car, "night_owl")) match += 1;
    let rare = 0;
    for (const k in car.gear) if (car.gear[k]) rare += D.ITEMS[car.gear[k]].rarity / 20;
    return e.charm * 3 + car.needs.shine / 10 + match * 8 + rare;
  };
  Sim.showEnter = function (S, carId) {
    const car = Sim.find(S, carId);
    if (!car) return { ok: false };
    if (!Sim.open(S, "Western Addition")) return { ok: false, msg: "The Car Show is in Alamo Square (Crew Rank 5)." };
    if (S.show.entry) return { ok: false, msg: "You've already entered this week." };
    S.show.entry = { carId, name: nameOf(car), score: Sim.showScore(S, car, S.show.theme), theme: S.show.theme };
    return { ok: true, msg: nameOf(car) + " is entered in “" + Sim.showTheme(S).name + "”. The judges announce the winners on Monday." };
  };
  function judgeShow(S) {
    const en = S.show.entry,
      me = en.score + R(S) * 10,
      npcs = St.shuffle(S, D.NPC_CARS)
        .slice(0, 7)
        .map((n) => ({ name: n, score: 12 + R(S) * 34 }));
    const all = npcs.concat([{ name: en.name, score: me, mine: true }]).sort((a, b) => b.score - a.score),
      place = all.findIndex((r) => r.mine) + 1,
      prizeF = [1000, 500, 250][place - 1] || 50;
    fares(S, prizeF);
    let extra = "";
    if (place === 1) {
      Sim.trophy(S, "show_winner");
      const retired = Object.keys(D.ITEMS).filter((i) => D.ITEMS[i].season && !seasonOn(D.ITEMS[i].season) && D.ITEMS[i].cat !== "snack");
      if (retired.length) extra = " and " + prize(S, { item: St.pick(S, retired) });
    }
    S.show.last = { week: S.show.week, theme: en.theme, place, results: all.map((r) => ({ name: r.name, score: Math.round(r.score), mine: !!r.mine })) };
    Sim.emit(S, { type: "show", icon: "🎀", text: "Car Show results: " + en.name + " placed #" + place + " of 8! ◎" + prizeF + extra + ".", inbox: true, diary: true });
  }
  Sim.judgeShow = (S) => S.show.entry && judgeShow(S);

  /* ======================================================================================================
     the Hill Climb Derby (Crew Rank 6): a turn-based race up Lombard, Push / Coast / Use an item
     ====================================================================================================== */
  Sim.derbyStart = function (S, carId) {
    const car = Sim.find(S, carId);
    if (!car) return { ok: false };
    if (S.player.rank < 6) return { ok: false, msg: "The Hill Climb Derby opens at Crew Rank 6." };
    const lv = Math.max(1, Sim.level(car)),
      e = Sim.eff(S, car);
    const mk = (name, h, r) => ({ name, h, r, d: 0, st: 100 });
    S.derby.race = {
      carId,
      leg: 0,
      legs: 5,
      me: Object.assign(mk(nameOf(car), e.handling + (car.dashpet && car.dashpet.id === "bell" ? 1 : 0), e.range), { charm: e.charm }),
      npcs: St.shuffle(S, D.NPC_CARS)
        .slice(0, 3)
        .map((n) => mk(n, Math.max(1, lv + St.ri(S, -1, 2)), Math.max(1, lv + St.ri(S, -1, 1)))),
      log: ["The flag drops on Lombard! Eight hairpins to the top."],
      done: false,
    };
    return { ok: true, race: S.derby.race };
  };
  function derbyLeg(S, c, move) {
    if (move === "push" && c.st >= 20) {
      c.d += c.h * 1.2 + c.r * 0.4 + R(S) * 6;
      c.st -= 30 - Math.min(15, c.r);
    } else if (move === "item") {
      c.d += c.h * 0.8 + R(S) * 3;
      c.st = Math.min(100, c.st + 40);
    } else {
      c.d += c.h * 0.6 + R(S) * 3;
      c.st = Math.min(100, c.st + 25);
    }
  }
  Sim.derbyMove = function (S, move, itemId) {
    const race = S.derby.race;
    if (!race || race.done) return { ok: false };
    if (move === "item") {
      if (!itemId || !Sim.take(S, itemId)) return { ok: false, msg: "No snack to use." };
    }
    if (move === "push" && race.me.st < 20) race.log.push(race.me.name + " is too tired to push, and coasts.");
    derbyLeg(S, race.me, move);
    for (const n of race.npcs) derbyLeg(S, n, n.st >= 35 && R(S) < 0.8 ? "push" : "coast");
    race.leg++;
    const order = [race.me].concat(race.npcs).sort((a, b) => b.d - a.d);
    race.log.push("Hairpin " + race.leg + ": " + order.map((c) => c.name).join(" → "));
    if (race.leg >= race.legs) {
      race.done = true;
      race.me.d += race.me.charm * 0.3; // the crowd cheers the prettiest car on
      const fin = [race.me].concat(race.npcs).sort((a, b) => b.d - a.d),
        place = fin.indexOf(race.me) + 1;
      race.place = place;
      let msg = "Finish! " + race.me.name + " placed #" + place + ".";
      if ((S.dailies.derby || 0) < 3) {
        S.dailies.derby = (S.dailies.derby || 0) + 1;
        const car = Sim.find(S, race.carId),
          chip = CHIP_FOR(Math.max(1, Sim.level(car)));
        if (place === 1) {
          msg += " " + prize(S, { fares: 300 }) + " and " + prize(S, { item: chip }) + "!";
          Sim.trophy(S, "derby_winner");
        } else if (place === 2) msg += " " + prize(S, { fares: 150 }) + " and " + prize(S, { item: "chip_lombard" }) + ".";
        else msg += " " + prize(S, { fares: place === 3 ? 80 : 30 }) + ".";
        if (car && place <= 2 && R(S) < 0.25) {
          car.stats.handling++;
          msg += " " + nameOf(car) + " learned something on the hairpins: +1 Handling!";
        }
        Sim.xp(S, 30);
      } else msg += " (Prizes are for the first three races a day. This one was for glory.)";
      race.log.push(msg);
      race.msg = msg;
    }
    return { ok: true, race };
  };

  /* ======================================================================================================
     the SF Startup Index (rank 12) and the Auction House
     ====================================================================================================== */
  function stocksTick(S) {
    const X = S.stocks,
      h = hourIdx(S);
    for (const s of D.STARTUPS) {
      let p = X.prices[s.id] || s.p;
      const z = (R(S) + R(S) + R(S) - 1.5) * 0.12;
      p = p * Math.exp(z + (Math.log(s.p) - Math.log(p)) * 0.03);
      X.prices[s.id] = Math.max(1, Math.round(p * 100) / 100);
    }
    X.hour = h;
  }
  Sim.price = (S, id) => {
    if (!S.stocks.prices[id]) stocksTick(S);
    return S.stocks.prices[id];
  };
  Sim.trade = function (S, id, n) {
    if (S.player.rank < 12) return { ok: false, msg: "The Startup Index opens at Crew Rank 12." };
    const p = Sim.price(S, id),
      own = S.stocks.own[id] || 0;
    if (n > 0) {
      const cost = Math.ceil(p * n);
      if (S.player.fares < cost) return { ok: false, msg: "You need ◎" + cost + "." };
      fares(S, -cost);
      S.stocks.own[id] = own + n;
      return { ok: true, msg: "Bought " + n + " " + id + " for ◎" + cost + "." };
    }
    n = Math.min(own, -n);
    if (!n) return { ok: false, msg: "You don't own any." };
    const got = Math.floor(p * n);
    S.stocks.own[id] = own - n;
    fares(S, got);
    return { ok: true, msg: "Sold " + n + " " + id + " for ◎" + got + "." };
  };
  Sim.auction = function (S) {
    const A = S.auction;
    if (A.date !== Sim.today() || !A.lots.length) {
      A.date = Sim.today();
      A.lots = St.shuffle(S, D.AUCTION_POOL)
        .slice(0, 3)
        .map((item, i) => ({ item, bid: Math.round(D.ITEMS[item].price * 0.4), by: St.pick(S, D.BIDDERS), ends: hourIdx(S) + 3 + i * 2, done: false }));
    }
    return A;
  };
  function auctionTick(S) {
    const A = S.auction;
    if (!A.lots) return;
    const h = hourIdx(S);
    for (const l of A.lots) {
      if (l.done) continue;
      if (h >= l.ends) {
        l.done = true;
        if (l.by === "you") {
          Sim.give(S, l.item);
          Sim.emit(S, { type: "toast", icon: "🔨", text: "You won the auction for " + D.ITEMS[l.item].name + " (◎" + l.bid + ")!", inbox: true });
        }
        continue;
      }
      // the NPCs bid up to about the item's value
      if (R(S) < 0.35 && l.bid < D.ITEMS[l.item].price * (0.8 + R(S) * 0.5)) {
        const prev = l.by,
          nb = Math.round(l.bid * (1.05 + R(S) * 0.1)) + 5;
        if (prev === "you") {
          fares(S, l.bid);
          Sim.emit(S, { type: "toast", icon: "🔨", text: "You were outbid on " + D.ITEMS[l.item].name + ". Your ◎" + l.bid + " came back." });
        }
        l.bid = nb;
        l.by = St.pick(S, D.BIDDERS);
      }
    }
  }
  Sim.bid = function (S, i, amount) {
    const l = Sim.auction(S).lots[i];
    if (!l || l.done) return { ok: false, msg: "That auction's closed." };
    if (l.by === "you") return { ok: false, msg: "You're already the top bidder." };
    const min = Math.ceil(l.bid * 1.05) + 1;
    amount = Math.round(amount || min);
    if (amount < min) return { ok: false, msg: "Bid at least ◎" + min + "." };
    if (S.player.fares < amount) return { ok: false, msg: "You need ◎" + amount + "." };
    fares(S, -amount);
    l.bid = amount;
    l.by = "you";
    return { ok: true, msg: "You're the top bidder at ◎" + amount + "." };
  };

  /* ---------- a new save's first morning ---------- */
  Sim.start = function (S) {
    if (!S.today) newToday(S);
    if (!S.clock.weather) S.clock.weather = "clear";
    syncUnlocks(S);
    Sim.realTick(S);
    if (!S.req.length && !S.clock.night) spawnRequests(S);
  };

  WG.adoptSim = Sim;
})();
