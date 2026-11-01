/* Waymo Care · Sunday Drive · the swoop. Taking care of a car eases the camera down out of the sky to the street patch
   of the district the car is driving through (the arcade's play areas, js/world.js ZONES), where a robotaxi wearing the
   car's ring colour pulls over with the need, the crew member jogs up and plays the real job (js/jobs.js through
   game.js startJob) with no clock running, and the camera glides back up to the bird's-eye city. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    Traffic = WG.Traffic;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const Sw = { active: null };
  const City = () => WG.sundayCity,
    Clouds = () => WG.sundayClouds;

  const fleetVisible = (on) => {
    for (const c of Traffic.cars) c.parts.root.visible = on;
  };
  Sw.fleetVisible = fleetVisible;
  function mapVisible(on) {
    City().show(on);
    Clouds().show(on);
  }

  // o: { car (a City car), kind, zone, look (the street's light), word(kind), onEnd(res), onUp() }
  Sw.start = function (o) {
    const g = WG.game;
    if (Sw.active) return false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const c = o.car,
      above = new T.Vector3(c.x + 120, c.y + 220, c.z + 160);
    Sw.active = Object.assign({}, o, {
      phase: "down",
      t: 0,
      from: g.camera.position.clone(),
      fromLook: new T.Vector3(),
      above,
      aboveLook: new T.Vector3(c.x, c.y, c.z),
      car: null,
      mapCar: c,
      street: false,
    });
    g.camera.getWorldDirection(Sw.active.fromLook).multiplyScalar(400).add(g.camera.position);
    g.setState("sundayCare");
    g.A.sfx("whoosh");
    g.A.duck(true);
    return true;
  };

  // halfway down, while the view is still high: the district's street patch, with a couple of robotaxis for company
  function street(a) {
    const g = WG.game;
    g.moveDistrict(a.zone);
    if (a.look) W.setLook(a.look);
    Traffic.n = 3;
    Traffic.reset();
    fleetVisible(true);
    mapVisible(false);
    g.mii.root.visible = true;
    a.street = true;
  }
  function pickCar(a) {
    const car = Traffic.cars.find((c) => c.canPull() && !c.problem);
    if (!car) return false;
    car.ringCol = new T.Color(a.mapCar.ring).getHex();
    const p = { type: a.kind, max: 1, left: 1 };
    if (a.kind === "doors") p.doors = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2 + ((Math.random() * 2) | 0));
    if (a.kind === "cone") p.n = 3 + ((Math.random() * 2) | 0);
    car.setProblem(p);
    car.pullOver();
    a.car = car;
    a.phase = "pull";
    a.t = 0;
    return true;
  }
  function beginJob(a) {
    const g = WG.game,
      car = a.car;
    const spot = car.parts.g.localToWorld(new T.Vector3(-2.6, 0, -4.6));
    g.P.pos.set(spot.x, W.groundY(spot.x, spot.z), spot.z);
    g.P.path = [];
    g.P.speed = 0;
    g.restPose();
    a.phase = "job";
    // round 1: the gentlest version of every job; no patience clock runs outside the arcade's shifts
    g.startJob(car, { round: 1, word: a.word, done: (res) => jobEnd(a, res) });
  }
  function jobEnd(a, res) {
    const car = a.car;
    if (car) {
      car.setProblem(null);
      car.state = "leaving";
      if (res) car.hop = 1;
    }
    a.res = res;
    a.phase = "up";
    a.t = 0;
    a.from = WG.game.camera.position.clone();
    a.fromLook = new T.Vector3();
    WG.game.camera.getWorldDirection(a.fromLook).multiplyScalar(30).add(a.from);
    WG.game.setState("sunday");
    WG.game.A.duck(false);
    WG.game.A.sfx("whoosh");
    if (a.onEnd) a.onEnd(res);
  }
  // backing out before the job has started
  Sw.abort = function () {
    const a = Sw.active;
    if (!a || a.phase === "job" || a.phase === "up") return false;
    if (a.car) {
      a.car.setProblem(null);
      a.car.state = "leaving";
    }
    jobEnd(a, null);
    return true;
  };
  // leaving the mode in the middle of a swoop: put everything straight back at once
  Sw.reset = function () {
    const a = Sw.active;
    if (!a) return;
    if (WG.jobs.active) WG.jobs.cancel();
    if (a.car) {
      a.car.setProblem(null);
      a.car.state = "leaving";
    }
    Sw.active = null;
    WG.game.A.duck(false);
  };

  Sw.update = function (dt) {
    const a = Sw.active;
    if (!a) return;
    a.t += dt;
    if (a.phase === "down") {
      if (!a.street && a.t > 0.8) street(a);
      if (a.street && a.t > 1.6) pickCar(a);
    } else if (a.phase === "pull") {
      if (a.car.state === "problem" && a.t > 1.2) beginJob(a);
      if (a.t > 8) {
        a.car.setProblem(null);
        a.car.state = "leaving";
        a.phase = "down";
        a.car = null;
      }
    } else if (a.phase === "up") {
      if (a.t > 0.9 && a.street) {
        fleetVisible(false);
        WG.game.mii.root.visible = false;
        mapVisible(true);
        a.street = false;
        if (a.onUp) a.onUp();
      }
      if (a.t > 2.4) Sw.active = null;
    }
  };

  // the camera through the swoops (game.js's job camera takes over during the job itself)
  const _p = new T.Vector3(),
    _l = new T.Vector3();
  Sw.camera = function (dt, pos, look) {
    const a = Sw.active;
    if (a.phase === "down" || (a.phase === "pull" && !a.car)) {
      const e = ease(Math.min(1, a.t / 1.6));
      if (a.street) {
        a.aboveLook.copy(W.center);
        a.above.set(W.center.x + 70, W.center.y + 120, W.center.z + 90);
      }
      pos.lerpVectors(a.from, a.above, e);
      look.lerpVectors(a.fromLook, a.aboveLook, e);
      return 7;
    }
    if (a.phase === "pull" || a.phase === "job") {
      const c = a.car,
        fx = c.fwd.x,
        fz = c.fwd.z,
        k = Math.min(1, a.t / 2);
      look.set(c.pos.x, c.pos.y + 1.2, c.pos.z);
      pos.set(c.pos.x + fz * 10 - fx * 12, c.pos.y + 9 + (1 - k) * 40, c.pos.z - fx * 10 - fz * 12);
      return 2.6;
    }
    const e = ease(Math.min(1, a.t / 2.2));
    City().camera(dt, _p, _l);
    pos.lerpVectors(a.from, _p, e);
    look.lerpVectors(a.fromLook, _l, e);
    return 6;
  };

  WG.sundaySwoop = Sw;
})();
