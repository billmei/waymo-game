/* Waymo Care · Sunday Drive · State Controller & Main Mode Manager
   Handles game mode lifecycle, persistent save data in localStorage ("wc.sunday.v1"),
   Map Seal progression, UI bindings, and coordination between city, clouds,
   swoop minigames, photo mode, and postcard album. */
(function () {
  "use strict";
  const WG = window.WG || (window.WG = {});

  const STORAGE_KEY = "wc.sunday.v1";

  const DEFAULT_STATE = {
    version: 1,
    freeDrive: false,
    mapSeals: 0,
    totalCared: 0,
    faresDelivered: 0,
    unlockedDistricts: ["lombard"],
    postcards: {},
    thankYouNotes: [],
  };

  const Sunday = {
    active: false,
    state: null,
  };

  /* ---------- Persistent Save / Load ---------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          Sunday.state = Object.assign({}, DEFAULT_STATE, parsed);
          if (!Sunday.state.unlockedDistricts || !Sunday.state.unlockedDistricts.includes("lombard")) {
            Sunday.state.unlockedDistricts = ["lombard"];
          }
          return Sunday.state;
        }
      }
    } catch (e) {
      console.warn("Could not load Sunday Drive save:", e);
    }
    Sunday.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    return Sunday.state;
  }

  function saveState() {
    if (!Sunday.state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Sunday.state));
    } catch (e) {
      console.warn("Could not save Sunday Drive save:", e);
    }
    updateHUD();
  }

  /* ---------- Mode Lifecycle ---------- */
  function enter() {
    const G = WG.game;
    if (!G) return;
    Sunday.active = true;
    loadState();

    // Hide arcade screens and set state to sunday
    G.setState("sunday");
    if (G.mii && G.mii.root) G.mii.root.visible = false;

    // Show Sunday HUD
    const hud = document.getElementById("sunday-hud");
    if (hud) hud.hidden = false;

    // Initialize 3D City Diorama & Clouds
    if (WG.sundayCity) {
      WG.sundayCity.init(G.scene);
      WG.sundayCity.setVisible(true);
    }
    if (WG.sundayClouds) {
      WG.sundayClouds.init(G.scene);
    }

    // Dynamic Bossa Nova with unlocked stems
    if (WG.audio) {
      const uList = Sunday.state.freeDrive ? Object.keys(WG.sundayClouds.DISTRICTS) : Sunday.state.unlockedDistricts;
      WG.audio.setSundayStems(uList);
      G.A.music("title");
    }

    // Set gentle daylight look
    if (WG.world && WG.world.setLook) {
      WG.world.setLook("day");
    }

    bindUI();
    updateHUD();
  }

  function exit() {
    if (!Sunday.active) return;
    Sunday.active = false;
    saveState();

    const hud = document.getElementById("sunday-hud");
    if (hud) hud.hidden = true;

    if (WG.sundayCity) {
      WG.sundayCity.closeInspector();
      WG.sundayCity.setVisible(false);
    }
    if (WG.sundayPhoto && WG.sundayPhoto.active) {
      WG.sundayPhoto.exit();
    }
    if (WG.sundayAlbum) {
      WG.sundayAlbum.close();
    }

    // Reset audio back to standard
    if (WG.audio) {
      WG.audio.setSundayMusic(false);
    }

    const G = WG.game;
    if (G) {
      if (G.mii && G.mii.root) G.mii.root.visible = true;
      G.toTitle();
    }
  }

  /* ---------- Game Loop Hooks ---------- */
  function update(dt) {
    if (!Sunday.active) return;

    // 1. Photo Mode active
    if (WG.sundayPhoto && WG.sundayPhoto.active) {
      WG.sundayPhoto.update(dt);
      return;
    }

    // 2. 3D Swoop Minigame active
    if (WG.sundaySwoop && WG.sundaySwoop.isActive) {
      WG.sundaySwoop.update(dt);
      return;
    }

    // 3. Normal aerial city view
    const G = WG.game;
    if (WG.sundayClouds) {
      WG.sundayClouds.update(G ? G.t : 0, dt);
    }
    if (WG.sundayCity) {
      WG.sundayCity.update(dt);
    }
  }

  function camera(dt, wantPos, wantLook) {
    if (!Sunday.active) return 2.2;

    // 1. Photo Mode camera
    if (WG.sundayPhoto && WG.sundayPhoto.active) {
      return WG.sundayPhoto.camera(dt, wantPos, wantLook);
    }

    // 2. Swoop minigame camera
    if (WG.sundaySwoop && WG.sundaySwoop.isActive) {
      return WG.sundaySwoop.camera(dt, wantPos, wantLook);
    }

    // 3. Cloud-parting unlock ceremony camera
    if (WG.sundayClouds && WG.sundayClouds.isCeremonyActive) {
      return WG.sundayClouds.ceremonyCamera(dt, wantPos, wantLook);
    }

    // 4. Default bird's-eye city camera
    if (WG.sundayCity) {
      return WG.sundayCity.camera(dt, wantPos, wantLook);
    }

    return 4;
  }

  function pointer(type, e) {
    if (!Sunday.active) return;
    if (WG.sundayPhoto && WG.sundayPhoto.active) {
      WG.sundayPhoto.pointer(type, e);
      return;
    }
    if (WG.sundaySwoop && WG.sundaySwoop.isActive) {
      return;
    }
    if (WG.sundayCity) {
      WG.sundayCity.pointer(type, e);
    }
  }

  function key(e) {
    if (!Sunday.active) return false;

    // Toggle Photo Mode
    if (e.code === "KeyP") {
      if (WG.sundayPhoto) WG.sundayPhoto.toggle();
      return true;
    }

    // Close overlays / Return from Ride Along / Exit
    if (e.code === "Escape") {
      if (WG.sundayPhoto && WG.sundayPhoto.active) {
        WG.sundayPhoto.exit();
        return true;
      }
      const albumModal = document.getElementById("sunday-scrapbook");
      if (albumModal && !albumModal.hidden) {
        if (WG.sundayAlbum) WG.sundayAlbum.close();
        return true;
      }
      const insp = document.getElementById("sunday-inspector");
      if (insp && !insp.hidden) {
        if (WG.sundayCity) WG.sundayCity.closeInspector();
        return true;
      }
      if (WG.sundayCity && WG.sundayCity.cam.ride) {
        WG.sundayCity.cam.ride = null;
        return true;
      }
      // Return to title
      exit();
      return true;
    }

    if (WG.sundayPhoto && WG.sundayPhoto.active) {
      return WG.sundayPhoto.key(e);
    }
    if (WG.sundayCity) {
      return WG.sundayCity.key(e);
    }
    return false;
  }

  function after() {
    // Post-render step
  }

  /* ---------- Progression & Records ---------- */
  function awardSeal(reason) {
    Sunday.state.mapSeals++;
    saveState();

    const G = WG.game;
    if (G && G.A) G.A.sfx("sparkle");
    showToast(`🌟 +1 Map Seal! (${reason || "Goal Completed"})`);
  }

  function recordFare(car) {
    Sunday.state.faresDelivered++;
    if (Sunday.state.faresDelivered % 10 === 0) {
      awardSeal("10 Passenger Fares Delivered");
    } else {
      saveState();
    }
  }

  function recordCared(note) {
    Sunday.state.totalCared++;
    if (note) {
      Sunday.state.thankYouNotes.push(note);
    }
    if (Sunday.state.totalCared % 3 === 0) {
      awardSeal("3 Care Tasks Completed");
    } else {
      saveState();
    }
  }

  function recordPostcard(photoRecord, isNew) {
    if (!photoRecord) return;
    Sunday.state.postcards[photoRecord.landmarkId] = {
      capturedAt: photoRecord.capturedAt,
      hasWaymo: photoRecord.hasWaymo,
      filter: photoRecord.filter,
      photoId: photoRecord.id,
      name: photoRecord.landmarkName,
    };

    if (isNew) {
      awardSeal(`New Landmark Postcard: ${photoRecord.landmarkName}`);
    } else {
      saveState();
    }
  }

  function unlockDistrict(distId) {
    const dist = WG.sundayClouds.DISTRICTS[distId];
    if (!dist) return;

    if (Sunday.state.mapSeals < dist.seals) {
      showToast(`⚠️ Requires ${dist.seals} Map Seals to unlock!`);
      return;
    }

    Sunday.state.mapSeals -= dist.seals;
    if (!Sunday.state.unlockedDistricts.includes(distId)) {
      Sunday.state.unlockedDistricts.push(distId);
    }
    saveState();

    // Trigger Cloud-Parting Ceremony!
    WG.sundayClouds.startUnlockCeremony(distId, () => {
      // Dynamic bossa nova adds the next instrument stem!
      if (WG.audio) {
        WG.audio.setSundayStems(Sunday.state.unlockedDistricts);
      }
      // Spawn new Waymos and update traffic
      if (WG.sundayCity) {
        WG.sundayCity.spawnInitialFleet();
      }
      showToast(`🎉 Welcome to ${dist.title}!`);
    });
  }

  function toggleFreeDrive(enabled) {
    Sunday.state.freeDrive = !!enabled;
    saveState();

    if (WG.sundayClouds) {
      WG.sundayClouds.updateVisibility();
    }
    if (WG.audio) {
      const uList = Sunday.state.freeDrive ? Object.keys(WG.sundayClouds.DISTRICTS) : Sunday.state.unlockedDistricts;
      WG.audio.setSundayStems(uList);
    }
    if (WG.sundayCity) {
      WG.sundayCity.spawnInitialFleet();
    }

    showToast(enabled ? "🕊️ Free Drive Activated! All neighborhoods unlocked." : "🔒 Free Drive Disabled. Restored seal progression.");
  }

  function resetData() {
    Sunday.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    if (WG.sundayClouds) WG.sundayClouds.updateVisibility();
    if (WG.sundayCity) WG.sundayCity.spawnInitialFleet();
    if (WG.audio) WG.audio.setSundayStems(Sunday.state.unlockedDistricts);
    showToast("🔄 Sunday Drive data reset.");
  }

  /* ---------- UI Bindings & HUD ---------- */
  function bindUI() {
    const hud = document.getElementById("sunday-hud");
    if (!hud || hud.dataset.bound) return;
    hud.dataset.bound = "true";

    hud.querySelector("#sh-back").onclick = () => exit();

    hud.querySelector("#sh-album").onclick = () => {
      if (WG.sundayAlbum) WG.sundayAlbum.open("postcards");
    };

    hud.querySelector("#sh-photo").onclick = () => {
      if (WG.sundayPhoto) WG.sundayPhoto.enter();
    };

    hud.querySelector("#sh-settings").onclick = () => {
      if (WG.sundayAlbum) WG.sundayAlbum.open("settings");
    };

    // Scrapbook Modal tab controls
    const sb = document.getElementById("sunday-scrapbook");
    if (sb) {
      sb.querySelectorAll(".sb-tab-btn").forEach((btn) => {
        btn.onclick = () => {
          if (WG.sundayAlbum) WG.sundayAlbum.switchTab(btn.dataset.tab);
        };
      });
      sb.querySelector(".sb-close").onclick = () => {
        if (WG.sundayAlbum) WG.sundayAlbum.close();
      };
      const lbClose = document.getElementById("lb-close");
      if (lbClose) {
        lbClose.onclick = () => {
          if (WG.sundayAlbum) WG.sundayAlbum.closeLightbox();
        };
      }
    }
  }

  function updateHUD() {
    const hud = document.getElementById("sunday-hud");
    if (!hud || !Sunday.state) return;

    const sealsEl = hud.querySelector("#sh-seals-val");
    if (sealsEl) sealsEl.textContent = Sunday.state.mapSeals || 0;

    const faresEl = hud.querySelector("#sh-fares-val");
    if (faresEl) faresEl.textContent = Sunday.state.faresDelivered || 0;

    const cardsEl = hud.querySelector("#sh-cards-val");
    if (cardsEl) {
      const count = Object.keys(Sunday.state.postcards || {}).length;
      cardsEl.textContent = `${count}/37`;
    }
  }

  function showToast(msg) {
    let t = document.getElementById("sunday-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "sunday-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3500);
  }

  const Module = {
    get active() {
      return Sunday.active;
    },
    get state() {
      return Sunday.state;
    },
    enter,
    exit,
    update,
    camera,
    pointer,
    key,
    after,
    awardSeal,
    recordFare,
    recordCared,
    recordPostcard,
    unlockDistrict,
    toggleFreeDrive,
    resetData,
    showToast,
  };

  WG.sunday = Module;
})();
