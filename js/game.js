/* Waymo Care · the game: three shifts on the San Francisco fleet crew. Walk (WASD / arrows, or click / tap to go),
   reach a robotaxi that needs help and do the job. Faster and calmer riders mean more points; streaks multiply them. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    A = WG.audio,
    JOB = WG.jobs,
    Traffic = WG.Traffic,
    KIND = WG.KIND;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rr = (a, b) => a + Math.random() * (b - a);
  const TOUCH = matchMedia("(pointer: coarse)").matches;

  /* ---------- rounds ---------- */
  const SHIFTS = [
    {
      name: "Morning Rush",
      look: "day",
      blurb: "Sunny skies over the city. Riders are waking up — and leaving muddy footprints, cones and open doors behind them.",
      dur: 100,
      every: [5.5, 7.5],
      max: 3,
      patience: 42,
      kinds: ["dirty", "charge", "cone", "doors"],
      key: 0,
    },
    {
      name: "Karl the Fog",
      look: "fog",
      blurb: "The fog rolls in off the Pacific. Sensors get confused and need a reboot, and the night crowd left popcorn everywhere.",
      dur: 100,
      every: [4.6, 6.4],
      max: 4,
      patience: 38,
      kinds: ["dirty", "charge", "cone", "reboot", "vacuum"],
      key: 2,
    },
    {
      name: "Golden Hour",
      look: "dusk",
      blurb: "Sunset rush! Everything goes wrong at once — and the seagulls are out.",
      dur: 100,
      every: [3.8, 5.4],
      max: 5,
      patience: 34,
      kinds: ["dirty", "charge", "cone", "reboot", "birds", "vacuum", "doors"],
      key: 5,
    },
  ];
  const MEDALS = [
    { name: "Platinum", at: 6200, col: "plat" },
    { name: "Gold", at: 4600, col: "gold" },
    { name: "Silver", at: 3000, col: "silver" },
    { name: "Bronze", at: 1500, col: "bronze" },
  ];

  /* ---------- renderer and scene ---------- */
  const cv = $("#gl");
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" });
  const LOW = /[?&]low\b/.test(location.search);
  renderer.setPixelRatio(LOW ? 0.6 : Math.min(TOUCH ? 1.5 : 2, window.devicePixelRatio || 1));
  // Slop Skies' island draws its own shading and blob shadows, so the game's toys use blob shadows too
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.5, 9000);
  W.build(scene, renderer);
  Traffic.init(scene, 18);
  // the crew member
  const mii = WG.makeMii();
  scene.add(mii.root);
  // an x-ray silhouette, so the crew member never gets lost behind a row of houses. It draws after the city but before
  // the crew member (render order 0.5 vs 1), only where the city's depth is in front of it, and writes no depth
  {
    const ghost = new T.MeshBasicMaterial({ color: 0x36d3c4, depthWrite: false, depthFunc: T.GreaterDepth, fog: false });
    const list = [];
    mii.root.traverse((o) => o.isMesh && o.geometry.type !== "PlaneGeometry" && list.push(o));
    for (const o of list) {
      o.renderOrder = 1;
      const g = new T.Mesh(o.geometry, ghost);
      g.renderOrder = 0.5;
      o.add(g);
    }
  }
  const P = {
    pos: new T.Vector3(W.start.x, 0, W.start.z),
    yaw: Math.PI,
    speed: 0,
    path: [],
    target: null,
    phase: 0,
    stepI: 0,
    work: 0,
  };
  P.pos.y = W.groundY(P.pos.x, P.pos.z);

  // click marker
  const marker = new T.Mesh(
    new T.RingGeometry(0.55, 0.85, 32),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);
  let markerT = 9;

  /* ---------- walk grid and pathfinding ---------- */
  // 1 m cells over the play area's bounding box, blocked by the island's colliders
  const corners = [
      [W.AREA.lx0, W.AREA.lz0],
      [W.AREA.lx1, W.AREA.lz0],
      [W.AREA.lx1, W.AREA.lz1],
      [W.AREA.lx0, W.AREA.lz1],
    ].map(([a, b]) => W.toWorld(a, b)),
    X0 = Math.floor(Math.min(...corners.map((c) => c[0]))),
    Z0 = Math.floor(Math.min(...corners.map((c) => c[1]))),
    NX = Math.ceil(Math.max(...corners.map((c) => c[0]))) - X0,
    NZ = Math.ceil(Math.max(...corners.map((c) => c[1]))) - Z0,
    GN = NX,
    grid = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) grid[j * NX + i] = W.isBlocked(X0 + i + 0.5, Z0 + j + 0.5, 0.45) ? 1 : 0;
  const cellOf = (x, z) => [clamp(Math.floor(x - X0), 0, NX - 1), clamp(Math.floor(z - Z0), 0, NZ - 1)];
  const free = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && !grid[j * NX + i];
  function nearestFree(i, j) {
    if (free(i, j)) return [i, j];
    for (let r = 1; r < 12; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(i + di, j + dj)) return [i + di, j + dj];
    return null;
  }
  function los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az),
      n = Math.ceil(d / 0.4);
    for (let k = 1; k < n; k++) {
      const x = ax + ((bx - ax) * k) / n,
        z = az + ((bz - az) * k) / n,
        [i, j] = cellOf(x, z);
      if (!free(i, j)) return false;
    }
    return true;
  }
  const gScore = new Float32Array(NX * NZ),
    from = new Int32Array(NX * NZ),
    seen = new Uint32Array(NX * NZ);
  let stamp = 0;
  function findPath(sx, sz, tx, tz) {
    const s = nearestFree(...cellOf(sx, sz)),
      t = nearestFree(...cellOf(tx, tz));
    if (!s || !t) return [];
    if (los(sx, sz, tx, tz) && free(...cellOf(tx, tz))) return [[tx, tz]];
    stamp++;
    const si = s[1] * GN + s[0],
      ti = t[1] * GN + t[0];
    const heap = [],
      push = (n, f) => {
        heap.push([f, n]);
        let k = heap.length - 1;
        while (k > 0) {
          const p = (k - 1) >> 1;
          if (heap[p][0] <= heap[k][0]) break;
          [heap[p], heap[k]] = [heap[k], heap[p]];
          k = p;
        }
      },
      popH = () => {
        const top = heap[0],
          last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let k = 0;
          for (;;) {
            const l = 2 * k + 1,
              r = l + 1;
            let m = k;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === k) break;
            [heap[m], heap[k]] = [heap[k], heap[m]];
            k = m;
          }
        }
        return top;
      };
    const h = (n) => {
      const dx = Math.abs((n % GN) - t[0]),
        dz = Math.abs(((n / GN) | 0) - t[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    seen[si] = stamp;
    gScore[si] = 0;
    from[si] = -1;
    push(si, h(si));
    let found = false,
      iters = 0;
    while (heap.length && iters++ < 250000) {
      const [, n] = popH();
      if (n === ti) {
        found = true;
        break;
      }
      const ci = n % GN,
        cj = (n / GN) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di,
            nj = cj + dj;
          if (!free(ni, nj)) continue;
          if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
          const m = nj * GN + ni,
            g = gScore[n] + (di && dj ? 1.414 : 1);
          if (seen[m] !== stamp || g < gScore[m]) {
            seen[m] = stamp;
            gScore[m] = g;
            from[m] = n;
            push(m, g + h(m));
          }
        }
    }
    if (!found) return [];
    const pts = [];
    for (let n = ti; n !== -1; n = from[n]) pts.push([X0 + (n % GN) + 0.5, Z0 + ((n / GN) | 0) + 0.5]);
    pts.reverse();
    if (free(...cellOf(tx, tz))) pts[pts.length - 1] = [tx, tz];
    // string-pull
    const out = [];
    let ax = sx,
      az = sz,
      k = 0;
    while (k < pts.length) {
      let far = k;
      for (let q = pts.length - 1; q > k; q--)
        if (los(ax, az, pts[q][0], pts[q][1])) {
          far = q;
          break;
        }
      out.push(pts[far]);
      ax = pts[far][0];
      az = pts[far][1];
      k = far + 1;
    }
    return out;
  }

  /* ---------- game state ---------- */
  const G = {
    state: "boot", // boot | title | howto | brief | ready | play | timeup | result | final | pause
    round: 0,
    t: 0,
    left: 0,
    score: 0,
    roundScore: 0,
    combo: 0,
    bestCombo: 0,
    done: 0,
    missed: 0,
    perfects: 0,
    rateSum: 10,
    rateN: 2,
    spawnT: 0,
    mini: null,
    total: { done: 0, missed: 0, perfects: 0, bestCombo: 0 },
    stateT: 0,
  };
  let best = 0;
  try {
    best = +localStorage.getItem("wc.best") || 0;
  } catch (e) {}
  const shift = () => SHIFTS[G.round];
  const active = () => Traffic.cars.filter((c) => c.problem);

  function setState(s) {
    G.state = s;
    G.stateT = 0;
    document.body.dataset.state = s;
    for (const id of ["title", "howto", "brief", "result", "final", "pause"]) {
      const e = document.getElementById(id);
      if (e) e.hidden = id !== s;
    }
    $("#hud").hidden = !(s === "play" || s === "ready" || s === "timeup" || s === "pause");
  }

  function resetRun() {
    G.round = 0;
    G.score = 0;
    G.rateSum = 10;
    G.rateN = 2;
    G.total = { done: 0, missed: 0, perfects: 0, bestCombo: 0 };
    G.combo = 0;
  }
  function clearProblems() {
    for (const c of Traffic.cars)
      if (c.problem) {
        c.setProblem(null);
        if (c.state === "problem" || c.state === "pulling") c.state = "leaving";
      }
    P.target = null;
  }
  function openBrief() {
    const s = shift();
    W.setLook(s.look);
    clearProblems();
    $("#br-n").textContent = "Shift " + (G.round + 1) + " of " + SHIFTS.length;
    $("#br-t").textContent = s.name;
    $("#br-p").textContent = s.blurb;
    const jobs = $("#br-jobs");
    jobs.innerHTML = "";
    for (const k of s.kinds) {
      const li = document.createElement("li");
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      WG.drawIcon(c.getContext("2d"), k, 32, 34, 1);
      li.appendChild(c);
      const sp = document.createElement("span");
      sp.textContent = JOBNAME[k];
      li.appendChild(sp);
      jobs.appendChild(li);
    }
    setState("brief");
    A.music("title");
    focusFirst("#brief");
  }
  const JOBNAME = {
    dirty: "Wash",
    charge: "Recharge",
    cone: "De-cone",
    birds: "Shoo birds",
    reboot: "Reboot sensors",
    vacuum: "Vacuum",
    doors: "Close doors",
  };

  function startRound() {
    const s = shift();
    G.left = s.dur;
    G.roundScore = 0;
    G.done = 0;
    G.missed = 0;
    G.perfects = 0;
    G.bestCombo = 0;
    G.spawnT = 1.2;
    G.tickS = -1;
    G.hurry = false;
    setState("ready");
    big("Ready?", "ready");
    A.music(null);
    A.sfx("count");
  }
  function go() {
    setState("play");
    big("Start!", "go");
    A.sfx("go");
    A.music("play", { transpose: shift().key, restart: true });
    G.spawnT = 0.8;
    G.spawn2 = 2.6;
  }
  function timeUp() {
    setState("timeup");
    big("Time's up!", "up");
    A.music(null);
    A.sfx("timeup");
    if (JOB.active) JOB.cancel();
    P.path = [];
    P.target = null;
  }
  function showResult() {
    // tally this shift into the run
    G.total.done += G.done;
    G.total.missed += G.missed;
    G.total.perfects += G.perfects;
    G.total.bestCombo = Math.max(G.total.bestCombo, G.bestCombo);
    clearProblems();
    $("#rs-n").textContent = "Shift " + (G.round + 1) + " complete!";
    $("#rs-t").textContent = shift().name;
    $("#rs-done").textContent = G.done;
    $("#rs-miss").textContent = G.missed;
    $("#rs-perf").textContent = G.perfects;
    $("#rs-combo").textContent = G.bestCombo;
    $("#rs-score").textContent = fmt(G.roundScore);
    $("#rs-total").textContent = fmt(G.score);
    $("#rs-next").textContent = G.round + 1 < SHIFTS.length ? "Next shift" : "Final results";
    setState("result");
    A.music("results");
    A.sfx("chime", 1);
    focusFirst("#result");
  }
  function showFinal() {
    const medal = MEDALS.find((m) => G.score >= m.at);
    const isPB = G.score > best;
    if (isPB) {
      best = G.score;
      try {
        localStorage.setItem("wc.best", String(best));
      } catch (e) {}
    }
    $("#fn-score").textContent = fmt(G.score);
    $("#fn-medal").className = "medal " + (medal ? medal.col : "none");
    $("#fn-medal-n").textContent = medal ? medal.name : "No medal";
    $("#fn-pb").hidden = !isPB;
    $("#fn-done").textContent = G.total.done;
    $("#fn-miss").textContent = G.total.missed;
    $("#fn-perf").textContent = G.total.perfects;
    $("#fn-combo").textContent = G.total.bestCombo;
    const rate = G.rateSum / G.rateN;
    $("#fn-rate").textContent = rate.toFixed(1);
    $("#fn-stars").style.setProperty("--r", rate / 5);
    const nextM = MEDALS.slice().reverse().find((m) => G.score < m.at);
    $("#fn-next").textContent = nextM ? fmt(nextM.at - G.score) + " more points for " + nextM.name : "You are a legend of the fleet!";
    setState("final");
    W.setLook("dusk");
    A.music("results");
    setTimeout(() => A.sfx("medal"), 400);
    updateBest();
    focusFirst("#final");
  }
  function updateBest() {
    const m = MEDALS.find((k) => best >= k.at);
    $("#t-best").textContent = best ? "Best: " + fmt(best) + (m ? " · " + m.name : "") : "";
  }
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  /* ---------- problems ---------- */
  function spawnProblem() {
    const s = shift(),
      cand = Traffic.cars.filter((c) => c.canPull() && !c.problem && c.coolT === undefined);
    if (!cand.length) return false;
    // prefer cars a short jog away
    let best = null,
      bw = -1;
    for (const c of cand) {
      const d = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z),
        w = (d < 14 ? 0.3 : d < 95 ? 1 : 0.35) * rr(0.5, 1.5);
      if (w > bw) {
        bw = w;
        best = c;
      }
    }
    const type = s.kinds[(Math.random() * s.kinds.length) | 0];
    const prob = { type, max: s.patience, left: s.patience };
    if (type === "doors") {
      const n = Math.min(4, 2 + G.round + (Math.random() < 0.4 ? 1 : 0) - 1);
      prob.doors = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, Math.max(2, n));
    }
    best.setProblem(prob);
    best.pullOver();
    if (!G.tipped) {
      G.tipped = true;
      tip(
        "<b>A robotaxi needs help!</b> " +
          (TOUCH ? "Tap it (or its bubble)" : "Click it, or walk over with WASD and press Space,") +
          " to run over and fix it. Arrows at the edge point to cars off screen.",
        7,
      );
    }
    A.sfx("alert", clamp((best.pos.x - P.pos.x) / 60, -1, 1));
    return true;
  }
  function rate(stars) {
    G.rateSum += stars;
    G.rateN++;
  }
  function jobDone(car, res) {
    const frac = clamp(car.problem.left / car.problem.max, 0, 1),
      q = res.q;
    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    const mult = [1, 1, 1.2, 1.4, 1.6, 1.8, 2][Math.min(G.combo, 6)];
    const pts = Math.round(((100 + [0, 50, 100][q] + 60 * frac) * mult) / 10) * 10;
    G.score += pts;
    G.roundScore += pts;
    G.done++;
    if (q === 2) G.perfects++;
    rate(q === 2 ? 5 : q === 1 ? (frac > 0.4 ? 5 : 4) : frac > 0.4 ? 4 : 3);
    floater(car.pos, "+" + pts, ["Good", "Great!", "Perfect!"][q], q);
    if (G.combo >= 2) {
      floater(car.pos, G.combo + " in a row!", "x" + mult.toFixed(1), 3, 0.25);
      A.sfx("combo", G.combo);
    }
    A.sfx("chime", q);
    A.sfx("carHappy", 0);
    car.setProblem(null);
    car.state = "leaving";
    car.hop = 1;
    car.coolT = 8;
    bumpHud();
  }
  function jobMissed(car) {
    G.missed++;
    G.combo = 0;
    rate(1);
    floater(car.pos, "Missed!", "Rider gave 1★", -1);
    A.sfx("carSad", clamp((car.pos.x - P.pos.x) / 60, -1, 1));
    A.sfx("fail");
    car.setProblem(null);
    car.state = "leaving";
    car.sad = 1.2;
    car.coolT = 8;
    if (P.target === car) {
      P.target = null;
      P.path = [];
    }
    bumpHud();
  }

  function startJob(car) {
    if (!car.problem || JOB.active) return;
    P.path = [];
    P.target = car;
    G.mini = car;
    car.problem.busy = true;
    car.parts.sprite.visible = false;
    $("#h-tip").hidden = true;
    A.sfx("open");
    A.duck(true);
    holding = null;
    JOB.start(car.problem.type, car, { scene, camera, P, mii, round: G.round + 1, big, ray: rayAt, pickGround }, (res) => {
      A.duck(false);
      G.mini = null;
      if (car.problem) {
        car.problem.busy = false;
        car.parts.sprite.visible = true;
      }
      if (res && car.problem) jobDone(car, res);
      P.target = null;
    });
  }

  /* ---------- HUD ---------- */
  const hud = {
    score: $("#h-score"),
    combo: $("#h-combo"),
    time: $("#h-time"),
    shift: $("#h-shift"),
    rate: $("#h-rate"),
    stars: $("#h-stars"),
    prompt: $("#h-prompt"),
    jobs: $("#h-jobs"),
  };
  const h2 = $("#hud2d"),
    hx = h2.getContext("2d");
  let shownScore = 0;
  function bumpHud() {
    hud.score.parentNode.classList.remove("bump");
    void hud.score.offsetWidth;
    hud.score.parentNode.classList.add("bump");
  }
  const jobEls = new Map();
  function drawHud(dt) {
    shownScore += (G.score - shownScore) * Math.min(1, dt * 8);
    if (Math.abs(G.score - shownScore) < 1) shownScore = G.score;
    hud.score.textContent = fmt(shownScore);
    hud.combo.textContent = G.combo >= 2 ? G.combo + " in a row · x" + [1, 1, 1.2, 1.4, 1.6, 1.8, 2][Math.min(G.combo, 6)].toFixed(1) : "";
    const s = Math.max(0, Math.ceil(G.left)),
      m = Math.floor(s / 60);
    hud.time.textContent = m + ":" + String(s % 60).padStart(2, "0");
    hud.time.parentNode.classList.toggle("hurry", G.left <= 10 && G.state === "play");
    hud.shift.textContent = "Shift " + (G.round + 1) + " · " + shift().name;
    const r = G.rateSum / G.rateN;
    hud.rate.textContent = r.toFixed(1);
    hud.stars.style.setProperty("--r", r / 5);

    // the job list
    const act = active();
    for (const [car, e] of jobEls)
      if (!act.includes(car)) {
        e.remove();
        jobEls.delete(car);
      }
    for (const car of act) {
      let e = jobEls.get(car);
      if (!e) {
        e = document.createElement("div");
        e.className = "job";
        e.innerHTML = '<canvas width="64" height="64"></canvas><div><b></b><i><u></u></i></div><span></span>';
        WG.drawIcon(e.querySelector("canvas").getContext("2d"), car.problem.type, 32, 34, 1);
        e.querySelector("b").textContent = KIND[car.problem.type].label;
        e.addEventListener("click", () => {
          if (G.state === "play" && !JOB.active) goTo(car);
        });
        hud.jobs.appendChild(e);
        jobEls.set(car, e);
      }
      const f = clamp(car.problem.left / car.problem.max, 0, 1);
      const u = e.querySelector("u");
      u.style.transform = "scaleX(" + f + ")";
      u.style.background = f > 0.5 ? "#41c45a" : f > 0.25 ? "#ffbf1f" : "#ff4b3e";
      e.querySelector("span").textContent = Math.round(Math.hypot(car.pos.x - P.pos.x, car.pos.z - P.pos.z)) + "m";
      e.classList.toggle("on", P.target === car);
      e.classList.toggle("low", f < 0.25);
    }

    // edge arrows for problems off screen
    const w = h2.clientWidth,
      h = h2.clientHeight;
    hx.clearRect(0, 0, w, h);
    const showArrows = G.state === "play" && !JOB.active;
    if (h2.hidden === showArrows) h2.hidden = !showArrows;
    if (!showArrows) return;
    const v = new T.Vector3();
    for (const car of act) {
      v.set(car.pos.x, car.pos.y + 3, car.pos.z).project(camera);
      let sx = (v.x * 0.5 + 0.5) * w,
        sy = (-v.y * 0.5 + 0.5) * h;
      const behind = v.z > 1;
      if (behind) {
        sx = w - sx;
        sy = h - sy;
      }
      const m2 = 46;
      if (!behind && sx > m2 && sx < w - m2 && sy > m2 + 70 && sy < h - m2) continue;
      const cx = w / 2,
        cy = h / 2,
        dx = sx - cx,
        dy = sy - cy,
        k = Math.min((w / 2 - m2) / Math.abs(dx || 1e-3), (h / 2 - m2) / Math.abs(dy || 1e-3)),
        ex = cx + dx * k,
        ey = cy + dy * k,
        a = Math.atan2(dy, dx),
        f = clamp(car.problem.left / car.problem.max, 0, 1),
        pulse = 1 + Math.sin(G.t * 8) * (f < 0.3 ? 0.1 : 0.03);
      hx.save();
      hx.translate(ex, ey);
      hx.scale(pulse, pulse);
      hx.save();
      hx.rotate(a);
      hx.fillStyle = KIND[car.problem.type].col;
      hx.strokeStyle = "#fff";
      hx.lineWidth = 3;
      hx.beginPath();
      hx.moveTo(40, 0);
      hx.lineTo(22, -14);
      hx.lineTo(22, 14);
      hx.closePath();
      hx.fill();
      hx.stroke();
      hx.restore();
      hx.fillStyle = "#fff";
      hx.beginPath();
      hx.arc(0, 0, 24, 0, 7);
      hx.fill();
      hx.lineWidth = 5;
      hx.strokeStyle = "#e6ebf0";
      hx.beginPath();
      hx.arc(0, 0, 21, 0, 7);
      hx.stroke();
      hx.strokeStyle = f > 0.5 ? "#41c45a" : f > 0.25 ? "#ffbf1f" : "#ff4b3e";
      hx.beginPath();
      hx.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
      hx.stroke();
      WG.drawIcon(hx, car.problem.type, 0, 1, 0.55);
      hx.restore();
    }
  }
  function floater(pos, a, b, q, delay) {
    const e = document.createElement("div");
    e.className = "floater q" + q;
    e.innerHTML = "<b>" + a + "</b><small>" + b + "</small>";
    e.style.animationDelay = (delay || 0) + "s";
    $("#floaters").appendChild(e);
    e._p = pos.clone().add(new T.Vector3(0, 4.5, 0));
    floaters.push(e);
    setTimeout(() => {
      e.remove();
      floaters.splice(floaters.indexOf(e), 1);
    }, 1600 + (delay || 0) * 1000);
  }
  const floaters = [];
  function placeFloaters() {
    const v = new T.Vector3();
    for (const e of floaters) {
      v.copy(e._p).project(camera);
      e.style.left = ((v.x * 0.5 + 0.5) * innerWidth).toFixed(1) + "px";
      e.style.top = ((-v.y * 0.5 + 0.5) * innerHeight).toFixed(1) + "px";
    }
  }
  let tipT = 0;
  function tip(html, secs) {
    const e = $("#h-tip");
    e.innerHTML = html;
    e.hidden = false;
    clearTimeout(tipT);
    tipT = setTimeout(() => (e.hidden = true), secs * 1000);
  }
  function big(text, cls) {
    const e = $("#big");
    e.className = "";
    void e.offsetWidth;
    e.textContent = text;
    e.className = "show " + (cls || "");
  }

  /* ---------- input ---------- */
  const keys = new Set();
  addEventListener("keydown", (e) => {
    A.init();
    if (JOB.active && G.state === "play") {
      if (!e.repeat) keys.add(e.code);
      if (e.code === "Escape") JOB.cancel();
      else if (JOB.key(e.code)) e.preventDefault();
      if (/^Arrow/.test(e.code) || e.code === "Space") e.preventDefault();
      return;
    }
    if (e.repeat && !/^(Arrow|Key[WASD])/.test(e.code)) return;
    keys.add(e.code);
    if (G.state === "play") {
      if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") {
        const n = nearProblem();
        if (n) startJob(n);
        e.preventDefault();
      }
      if (e.code === "Escape" || e.code === "KeyP") pause();
      if (/^Arrow/.test(e.code) || e.code === "Space") e.preventDefault();
    } else if (G.state === "pause" && (e.code === "Escape" || e.code === "KeyP")) resume();
    else if (G.state === "title" && !document.activeElement.closest("button") && (e.code === "Enter" || e.code === "Space")) {
      e.preventDefault();
      A.sfx("select");
      resetRun();
      openBrief();
    } else if (G.state === "howto" && e.code === "Escape") toTitle();
    // menus: arrow keys move focus between buttons
    const scr = document.querySelector(".screen:not([hidden])");
    if (scr && /^Arrow(Up|Down|Left|Right)$/.test(e.code)) {
      const bs = Array.from(scr.querySelectorAll("button"));
      if (bs.length) {
        const i = bs.indexOf(document.activeElement),
          d = e.code === "ArrowDown" || e.code === "ArrowRight" ? 1 : -1;
        bs[(i + d + bs.length) % bs.length].focus();
        e.preventDefault();
      }
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  const ray = new T.Raycaster();
  function rayAt(clientX, clientY) {
    const r = cv.getBoundingClientRect(),
      nx = ((clientX - r.left) / r.width) * 2 - 1,
      ny = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera({ x: nx, y: ny }, camera);
    return ray;
  }
  function pickGround(clientX, clientY) {
    const h = pick(clientX, clientY, true);
    return h && !h.car ? h : null;
  }
  function pick(clientX, clientY, groundOnly) {
    rayAt(clientX, clientY);
    const o = ray.ray.origin,
      d = ray.ray.direction;
    // a robotaxi with a problem?
    let bestC = null,
      bd = 3.2;
    for (const c of Traffic.cars) {
      if (!c.problem || groundOnly) continue;
      for (const hgt of [1.1, 4.2]) {
        const px = c.pos.x - o.x,
          py = c.pos.y + hgt - o.y,
          pz = c.pos.z - o.z,
          t = px * d.x + py * d.y + pz * d.z;
        if (t < 0) continue;
        const dist = Math.hypot(px - d.x * t, py - d.y * t, pz - d.z * t);
        if (dist < bd) {
          bd = dist;
          bestC = c;
        }
      }
    }
    if (bestC) return { car: bestC };
    // march the ray to the ground
    let tPrev = 0;
    for (let t = 1; t < 600; t *= 1.04) {
      const x = o.x + d.x * t,
        y = o.y + d.y * t,
        z = o.z + d.z * t;
      if (y < W.groundY(x, z)) {
        let a = tPrev,
          b = t;
        for (let k = 0; k < 12; k++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m < W.groundY(o.x + d.x * m, o.z + d.z * m)) b = m;
          else a = m;
        }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
      tPrev = t;
    }
    return null;
  }
  function goTo(car) {
    P.target = car;
    P.path = findPath(P.pos.x, P.pos.z, car.pos.x, car.pos.z);
    P.repath = 0.5;
  }
  let holding = null;
  cv.addEventListener("pointerdown", (e) => {
    A.init();
    if (G.state === "play" && JOB.active) {
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (_) {}
      JOB.pointer("down", e);
      return;
    }
    if (G.state !== "play") return;
    const h = pick(e.clientX, e.clientY);
    if (!h) return;
    if (h.car) {
      A.sfx("select");
      if (Math.hypot(h.car.pos.x - P.pos.x, h.car.pos.z - P.pos.z) < 4.6) startJob(h.car);
      else goTo(h.car);
      return;
    }
    P.target = null;
    P.path = findPath(P.pos.x, P.pos.z, h.x, h.z);
    marker.position.set(h.x, W.groundY(h.x, h.z) + 0.08, h.z);
    markerT = 0;
    holding = { id: e.pointerId, x: e.clientX, y: e.clientY, t: 0 };
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  cv.addEventListener("pointermove", (e) => {
    if (JOB.active) JOB.pointer("move", e);
    if (holding && holding.id === e.pointerId) {
      holding.x = e.clientX;
      holding.y = e.clientY;
    }
  });
  const endHold = (e) => {
    if (JOB.active) JOB.pointer("up", e);
    if (holding && holding.id === e.pointerId) holding = null;
  };
  cv.addEventListener("pointerup", endHold);
  cv.addEventListener("pointercancel", endHold);
  cv.addEventListener(
    "wheel",
    (e) => {
      if (G.state === "play" && !JOB.active) {
        zoom = clamp(zoom * (e.deltaY > 0 ? 1.08 : 0.93), 22, 64);
        e.preventDefault();
      }
    },
    { passive: false },
  );

  function nearProblem() {
    const n = Traffic.nearest(P.pos.x, P.pos.z, (c) => !!c.problem);
    return n && n.d < 4.6 ? n.car : null;
  }

  /* ---------- buttons ---------- */
  function on(id, f) {
    const e = document.getElementById(id);
    e.addEventListener("click", (ev) => {
      A.init();
      f(ev);
    });
  }
  document.addEventListener(
    "pointerover",
    (e) => {
      const b = e.target.closest && e.target.closest("button");
      if (b && b !== document._hov) {
        document._hov = b;
        A.sfx("hover");
      }
    },
    true,
  );
  function focusFirst(sel) {
    if (TOUCH) return;
    const b = document.querySelector(sel + " button.primary") || document.querySelector(sel + " button");
    if (b) setTimeout(() => b.focus({ preventScroll: true }), 50);
  }
  function toTitle() {
    if (JOB.active) JOB.cancel();
    clearProblems();
    setState("title");
    W.setLook("day");
    A.music("title");
    updateBest();
    focusFirst("#title");
  }
  function pause() {
    if (G.state !== "play") return;
    G.paused = "play";
    setState("pause");
    A.sfx("open");
    A.duck(true);
    focusFirst("#pause");
  }
  function resume() {
    setState("play");
    A.sfx("back");
    A.duck(false);
  }
  on("t-start", () => {
    A.sfx("select");
    resetRun();
    openBrief();
  });
  on("t-how", () => {
    A.sfx("select");
    setState("howto");
    focusFirst("#howto");
  });
  on("hw-back", () => {
    A.sfx("back");
    toTitle();
  });
  on("br-go", () => {
    A.sfx("select");
    startRound();
  });
  on("br-back", () => {
    A.sfx("back");
    toTitle();
  });
  on("rs-next", () => {
    A.sfx("select");
    if (G.round + 1 < SHIFTS.length) {
      G.round++;
      openBrief();
    } else showFinal();
  });
  on("fn-again", () => {
    A.sfx("select");
    resetRun();
    openBrief();
  });
  on("fn-title", () => {
    A.sfx("back");
    toTitle();
  });
  on("h-pause", () => pause());
  on("pz-go", () => resume());
  on("pz-restart", () => {
    A.sfx("select");
    A.duck(false);
    G.score -= G.roundScore;
    clearProblems();
    openBrief();
  });
  on("pz-quit", () => {
    A.duck(false);
    A.sfx("back");
    toTitle();
  });
  const sndBtn = $("#snd");
  function syncSnd() {
    sndBtn.classList.toggle("off", A.muted);
    sndBtn.setAttribute("aria-pressed", String(!A.muted));
    sndBtn.title = A.muted ? "Sound off" : "Sound on";
  }
  on("snd", () => {
    A.setMuted(!A.muted);
    syncSnd();
    if (!A.muted) A.sfx("select");
  });
  syncSnd();
  // the first touch anywhere wakes the audio
  const wake = () => {
    A.init();
    if (G.state === "title") A.music("title");
    document.body.classList.add("woke");
    removeEventListener("pointerdown", wake, true);
    removeEventListener("keydown", wake, true);
  };
  addEventListener("pointerdown", wake, true);
  addEventListener("keydown", wake, true);

  /* ---------- camera ---------- */
  let zoom = TOUCH ? 46 : 38;
  const CAM = { pitch: 52 };
  const camPos = new T.Vector3(420 + Math.sin(0.6) * 2300, 640, -620 + Math.cos(0.6) * 2300),
    camLook = new T.Vector3(420, 60, -620),
    wantPos = new T.Vector3(),
    wantLook = new T.Vector3();
  function cameraUpdate(dt) {
    let k = 2.2;
    if (G.state === "title" || G.state === "howto" || G.state === "final") {
      // a slow orbit over Slop Skies' San Francisco, around the downtown end of the city
      const a = 0.6 + G.t * 0.025;
      wantLook.set(420, 60, -620);
      wantPos.set(420 + Math.sin(a) * 2300, 640, -620 + Math.cos(a) * 2300);
      k = 1.2;
    } else if (G.state === "brief" || G.state === "result") {
      const a = G.t * 0.06;
      wantLook.set(P.pos.x, P.pos.y + 2, P.pos.z);
      wantPos.set(P.pos.x + Math.sin(a) * 60, P.pos.y + 44, P.pos.z + Math.cos(a) * 60);
      k = 1.5;
    } else if (JOB.active) {
      k = JOB.camera(wantPos, wantLook);
    } else {
      // a 3/4 view down onto the street; the crew member shows through the houses in front as a silhouette
      const pitch = (CAM.pitch * Math.PI) / 180;
      wantLook.set(P.pos.x, P.pos.y + 1, P.pos.z - 2);
      wantPos.set(P.pos.x, P.pos.y + 1 + Math.sin(pitch) * zoom, P.pos.z - 2 + Math.cos(pitch) * zoom);
      k = G.state === "play" ? 6 : 3;
    }
    const f = 1 - Math.exp(-k * dt);
    camPos.lerp(wantPos, f);
    camLook.lerp(wantLook, f);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // the aerial views need Slop Skies' long depth range, the street needs a near one
    const far = camPos.y - W.height(camPos.x, camPos.z) > 220,
      near = far ? 4 : 0.5,
      farP = far ? 60000 : 9000;
    if (camera.near !== near) {
      camera.near = near;
      camera.far = farP;
      camera.updateProjectionMatrix();
    }
  }

  /* ---------- the crew member ---------- */
  function playerUpdate(dt) {
    let ix = 0,
      iz = 0;
    const drives = JOB.active && JOB.active.drives;
    if (G.state === "play" && (!JOB.active || drives)) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) iz -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) iz += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
      if ((ix || iz) && !drives) {
        P.path = [];
        P.target = null;
      }
      // hold to steer
      if (holding && !drives) {
        holding.t -= dt;
        if (holding.t <= 0) {
          holding.t = 0.2;
          const h = pick(holding.x, holding.y);
          if (h && !h.car) {
            P.path = findPath(P.pos.x, P.pos.z, h.x, h.z);
            marker.position.set(h.x, W.groundY(h.x, h.z) + 0.08, h.z);
            markerT = 0.3;
          }
        }
      }
      // chase a moving target
      if (P.target && !JOB.active) {
        if (!P.target.problem) P.target = null;
        else {
          const d = Math.hypot(P.target.pos.x - P.pos.x, P.target.pos.z - P.pos.z);
          if (d < 3.7) {
            startJob(P.target);
          } else {
            P.repath -= dt;
            if (P.repath <= 0 || !P.path.length) {
              P.repath = 0.6;
              P.path = findPath(P.pos.x, P.pos.z, P.target.pos.x, P.target.pos.z);
            }
          }
        }
      }
    }
    let dx = 0,
      dz = 0;
    if (ix || iz) {
      const l = Math.hypot(ix, iz);
      dx = ix / l;
      dz = iz / l;
    } else if (P.path.length && G.state === "play" && !JOB.active) {
      const [wx, wz] = P.path[0],
        ddx = wx - P.pos.x,
        ddz = wz - P.pos.z,
        d = Math.hypot(ddx, ddz);
      if (d < 0.5) P.path.shift();
      else {
        dx = ddx / d;
        dz = ddz / d;
      }
    }
    const want = dx || dz ? 11 : 0;
    if (drives) JOB.active.drive(dt, ix, iz);
    else P.speed += clamp(want - P.speed, -40 * dt, 30 * dt);
    if (P.speed > 0.05 && !drives) {
      if (dx || dz) P.dir = [dx, dz];
      const [ux, uz] = P.dir || [0, 1],
        step = P.speed * dt,
        nx = P.pos.x + ux * step,
        nz = P.pos.z + uz * step,
        ok = (x, z) => !W.isBlocked(x, z, 0.4);
      // if a car nudged us into a wall, let us walk out of it
      if (!ok(P.pos.x, P.pos.z) && W.inArea(nx, nz)) {
        P.pos.x = nx;
        P.pos.z = nz;
      } else if (ok(nx, nz)) {
        P.pos.x = nx;
        P.pos.z = nz;
      } else if (ok(nx, P.pos.z)) P.pos.x = nx;
      else if (ok(P.pos.x, nz)) P.pos.z = nz;
      else P.speed = 0;
      P.yawWant = Math.atan2(-ux, -uz);
    }
    // don't walk through the cars
    for (const c of Traffic.cars) {
      const rx = P.pos.x - c.pos.x,
        rz = P.pos.z - c.pos.z;
      if (Math.abs(rx) > 4 || Math.abs(rz) > 4) continue;
      const along = rx * c.fwd.x + rz * c.fwd.z,
        lat = -rx * c.fwd.z + rz * c.fwd.x,
        ea = 2.45 - Math.abs(along),
        el = 1.25 - Math.abs(lat);
      if (ea > 0 && el > 0) {
        if (el < ea) {
          const s = Math.sign(lat) || 1;
          P.pos.x += -c.fwd.z * s * el;
          P.pos.z += c.fwd.x * s * el;
        } else {
          const s = Math.sign(along) || 1;
          P.pos.x += c.fwd.x * s * ea;
          P.pos.z += c.fwd.z * s * ea;
        }
      }
    }
    P.pos.y = lerp(P.pos.y, W.groundY(P.pos.x, P.pos.z), Math.min(1, dt * 18));
    // step to the work spot (the street-side front corner, out of the camera's way) and face the car
    if (G.mini && JOB.active && !drives) {
      const c = G.mini,
        spot = c.parts.g.localToWorld(JOB.SPOT.clone()),
        f = Math.min(1, dt * 6);
      if (!W.isBlocked(spot.x, spot.z, 0.3)) {
        P.pos.x += (spot.x - P.pos.x) * f;
        P.pos.z += (spot.z - P.pos.z) * f;
      }
      P.yawWant = Math.atan2(-(c.pos.x - P.pos.x), -(c.pos.z - P.pos.z));
      P.work += dt;
    } else P.work = 0;
    if (P.yawWant !== undefined) {
      let d = P.yawWant - P.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      P.yaw += d * Math.min(1, dt * 14);
    }
    // animate
    if (drives) {
      JOB.active.pose(mii, dt);
      mii.root.position.copy(P.pos);
      mii.root.rotation.y = P.yaw;
      return;
    }
    const sp = P.speed / 11;
    P.phase += dt * (4 + 9 * sp);
    const sw = Math.sin(P.phase) * 0.8 * sp;
    mii.legs[0].rotation.x = sw;
    mii.legs[1].rotation.x = -sw;
    if (P.work > 0) {
      const a = Math.sin(P.work * 14);
      mii.arms[0].rotation.x = -1.4 + a * 0.4;
      mii.arms[1].rotation.x = -1.2 - a * 0.4;
    } else {
      mii.arms[0].rotation.x = -sw * 0.9;
      mii.arms[1].rotation.x = sw * 0.9;
    }
    mii.body.position.y = Math.abs(Math.sin(P.phase)) * 0.09 * sp + (sp < 0.1 ? Math.sin(G.t * 2) * 0.012 : 0);
    mii.body.rotation.x = -0.12 * sp;
    mii.head.rotation.z = sp < 0.1 && !P.work ? Math.sin(G.t * 1.3) * 0.05 : 0;
    const stepI = Math.floor(P.phase / Math.PI);
    if (stepI !== P.stepI && sp > 0.4) A.sfx("step");
    P.stepI = stepI;
    mii.root.position.copy(P.pos);
    mii.root.rotation.y = P.yaw;
  }

  /* ---------- the loop ---------- */
  function playUpdate(dt) {
    const s = shift();
    if (G.state === "play") {
      G.left -= dt;
      // hurry up
      if (G.left <= 20 && !G.hurry) {
        G.hurry = true;
        A.setTempo(1.12);
        A.setIntense(true);
        big("Hurry up!", "hurry");
      }
      if (G.left <= 10 && G.left > 0) {
        const sec = Math.ceil(G.left);
        if (sec !== G.tickS) {
          G.tickS = sec;
          A.sfx(sec % 2 ? "tick" : "tock");
        }
      }
      if (G.left <= 0 && !JOB.active) {
        G.left = 0;
        timeUp();
        return;
      }
      if (G.left <= 0) G.left = 0;
      // spawn
      if (G.left > 6) {
        G.spawnT -= dt;
        if (G.spawn2 !== undefined) {
          G.spawn2 -= dt;
          if (G.spawn2 <= 0 && active().length < s.max && spawnProblem()) G.spawn2 = undefined;
        }
        if (G.spawnT <= 0) {
          if (active().length < s.max) {
            if (spawnProblem()) G.spawnT = rr(s.every[0], s.every[1]);
          } else G.spawnT = 1;
        }
      }
      // patience
      for (const c of Traffic.cars) {
        if (c.coolT !== undefined) {
          c.coolT -= dt;
          if (c.coolT <= 0) c.coolT = undefined;
        }
        if (!c.problem || c.problem.busy) continue;
        c.problem.left -= dt;
        if (c.problem.left <= 0) jobMissed(c);
      }
      // the prompt
      const n = !JOB.active && nearProblem();
      if (n) {
        hud.prompt.hidden = false;
        hud.prompt.innerHTML = TOUCH ? "Tap the car to help!" : "<kbd>Space</kbd> Help this car";
      } else hud.prompt.hidden = true;
    } else hud.prompt.hidden = true;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (document.hidden) return;
    G.t += dt;
    G.stateT += dt;
    const paused = G.state === "pause";
    if (!paused) {
      Traffic.update(dt, G.t, G.state === "play" || G.state === "ready" ? P.pos : null, W.look);
      for (const c of Traffic.cars)
        if (c.beeped === G.t) A.sfx("carBeep", clamp((c.pos.x - P.pos.x) / 40, -1, 1));
      playerUpdate(dt);
      playUpdate(dt);
      JOB.update(dt);
    }
    if (G.state === "ready" && G.stateT > 1.5) go();
    if (G.state === "timeup" && G.stateT > 2.6) showResult();
    cameraUpdate(dt);
    W.update(G.t, dt, P.pos, camera, innerWidth, innerHeight);
    markerT += dt;
    marker.material.opacity = clamp(1 - markerT * 1.8, 0, 0.9);
    marker.scale.setScalar(1 + markerT * 1.2);
    renderer.render(scene, camera);
    drawHud(dt);
    placeFloaters();
  }

  function resize() {
    const w = innerWidth,
      h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 58 : 40;
    camera.updateProjectionMatrix();
    const dpr = Math.min(2, devicePixelRatio || 1);
    h2.width = w * dpr;
    h2.height = h * dpr;
    hx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  // let the city settle before the curtain lifts
  for (let i = 0; i < 30; i++) Traffic.update(1 / 30, i / 30, null, "day");
  setState("title");
  updateBest();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
    const boot = $("#boot");
    boot.classList.add("gone");
    setTimeout(() => boot.remove(), 600);
    focusFirst("#title");
  });
  if (TOUCH) document.body.classList.add("touch");
  WG.G = G;
  WG.P = P;
  WG.debug = {
    scene,
    camera,
    renderer,
    spawnProblem,
    startJob,
    findPath,
    CAM,
    setZoom: (z) => (zoom = z),
  };
})();
