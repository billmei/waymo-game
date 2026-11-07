// Care transition regressions without a browser: node --test tools/adopt_care_test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const THREE = require("../lib/three.min.js");

function setup() {
  let job = null, result = null, resets = 0;
  const car = {
    state: "drive", problem: null,
    parts: { root: {}, g: { localToWorld: (v) => v } },
    canPull: () => true,
    setProblem(p) { this.problem = p; },
    pullOver() { this.state = "pulling"; },
  };
  const WG = {
    world: { groundY: () => 0 },
    adoptData: { STAGES: [] },
    adoptSim: { CARE: { Home: "lombard" } },
    Traffic: { cars: [car], reset() { resets++; } },
    adoptMap: { hoodPos: () => ({ x: 0, y: 0, z: 0 }), show() {} },
    game: {
      camera: new THREE.PerspectiveCamera(), mii: { root: {} },
      P: { pos: new THREE.Vector3() },
      A: { sfx() {}, duck() {} }, restPose() {}, moveDistrict() {},
      setState(state) { this.state = state; },
      startJob(c, options) { job = { car: c, options }; },
    },
  };
  const context = vm.createContext({ window: { WG }, THREE, document: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/adopt/care.js"), "utf8"), context);
  const C = WG.adoptCare;
  const start = () => C.start({ kind: "cone", hood: "Home", onEnd: (res, reason) => { result = { res, reason }; } });
  const pull = () => { assert.equal(start(), true); C.update(1); C.update(1); assert.equal(C.active.phase, "pull"); };
  return { C, WG, car, start, pull, job: () => job, result: () => result, resets: () => resets };
}

test("a car arriving after eight seconds starts its job without running the retry branch", () => {
  const f = setup();
  f.pull();
  f.car.state = "problem";
  f.C.active.t = 8;
  f.C.update(0.1);
  assert.equal(f.C.active.phase, "job");
  assert.equal(f.C.active.car, f.car);
  assert.equal(f.car.problem.type, "cone");
  assert.equal(f.job().car, f.car);
  f.job().options.done({ q: 2 });
  assert.equal(f.C.active.phase, "up");
  assert.equal(f.result().res.q, 2);
});

test("a blocked pull-over retries and a second car can start the job", () => {
  const f = setup();
  f.pull();
  f.C.update(8.1);
  assert.equal(f.C.active.phase, "down");
  assert.equal(f.C.active.car, null);
  assert.equal(f.car.problem, null);
  f.car.state = "drive";
  f.C.update(1);
  f.car.state = "problem";
  f.C.update(1.3);
  assert.equal(f.C.active.phase, "job");
});

test("no available street car refreshes the fleet and eventually releases the care lock", () => {
  const f = setup();
  f.car.canPull = () => false;
  assert.equal(f.start(), true);
  for (let i = 0; i < 25; i++) f.C.update(1);
  assert.ok(f.resets() > 1);
  assert.equal(f.C.active.phase, "up");
  assert.equal(f.result().reason, "timeout");
  assert.equal(f.WG.game.state, "adopt");
  f.C.update(2.5);
  assert.equal(f.C.active, null);
  assert.equal(f.start(), true);
});

test("a refreshed fleet can recover before the setup deadline", () => {
  const f = setup();
  f.car.canPull = () => false;
  f.start();
  for (let i = 0; i < 9; i++) f.C.update(1);
  assert.ok(f.resets() > 1);
  f.car.canPull = () => true;
  f.C.update(1);
  f.car.state = "problem";
  f.C.update(1.3);
  assert.equal(f.C.active.phase, "job");
});

test("overlapping requests are rejected, and cancelling allows an immediate retry", () => {
  const f = setup();
  f.pull();
  const first = f.C.active;
  assert.equal(f.start(), false);
  assert.equal(f.C.active, first);
  f.C.abort();
  assert.equal(f.car.problem, null);
  assert.equal(f.result().res, null);
  assert.equal(f.start(), true);
  assert.notEqual(f.C.active, first);
  assert.equal(f.C.active.phase, "down");
});
