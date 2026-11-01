/* Waymo Care · Sunday Drive · Cloud Shroud & Map Expansion
   Billowing sea-cloud particle shrouds over locked districts,
   smooth particle bobbing, and the cloud-parting unlock ceremony. */
(function () {
  "use strict";
  const WG = window.WG || (window.WG = {});
  const T = THREE;

  const DISTRICTS = {
    lombard: {
      id: "lombard",
      name: "Russian Hill",
      title: "Russian Hill & Telegraph Hill",
      zone: "lombard",
      seals: 0,
      x: 672,
      z: -1968,
      r: 320,
      landmark: "Coit Tower",
      lore: "Steep sunny hills, crooked Lombard brick hairpins, and sweeping views of Alcatraz and the bay.",
      stem: "ep",
      color: 0x38bdf8
    },
    downtown: {
      id: "downtown",
      name: "Downtown / FiDi",
      title: "Downtown & Financial District",
      zone: "downtown",
      seals: 2,
      x: 1840,
      z: -1216,
      r: 340,
      landmark: "Transamerica Pyramid",
      lore: "Soaring towers of glass and steel, lunch-rush bustle, and dramatic shadows stretching across Market Street.",
      stem: "bass",
      color: 0x3b82f6
    },
    presidio: {
      id: "presidio",
      name: "The Presidio",
      title: "The Presidio & Marina",
      zone: "presidio",
      seals: 4,
      x: -1760,
      z: -1952,
      r: 380,
      landmark: "Golden Gate Bridge",
      lore: "Coastal cypress breezes, Golden Gate Bridge vistas, and sea gulls wheeling over Crissy Field.",
      stem: "vibes",
      color: 0x10b981
    },
    ladies: {
      id: "ladies",
      name: "Alamo Square",
      title: "Alamo Square & Painted Ladies",
      zone: "ladies",
      seals: 6,
      x: 528,
      z: -896,
      r: 320,
      landmark: "Painted Ladies",
      lore: "Perpetual golden hour glow, Victorian gingerbread trim, and peaceful park picnics on the green hillside.",
      stem: "drums",
      color: 0xf59e0b
    },
    windmills: {
      id: "windmills",
      name: "Ocean Beach",
      title: "Ocean Beach & The Windmills",
      zone: "windmills",
      seals: 8,
      x: -2848,
      z: 480,
      r: 380,
      landmark: "Dutch Windmill",
      lore: "Karl the Fog rolling softly over coastal dunes, salt sea spray, and historic wooden windmills turning in the sea breeze.",
      stem: "brass",
      color: 0x8b5cf6
    },
    twinpeaks: {
      id: "twinpeaks",
      name: "Twin Peaks",
      title: "Twin Peaks & Scenic Heights",
      zone: "twinpeaks",
      seals: 10,
      x: 0,
      z: 0,
      r: 360,
      landmark: "Twin Peaks",
      lore: "The breezy highest summits of San Francisco with panoramic views stretching across the entire bay peninsula.",
      stem: "full",
      color: 0xec4899
    }
  };

  const CL = {
    group: null,
    clusters: new Map(), // districtId -> array of sprite objects
    ceremony: null,      // active unlocking ceremony animation
    puffMat: null,
  };

  function init(scene) {
    if (CL.group) scene.remove(CL.group);
    CL.group = new T.Group();
    CL.group.renderOrder = 8;
    scene.add(CL.group);

    const tex = (WG.world && WG.world.puffTex) ? WG.world.puffTex() : createPuffTexture();
    CL.puffMat = new T.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      color: 0xf0f5f9,
    });

    // Create cloud clusters for all districts
    for (const key in DISTRICTS) {
      createCluster(DISTRICTS[key]);
    }

    updateVisibility();
  }

  function createPuffTexture() {
    const pc = document.createElement("canvas");
    pc.width = pc.height = 128;
    const px = pc.getContext("2d");
    const gr = px.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.45, "rgba(245,250,255,0.65)");
    gr.addColorStop(1, "rgba(240,248,255,0)");
    px.fillStyle = gr;
    px.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(pc);
  }

  function createCluster(dist) {
    const puffs = [];
    const count = 22;
    const W = WG.world;

    for (let i = 0; i < count; i++) {
      const sp = new T.Sprite(CL.puffMat.clone());
      const rad = Math.random() * dist.r;
      const ang = Math.random() * Math.PI * 2;
      const px = dist.x + Math.cos(ang) * rad;
      const pz = dist.z + Math.sin(ang) * rad;
      const ground = W ? W.groundY(px, pz) : 20;
      const py = ground + 32 + Math.random() * 45;
      const sz = 75 + Math.random() * 65;

      sp.scale.set(sz, sz * 0.58, 1);
      sp.position.set(px, py, pz);
      sp.userData = {
        baseX: px,
        baseY: py,
        baseZ: pz,
        baseScale: sz,
        speed: 0.8 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        radOffset: rad,
        ang,
      };

      CL.group.add(sp);
      puffs.push(sp);
    }

    CL.clusters.set(dist.id, puffs);
  }

  function updateVisibility() {
    const st = WG.sunday ? WG.sunday.state : null;
    const unlocked = (st && st.unlockedDistricts) ? new Set(st.unlockedDistricts) : new Set(["lombard"]);
    const isFreeDrive = st && st.freeDrive;

    for (const [id, puffs] of CL.clusters.entries()) {
      const isLocked = !isFreeDrive && !unlocked.has(id);
      for (const sp of puffs) {
        // If an unlock ceremony is in progress for this cluster, let ceremony animate it
        if (CL.ceremony && CL.ceremony.districtId === id) continue;
        sp.visible = isLocked;
        sp.material.opacity = isLocked ? 0.88 : 0;
      }
    }
  }

  function update(t, dt) {
    if (!CL.group) return;

    // Bobbing clouds animation
    for (const [id, puffs] of CL.clusters.entries()) {
      for (const sp of puffs) {
        if (!sp.visible) continue;
        const u = sp.userData;
        sp.position.y = u.baseY + Math.sin(t * u.speed + u.phase) * 5;
        sp.position.x = u.baseX + Math.cos(t * 0.4 + u.phase) * 6;
      }
    }

    // Active Unlock Ceremony animation
    if (CL.ceremony) {
      updateCeremony(dt);
    }
  }

  /* ---------- Unlock Ceremony ---------- */
  function startUnlockCeremony(distId, onComplete) {
    const dist = DISTRICTS[distId];
    if (!dist) return;
    const puffs = CL.clusters.get(distId) || [];
    const G = WG.game;

    // Wind gust sound & chime
    if (G && G.A) {
      G.A.sfx("whoosh");
      setTimeout(() => G.A.sfx("sparkle"), 600);
    }

    CL.ceremony = {
      districtId: distId,
      dist,
      puffs,
      t: 0,
      duration: 3.2,
      onComplete,
      startCamPos: (G && G.camera) ? G.camera.position.clone() : new T.Vector3(dist.x + 100, 600, dist.z + 100),
      targetCamPos: new T.Vector3(dist.x + 180, 240, dist.z + 260),
      targetLook: new T.Vector3(dist.x, 30, dist.z),
    };
  }

  function updateCeremony(dt) {
    const c = CL.ceremony;
    if (!c) return;
    c.t += dt;
    const progress = Math.min(1, c.t / c.duration);
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Disperse cloud puffs outward and fade out
    for (const sp of c.puffs) {
      const u = sp.userData;
      const expand = 1 + progress * 2.5;
      sp.scale.set(u.baseScale * expand, u.baseScale * 0.58 * expand, 1);
      sp.material.opacity = Math.max(0, 0.88 * (1 - progress * 1.2));
      sp.position.x = distCenter(c.dist.x, u.baseX, expand);
      sp.position.z = distCenter(c.dist.z, u.baseZ, expand);
      sp.position.y = u.baseY + progress * 80;
    }

    if (progress >= 1) {
      for (const sp of c.puffs) {
        sp.visible = false;
        sp.material.opacity = 0;
      }
      const doneCb = c.onComplete;
      CL.ceremony = null;
      if (doneCb) doneCb();
    }
  }

  function distCenter(center, pos, factor) {
    return center + (pos - center) * factor;
  }

  function ceremonyCamera(dt, pos, look) {
    if (!CL.ceremony) return 2;
    const c = CL.ceremony;
    const progress = Math.min(1, c.t / c.duration);
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Smooth swoop to center on the newly opened district
    pos.lerpVectors(c.startCamPos, c.targetCamPos, ease);
    look.copy(c.targetLook);

    // Orbit arc around the landmark during the second half
    if (progress > 0.4) {
      const ang = (progress - 0.4) * 1.8;
      pos.x = c.dist.x + Math.sin(ang) * 320;
      pos.z = c.dist.z + Math.cos(ang) * 320;
      pos.y = 160 + Math.sin(progress * Math.PI) * 40;
    }
    return 6;
  }

  /* ---------- District Click / Inspector ---------- */
  function getDistrictAt(x, z) {
    for (const key in DISTRICTS) {
      const d = DISTRICTS[key];
      const dist = Math.hypot(x - d.x, z - d.z);
      if (dist < d.r) return d;
    }
    return null;
  }

  const Clouds = {
    DISTRICTS,
    init,
    update,
    updateVisibility,
    startUnlockCeremony,
    ceremonyCamera,
    getDistrictAt,
    get isCeremonyActive() {
      return !!CL.ceremony;
    }
  };

  WG.sundayClouds = Clouds;
})();
