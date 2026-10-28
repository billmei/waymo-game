// Waymo Care · Adopt-a-Waymo balance check. Runs js/adopt/sim.js in Node (it doesn't touch three.js) for a number of
// in-game days with a simple "player" who does the dailies, plays the arcade, keeps the fleet's lowest needs topped up
// (items first, hands-on care at a Care Spot otherwise), adopts when a slot opens and upgrades the charger bays.
// It prints Fares earned per day, how often each need dips below 20, and when Crew Rank milestones arrive.
//
//   node tools/adopt_sim.js            # 30 days
//   node tools/adopt_sim.js 10 --seed 7 --quiet
//   node tools/adopt_sim.js 10 --lazy         # nobody tops up the needs: sulking, naps and tows
//   node tools/adopt_sim.js 3 --saves         # also check old, corrupted and long-gap saves
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
const args = process.argv.slice(2),
  days = +(args.find((a) => /^\d+$/.test(a)) || 30),
  seed = args.includes("--seed") ? +args[args.indexOf("--seed") + 1] : 12345,
  quiet = args.includes("--quiet"),
  lazy = args.includes("--lazy"); // a player who never looks after the needs
const ROOT = path.join(__dirname, "..");
// --saves: a fake localStorage, for the save checks at the bottom
const mem = {};
if (args.includes("--saves"))
  globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ["js/adopt/data.js", "js/adopt/state.js", "js/adopt/sim.js"]) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), "utf8"), { filename: f });
const { adoptData: D, adoptState: St, adoptSim: Sim } = globalThis.WG;

// the districts' centres, straight out of js/isle.js (ISL.DIST)
const isle = fs.readFileSync(path.join(ROOT, "js/isle.js"), "utf8"),
  m = /const DIST = (\[[\s\S]*?\n\s*\]);/.exec(isle);
Sim.setGeo(eval(m[1]));

// one in-game day is one real day, so the dailies come back every morning
const T0 = Date.parse("2026-10-27T08:00:00");
let S = St.fresh(T0, seed);
Sim.now = () => T0 + (S.clock.day - 1) * 864e5 + (S.clock.minute - 480) * 60e3;
Sim.start(S);
const log = [],
  low = { charge: 0, shine: 0, cozy: 0, senses: 0, clarity: 0, mood: 0 },
  milestones = {};
let lowSamples = 0;
const src = { rides: 0, other: 0 };
Sim.on = (ev) => {
  if (ev.type === "ride") src.rides += ev.fare;
  if (ev.type === "rank") milestones[ev.rank] = S.clock.day;
  if (!quiet && ["rank", "stage", "trophy", "nap", "adopt"].includes(ev.type)) log.push("  day " + S.clock.day + " " + Sim.fmtClock(S.clock.minute) + "  " + ev.text);
};

const NEED_ITEM = { charge: "snack_capacitor", shine: "wax_sea_salt", cozy: "cozy_air", senses: "sense_lens", clarity: "clar_reboot_tea" };
function player() {
  // the dailies
  for (const id of Object.keys(D.DAILIES)) {
    if (!Sim.dailyState(S, id).open) continue;
    const car = S.cars[0];
    Sim.claimDaily(S, id, { car: car && car.id, q: 1, sneak: true });
  }
  Sim.fish(S);
  // adopt a car when there's a free slot (the first is free)
  if (S.cars.length < S.unlocked.carSlots && S.player.fares >= Sim.adoptFee(S) + 200) {
    const r = Sim.adopt(S, 0, "Car" + (S.adopted + 1));
    if (!r.ok && !quiet) log.push("  adopt failed: " + r.msg);
  }
  if (S.player.fares > Sim.upgradeCost(S, "bays") + 800 && S.garage.bays < S.cars.length) Sim.upgrade(S, "bays");
}
function arcade() {
  for (const k of ["charge", "dirty", "vacuum"]) for (let i = 0; i < 3; i++) Sim.arcadeResult(S, k, { q: 1, time: 22 });
}
function care() {
  if (lazy) return;
  for (const car of S.cars) {
    const w = Sim.worst(car);
    if (w.v >= 35) continue;
    if (Sim.careSpot(car) && !Sim.busy(car)) {
      Sim.careDone(S, car.id, Sim.NEED_JOB[w.need], 1);
      continue;
    }
    const item = NEED_ITEM[w.need];
    if (!Sim.has(S, item) && S.player.fares > D.ITEMS[item].price * 3) S.inventory[item] = 1 + (S.player.fares -= D.ITEMS[item].price, 0);
    if (Sim.has(S, item)) Sim.useItem(S, car.id, item);
    else if (w.v < 25 && !Sim.busy(car)) Sim.callToCare(S, car.id);
  }
}

const perDay = [];
for (let d = 1; d <= days; d++) {
  const f0 = S.player.fares;
  let earned = 0;
  const hookFares = Sim.fares;
  Sim.realTick(S);
  player();
  arcade();
  for (let h = 0; h < 18; h++) {
    Sim.run(S, 60);
    care();
    for (const car of S.cars) {
      lowSamples++;
      for (const k of Object.keys(low)) if (car.needs[k] < 20) low[k]++;
    }
    if (S.clock.night) break;
  }
  let guard = 0;
  while (S.clock.night && !S.clock.sleepReady && guard++ < 600) Sim.run(S, 1);
  const T = S.today;
  src.other += T.fares;
  perDay.push({ day: S.clock.day, fares: T.fares, rides: Object.values(T.rides).reduce((a, b) => a + b, 0), cars: S.cars.length, rank: S.player.rank, bank: S.player.fares });
  Sim.sleep(S);
}

console.log("Adopt-a-Waymo balance run: " + days + " in-game days, seed " + seed + "\n");
console.log("day  cars  rides   ◎earned   ◎bank   rank");
for (const r of perDay) console.log(String(r.day).padStart(3) + "  " + String(r.cars).padStart(4) + "  " + String(r.rides).padStart(5) + "  " + String(r.fares).padStart(8) + "  " + String(r.bank).padStart(7) + "  " + String(r.rank).padStart(5));
const avg = (k, from, to) => {
  const xs = perDay.filter((r) => r.day >= from && r.day <= to);
  return xs.length ? Math.round(xs.reduce((a, r) => a + r[k], 0) / xs.length) : 0;
};
console.log("\nAverage ◎ a day: days 1–5 " + avg("fares", 1, 5) + ", days 6–15 " + avg("fares", 6, 15) + ", days 16–30 " + avg("fares", 16, 30));
console.log("Share of ◎ from rides: " + Math.round((100 * src.rides) / Math.max(1, src.other)) + "%");
console.log("Time spent below 20 (share of car-hours): " + Object.entries(low).map(([k, v]) => k + " " + ((100 * v) / Math.max(1, lowSamples)).toFixed(1) + "%").join(", "));
console.log("Crew Rank milestones: " + [2, 5, 6, 9, 10, 12, 14].map((r) => "rank " + r + " day " + (milestones[r] || "—")).join(", ") + "  (targets: rank 5 ≈ day 3, rank 9 ≈ day 8, rank 10 ≈ day 10)");
console.log("Stamps " + Object.keys(S.album.stamps).length + "/" + D.STAMPS.length + ", rider cards " + Object.keys(S.album.cards).length + ", trophies " + S.player.trophies.length);
for (const c of S.cars) console.log("  " + c.name + ": " + c.stage + ", " + c.km.toFixed(0) + " km, " + c.rides + " rides, bond " + c.bond.toFixed(1) + ", level " + Sim.level(c) + ", needs " + Object.entries(c.needs).map(([k, v]) => k + " " + Math.round(v)).join(" "));
if (!quiet && log.length) console.log("\nEvents:\n" + log.slice(0, 60).join("\n"));

// the saves: an old save missing newer fields, a corrupted one, and three days away
if (args.includes("--saves")) {
  const ok = (c, m) => console.log((c ? "  ✓ " : "  ✗ ") + m) || (c || (process.exitCode = 1));
  console.log("\nSave checks:");
  St.save(S, Sim.now());
  const good = mem[St.KEY];
  // an "old" save: drop fields a later version added
  const old = JSON.parse(good);
  delete old.arcade;
  delete old.show;
  delete old.cars[0].gear;
  delete old.cars[0].hoodTime;
  mem[St.KEY] = JSON.stringify(old);
  let L = St.load(Sim.now());
  ok(L.arcade && L.show && L.cars[0].gear && L.cars[0].hoodTime && !L.isNew, "an old save loads, with the missing fields filled in");
  ok(L.cars.length === S.cars.length && L.player.fares === S.player.fares, "…and keeps its cars and Fares");
  // a corrupted save: the last good copy (wc.adopt.bak) comes back, the broken text is kept aside
  mem[St.BAK] = good;
  mem[St.KEY] = good.slice(0, good.length / 2);
  L = St.load(Sim.now());
  ok(L.recovered && L.cars.length === S.cars.length, "a corrupted save restores the last good copy");
  ok(mem["wc.adopt.corrupt"] && mem["wc.adopt.corrupt"].length === Math.floor(good.length / 2), "…and the damaged text is kept in wc.adopt.corrupt");
  // nothing readable at all: a fresh save
  mem[St.KEY] = "{oops";
  mem[St.BAK] = "also broken";
  L = St.load(Sim.now());
  ok(L.isNew && L.cars.length === 0, "with no good copy either, a fresh save starts");
  // three days away, gently: the fleet carries on for up to a day, and no need drops below 25
  const T = St.clone(S);
  for (const c of T.cars) for (const k of D.NEED_KEYS) c.needs[k] = 60;
  T.lastSeen = Sim.now() - 3 * 864e5;
  const away = St.catchUp(T, Sim.now());
  ok(away && away.minutes === 18 * 60, "three days away runs one in-game day (" + (away && away.minutes) + " minutes, " + (away && away.rides) + " rides, ◎" + (away && away.fares) + ")");
  ok(T.cars.every((c) => D.NEED_KEYS.every((k) => c.needs[k] >= 25)), "no need dropped below 25 while away");
  T.settings.offline = "paused";
  T.lastSeen = Sim.now() - 3 * 864e5;
  ok(St.catchUp(T, Sim.now()) === null, "with the clock paused while away, nothing happens");
}
