/* Waymo Care · Sunday Drive · Swoop-In Minigames
   Smooth camera transitions between high-altitude city diorama and
   street-level 3D care jobs (from js/jobs.js, with timers disabled),
   dispatches collectible Rider Thank-You Notes, and awards Map Seals. */
(function () {
  "use strict";
  const WG = window.WG || (window.WG = {});
  const T = THREE;

  const RIDER_QUOTES = {
    GRANDMA: [
      "Such a polite crew, thank you dear!",
      "The car smells like fresh peppermint now. Wonderful!",
      "My knit blanket is safe and sound. Bless you all."
    ],
    ARTIST: [
      "My canvas didn't slide an inch, and the windows are spotless!",
      "The natural morning light through that clean windshield was pure poetry.",
      "Best mobile studio in town. Thanks for the quick wash!"
    ],
    LOCAL: [
      "Best pit crew in SF. Keep it easy.",
      "Smooth ride down the hills as always. Cheers!",
      "Ready for another thousand miles across the city."
    ],
    TOURIST: [
      "We took the most incredible photos through the clean roof!",
      "San Francisco has the coolest robot taxis on earth!",
      "Thank you for helping us make it to the cable car on time!"
    ],
    SURFER: [
      "Board fit great in the back, totally saved my morning session.",
      "No salt fog on the sensors, perfect cruise out to Ocean Beach.",
      "Righteous pit stop, my friends."
    ],
    BARISTA: [
      "Quickest morning commute up the hill. You guys rock!",
      "Left no crumbs behind! Have a stellar shift.",
      "Smooth sailing all the way to North Beach."
    ],
    TECHIE: [
      "Reboot was 10/10, zero latency.",
      "Clean telemetry all across the peninsula.",
      "Firmware running like a dream. Thank you!"
    ],
    CHEF: [
      "Delivered me and the sourdough starter right on time!",
      "Crisp and punctual. See you tomorrow morning!",
      "The produce stayed upright around every crooked curve."
    ]
  };

  const CHEERFUL_WORDS = ["Lovely!", "Sparkling!", "All Set!", "Wonderful!", "Splendid!", "Spick & Span!"];

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const Swoop = {
    active: null,
  };

  function start(car, needType, districtZone, onEnd) {
    const G = WG.game;
    if (!G) return false;

    if (Swoop.active) {
      if (Swoop.active.phase !== "up") return false;
      cleanupStreet();
      Swoop.active = null;
    }

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    const zone = districtZone || "lombard";
    const cam = G.camera;

    Swoop.active = {
      car,
      needType,
      zone,
      phase: "down",
      t: 0,
      fromPos: cam.position.clone(),
      fromLook: new T.Vector3(),
      abovePos: new T.Vector3(),
      aboveLook: new T.Vector3(),
      streetCar: null,
      streetLoaded: false,
      onEnd,
    };

    cam.getWorldDirection(Swoop.active.fromLook).multiplyScalar(300).add(cam.position);

    G.setState("sundayCare");
    G.A.sfx("whoosh");
    G.A.duck(true);
    return true;
  }

  function loadStreet(s) {
    const G = WG.game;
    G.moveDistrict(s.zone);

    // Hide aerial diorama elements, show street traffic
    if (WG.sundayCity) WG.sundayCity.setVisible(false);
    WG.Traffic.n = 2;
    WG.Traffic.reset();

    for (const c of WG.Traffic.cars) {
      c.parts.root.visible = true;
    }
    G.mii.root.visible = true;
    s.streetLoaded = true;
  }

  function setupJobCar(s) {
    const G = WG.game;
    const car = WG.Traffic.cars.find((c) => c.canPull() && !c.problem);
    if (!car) return false;

    // Configure need problem with no timer expiration
    const p = {
      type: s.needType,
      max: 99999, // Infinite patience!
      left: 99999,
    };

    if (s.needType === "doors") {
      p.doors = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
    }
    if (s.needType === "cone") {
      p.n = 3 + ((Math.random() * 2) | 0);
    }

    car.setProblem(p);
    car.pullOver();
    s.streetCar = car;
    s.phase = "pull";
    s.t = 0;
    return true;
  }

  function beginMinigame(s) {
    const G = WG.game;
    const car = s.streetCar;

    // Place crew member walking over
    const spot = car.parts.g.localToWorld(new T.Vector3(-2.6, 0, -4.5));
    G.P.pos.set(spot.x, WG.world.groundY(spot.x, spot.z), spot.z);
    G.P.path = [];
    G.P.speed = 0;
    G.restPose();
    s.phase = "job";

    G.startJob(car, {
      round: 1,
      done: (res) => onJobDone(s, res),
    });
  }

  function onJobDone(s, res) {
    const G = WG.game;
    const car = s.streetCar;
    if (car) {
      car.setProblem(null);
      car.state = "leaving";
      if (res) car.hop = 1;
    }

    if (res) {
      // Cheerful word & sparkles
      const word = CHEERFUL_WORDS[Math.floor(Math.random() * CHEERFUL_WORDS.length)];
      if (G.big) G.big(word, "go");
      G.A.sfx("sparkle");

      // Generate Thank-You Note
      const riderType = (s.car && s.car.passenger && s.car.passenger.rider) || "LOCAL";
      const quotes = RIDER_QUOTES[riderType] || RIDER_QUOTES.LOCAL;
      const quoteText = quotes[Math.floor(Math.random() * quotes.length)];

      const note = {
        rider: riderType,
        job: s.needType,
        text: quoteText,
      };

      if (WG.sunday) {
        WG.sunday.recordCared(note);
      }
    }

    // Resolve the need on the aerial car as well
    if (s.car) {
      s.car.need = null;
      s.car.needTime = 0;
      if (s.car.parts && s.car.parts.sprite) {
        s.car.parts.sprite.visible = false;
      }
    }

    // Prepare upward swoop back to city diorama
    s.phase = "up";
    s.t = 0;
    s.fromPos = G.camera.position.clone();
    s.fromLook = new T.Vector3();
    G.camera.getWorldDirection(s.fromLook).multiplyScalar(40).add(s.fromPos);

    G.setState("sunday");
    G.A.duck(false);
    G.A.sfx("whoosh");

    if (s.onEnd) s.onEnd(res);
  }

  function cleanupStreet() {
    const G = WG.game;
    for (const c of WG.Traffic.cars) {
      c.parts.root.visible = false;
    }
    if (G.mii) G.mii.root.visible = false;
    if (WG.sundayCity) WG.sundayCity.setVisible(true);
  }

  function update(dt) {
    const s = Swoop.active;
    if (!s) return;
    s.t += dt;

    if (s.phase === "down") {
      if (!s.streetLoaded && s.t > 0.7) {
        loadStreet(s);
      }
      if (s.streetLoaded && s.t > 1.5) {
        setupJobCar(s);
      }
    } else if (s.phase === "pull") {
      if (s.streetCar && s.streetCar.state === "problem" && s.t > 1.0) {
        beginMinigame(s);
      } else if (s.t > 6) {
        // Fallback in case car did not finish pulling over
        beginMinigame(s);
      }
    } else if (s.phase === "up") {
      if (s.t > 0.8 && s.streetLoaded) {
        cleanupStreet();
        s.streetLoaded = false;
      }
      if (s.t > 2.2) {
        Swoop.active = null;
      }
    }
  }

  const _p = new T.Vector3();
  const _l = new T.Vector3();

  function camera(dt, pos, look) {
    const s = Swoop.active;
    if (!s) return 2;
    const W = WG.world;

    if (s.phase === "down" || (s.phase === "pull" && !s.streetCar)) {
      const e = ease(Math.min(1, s.t / 1.5));
      if (s.streetLoaded && W) {
        s.aboveLook.copy(W.center);
        s.abovePos.set(W.center.x + 60, W.center.y + 110, W.center.z + 80);
      }
      pos.lerpVectors(s.fromPos, s.abovePos, e);
      look.lerpVectors(s.fromLook, s.aboveLook, e);
      return 6;
    }

    if (s.phase === "pull" || s.phase === "job") {
      const c = s.streetCar;
      if (c) {
        const fx = c.fwd.x, fz = c.fwd.z;
        const k = Math.min(1, s.t / 1.8);
        look.set(c.pos.x, c.pos.y + 1.2, c.pos.z);
        pos.set(
          c.pos.x + fz * 10 - fx * 12,
          c.pos.y + 8 + (1 - k) * 35,
          c.pos.z - fx * 10 - fz * 12
        );
      }
      return 2.5;
    }

    // Upward swoop back to aerial city camera
    const e = ease(Math.min(1, s.t / 2.0));
    if (WG.sundayCity) {
      WG.sundayCity.camera(dt, _p, _l);
    }
    pos.lerpVectors(s.fromPos, _p, e);
    look.lerpVectors(s.fromLook, _l, e);
    return 6;
  }

  const Module = {
    start,
    update,
    camera,
    get isActive() {
      return !!Swoop.active;
    },
    RIDER_QUOTES,
  };

  WG.sundaySwoop = Module;
})();
