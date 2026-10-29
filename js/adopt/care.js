/* Waymo Care · Adopt-a-Waymo · hands-on care. The camera swoops down from the map to a Care Spot (one of the five
   street patches the arcade shifts are played on, js/world.js ZONES), a robotaxi there is dressed as the pet and pulls
   over with the problem, the crew member runs the real job (js/jobs.js, through game.js startJob), and the camera
   swoops back up. The same swoop runs the Arcade panel's games (a plain robotaxi, scored and paid by sim.js). */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    D = WG.adoptData,
    Sim = WG.adoptSim;
  const Traffic = WG.Traffic;
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const C = { active: null };

  const fleetVisible = (on) => {
    for (const c of Traffic.cars) c.parts.root.visible = on;
  };
  C.fleetVisible = fleetVisible;

  // start a swoop. o: { kind, carId (an adopted car) or arcade: true, hood (the Care Spot), onEnd(res) }
  C.start = function (o) {
    const g = WG.game,
      M = WG.adoptMap;
    if (C.active) {
      if (C.active.phase !== "up") return false;
      if (C.active.street) {
        fleetVisible(false);
        g.mii.root.visible = false;
        M.show(true);
      }
      C.active = null;
    }
    if (document.activeElement && document.activeElement.blur)
      document.activeElement.blur();
    const hood = o.hood,
      zone = Sim.CARE[hood] || "lombard",
      hp = M.hoodPos(hood);
    C.active = Object.assign({}, o, {
      zone,
      phase: "down",
      t: 0,
      from: g.camera.position.clone(),
      fromLook: new T.Vector3(),
      above: new T.Vector3(hp.x + 160, hp.y + 260, hp.z + 220),
      aboveLook: new T.Vector3(hp.x, hp.y, hp.z),
      car: null,
      street: false,
    });
    g.camera
      .getWorldDirection(C.active.fromLook)
      .multiplyScalar(400)
      .add(g.camera.position);
    g.setState("adoptCare");
    g.A.sfx("whoosh");
    g.A.duck(true);
    return true;
  };

  // halfway down, while the view is still high: move the street patch here, with two robotaxis for company and one
  // to dress as the pet
  function street(a) {
    const g = WG.game;
    g.moveDistrict(a.zone);
    Traffic.n = 3;
    Traffic.reset();
    fleetVisible(true);
    WG.adoptMap.show(false);
    g.mii.root.visible = true;
    a.street = true;
  }
  function pickCar(a) {
    const g = WG.game,
      car = Traffic.cars.find((c) => c.canPull() && !c.problem);
    if (!car) return false;
    const pet = a.carId && Sim.find(WG.adopt.S, a.carId);
    if (pet) {
      WG.adoptMap.dress(car.parts, pet);
      car.ringCol = new T.Color(pet.ring).getHex();
    } else car.ringCol = 0;
    const p = { type: a.kind, max: 1, left: 1 };
    if (a.kind === "doors")
      p.doors = [0, 1, 2, 3]
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + ((Math.random() * 2) | 0));
    if (a.kind === "cone") p.n = 3 + ((Math.random() * 3) | 0);
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
    // the crew member jogs in from the street side
    const spot = car.parts.g.localToWorld(new T.Vector3(-2.6, 0, -4.6));
    g.P.pos.set(spot.x, W.groundY(spot.x, spot.z), spot.z);
    g.P.path = [];
    g.P.speed = 0;
    g.restPose();
    a.phase = "job";
    const pet = a.carId && Sim.find(WG.adopt.S, a.carId),
      round = pet ? 1 + D.STAGES.findIndex((s) => s.id === pet.stage) : 2;
    g.startJob(car, { round, done: (res) => jobEnd(a, res) });
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
    WG.game.setState("adopt");
    WG.game.A.duck(false);
    WG.game.A.sfx("whoosh");
    if (a.onEnd) a.onEnd(res);
  }
  // the player backed out before the job started
  C.abort = function () {
    const a = C.active;
    if (!a || a.phase === "job" || a.phase === "up") return;
    if (a.car) {
      a.car.setProblem(null);
      a.car.state = "leaving";
    }
    jobEnd(a, null);
  };

  C.update = function (dt) {
    const a = C.active;
    if (!a) return;
    a.t += dt;
    if (a.phase === "down") {
      if (!a.street && a.t > 0.8) street(a);
      if (a.street && a.t > 1.6) pickCar(a);
    } else if (a.phase === "pull") {
      if (a.car.state === "problem" && a.t > 1.2) beginJob(a);
      // a car that never manages to pull over (it shouldn't happen): try another
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
        WG.adoptMap.show(true);
        a.street = false;
      }
      if (a.t > 2.4) C.active = null;
    }
  };

  // the camera through the swoops (game.js's job camera takes over during the job itself)
  const _p = new T.Vector3(),
    _l = new T.Vector3();
  C.camera = function (dt, pos, look) {
    const a = C.active;
    if (a.phase === "down" || (a.phase === "pull" && !a.car)) {
      const e = ease(Math.min(1, a.t / 1.6));
      if (a.street) {
        // over the street patch now: aim at its middle
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
        fz = c.fwd.z;
      // high on the street side, closing in as it pulls over
      const k = Math.min(1, a.t / 2);
      look.set(c.pos.x, c.pos.y + 1.2, c.pos.z);
      pos.set(
        c.pos.x + fz * 10 - fx * 12,
        c.pos.y + 9 + (1 - k) * 40,
        c.pos.z - fx * 10 - fz * 12,
      );
      return 2.6;
    }
    // up: back to the map
    const e = ease(Math.min(1, a.t / 2.2));
    WG.adoptMap.camera(dt, _p, _l);
    pos.lerpVectors(a.from, _p, e);
    look.lerpVectors(a.fromLook, _l, e);
    return 6;
  };

  WG.adoptCare = C;
})();
