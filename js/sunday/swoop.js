/* Waymo Care · Sunday Drive · the swoop down to a car that needs a hand. The aerial city lifts away, the arcade's street
   patch for that neighbourhood comes in with a couple of robotaxis, one pulls over with the need, and the real job from
   js/jobs.js plays (patience and scoring off). When it is done the camera glides back up to the same aerial view. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    City = WG.sundayCity;
  const K = W.SCALE;
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const S = { active: null };

  const fleetVisible = (on) => {
    for (const c of WG.Traffic.cars) c.parts.root.visible = on;
  };
  S.fleetVisible = fleetVisible;

  function street(a) {
    const g = WG.game;
    g.moveDistrict(a.zone);
    WG.Traffic.n = 3;
    WG.Traffic.reset();
    fleetVisible(true);
    City.show(false);
    WG.sundayClouds && WG.sundayClouds.show(false);
    g.mii.root.visible = true;
    a.street = true;
    a.above.set(W.center.x + 90, W.center.y + 150, W.center.z + 110);
    a.aboveLook.copy(W.center);
    if (W.look !== a.look) W.setLook(a.look);
  }

  function pickCar(a) {
    const g = WG.game,
      Traffic = WG.Traffic;
    const car = Traffic.cars.find((c) => c.canPull() && !c.problem);
    if (!car) return false;
    const p = { type: a.kind, max: 1, left: 1 };
    if (a.kind === "doors")
      p.doors = [0, 1, 2, 3]
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + ((Math.random() * 2) | 0));
    if (a.kind === "cone") p.n = 3 + ((Math.random() * 3) | 0);
    car.sundayName = a.name;
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
    g.startJob(car, { round: 1, done: (res) => jobEnd(a, res) });
  }

  function jobEnd(a, res) {
    const car = a.car,
      g = WG.game;
    if (car) {
      car.setProblem(null);
      car.state = "leaving";
      if (res) car.hop = 1;
    }
    a.res = res;
    a.phase = "up";
    a.t = 0;
    a.from.copy(g.camera.position);
    a.fromLook.set(0, 0, 0);
    g.camera.getWorldDirection(a.fromLook).multiplyScalar(30).add(a.from);
    g.setState("sunday");
    g.A.duck(false);
    g.A.sfx("whoosh");
    if (res && a.onDone) a.onDone(car, a.kind, res);
    if (!res && a.onCancel) a.onCancel(car, a.kind);
  }

  S.start = function (o) {
    const g = WG.game;
    if (S.active) return false;
    if (document.activeElement && document.activeElement.blur)
      document.activeElement.blur();
    const district = City.districts[o.district] || City.districts.lombard,
      hp = City.hoodPos(district.id);
    S.active = {
      car: null,
      kind: o.kind,
      district: o.district,
      name: o.name || "",
      zone: district.zone,
      look: district.look,
      onDone: o.onDone,
      onCancel: o.onCancel,
      phase: "down",
      t: 0,
      from: g.camera.position.clone(),
      fromLook: new T.Vector3(),
      above: new T.Vector3(hp.x + 160, hp.y + 260, hp.z + 220),
      aboveLook: new T.Vector3(hp.x, hp.y, hp.z),
      street: false,
    };
    g.camera
      .getWorldDirection(S.active.fromLook)
      .multiplyScalar(400)
      .add(g.camera.position);
    City.show(false);
    WG.sundayClouds && WG.sundayClouds.show(false);
    City.clearFocus();
    g.setState("sundayCare");
    g.A.sfx("whoosh");
    g.A.duck(true);
    return true;
  };

  S.abort = function () {
    const a = S.active;
    if (!a || a.phase === "job") return;
    if (a.car) {
      a.car.setProblem(null);
      a.car.state = "leaving";
    }
    const g = WG.game;
    fleetVisible(false);
    g.mii.root.visible = false;
    City.show(true);
    WG.sundayClouds && WG.sundayClouds.show(true);
    g.setState("sunday");
    g.A.duck(false);
    S.active = null;
  };

  S.update = function (dt) {
    const a = S.active;
    if (!a) return;
    a.t += dt;
    if (a.phase === "down") {
      if (!a.street && a.t > 0.8) street(a);
      if (a.street && a.t > 1.7 && !a.car) pickCar(a);
      // if the street has no car that can pull over, quietly return to the map
      if (a.t > 7 && !a.car) {
        if (a.onCancel) a.onCancel(null, a.kind);
        S.abort();
        return;
      }
    } else if (a.phase === "pull") {
      if (a.car && a.car.state === "problem" && a.t > 1.1) beginJob(a);
      if (a.t > 9 && a.car && a.car.state !== "problem") {
        a.car.setProblem(null);
        a.car.state = "leaving";
        a.car = null;
        a.phase = "down";
        a.t = 0;
        a.street = false;
        a.from.copy(WG.game.camera.position);
        WG.game.camera.getWorldDirection(a.fromLook).multiplyScalar(300).add(a.from);
        fleetVisible(false);
        WG.game.mii.root.visible = false;
        City.show(true);
        WG.sundayClouds && WG.sundayClouds.show(true);
      }
    } else if (a.phase === "up") {
      if (a.t > 0.9 && a.street) {
        fleetVisible(false);
        WG.game.mii.root.visible = false;
        City.show(true);
        WG.sundayClouds && WG.sundayClouds.show(true);
        a.street = false;
      }
      if (a.t > 2.5) S.active = null;
    }
  };

  const _p = new T.Vector3(),
    _l = new T.Vector3();
  S.camera = function (dt, pos, look) {
    const a = S.active;
    if (!a) return 4;
    if (a.phase === "down" || (a.phase === "pull" && !a.car)) {
      const e = ease(Math.min(1, a.t / 1.7));
      if (a.street) {
        a.aboveLook.copy(W.center);
        a.above.set(W.center.x + 90, W.center.y + 150, W.center.z + 110);
      }
      pos.lerpVectors(a.from, a.above, e);
      look.lerpVectors(a.fromLook, a.aboveLook, e);
      return 7;
    }
    if (a.phase === "pull" || a.phase === "job") {
      const c = a.car,
        fx = c.fwd.x,
        fz = c.fwd.z;
      const k = Math.min(1, a.t / 2);
      look.set(c.pos.x, c.pos.y + 1.2, c.pos.z);
      pos.set(
        c.pos.x + fz * 10 - fx * 12,
        c.pos.y + 9 + (1 - k) * 40,
        c.pos.z - fx * 10 - fz * 12,
      );
      return 2.6;
    }
    const e = ease(Math.min(1, a.t / 2.3));
    City.camera(dt, _p, _l);
    pos.lerpVectors(a.from, _p, e);
    look.lerpVectors(a.fromLook, _l, e);
    return 6;
  };

  WG.sundaySwoop = S;
})();
